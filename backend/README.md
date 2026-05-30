# CM Rarity API

Minimal hosted API for the CM Rarity Gadget MVP.

## Endpoints

```txt
GET /health
GET /signup
POST /signup
GET /me
GET /rarity?q={card title}&source={ebay|comc}&url={page url}
POST /billing/checkout
GET /billing/start
GET /billing/success
POST /billing/portal
POST /stripe/webhook
```

`/rarity` now locks paid-only fields for anonymous/free users. Paid/admin access receives full backend values.

`/billing/checkout` creates a Stripe Checkout Session for the $5/month beta subscription when Stripe environment values are present. Promotion codes are enabled for beta discount/free-month codes.

`/billing/start` is a browser-friendly redirect endpoint for extension CTAs. It creates a Checkout Session and redirects the tester to Stripe Checkout.

`/billing/success` verifies the Stripe Checkout Session, upserts the account in D1, creates an extension session token, and renders activation instructions.

`/billing/portal` creates a Stripe Customer Portal session for activated users. `/stripe/webhook` verifies Stripe signatures and keeps subscription status in sync when checkout completes or a subscription changes.

## Required Cloudflare Storage

Production entitlement requires Cloudflare D1.

Create the database:

```bash
wrangler d1 create cm-rarity-prod
```

Copy the returned `database_id` into `wrangler.toml`, uncomment the `[[d1_databases]]` block, then run:

```bash
wrangler d1 execute cm-rarity-prod --remote --file=backend/schema.sql
```

The Worker expects this binding:

```txt
CM_DB
```

Without `CM_DB`, Stripe Checkout can open, but the success page cannot persist paid entitlement or issue durable extension tokens.

## Run

```bash
node backend/server.js
```

Environment:

- `PORT`: server port, defaults to `8787`.
- `HOST`: bind host, defaults to `0.0.0.0`.
- `CM_RARITY_DATA_FILE`: path to a JSON card dataset.
- `CM_UPGRADE_URL`: upgrade CTA URL.
- `CM_ALLOWED_ORIGIN`: CORS origin, defaults to `*` for MVP.
- `CM_APP_URL`: Chasing Majors app URL for billing redirects.
- `CM_ALLOW_CLIENT_ADMIN`: set to `true` only for internal unpacked-extension trials with `MVP_ADMIN_MODE`.
- `CM_BETA_PAID_TOKEN`: temporary beta bearer token that unlocks paid access.
- `CM_BETA_PAID_EMAIL`: optional email associated with the temporary beta token.
- `STRIPE_SECRET_KEY`: Stripe secret key. Keep this server-side only.
- `STRIPE_PRICE_ID`: Stripe recurring $5/month price ID.
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret. Required for production entitlement sync.

Cloudflare secret setup:

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put CM_BETA_PAID_TOKEN
```

Set `STRIPE_PRICE_ID` as a runtime text variable or secret. It is not sensitive, but it must match the same Stripe mode as `STRIPE_SECRET_KEY`.

Create a Stripe webhook endpoint pointing to:

```txt
https://api.chasingmajors.com/stripe/webhook
```

Subscribe it to:

```txt
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

Cloudflare variables for internal testing:

```bash
wrangler secret put CM_ALLOW_CLIENT_ADMIN
```

Set `CM_ALLOW_CLIENT_ADMIN` to `true` only while `config.js` has `MVP_ADMIN_MODE: true`. Disable both before Chrome Web Store beta.

## Deploy

This service has no package dependencies. It can be deployed to Cloudflare Workers using `backend/worker.js`, or to any Node-compatible host using `backend/server.js`.

For Cloudflare Workers, deploy with:

```txt
wrangler.toml
main = "backend/worker.js"
```

Point `https://api.chasingmajors.com` at the hosted service and confirm:

```txt
https://api.chasingmajors.com/health
https://api.chasingmajors.com/rarity?q=2025-26%20Topps%20Finest%20Ace%20Bailey%20Sky%20Blue%20/150&source=ebay&url=https://www.ebay.com
```

## Data Strategy

The seed dataset in `backend/data/cards.json` is intentionally small. For the MVP, expand it around one focused trial lane before attempting broad sports-card coverage.
