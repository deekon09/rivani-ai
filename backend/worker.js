const JSON_HEADERS = { 'content-type': 'application/json; charset=UTF-8' };
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_LOGIN_SECONDS = 10 * 60;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return json({ ok: true, service: 'rivani-account-api' }, 200, cors);
      }

      if (!url.pathname.startsWith('/api/account-deletion/')) {
        return json({ error: 'Not found' }, 404, cors);
      }

      const user = await authenticateFirebaseUser(request, env);

      if (url.pathname === '/api/account-deletion/status' && request.method === 'GET') {
        const row = await env.DB.prepare(
          `SELECT requested_at, delete_at, status, retry_count
           FROM account_deletions WHERE uid = ?`
        ).bind(user.uid).first();

        return json({
          pending: Boolean(row && row.status === 'pending'),
          request: row ? {
            requestedAt: row.requested_at,
            deleteAt: row.delete_at,
            status: row.status,
            retryCount: row.retry_count
          } : null
        }, 200, cors);
      }

      if (url.pathname === '/api/account-deletion/request' && request.method === 'POST') {
        requireRecentLogin(user);
        const body = await safeJson(request);
        const suppliedUsername = String(body?.username || '').trim();
        const expectedUsername = String(user.displayName || '').trim();

        if (!expectedUsername) {
          throw httpError(400, 'USERNAME_MISSING', 'This account does not have a username yet.');
        }
        if (!suppliedUsername || suppliedUsername !== expectedUsername) {
          throw httpError(400, 'USERNAME_MISMATCH', 'Username does not match this account.');
        }
        if (body?.acknowledged !== true) {
          throw httpError(400, 'ACK_REQUIRED', 'Please confirm the 7-day deletion notice.');
        }

        const now = Date.now();
        const deleteAt = now + SEVEN_DAYS_MS;
        await env.DB.prepare(
          `INSERT INTO account_deletions
           (uid, email, username, requested_at, delete_at, status, retry_count, last_error, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, ?)
           ON CONFLICT(uid) DO UPDATE SET
             email = excluded.email,
             username = excluded.username,
             requested_at = excluded.requested_at,
             delete_at = excluded.delete_at,
             status = 'pending',
             retry_count = 0,
             last_error = NULL,
             updated_at = excluded.updated_at`
        ).bind(user.uid, user.email || null, expectedUsername, now, deleteAt, now).run();

        return json({
          ok: true,
          pending: true,
          requestedAt: now,
          deleteAt
        }, 200, cors);
      }

      if (url.pathname === '/api/account-deletion/cancel' && request.method === 'POST') {
        await env.DB.prepare(
          `DELETE FROM account_deletions WHERE uid = ? AND status = 'pending'`
        ).bind(user.uid).run();

        return json({ ok: true, pending: false }, 200, cors);
      }

      return json({ error: 'Method not allowed' }, 405, cors);
    } catch (error) {
      const status = Number(error?.status || 500);
      const code = error?.code || 'SERVER_ERROR';
      const message = status >= 500 ? 'Something went wrong on the account service.' : error.message;
      console.error('RIVANI account API error:', code, error?.message || error);
      return json({ error: code, message }, status, cors);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(processDueDeletions(env));
  }
};

async function processDueDeletions(env) {
  const now = Date.now();
  const { results = [] } = await env.DB.prepare(
    `SELECT uid, retry_count
     FROM account_deletions
     WHERE status = 'pending' AND delete_at <= ? AND retry_count < 10
     ORDER BY delete_at ASC
     LIMIT 100`
  ).bind(now).all();

  if (!results.length) return;
  const accessToken = await getServiceAccountAccessToken(env);

  for (const row of results) {
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/accounts:delete`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify({ localId: row.uid })
        }
      );

      if (!response.ok) {
        const text = await response.text();
        // If the account is already gone, the desired end state is reached.
        if (!/USER_NOT_FOUND/i.test(text)) {
          throw new Error(`Firebase delete failed (${response.status}): ${text.slice(0, 500)}`);
        }
      }

      // Remove the deletion record too, minimizing retained account data.
      await env.DB.prepare(`DELETE FROM account_deletions WHERE uid = ?`).bind(row.uid).run();
    } catch (error) {
      const retryCount = Number(row.retry_count || 0) + 1;
      await env.DB.prepare(
        `UPDATE account_deletions
         SET retry_count = ?, last_error = ?, updated_at = ?
         WHERE uid = ?`
      ).bind(retryCount, String(error?.message || error).slice(0, 1000), Date.now(), row.uid).run();
      console.error('Deletion retry scheduled:', row.uid, retryCount, error?.message || error);
    }
  }
}

async function authenticateFirebaseUser(request, env) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw httpError(401, 'AUTH_REQUIRED', 'Please sign in again.');
  const idToken = match[1];

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
    {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ idToken })
    }
  );

  const data = await response.json().catch(() => ({}));
  const record = data?.users?.[0];
  if (!response.ok || !record) {
    throw httpError(401, 'INVALID_SESSION', 'Your session is no longer valid. Please sign in again.');
  }

  const payload = decodeJwtPayload(idToken);
  return {
    uid: record.localId,
    email: record.email || '',
    displayName: record.displayName || '',
    authTime: Number(payload?.auth_time || 0)
  };
}

function requireRecentLogin(user) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!user.authTime || (nowSeconds - user.authTime) > RECENT_LOGIN_SECONDS) {
    throw httpError(401, 'RECENT_LOGIN_REQUIRED', 'For security, log out and sign in again before scheduling account deletion.');
  }
}

async function getServiceAccountAccessToken(env) {
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_PROJECT_ID) {
    throw new Error('Missing Firebase service-account configuration.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const claims = base64UrlJson({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/identitytoolkit',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  });
  const unsigned = `${header}.${claims}`;

  const privateKey = String(env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  const assertion = `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(`Could not obtain Google access token: ${JSON.stringify(tokenData).slice(0, 500)}`);
  }
  return tokenData.access_token;
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = env.ALLOWED_ORIGIN || 'https://rivani-ai.rivani.workers.dev';
  const headers = {
    ...JSON_HEADERS,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type',
    'access-control-max-age': '86400',
    'vary': 'Origin'
  };
  if (origin === allowed) headers['access-control-allow-origin'] = origin;
  return headers;
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

async function safeJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

function base64UrlJson(value) {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlBytes(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
