---
"ruroute": minor
---

`type.*` schemas now return one shared runtime marker, and `Schema` no longer has a `kind` property. Schemas were never read at runtime, so this only shrinks the bundle (about 190 B minified for all exports).
