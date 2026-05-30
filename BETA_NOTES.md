# CM Rarity Gadget Beta Notes

## Beta Goal

Validate whether collectors understand and value Chasing Majors rarity intelligence while browsing eBay and COMC. This is a limited production rollout: billing, entitlement, and support paths should behave like the live product even while access is restricted to selected testers.

## Current Beta Build

- Distribution target: unlisted Chrome Web Store listing.
- Public beta mode: `MVP_ADMIN_MODE` is off.
- API target: `https://cm-rarity-api.johndownard.workers.dev`.
- Billing: Stripe Checkout subscription at $5/month.
- Signup/billing CTAs: Worker-powered `/billing/start` redirect into Stripe Checkout.
- Account activation: checkout success page issues an access token that testers paste into the extension toolbar popup.
- Entitlement sync: Stripe webhooks update paid/free status after checkout, subscription updates, or cancellation.
- Promo codes: enabled in Stripe Checkout.
- Feedback: routed through `FEEDBACK_URL` in `config.js`.

## What Testers Should Try

- COMC player search pages.
- COMC serial-numbered cards, especially titles containing `#/25`, `#/149`, `#/499`, or similar.
- COMC graded cards with text like `[PSA 9 MINT]`.
- eBay search pages with specific set/product searches.
- eBay listing badges when the search is broad.

## What Testers Should Report

- Marketplace: eBay or COMC.
- Page URL.
- Screenshot of the listing and CM popup.
- What CM showed.
- What they expected.
- Whether they were anonymous/free or had completed checkout.

## Known Beta Limits

- COMC is currently more reliable than eBay because COMC titles are more structured.
- eBay titles may contain seller hype, unrelated cards, team names, grading terms, and inaccurate keywords.
- Some PRV rows are still missing, so correct unknowns are expected.
- Serial numbers visible in COMC titles can populate estimated print run even when there is no exact PRV row.
- Pack odds are only shown where PRV includes them.
- Daily free lookup counting is still local to the browser; backend enforcement is a post-beta hardening task.

## Internal Testing

Private admin testing can temporarily use:

```txt
MVP_ADMIN_MODE: true
CM_ALLOW_CLIENT_ADMIN=true
```

Do not ship that combination to newsletter testers. Public beta builds should keep `MVP_ADMIN_MODE: false`.
