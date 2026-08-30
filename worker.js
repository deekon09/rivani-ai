const JSON_HEADERS = { 'content-type': 'application/json; charset=UTF-8' };
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_LOGIN_SECONDS = 10 * 60;
const LUKI_MAX_MESSAGE = 500;
const LUKI_MAX_HISTORY = 8;
const LUKI_HOURLY_LIMIT = 30;

const LUKI_SYSTEM_PROMPT = `You are LUKI, the official RIVANI AI website assistant.

CORE BEHAVIOR
- Always answer in clear English, even if the user's spelling, grammar, or wording is poor.
- Understand natural questions, short questions, typos, and conversational wording.
- Your scope is RIVANI AI only. Do not become a general-purpose chatbot.
- If a question is unrelated to RIVANI AI, politely say: "I can only help with RIVANI AI, its tools, account, plans, policies, and website features."
- Never invent a feature, price, tool status, technical implementation, or policy.
- If information is not in this knowledge base, say that it has not been published or finalized yet.
- Be concise but useful. Prefer 2-6 short sentences unless the user asks for more detail.
- When relevant, name the correct page or guide the user can open.

RIVANI AI BRAND
- Brand: RIVANI AI.
- Slogan: "Smarter Tools. Better Results."
- RIVANI AI is a multi-tool AI platform built around focused utilities rather than one general-purpose chatbot.
- Main categories: audio, image, video, PDF/documents, and text.
- The platform aims to show clear inputs, visible tool status, processing disclosures, previews where useful, and simple exports.

CURRENT TOOL STATUS
1. AI Audio Repair — flagship, in development.
   Purpose: improve real-world voice recordings affected by background noise, room echo, hiss, uneven loudness, and difficult phone/laptop microphone audio.
   Intended workflow: upload supported audio, scan common quality problems, choose a repair style such as Natural/Clean/Studio, preview before/after, export the repaired result.
   Useful for: podcasts/interviews, YouTube/Reels voiceovers, lectures/classrooms, phone and voice-note recordings.
   Limits: severely clipped audio may not be recoverable; overlapping speakers can remain difficult; aggressive enhancement can sound unnatural.
   Guide: article-audio-repair.html

2. Image Enhancer — planned.
   Purpose: improve clarity and perceived detail in low-quality images with preview before export.
   Guide: article-image-enhancer.html

3. Background Remover — planned.
   Purpose: isolate the main subject and export a transparent result; useful for profile pictures, products, and creator graphics.
   Guide: article-background-remover.html

4. Video Subtitle Generator — planned.
   Purpose: turn speech into caption-ready text for creator workflows.
   Guide: article-video-subtitles.html

5. PDF Assistant — planned.
   Purpose: extract, organize, search, summarize, and explain document information with a focused PDF interface.
   Guide: article-pdf-assistant.html

6. Text Tools — planned.
   Purpose: focused rewrite, cleanup, translation, grammar/formatting and similar writing utilities.
   Guide: article-text-tools.html

WEBSITE PAGES
- Homepage: index.html
- Features: features.html
- About: about.html
- Articles/tool guides: articles.html
- Privacy Policy: privacy.html
- Terms of Use: terms.html
- Acceptable Use Policy: acceptable-use.html
- Cookie Policy: cookies.html
- Login/signup: auth.html
- User dashboard: dashboard.html

ACCOUNT SYSTEM
- Authentication uses Firebase Authentication.
- Supported sign-in methods: email/password and Google. Facebook is not used.
- Email/password signup asks for username, email, password, confirm password, and Terms/Privacy acceptance.
- Username rule: 3-20 characters, letters and numbers only. No spaces, @ signs, dots, underscores, or other symbols.
- Password rule: 8-64 characters; first character must be uppercase; include at least one lowercase letter, one number, one special character; no spaces.
- After successful signup, the user is signed out and shown an Account Created Successfully page, then must log in.
- After successful login, the dashboard opens.
- Google signup also requires choosing a valid RIVANI username and accepting Terms/Privacy.

DASHBOARD AND PLANS
- Dashboard shows profile/account information, sign-in method, membership information, security information, plan status, logout, and deletion controls.
- Current default plan for new users: Free.
- Pro and Premium are future tiers and cannot be purchased yet.
- Billing/payment is not connected yet. Do not state prices or paid limits because they have not been finalized.

ACCOUNT DELETION
- A signed-in user can request account deletion from the dashboard.
- The exact account username must be confirmed and the 7-day deletion notice acknowledged.
- For security, the deletion request requires a recent login.
- After the deletion request is successfully scheduled, the website signs the user out automatically.
- The account enters a 7-day grace period. The user can log back in during that grace period and cancel the deletion from the dashboard.
- After the deadline, a Cloudflare scheduled backend job permanently deletes the Firebase Authentication account. Processing may occur shortly after the exact 7-day timestamp because it runs on a schedule.
- The deletion-request record is removed after successful permanent deletion.

PRIVACY AND FILE HANDLING
- RIVANI AI has Privacy, Terms, Acceptable Use, and Cookie pages.
- Tool-specific file processing must be disclosed before processing starts.
- Some future tools may process locally in the browser and others may use remote services; RIVANI AI should not claim local-only processing unless that implementation is actually in use.
- Standard technical data may be processed to operate and secure the service.
- Authentication providers and AI-processing providers may process data under their own terms when those integrations are enabled.

POLICY PRINCIPLES
- Users are responsible for having rights/permission for submitted content.
- AI-generated or modified output can contain errors or artifacts and should be reviewed.
- Users may not use RIVANI AI for illegal activity, privacy invasion, deceptive impersonation, malware, attacks, bypassing security/rate limits, or accessing another user's data.
- Current policy pages are drafts for the present product direction and should be updated as commercial features, pricing, storage, and real processing are finalized.

LUKI
- LUKI is the RIVANI AI help assistant shown on the side of the website.
- LUKI answers questions about RIVANI AI tools, features, current status, accounts, plans, policies, file handling, and navigation.
- LUKI should not claim that planned tools are already live.
- LUKI messages are processed server-side. Gemini is the primary provider, GroqCloud is the first fallback, and Cloudflare Workers AI is the final fallback when configured. Provider keys are never exposed in frontend browser code.
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return json({
          ok: true,
          service: 'rivani-account-api',
          luki: {
            geminiConfigured: Boolean(env.GEMINI_API_KEY),
            groqConfigured: Boolean(env.GROQ_API_KEY),
            cloudflareAIConfigured: Boolean(env.AI),
            cloudflareModel: String(env.CLOUDFLARE_AI_MODEL || '@cf/google/gemma-4-26b-a4b-it'),
            primary: String(env.LUKI_PRIMARY_PROVIDER || 'gemini').toLowerCase()
          }
        }, 200, cors);
      }

      if (url.pathname === '/api/luki/chat' && request.method === 'POST') {
        return await handleLukiChat(request, env, cors);
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
      console.error('RIVANI API error:', code, error?.message || error);
      return json({ error: code, message }, status, cors);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(Promise.all([
      processDueDeletions(env),
      cleanupLukiRateLimits(env)
    ]));
  }
};

async function handleLukiChat(request, env, cors) {
  if (!env.GEMINI_API_KEY && !env.GROQ_API_KEY && !env.AI) {
    throw httpError(503, 'LUKI_NOT_CONFIGURED', 'LUKI AI is being configured. Please try again later.');
  }

  await enforceLukiRateLimit(request, env);
  const body = await safeJson(request);
  const message = String(body?.message || '').trim();

  if (!message) throw httpError(400, 'MESSAGE_REQUIRED', 'Please type a question for LUKI.');
  if (message.length > LUKI_MAX_MESSAGE) {
    throw httpError(400, 'MESSAGE_TOO_LONG', `Please keep your question under ${LUKI_MAX_MESSAGE} characters.`);
  }

  const history = sanitizeLukiHistory(body?.history);
  const primaryRaw = String(env.LUKI_PRIMARY_PROVIDER || 'gemini').toLowerCase();
  const primary = ['gemini', 'groq', 'cloudflare'].includes(primaryRaw) ? primaryRaw : 'gemini';

  const order =
    primary === 'groq'
      ? ['groq', 'gemini', 'cloudflare']
      : primary === 'cloudflare'
        ? ['cloudflare', 'gemini', 'groq']
        : ['gemini', 'groq', 'cloudflare'];

  const failures = [];

  for (const provider of order) {
    try {
      if (provider === 'gemini' && env.GEMINI_API_KEY) {
        const answer = await askGemini(env, message, history);
        if (answer) return json({ ok: true, answer, provider: 'gemini' }, 200, cors);
      }

      if (provider === 'groq' && env.GROQ_API_KEY) {
        const answer = await askGroq(env, message, history);
        if (answer) return json({ ok: true, answer, provider: 'groq' }, 200, cors);
      }

      if (provider === 'cloudflare' && env.AI) {
        const answer = await askCloudflareAI(env, message, history);
        if (answer) return json({ ok: true, answer, provider: 'cloudflare' }, 200, cors);
      }
    } catch (error) {
      failures.push(`${provider}: ${String(error?.message || error).slice(0, 300)}`);
      console.error('LUKI provider failed:', provider, error?.message || error);
    }
  }

  console.error('All LUKI providers failed:', failures.join(' | '));
  throw httpError(503, 'LUKI_TEMPORARILY_UNAVAILABLE', 'LUKI is temporarily unavailable. Please try again in a moment.');
}

async function askGemini(env, message, history) {
  const model = String(env.GEMINI_MODEL || 'gemini-2.5-flash-lite');
  const contents = history.map(item => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.content }]
  }));
  contents.push({ role: 'user', parts: [{ text: message }] });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: LUKI_SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 400
        }
      })
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${JSON.stringify(data).slice(0, 450)}`);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map(part => part?.text || '')
    .join('\n')
    .trim();
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

