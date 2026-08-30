RIVANI AI — account flow build

Authentication
- Firebase Web configuration is connected in assets/firebase-config.js.
- Supported account methods: Email/Password and Google. Facebook has been removed from the website.
- Signup creates the account, signs the new user out, then opens account-created.html.
- Login redirects authenticated users to dashboard.html.

Signup rules
- Username: 3–20 characters, letters and numbers only.
- Password: 8–64 characters, first character uppercase, at least one lowercase letter, one number, one special character, and no spaces.
- Terms & Privacy acceptance is required for email/password signup.

Dashboard
- Shows username, email, provider, creation date, last login and current Free plan.
- Includes real Firebase logout.
- Includes the designed 7-day deletion-request UI. IMPORTANT: the final automatic server-side account deletion worker is NOT connected yet. The current build stores the grace-period preview only in this browser. Do not claim automatic deletion is live until the backend worker/admin deletion flow is deployed.

Firebase console
- Keep Email/Password and Google enabled in Authentication > Sign-in method.
- Keep rivani-ai.rivani.workers.dev in Authorized domains.
- For stronger server enforcement, configure Firebase password policy for minimum length, uppercase, lowercase, numeric and special characters. The custom “first character uppercase” rule is enforced by this website UI and should also be enforced by a trusted backend if you later expose other account-creation APIs.
