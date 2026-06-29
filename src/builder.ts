import { HASH_START, QUERY_ASSIGN, QUERY_SEPARATOR, QUERY_START } from "./constants";
import { parseTemplate } from "./parser";
import type { CreateRurouteOptions, QueryValue, RurouteFactory, RurouteTemplate } from "./types";
import { encodeUrlValue } from "./utils/encode-url-value";

export const createRuroute = (options?: CreateRurouteOptions): RurouteFactory => {
  const prefix = options?.prefix ?? "";

  const factory = (template: string): RurouteTemplate<string> => {
    const meta = parseTemplate(template);
    const segments = meta.pathSegments;
    const segmentCount = segments.length;
    const queryKeys = meta.queryKeys;
    const queryCount = queryKeys.length;
    const hashKey = meta.hashKey;
    const hashBeforeQuery = meta.hashBeforeQuery;
    const hasScheme = segments[0].indexOf("://") !== -1;
    const pathPrefix = hasScheme ? "" : prefix;

    const build = (params?: Record<string, QueryValue | undefined>): string => {
      let path = pathPrefix;
      for (let index = 0; index < segmentCount; index++) {
        if ((index & 1) === 0) {
          path += segments[index];
        } else {
          const name = segments[index];
          const value = params?.[name];
          if (value === undefined) {
            throw new Error(`[ruroute] Missing required path value: ${name}`);
          }
          path += encodeUrlValue(value);
        }
      }

      let query = "";
      for (let index = 0; index < queryCount; index++) {
        const key = queryKeys[index];
        const value = params?.[key];
        if (value !== undefined) {
          query += query.length > 0 ? QUERY_SEPARATOR : QUERY_START;
          query += key + QUERY_ASSIGN + encodeUrlValue(value);
        }
      }

      let hash = "";
      if (hashKey !== undefined) {
        const value = params?.[hashKey];
        if (value === undefined) {
          throw new Error(`[ruroute] Missing required hash value: ${hashKey}`);
        }
        hash = HASH_START + encodeUrlValue(value);
      }

      return hashBeforeQuery ? path + hash + query : path + query + hash;
    };

    return { types: () => build } as RurouteTemplate<string>;
  };

  return factory as RurouteFactory;
};
