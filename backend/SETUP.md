# RIVANI AI — Real 7-day account deletion setup

This backend stores a signed-in user's deletion request in Cloudflare D1, allows cancellation during the 7-day grace period, and uses an hourly Cloudflare Cron Trigger to permanently delete the Firebase Authentication user after the deadline.

## Never publish these values

Do NOT put the Firebase service-account JSON, `private_key`, or any service-account secret in GitHub or website JavaScript.

## Cloudflare resources

1. Create a D1 database named `rivani-account-data`.
2. Open its Console and run all SQL from `schema.sql`.
3. Create a new Worker named `rivani-account-api` and paste `worker.js` into it.
4. Add a D1 binding named exactly `DB` pointing to `rivani-account-data`.

## Worker variables / secrets

In Worker Settings > Variables and Secrets add:

- `FIREBASE_WEB_API_KEY` = the Firebase web API key already used by the website.
- `FIREBASE_PROJECT_ID` = `rivani-ai`
- `ALLOWED_ORIGIN` = `https://rivani-ai.rivani.workers.dev`
- `FIREBASE_CLIENT_EMAIL` = `client_email` from the Firebase service-account JSON.
- `FIREBASE_PRIVATE_KEY` = `private_key` from the Firebase service-account JSON. Add this as a SECRET, not plain text.

For the service account, use Firebase Console > Project settings > Service accounts > Generate new private key. Store that downloaded JSON securely and do not commit it.

## Cron Trigger

Add this Cron Trigger to the account Worker:

`0 * * * *`

It runs once per hour. Therefore permanent deletion happens after the 7-day deadline, normally within the next hourly cron run rather than at the exact second.

## Website endpoint

The website file `assets/runtime-config.js` is already set to:

`https://rivani-account-api.rivani.workers.dev`

If Cloudflare gives your account Worker a different URL, change only `deletionApiBase` in that file.

## Test checklist

1. Deploy the account Worker and open `/health`; it should return JSON with `ok: true`.
2. Deploy the updated website.
3. Log in to RIVANI AI.
4. Open Dashboard > Security > Delete account.
5. If your login is older than 10 minutes, log out and log back in first.
6. Type the exact username, tick the notice, and submit.
7. Refresh the dashboard. The deletion banner must still be present; that confirms the request is server-side, not localStorage.
8. Click Cancel deletion request and refresh. The banner should be gone.

For a safe production test, do not wait seven days on your primary account. Create a throwaway Firebase user and temporarily change `SEVEN_DAYS_MS` in `worker.js` to a short test period, then restore it before launch.