async function askGroq(env, message, history) {
  const model = String(env.GROQ_MODEL || 'openai/gpt-oss-20b');
  const messages = [
    { role: 'system', content: LUKI_SYSTEM_PROMPT },
    ...history.map(item => ({ role: item.role, content: item.content })),
    { role: 'user', content: message }
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_completion_tokens: 400
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Groq ${response.status}: ${JSON.stringify(data).slice(0, 450)}`);
  }

  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('Groq returned an empty response.');
  return text;
}

async function askCloudflareAI(env, message, history) {
  if (!env.AI) throw new Error('Cloudflare Workers AI binding is not configured.');

  const model = String(env.CLOUDFLARE_AI_MODEL || '@cf/google/gemma-4-26b-a4b-it');
  const messages = [
    { role: 'system', content: LUKI_SYSTEM_PROMPT },
    ...history.map(item => ({ role: item.role, content: item.content })),
    { role: 'user', content: message }
  ];

  const result = await env.AI.run(model, {
    messages,
    temperature: 0.2,
    max_tokens: 400
  });

  const text = String(
    result?.response ??
    result?.result?.response ??
    result?.choices?.[0]?.message?.content ??
    ''
  ).trim();

  if (!text) {
    throw new Error(`Cloudflare Workers AI returned an empty response: ${JSON.stringify(result).slice(0, 400)}`);
  }

  return text;
}

function sanitizeLukiHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-LUKI_MAX_HISTORY).flatMap(item => {
    const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : '';
    const content = String(item?.content || '').trim().slice(0, LUKI_MAX_MESSAGE);
    return role && content ? [{ role, content }] : [];
  });
}

async function enforceLukiRateLimit(request, env) {
  if (!env.DB) return;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const clientHash = await sha256(`${ip}|rivani-luki-v1`);
  const bucket = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH in UTC
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO luki_rate_limits (client_hash, bucket, count, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(client_hash, bucket) DO UPDATE SET
       count = count + 1,
       updated_at = excluded.updated_at`
  ).bind(clientHash, bucket, now).run();

  const row = await env.DB.prepare(
    `SELECT count FROM luki_rate_limits WHERE client_hash = ? AND bucket = ?`
  ).bind(clientHash, bucket).first();

  if (Number(row?.count || 0) > LUKI_HOURLY_LIMIT) {
    throw httpError(429, 'LUKI_RATE_LIMIT', 'You have reached the current LUKI message limit. Please try again later.');
  }
}

async function cleanupLukiRateLimits(env) {
  if (!env.DB) return;
  const cutoff = Date.now() - (48 * 60 * 60 * 1000);
  try {
    await env.DB.prepare(`DELETE FROM luki_rate_limits WHERE updated_at < ?`).bind(cutoff).run();
  } catch (error) {
    // Allows deletion cron to keep working even before the optional LUKI table is created.
    console.error('LUKI rate-limit cleanup skipped:', error?.message || error);
  }
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

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
        if (!/USER_NOT_FOUND/i.test(text)) {
          throw new Error(`Firebase delete failed (${response.status}): ${text.slice(0, 500)}`);
        }
      }

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
