RIVANI AI v2

Upload all files in this folder to your GitHub repository root. Cloudflare Workers/Pages can serve this as a static site.

SOCIAL LOGIN
The Google/Facebook buttons are real Firebase Authentication integration code, but they are intentionally inactive until you add your own Firebase web configuration in assets/firebase-config.js and enable providers in Firebase Console. No credentials can be invented safely.

For Facebook: create a Meta app, enable Facebook Login, then add the App ID/secret to Firebase Authentication > Sign-in method > Facebook. Add your Cloudflare workers.dev domain to Firebase Authorized domains.

Legal pages are starter drafts, not legal advice; review them before a commercial launch.
