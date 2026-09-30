# Detection eval

`labels.csv` holds 15 hand-labelled domains. Labels come from loading each site in a
**real browser** (JS executed, bot challenges passed) and checking the rendered DOM for
Next.js markers (`#__NEXT_DATA__`, `self.__next_f`, `/_next/` scripts) plus the response
headers of a same-origin fetch. The detector under test only gets **one plain HTTP GET**
(no JS), so disagreements are real detector misses, not label noise.

`host` may list several acceptable answers (`akamai|aws`) when a CDN fronts another
provider and both are defensible. `on_vercel` is the business-critical label: it decides
whether a company is a customer (skip) or a prospect.

Caveat: 11 of the 15 were chosen from sites I already knew or had scanned, so this is a
sanity check, not an unbiased benchmark. Add your own rows to widen it.

Run: `pnpm eval`
