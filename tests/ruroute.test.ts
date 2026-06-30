import { describe, expect, it, vi } from "vitest";
import { createRuroute, ruroute } from "../src";

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
    const route = ruroute("/about").types();
    expect(route()).toBe("/about");
  });

  it("パス + クエリのみのテンプレートでURLを生成できる", () => {
    const route = ruroute("/search?keyword&page").types<{
      keyword: string;
      page?: number;
    }>();

    expect(route({ keyword: "hello world" })).toBe("/search?keyword=hello%20world");
  });

  it("改行テンプレートのクエリキーでもURLを生成できる", () => {
    const route = ruroute(`/search
      ?q1
      &q2
      &q3`).types<{
      q1?: string;
      q2?: string;
      q3?: string;
    }>();

    expect(route({ q1: "one", q3: "three" })).toBe("/search?q1=one&q3=three");
  });

  it("必須のパスパラメータが未指定ならエラーになる", () => {
    const route = ruroute("/users/:id").types<{ id: string }>();

    expect(() => route(undefined as never)).toThrowError(
      "[ruroute] Missing required path value: id",
    );
  });

  it("必須のハッシュパラメータが未指定ならエラーになる", () => {
    const route = ruroute("/guide/:id#section").types<{ id: string; section: string }>();

    expect(() => route({ id: "intro" } as never)).toThrowError(
      "[ruroute] Missing required hash value: section",
    );
  });
});

describe("createRuroute with prefix", () => {
  it("prefixオプションでパスの先頭に文字列を付与できる", () => {
    const ruroute = createRuroute({ prefix: "/api" });
    const route = ruroute("/users/:id").types<{ id: string }>();

    expect(route({ id: "42" })).toBe("/api/users/42");
  });

  it("prefixなしでも動作する（後方互換性）", () => {
    const ruroute = createRuroute();
    const route = ruroute("/users/:id").types<{ id: string }>();

    expect(route({ id: "42" })).toBe("/users/42");
  });

  it("prefixでクエリパラメータも含むURLが生成できる", () => {
    const ruroute = createRuroute({ prefix: "/api/v1" });
    const route = ruroute("/search?keyword&page").types<{
      keyword: string;
      page?: number;
    }>();

    expect(route({ keyword: "hello" })).toBe("/api/v1/search?keyword=hello");
    expect(route({ keyword: "hello", page: 2 })).toBe("/api/v1/search?keyword=hello&page=2");
  });

  it("prefixでハッシュを含むURLが生成できる", () => {
    const ruroute = createRuroute({ prefix: "/docs" });
    const route = ruroute("/guide/:id#section").types<{ id: string; section: string }>();

    expect(route({ id: "intro", section: "overview" })).toBe("/docs/guide/intro#overview");
  });

  it("prefixでハッシュ・クエリの複雑なURLが生成できる", () => {
    const ruroute = createRuroute({ prefix: "/api" });
    const route = ruroute("/posts/:id?tab#section").types<{
      id: string;
      tab?: string;
      section: string;
    }>();

    expect(route({ id: "1", section: "comments" })).toBe("/api/posts/1#comments");
    expect(route({ id: "1", tab: "edit", section: "comments" })).toBe(
      "/api/posts/1?tab=edit#comments",
    );
  });

  it("スキーム付きテンプレートではprefixは反映されない", () => {
    const ruroute = createRuroute({ prefix: "/api" });
    const route = ruroute("app://start/:id").types<{ id: string }>();

    expect(route({ id: "42" })).toBe("app://start/42");
  });

  it("空文字列のprefixは何も付与しない", () => {
    const ruroute = createRuroute({ prefix: "" });
    const route = ruroute("/users/:id").types<{ id: string }>();

    expect(route({ id: "42" })).toBe("/users/42");
  });
});

describe("createRuroute value handling", () => {
  const ruroute = createRuroute();

  it("falsyでもundefinedでないクエリ値（false/0/空文字）は出力に含める", () => {
    const route = ruroute("/x?flag&count&note").types<{
      flag?: boolean;
      count?: number;
      note?: string;
    }>();

    expect(route({ flag: false, count: 0, note: "" })).toBe("/x?flag=false&count=0&note=");
  });

  it("先頭クエリ値が未指定でも後続クエリが?で開始される", () => {
    const route = ruroute("/x?first&second").types<{
      first?: string;
      second?: string;
    }>();

    expect(route({ second: "v" })).toBe("/x?second=v");
  });

  it("パス値の特殊文字をURLエンコードする", () => {
    const route = ruroute("/p/:id").types<{ id: string }>();

    expect(route({ id: "a b/c?d" })).toBe("/p/a%20b%2Fc%3Fd");
  });

  it("ハッシュ値の特殊文字をURLエンコードする", () => {
    const route = ruroute("/p#section").types<{ section: string }>();

    expect(route({ section: "a b/c" })).toBe("/p#a%20b%2Fc");
  });

  it("ハッシュ先行テンプレートでクエリが全て未指定ならハッシュのみ出力する", () => {
    const route = ruroute("/p#section?tab").types<{
      section: string;
      tab?: string;
    }>();

    expect(route({ section: "top" })).toBe("/p#top");
  });
});

describe("ruroute", () => {
  it("createRurouteの既定インスタンスとして使える", () => {
    const route = ruroute("app://start#hash?query1&query2").types<{
      hash: string;
      query1: string;
      query2?: number;
    }>();

    expect(route({ hash: "section", query1: "tab top" })).toBe(
      "app://start#section?query1=tab%20top",
    );
  });
});
