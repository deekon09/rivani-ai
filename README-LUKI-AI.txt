RIVANI AI V6 — LUKI AI + AUTO LOGOUT AFTER DELETION REQUEST

WHAT CHANGED
1. After a deletion request is successfully scheduled, Firebase signs the user out automatically and redirects to the login page.
2. The login page explains that deletion is scheduled and can be cancelled by logging back in within 7 days.
3. LUKI now calls the Cloudflare backend instead of relying only on keyword rules.
4. Gemini is the default primary provider; Groq is an automatic fallback.
5. API keys stay in Cloudflare Worker Secrets, never in frontend files.
6. LUKI always answers in English and is restricted to RIVANI AI knowledge.
7. A basic D1 hourly rate limit protects the free API quotas from casual abuse.

CLOUDFLARE SECRETS TO ADD TO rivani-account-api
- GEMINI_API_KEY = your Gemini API key (Secret)
- GROQ_API_KEY = your Groq API key (Secret)

OPTIONAL KEYVALUE VARIABLES
- LUKI_PRIMARY_PROVIDER = gemini   (or groq)
- GEMINI_MODEL = gemini-2.5-flash-lite
- GROQ_MODEL = openai/gpt-oss-20b

DATABASE
Run backend/schema-luki.sql once in the existing rivani-account-data D1 database.

WORKER
Replace the current rivani-account-api Worker code with backend/worker.js and deploy.

FRONTEND
Upload the V6 website files to the existing GitHub repo and let Cloudflare redeploy.
