---
"ruroute": patch
---

`defineRoutes` is about 20% faster and the bundle is about 20 B smaller, because each route now creates a single function and reuses it as its method properties.
