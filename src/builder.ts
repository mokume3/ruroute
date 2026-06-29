import { HASH_PREFIX, PATH_PARAMETER_SEGMENT_INTERVAL, QUERY_PREFIX } from "./constants";
import type { CompiledTemplateMeta } from "./parser";
import { encodeUrlValue } from "./utils/encode-url-value";

interface BuildableRouteParams {
  [key: string]: string | number | boolean | undefined;
}

const EMPTY_ROUTE_PARAMS: BuildableRouteParams = Object.create(null);

const appendQueryString = (
  sourceUrl: string,
  queryKeys: string[],
  params: BuildableRouteParams,
): string => {
  let builtUrl = sourceUrl;
  let isFirstQueryParam = true;
  let queryKeyIndex = 0;

  while (queryKeyIndex < queryKeys.length) {
    const queryKey = queryKeys[queryKeyIndex];
    const queryValue = params[queryKey];

    if (queryValue !== undefined) {
      if (isFirstQueryParam) {
        builtUrl += QUERY_PREFIX;
        isFirstQueryParam = false;
      } else {
        builtUrl += "&";
      }

      builtUrl += `${queryKey}=${encodeUrlValue(queryValue)}`;
    }

    queryKeyIndex += 1;
  }

  return builtUrl;
};

export const buildUrlFn = <T extends BuildableRouteParams>(
  compiledTemplateMeta: CompiledTemplateMeta,
  prefix: string = "",
): ((...params: [T] extends [Record<string, never>] ? [] : [params: T]) => string) => {
  return (...params: [T] extends [Record<string, never>] ? [] : [params: T]): string => {
    const routeParams: BuildableRouteParams = params[0] ?? EMPTY_ROUTE_PARAMS;
    const pathSegments = compiledTemplateMeta.pathSegments;
    const shouldApplyPrefix = prefix && !compiledTemplateMeta.hasScheme;
    let builtUrl = shouldApplyPrefix ? prefix : "";
    let pathSegmentIndex = 0;

    while (pathSegmentIndex < pathSegments.length) {
      const pathSegment = pathSegments[pathSegmentIndex];
      const isStaticPathSegment = pathSegmentIndex % PATH_PARAMETER_SEGMENT_INTERVAL === 0;

      if (isStaticPathSegment) {
        builtUrl += pathSegment;
      } else {
        const pathParameterValue = routeParams[pathSegment];

        if (pathParameterValue === undefined) {
          throw new Error(`[ruroute] Missing required path parameter: "${pathSegment}"`);
        }

        builtUrl += encodeUrlValue(pathParameterValue);
      }

      pathSegmentIndex += 1;
    }

    if (compiledTemplateMeta.hashBeforeQuery) {
      if (compiledTemplateMeta.hashKey !== undefined) {
        const hashValue = routeParams[compiledTemplateMeta.hashKey];

        if (hashValue === undefined) {
          throw new Error(
            `[ruroute] Missing required hash parameter: "${compiledTemplateMeta.hashKey}"`,
          );
        }

        builtUrl += `${HASH_PREFIX}${encodeUrlValue(hashValue)}`;
      }

      return appendQueryString(builtUrl, compiledTemplateMeta.queryKeys, routeParams);
    }

    builtUrl = appendQueryString(builtUrl, compiledTemplateMeta.queryKeys, routeParams);

    if (compiledTemplateMeta.hashKey !== undefined) {
      const hashValue = routeParams[compiledTemplateMeta.hashKey];

      if (hashValue === undefined) {
        throw new Error(
          `[ruroute] Missing required hash parameter: "${compiledTemplateMeta.hashKey}"`,
        );
      }

      builtUrl += `${HASH_PREFIX}${encodeUrlValue(hashValue)}`;
    }

    return builtUrl;
  };
};
