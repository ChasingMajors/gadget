# CM Rarity API

Minimal hosted API for the CM Rarity Gadget MVP.

## Endpoints

```txt
GET /health
GET /me
GET /rarity?q={card title}&source={ebay|comc}&url={page url}
POST /billing/checkout
```

`/rarity` now locks paid-only fields for anonymous/free users. Paid/admin access receives full backend values.

`/billing/checkout` creates a Stripe Checkout Session for the $5/month beta subscription when Stripe environment values are present. Promotion codes are enabled for beta discount/free-month codes.

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

Cloudflare secret setup:

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_PRICE_ID
wrangler secret put CM_BETA_PAID_TOKEN
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
