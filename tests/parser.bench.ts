import { bench, describe } from "vitest";
import { parseTemplate } from "../src/parser";

describe("parseTemplate benchmark", () => {
  const templateWithPathQueryHash = "app://start/:param1/www/:param2?query1&query2&query3#hash";
  const templateWithHashBeforeQuery = "app://start#hash?query1&query2";
  const pathOnlyTemplate = "/users/:id/posts/:postId";

  bench("path + query + hash テンプレートの解析", () => {
    parseTemplate(templateWithPathQueryHash);
  });

  bench("hash before query テンプレートの解析", () => {
    parseTemplate(templateWithHashBeforeQuery);
  });

  bench("パスのみテンプレートの解析", () => {
    parseTemplate(pathOnlyTemplate);
  });
});
