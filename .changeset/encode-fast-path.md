---
'ruroute': patch
---

Building URLs is about 1.6x faster when path params and hashes contain only characters that need no encoding (such as numeric IDs and slugs). Values that need encoding are 10–20% slower, and the bundle is 14 B larger. Defining `type.empty` routes is slightly faster.
