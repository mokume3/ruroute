import { describe, expect, it, vi } from "vitest";
import { createRuroute } from "../src";

interface EmptyRouteParams {
  [key: string]: never;
}

describe("createRuroute", () => {
  const ruroute = createRuroute();

  it("パス・クエリ・ハッシュをエンコードしてURLを生成できる", () => {
    const route = ruroute("app://start/:param1/www/:param2?query1&query2&query3#hash").types<{
      param1: string;
      param2: string;
      query1: number;
      query2: string;
      query3?: boolean;
      hash: string;
    }>();

    const url = route({
      param1: "value1",
      param2: "value2",
      query1: 123,
      query2: "value test",
      query3: true,
      hash: "hashValue",
    });

    expect(url).toBe(
      "app://start/value1/www/value2?query1=123&query2=value%20test&query3=true#hashValue",
    );
  });

  it("optionalなクエリパラメータが未指定ならURLに含めない", () => {
    const route = ruroute("app://start/:param1?query1").types<{
      param1: string;
      query1?: number;
    }>();

    expect(route({ param1: "v1" })).toBe("app://start/v1");
  });

  it("ハッシュモード（#の後に?）でもテンプレート順でURLを生成できる", () => {
    const route = ruroute("app://start#hash?query1&query2").types<{
      hash: string;
      query1: string;
      query2?: number;
    }>();

    const url = route({
      hash: "section",
      query1: "tab top",
    });

    expect(url).toBe("app://start#section?query1=tab%20top");
  });

  it("重複したパラメータキーがあるテンプレートで警告を出す", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const route = ruroute("app://start/:id/posts/:id?query&query#hash").types<{
      id: string;
      query: string;
      hash: string;
    }>();

    route({
      id: "42",
      query: "x",
      hash: "y",
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("スキームなしテンプレートでもURLを生成できる", () => {
    const route = ruroute("/users/:id?tab#section").types<{
      id: string;
      tab?: string;
      section: string;
    }>();

    expect(route({ id: "42", section: "profile" })).toBe("/users/42#profile");
  });

  it("パス + ハッシュのみのテンプレートでURLを生成できる", () => {
    const route = ruroute("/docs/:slug#section").types<{
      slug: string;
      section: string;
    }>();

    expect(route({ slug: "intro", section: "overview" })).toBe("/docs/intro#overview");
  });

  it("静的パスのみのテンプレートはそのまま返す", () => {
    const route = ruroute("/about").types<EmptyRouteParams>();
    expect(route({})).toBe("/about");
  });

  it("パス + クエリのみのテンプレートでURLを生成できる", () => {
    const route = ruroute("/search?keyword&page").types<{
      keyword: string;
      page?: number;
    }>();

    expect(route({ keyword: "hello world" })).toBe("/search?keyword=hello%20world");
  });
});
