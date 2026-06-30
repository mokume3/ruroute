import { ruroute } from "../src";

const route1 = ruroute("/posts/:id?tab#section").types<{
  /** ユーザーID */
  id: string | number | boolean;
  /** タブ */
  tab?: 0 | "0";
  /** セクション */
  section: boolean | number;
}>();

const url1 = route1({
  id: "123",
  tab: "0",
  section: 1,
});

console.log(url1);

const route2 = ruroute(`/search
  ?q1
  &q2
  &q3
  &q4
  &q5
  &q6
  &q7
  &q8
  &q9
  &q10
  &q11
  &q12
  &q13
  &q14
  &q15`).types<{
  q1: string;
  q2?: string;
  q3?: string;
  q4?: string;
  q5?: string;
  q6?: string;
  q7?: string;
  q8?: string;
  q9?: string;
  q10?: string;
  q11?: string;
  q12?: string;
  q13?: string;
  q14?: string;
  q15?: string;
}>();

console.log(route2({ q1: "value1", q3: "value3", q5: "value5" }));

const routes = {
  /** カスタムスキーマ */
  "app://start": ruroute("app://start").types(),
  /** パスパラメータ */
  "/users/:id": ruroute("/users/:id").types<{ id: string }>(),
  /** クエリパラメータ */
  "/search": ruroute("/search?keyword&page").types<{
    keyword: string;
    page?: number;
  }>(),
  /** ハッシュパラメータ */
  "/guide/:id": ruroute("/guide/:id#section").types<{ id: string; section: string }>(),
  /** ハッシュ・クエリパラメータ */
  "/posts/:id": ruroute("/posts/:id?tab#section").types<{
    /** ユーザーID */
    id: string;
    /** タブ */
    tab?: string;
    /** セクション */
    section: string;
  }>(),
};

const route = routes["/posts/:id"]({
  id: "123",
  tab: "overview",
  section: "details",
});

console.log(route);
