import { describe, expect, it, vi } from "vitest";
import { parseTemplate } from "../src/parser";

describe("parseTemplate", () => {
  it("パス・クエリ・ハッシュを分解してメタ情報を返す", () => {
    const meta = parseTemplate("app://start/:param1/www/:param2?query1&query2&query3#hash");

    expect(meta).toMatchObject({
      pathSegments: ["app://start/", "param1", "/www/", "param2", ""],
      queryKeys: ["query1", "query2", "query3"],
      hashKey: "hash",
      hashBeforeQuery: false,
    });
  });

  it("ハッシュモード（#の後に?）を正しく認識する", () => {
    const meta = parseTemplate("app://start#hash?query1&query2");

    expect(meta).toMatchObject({
      pathSegments: ["app://start"],
      queryKeys: ["query1", "query2"],
      hashKey: "hash",
      hashBeforeQuery: true,
    });
  });

  it("クエリやハッシュがない場合は空として扱う", () => {
    const meta = parseTemplate("app://start/:id");

    expect(meta).toMatchObject({
      pathSegments: ["app://start/", "id", ""],
      queryKeys: [],
      hashKey: undefined,
      hashBeforeQuery: false,
    });
  });

  it("重複したパス・クエリキーに対して警告を出す", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    parseTemplate("app://start/:id/posts/:id?query&query#hash");

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("スキームなしのテンプレートを解析できる", () => {
    const meta = parseTemplate("/users/:id?tab#section");

    expect(meta).toMatchObject({
      pathSegments: ["/users/", "id", ""],
      queryKeys: ["tab"],
      hashKey: "section",
      hashBeforeQuery: false,
    });
  });

  it("パス + ハッシュのみのテンプレートを解析できる", () => {
    const meta = parseTemplate("/docs/:slug#section");

    expect(meta).toMatchObject({
      pathSegments: ["/docs/", "slug", ""],
      queryKeys: [],
      hashKey: "section",
      hashBeforeQuery: false,
    });
  });

  it("パス + クエリのみのテンプレートを解析できる", () => {
    const meta = parseTemplate("/search?keyword&page");

    expect(meta).toMatchObject({
      pathSegments: ["/search"],
      queryKeys: ["keyword", "page"],
      hashKey: undefined,
      hashBeforeQuery: false,
    });
  });

  it("空のクエリ要素は無視する", () => {
    const meta = parseTemplate("/search?keyword&&page&");

    expect(meta).toMatchObject({
      pathSegments: ["/search"],
      queryKeys: ["keyword", "page"],
      hashKey: undefined,
      hashBeforeQuery: false,
    });
  });

  it("改行とインデントを含むクエリテンプレートを解析できる", () => {
    const meta = parseTemplate(`/search
      ?q1
      &q2
      &q3`);

    expect(meta).toMatchObject({
      pathSegments: ["/search"],
      queryKeys: ["q1", "q2", "q3"],
      hashKey: undefined,
      hashBeforeQuery: false,
    });
  });

  it("複数ハッシュは最初の#以降を1つのハッシュ文字列として扱う", () => {
    const meta = parseTemplate("app://start#hash1#hash2");

    expect(meta).toMatchObject({
      pathSegments: ["app://start"],
      queryKeys: [],
      hashKey: "hash1#hash2",
      hashBeforeQuery: false,
    });
  });

  it("ワイルドカードを含むテンプレートはサポート外としてエラーになる", () => {
    expect(() => parseTemplate("/files/*")).toThrowError(
      '[ruroute] Wildcard "*" in path is not supported.',
    );
  });

  it("ハッシュキーが既存キーと重複していても警告を出す", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    parseTemplate("/posts/:section#section");

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("production環境では重複キー警告を出さずに解析できる", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const meta = parseTemplate("/posts/:id/:id?query&query#hash");

    process.env.NODE_ENV = originalNodeEnv;

    expect(meta).toMatchObject({
      pathSegments: ["/posts/", "id", "/", "id", ""],
      queryKeys: ["query", "query"],
      hashKey: "hash",
      hashBeforeQuery: false,
    });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
