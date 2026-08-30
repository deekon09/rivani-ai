RIVANI Worker V7
Fallback order: Gemini -> Groq -> Cloudflare Workers AI

After pasting worker.js into Cloudflare:
1. Add Workers AI binding named AI.
2. Optional variable:
   CLOUDFLARE_AI_MODEL=@cf/google/gemma-4-26b-a4b-it
3. Keep LUKI_PRIMARY_PROVIDER=gemini
4. Save and deploy.
5. Test /health.
