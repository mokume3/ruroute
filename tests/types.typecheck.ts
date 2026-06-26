import { createRuroute } from "../src";

interface EmptyRouteParams {
  [key: string]: never;
}

const ruroute = createRuroute();

ruroute("app://start/:param1?query1#hash").types<{
  param1: string;
  query1: number;
  hash: string;
}>();

ruroute("app://start/:param1?query1").types<{
  param1: string;
  query1?: number;
}>();

ruroute("/users/:id?tab#section").types<{
  id: string;
  tab?: string;
  section: string;
}>();

ruroute("app://start#section?tab").types<{
  section: string;
  tab?: string;
}>();

ruroute("/about").types<EmptyRouteParams>();

// @ts-expect-error パスパラメータが不足している
ruroute("app://start/:param1?query1#hash").types<{
  query1: number;
  hash: string;
}>();

// @ts-expect-error パスパラメータをoptionalにはできない
ruroute("app://start/:param1?query1#hash").types<{
  param1?: string;
  query1: number;
  hash: string;
}>();

// @ts-expect-error クエリパラメータの定義が不足している
ruroute("app://start/:param1?query1#hash").types<{
  param1: string;
  hash: string;
}>();

// @ts-expect-error ハッシュパラメータの定義が不足している
ruroute("app://start/:param1?query1#hash").types<{
  param1: string;
  query1: number;
}>();

// @ts-expect-error ハッシュモードでハッシュの定義が不足している
ruroute("app://start#section?tab").types<{
  tab: string;
}>();

// @ts-expect-error パスパラメータはstringのみ
ruroute("app://start/:param1").types<{
  param1: number;
}>();

// @ts-expect-error ハッシュパラメータはstringのみ
ruroute("app://start#hash").types<{
  hash: number;
}>();
