# ruroute

テンプレート文字列から型安全に URL を構築するライブラリです。

## Usage

```ts
import { createRuroute } from "ruroute";

const ruroute = createRuroute();

const route = ruroute("app://start/:id?tab#section").types<{
  id: string;
  tab?: string;
  section: string;
}>();

const url = route({
  id: "42",
  tab: "profile",
  section: "overview",
});
```

## Development

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm check
```
