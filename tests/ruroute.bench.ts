import { bench, describe } from "vitest";
import { createRuroute } from "../src";

interface RouteParamsWithPathQueryHash {
  param1: string;
  param2: string;
  query1: number;
  query2: string;
  query3?: boolean;
  hash: string;
}

interface RouteParamsWithHashBeforeQuery {
  hash: string;
  query1: string;
  query2?: number;
}

describe("createRuroute benchmark", () => {
  const ruroute = createRuroute();

  const routeWithPathQueryHash = ruroute(
    "app://start/:param1/www/:param2?query1&query2&query3#hash",
  ).types<RouteParamsWithPathQueryHash>();

  const routeWithHashBeforeQuery = ruroute(
    "app://start#hash?query1&query2",
  ).types<RouteParamsWithHashBeforeQuery>();

  const routeParamsWithPathQueryHash: RouteParamsWithPathQueryHash = {
    param1: "value1",
    param2: "value2",
    query1: 123,
    query2: "value test",
    query3: true,
    hash: "hashValue",
  };

  const routeParamsWithHashBeforeQuery: RouteParamsWithHashBeforeQuery = {
    hash: "section",
    query1: "tab top",
    query2: 2,
  };

  bench("path + query + hash の URL 構築", () => {
    routeWithPathQueryHash(routeParamsWithPathQueryHash);
  });

  bench("hash before query の URL 構築", () => {
    routeWithHashBeforeQuery(routeParamsWithHashBeforeQuery);
  });
});
