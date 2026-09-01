// Runtime endpoints for RIVANI AI.
// Keep secrets out of this file. This file is safe to publish.
export const runtimeConfig = {
  accountApiBase: 'https://rivani-account-api.rivani.workers.dev',
  deletionApiBase: 'https://rivani-account-api.rivani.workers.dev',

  // Public Cloudflare Turnstile site key. Put ONLY the site key here.
  // Keep TURNSTILE_SECRET_KEY in the rivani-account-api Worker environment.
  turnstileSiteKey: ''
};
