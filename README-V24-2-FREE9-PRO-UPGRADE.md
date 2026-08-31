# RIVANI AI V24.2 — Free 9/day + Pro Upgrade

## Free quota
- 9 completed audio enhancements per local calendar day
- the 10th attempt is blocked
- the Repair button stays locked for the rest of that day
- the next local calendar day resets automatically
- microphone enhancement uses the same quota
- only completed enhancement jobs increment the count

When locked the page shows:
- daily limit reached
- try again tomorrow
- RIVANI Pro ₹499/month (India)
- unlimited enhancement job count
- 5 h processing/day

## Pro checkout
The UI is checkout-ready, but no fake payment link is included.

Before `audio-repair.js` loads, configure:

    window.RIVANI_PRO_CHECKOUT_URL = "https://your-secure-checkout-url";

The Pro buttons will redirect to that secure checkout.

## Production entitlement
Paid Pro must be verified server-side:
1. signed-in user starts checkout
2. account backend creates/returns payment checkout
3. provider completes payment
4. provider webhook calls RIVANI backend
5. backend stores `plan=pro` and subscription/customer ids
6. frontend reads backend plan and unlocks Pro
7. cancel/payment-failed webhook downgrades when needed

Do not use localStorage as the paid entitlement source.

## International pricing
Keep India at ₹499/month.
For international customers use provider-supported USD/EUR/etc. checkout.
Fixed localized plans are usually cleaner than browser-side currency math.

## Audio
Audio model/DSP/performance is unchanged from V24.1.
No Cloudflare model Worker update is required.
