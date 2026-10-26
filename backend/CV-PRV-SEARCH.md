# Product-level PRV availability in /cv-search

Only `type: "product"` CV results have additive fields:

- `has_prv`: true only for an unambiguous published identity with a matching D1 sync record and positive, current row count.
- `prv_row_count`: synced PRV measurement-row count, never a card print run.
- `prv_code`: separate canonical PRV code when a unique populated catalog identity exists.
- `prv_status`: `available`, `none`, `ambiguous`, `not_indexed` or `unavailable`. A false boolean with `not_indexed`/`unavailable` does not assert absence of published PRV data.

Join rule matches the homepage: lowercase DisplayName and sport, replace each sequence outside ASCII a-z/0-9 with a hyphen, trim boundary hyphens. Require a unique identity across the entire public PRV index, including empty entries. CV and PRV codes are not assumed equal. The public catalog is cached for 300 seconds and bridges the exact product identity to the PRV code; one composite-primary-key D1 lookup batch reads sync-manifest counts for at most 50 page products (100 bound parameters). No row COUNT, PRV row scan, query per result, fuzzy match, or measurement preview is used. Card results are unchanged. A PRV outage leaves CV results usable with an explicit unavailable state.

The existing FTS search, pagination, rate limiter and five-minute public edge cache are preserved. A version component in the cache key prevents old response contracts from masking the new fields. Cache hits and card-only pages need zero additional PRV D1 reads. The homepage can continue hydrating its existing separate PRV section by the same identity rule; no frontend, billing, rarity, authentication, binding or secret changes are included.

Current D1 coverage is the separately synced 37 rows / 5 products, not the full published PRV catalog. Unsynced published products report `not_indexed`. This signal does not validate source measurements or their Estimated/Unverified status. Measurements and qualifiers remain in the existing PRV payloads.
