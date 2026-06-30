import { describe, expect, expectTypeOf, it } from "vitest";
import { createRuroute, ruroute } from "../src";

interface AppRouteParams {
  param1: string;
  query1: number;
  hash: string;
}

interface QueryOptionalRouteParams {
  param1: string;
  query1?: number;
}

interface UserRouteParams {
  id: string;
  tab?: string;
  section: string;
}

interface HashBeforeQueryRouteParams {
  section: string;
  tab?: string;
}

interface DefaultInstanceRouteParams {
  hash: string;
  query1: string;
  query2?: number;
}

interface MultilineQueryRouteParams {
  q1?: string;
  q2?: string;
  q3?: string;
}

describe("types.typecheck", () => {
  const routeFactory = createRuroute();

  it("validな型定義を受け入れる", () => {
    const appRoute = routeFactory("app://start/:param1?query1#hash").types<AppRouteParams>();
    const queryOptionalRoute = routeFactory(
      "app://start/:param1?query1",
    ).types<QueryOptionalRouteParams>();
    const userRoute = routeFactory("/users/:id?tab#section").types<UserRouteParams>();
    const hashBeforeQueryRoute =
      routeFactory("app://start#section?tab").types<HashBeforeQueryRouteParams>();
    const staticRoute = ruroute("/about").types();
    const defaultInstanceRoute = ruroute(
      "app://start#hash?query1&query2",
    ).types<DefaultInstanceRouteParams>();
    const multilineQueryRoute = routeFactory(`/search
      ?q1
      &q2
      &q3`).types<MultilineQueryRouteParams>();

    expectTypeOf(appRoute).toEqualTypeOf<(params: AppRouteParams) => string>();
    expectTypeOf(queryOptionalRoute).toEqualTypeOf<(params: QueryOptionalRouteParams) => string>();
    expectTypeOf(userRoute).toEqualTypeOf<(params: UserRouteParams) => string>();
    expectTypeOf(hashBeforeQueryRoute).toEqualTypeOf<
      (params: HashBeforeQueryRouteParams) => string
    >();
    expectTypeOf(staticRoute).toEqualTypeOf<() => string>();
    expectTypeOf(defaultInstanceRoute).toEqualTypeOf<
      (params: DefaultInstanceRouteParams) => string
    >();
    expectTypeOf(multilineQueryRoute).toEqualTypeOf<
      (params: MultilineQueryRouteParams) => string
    >();

    expect(true).toBe(true);
  });

  it("invalidな型定義を拒否する", () => {
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

    expect(true).toBe(true);
  });
});
