# CM Rarity Gadget v4

Chrome extension scaffold for Chasing Majors rarity intelligence on eBay and COMC listings.

## Architecture

- `manifest.json`: Chrome Manifest V3 extension config.
- `background.js`: API proxy service worker for backend calls, future auth, and rate-limit handling.
- `config.js`: API and freemium settings.
- `content.js`: page scan orchestration and lookup flow.
- `parser.js`: source detection and listing/image extraction.
- `api.js`: backend-ready rarity API client with mock fallback when unavailable.
- `ui.js`: CM badge and hover/click panel rendering.
- `storage.js`: user state and daily free lookup tracking with `chrome.storage.local`.
- `styles.css`: isolated overlay styling.
- `backend/`: minimal hosted `/rarity` API for MVP trials.
- `PRV_IMPORT.md`: CSV import workflow for expanding the Worker dataset from PRV.

## API Contract

The extension calls:

```txt
GET /rarity?q={encoded card title}&source={ebay|comc}&url={current page url}
```

Expected response:

```json
{
  "title": "Card title",
  "matchConfidence": 0.92,
  "rarityTier": "Rare",
  "scarcityScore": 86,
  "printRun": 99,
  "packOdds": "1:144 packs",
  "popTotal": 24,
  "popGem": 8,
  "lockedFields": [],
  "upgradeUrl": "https://chasingmajors.com/upgrade",
  "matchMode": "card"
}
```

`matchMode` can be `card` for exact card-level data or `set` for product/set-level PRV estimates.

## User State

The current user state is stored in `chrome.storage.local` under `cmRarityUserState` and `cmRaritySession`:

```json
{
  "status": "anonymous",
  "plan": "free",
  "email": ""
}
```

Supported states:

- Anonymous/free: `{ "status": "anonymous", "plan": "free" }`
- Logged in/free: `{ "status": "logged_in", "plan": "free" }`
- Paid: `{ "status": "logged_in", "plan": "paid" }`
- Admin/testing: `{ "status": "logged_in", "plan": "admin" }`

Admin and paid access require a backend-issued access token. Client-side admin flags are not trusted.

`config.js` points `API_BASE_URL` at the Chasing Majors API custom domain:

```txt
https://api.chasingmajors.com
```

`API_CACHE_TTL_MS` is currently `0` so MVP data corrections appear immediately while testing.

## Signup and Billing

The extension is wired for a limited production rollout with account and billing CTAs:

- `SIGNUP_URL`: opens account creation.
- `LOGIN_URL`: opens sign in.
- `BILLING_URL`: opens account billing.
- `FEEDBACK_URL`: opens beta issue reporting.

The payment flow is backend-owned. The extension never stores Stripe secrets or paid rarity data. The Worker exposes:

```txt
GET /signup
POST /signup
GET /me
POST /billing/checkout
GET /billing/start
GET /billing/success
POST /billing/portal
POST /stripe/webhook
```

`POST /billing/checkout` creates a Stripe subscription Checkout Session when Cloudflare secrets are configured:

```txt
STRIPE_SECRET_KEY
STRIPE_PRICE_ID
STRIPE_WEBHOOK_SECRET
```

Stripe Checkout is configured for subscription mode and `allow_promotion_codes=true`, so first-month free or discounted beta codes can be shared with newsletter testers.

`GET /billing/start` is used by extension links. It redirects a normal browser click into Stripe Checkout.

`GET /billing/success` verifies the Stripe Checkout Session, creates or updates the account in D1, issues an extension access token, and shows activation instructions for the toolbar popup.

`POST /stripe/webhook` keeps entitlement current when Stripe sends checkout and subscription events. `POST /billing/portal` opens Stripe Customer Portal for activated paid users.

Production entitlement requires a Cloudflare D1 database bound as `CM_DB`; see [backend/README.md](backend/README.md).

## Chrome Web Store Notes

This scaffold avoids bundled paid rarity data. Free users only see limited fields, paid users can see all fields returned by the backend when they are not marked locked by `lockedFields`.

For the first Chrome Web Store rollout, keep the listing unlisted at first and use the signup/billing flow to unlock paid fields.

## Public Beta Defaults

Current limited rollout defaults:

- `AUTH_ENABLED: true`
- `API_BASE_URL: https://api.chasingmajors.com`
- `SIGNUP_URL` and `BILLING_URL` point to Worker-powered Stripe Checkout redirects.
- `APP_URL` points to the public Chasing Majors site.
- Public testers unlock paid fields through signup/billing.
- Paid users activate the extension by pasting the access token from the checkout success page into the toolbar popup.
- Internal admin testing should use `/admin/issue-token` with `CM_ADMIN_SECRET` to issue a real `cm_live_...` access token.

## Local Harness

Open `dev/harness.html` in Chrome to test badge placement, fallback data, daily limits, and local free/paid user state without loading marketplace pages.

## Tester Updates

For MVP testers, GitHub is the update source. Each pushed extension change builds a ZIP in the **Package Chrome extension** GitHub Action.

Tester update flow:

1. Open the latest successful **Package Chrome extension** workflow run in GitHub.
2. Download the `cm-rarity-gadget-extension` artifact.
3. Unzip it into a stable local folder, such as `~/ChasingMajors/cm-rarity-gadget`.
4. Go to `chrome://extensions`.
5. Click **Load unpacked** the first time, or **Reload** after replacing files in the same folder.

Local ZIP build:

```bash
npm run package:extension
```

This creates `dist/cm-rarity-gadget-v4.0.3.zip`. Keep the unpacked extension folder path stable on each tester Mac so Chrome can reload updates without removing/re-adding the extension.

## Validation

Run:

```bash
npm run validate
npm run api:validate
npm run validate:worker
npm run validate:all
```

This checks the Manifest V3 wiring, required files, icon references, host permissions, MVP/admin config warnings, and seed API matching.
