import { ruroute } from "../src";

const routes = {
  /** カスタムスキーマ */
  "app://start": ruroute("app://start").types(),
  /** パスパラメータ */
  "/users/:id": ruroute("/users/:id").types<{ id: string }>(),
  /** クエリパラメータ */
  "/search?keyword&page": ruroute("/search?keyword&page").types<{
    keyword: string;
    page?: number;
  }>(),
  /** ハッシュパラメータ */
  "/guide/:id#section": ruroute("/guide/:id#section").types<{ id: string; section: string }>(),
  /** ハッシュ・クエリパラメータ */
  "/posts/:id?tab#section": ruroute("/posts/:id?tab#section").types<{
    id: string;
    tab?: string;
    section: string;
  }>(),
};

const route = routes["/posts/:id?tab#section"]({ id: "123", tab: "overview", section: "details" });

console.log(route);
