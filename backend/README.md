# CM Rarity API

Minimal hosted API for the CM Rarity Gadget MVP.

## Endpoints

```txt
GET /health
GET /rarity?q={card title}&source={ebay|comc}&url={page url}
```

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
