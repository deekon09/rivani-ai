RIVANI AI V5

This build replaces the browser-only deletion preview with a real server-backed 7-day deletion flow.

Website changes:
- deletion request stored in Cloudflare D1
- deletion status survives refresh and different browsers
- cancel deletion during grace period
- exact username confirmation
- recent login required to schedule deletion
- policy text updated

Backend folder:
- backend/worker.js
- backend/schema.sql
- backend/SETUP.md

IMPORTANT: Deploy and configure the backend Worker before expecting deletion requests to work.
Never upload Firebase service-account secrets to GitHub.
