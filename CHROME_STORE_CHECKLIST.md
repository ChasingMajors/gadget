# Chrome Web Store Checklist

## Before Submission

- Set `MVP_ADMIN_MODE` to `false` in `config.js`.
- Confirm `API_BASE_URL` points to the production Chasing Majors API.
- Confirm `/rarity` is hosted with HTTPS and returns the documented response shape.
- Add a Chasing Majors privacy policy URL.
- Add support and contact URLs.
- Confirm the extension name and description do not imply affiliation with eBay or COMC.
- Confirm no paid rarity dataset is bundled in extension files.
- Run `npm run validate`.

## Store Listing Assets

- 128x128 icon from `icons/icon128.png`.
- Screenshots showing the `CM` badge on a listing image.
- Screenshot showing the rarity panel.
- Short description focused on rarity intelligence for collectors.
- Longer description explaining free versus paid behavior.

## Permission Rationale

- `storage`: stores local user state and daily free lookup counter.
- `https://www.ebay.com/*`: overlays badges on eBay listing pages.
- `https://www.comc.com/*`: overlays badges on COMC listing pages.
- `https://api.chasingmajors.com/*`: fetches rarity intelligence from Chasing Majors.

## Post-Submission Hardening

- Move daily lookup enforcement to the backend.
- Replace MVP admin config with token-based entitlement.
- Add background-service-worker request telemetry.
- Add a versioned build artifact process.
