import { createRuroute, ruroute } from "../src";

const routeFactory = createRuroute();

routeFactory("app://start/:param1?query1#hash").types<{
  param1: string;
  query1: number;
  hash: string;
}>();

routeFactory("app://start/:param1?query1").types<{
  param1: string;
  query1?: number;
}>();

routeFactory("/users/:id?tab#section").types<{
  id: string;
  tab?: string;
  section: string;
}>();

routeFactory("app://start#section?tab").types<{
  section: string;
  tab?: string;
}>();

ruroute("/about").types();

ruroute("app://start#hash?query1&query2").types<{
  hash: string;
  query1: string;
  query2?: number;
}>();

// @ts-expect-error パスパラメータが不足している
routeFactory("app://start/:param1?query1#hash").types<{
  query1: number;
  hash: string;
}>();

// @ts-expect-error パスパラメータをoptionalにはできない
routeFactory("app://start/:param1?query1#hash").types<{
  param1?: string;
  query1: number;
  hash: string;
}>();

// @ts-expect-error クエリパラメータの定義が不足している
routeFactory("app://start/:param1?query1#hash").types<{
  param1: string;
  hash: string;
}>();

// @ts-expect-error ハッシュパラメータの定義が不足している
routeFactory("app://start/:param1?query1#hash").types<{
  param1: string;
  query1: number;
}>();

// @ts-expect-error ハッシュモードでハッシュの定義が不足している
routeFactory("app://start#section?tab").types<{
  tab: string;
}>();

// @ts-expect-error パスパラメータはstringのみ
routeFactory("app://start/:param1").types<{
  param1: number;
}>();

// @ts-expect-error ハッシュパラメータはstringのみ
routeFactory("app://start#hash").types<{
  hash: number;
}>();

// @ts-expect-error テンプレートにない追加キーは許可しない
routeFactory("/posts/:id?tab").types<{
  id: string;
  tab?: string;
  section: string;
}>();

// @ts-expect-error テンプレート側にあるクエリパラメータがtypesにない
routeFactory("/search?keyword&page").types<{
  keyword: string;
}>();

// @ts-expect-error テンプレート側にあるハッシュパラメータがtypesにない
routeFactory("/guide/:id#section").types<{
  id: string;
}>();
