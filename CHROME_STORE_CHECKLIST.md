# Chrome Web Store Checklist

## Before Submission

- Confirm `MVP_ADMIN_MODE` is `false` in `config.js`.
- Confirm `API_BASE_URL` points to the production Chasing Majors API.
- Confirm `/rarity` is hosted with HTTPS and returns the documented response shape.
- Confirm `/me` and `/billing/checkout` are hosted with HTTPS.
- Confirm `/billing/start` redirects a browser click to Stripe Checkout.
- Confirm `/billing/success` issues an extension access token after checkout.
- Confirm `/stripe/webhook` is configured in Stripe and receiving subscription events.
- Confirm `/billing/portal` opens Stripe Customer Portal for an activated paid user.
- Confirm the toolbar popup accepts the token and `/me` returns paid.
- Confirm Stripe Checkout opens with the intended recurring $5/month price.
- Confirm the beta promo code works in Stripe Checkout.
- Add a Chasing Majors privacy policy URL.
- Add support and contact URLs.
- Add a feedback form URL and confirm `FEEDBACK_URL` points to it.
- Confirm the extension name and description do not imply affiliation with eBay or COMC.
- Confirm no paid rarity dataset is bundled in extension files.
- Confirm paid fields are locked for anonymous/free users and unlocked only through backend entitlement.
- Run `npm run validate`.

## Store Listing Assets

- 128x128 icon from `icons/icon128.png`.
- Screenshots showing the `CM` badge on a listing image.
- Screenshot showing the rarity panel.
- Screenshot showing locked/free state.
- Screenshot showing signup or billing CTA.
- Short description focused on rarity intelligence for collectors.
- Longer description explaining free versus paid behavior.
- Privacy policy URL.
- Support URL.

## Permission Rationale

- `storage`: stores local user state and daily free lookup counter.
- `https://www.ebay.com/*`: overlays badges on eBay listing pages.
- `https://www.comc.com/*`: overlays badges on COMC listing pages.
- `https://api.chasingmajors.com/*`: fetches rarity intelligence from Chasing Majors.

## Data Disclosure

- Reads visible listing/search text on eBay and COMC.
- Sends card title/search text, source, and page URL to the Chasing Majors API for rarity lookup.
- Stores account state and daily free lookup count in Chrome local storage.
- Does not collect payment card details in the extension; Stripe Checkout handles payment.
- Does not claim affiliation with eBay or COMC.

## Beta Notes

- Use an unlisted listing for the first newsletter beta.
- Share the beta promo code in the newsletter only after it has been tested in Stripe live mode.
- Keep `CM_ALLOW_CLIENT_ADMIN` available only for internal testing; do not rely on it for newsletter testers.

## Post-Submission Hardening

- Move daily lookup enforcement to the backend.
- Replace temporary beta/admin shortcuts with token-based entitlement.
- Add background-service-worker request telemetry.
- Add a versioned build artifact process.
