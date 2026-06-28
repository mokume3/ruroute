import {
  EMPTY_TEXT,
  HASH_PREFIX,
  PATH_PARAMETER_PREFIX,
  PATH_PARAMETER_SEGMENT_INTERVAL,
  PATH_SEPARATOR,
  QUERY_PREFIX,
  QUERY_SEPARATOR,
} from "./constants";

export interface CompiledTemplateMeta {
  pathSegments: string[];
  queryKeys: string[];
  hashKey: string | undefined;
  hashBeforeQuery: boolean;
}

interface ParsedTemplateParts {
  pathPart: string;
  queryPart: string;
  hashPart: string;
  hashBeforeQuery: boolean;
}

interface DuplicateTracker {
  [key: string]: boolean | undefined;
}

const warnForDuplicateKeys = (
  categoryName: string,
  keys: string[],
  startIndex: number,
  step: number,
): void => {
  const seenKeys: DuplicateTracker = Object.create(null);
  let keyIndex = startIndex;

  while (keyIndex < keys.length) {
    const key = keys[keyIndex];

    if (seenKeys[key]) {
      console.warn(`[ruroute] Duplicate ${categoryName} key detected: "${key}"`);
    } else {
      seenKeys[key] = true;
    }

    keyIndex += step;
  }
};

const parseTemplateParts = (template: string): ParsedTemplateParts => {
  const queryIndex = template.indexOf(QUERY_PREFIX);
  const hashIndex = template.indexOf(HASH_PREFIX);
  const hasQuery = queryIndex >= 0;
  const hasHash = hashIndex >= 0;

  if (!hasQuery && !hasHash) {
    return {
      pathPart: template,
      queryPart: EMPTY_TEXT,
      hashPart: EMPTY_TEXT,
      hashBeforeQuery: false,
    };
  }

  if (hasQuery && (!hasHash || queryIndex < hashIndex)) {
    const pathPart = template.slice(0, queryIndex);
    const queryWithHashPart = template.slice(queryIndex + QUERY_PREFIX.length);
    const hashPartIndex = queryWithHashPart.indexOf(HASH_PREFIX);

    if (hashPartIndex < 0) {
      return {
        pathPart,
        queryPart: queryWithHashPart,
        hashPart: EMPTY_TEXT,
        hashBeforeQuery: false,
      };
    }

    return {
      pathPart,
      queryPart: queryWithHashPart.slice(0, hashPartIndex),
      hashPart: queryWithHashPart.slice(hashPartIndex + HASH_PREFIX.length),
      hashBeforeQuery: false,
    };
  }

  const pathPart = template.slice(0, hashIndex);
  const hashWithQueryPart = template.slice(hashIndex + HASH_PREFIX.length);
  const queryPartIndex = hashWithQueryPart.indexOf(QUERY_PREFIX);

  if (queryPartIndex < 0) {
    return {
      pathPart,
      queryPart: EMPTY_TEXT,
      hashPart: hashWithQueryPart,
      hashBeforeQuery: false,
    };
  }

  return {
    pathPart,
    queryPart: hashWithQueryPart.slice(queryPartIndex + QUERY_PREFIX.length),
    hashPart: hashWithQueryPart.slice(0, queryPartIndex),
    hashBeforeQuery: true,
  };
};

const splitPathSegments = (pathPart: string): string[] => {
  if (pathPart.includes("*")) {
    throw new Error('[ruroute] Wildcard "*" in path is not supported.');
  }

  const pathSegments: string[] = [];
  let pathCursor = 0;
  let staticStartIndex = 0;

  while (pathCursor < pathPart.length) {
    const isPathParameterPrefix =
      pathPart[pathCursor] === PATH_PARAMETER_PREFIX && pathPart[pathCursor + 1] !== PATH_SEPARATOR;

    if (isPathParameterPrefix) {
      pathSegments.push(pathPart.slice(staticStartIndex, pathCursor));
      pathCursor += 1;

      const parameterStartIndex = pathCursor;

      while (pathCursor < pathPart.length && pathPart[pathCursor] !== PATH_SEPARATOR) {
        pathCursor += 1;
      }

      const pathParameter = pathPart.slice(parameterStartIndex, pathCursor);

      if (pathParameter.endsWith(QUERY_PREFIX)) {
        throw new Error('[ruroute] Optional path parameter syntax ":param?" is not supported.');
      }

      pathSegments.push(pathParameter);
      staticStartIndex = pathCursor;
      continue;
    }

    pathCursor += 1;
  }

  pathSegments.push(pathPart.slice(staticStartIndex));
  return pathSegments;
};

const splitQueryKeys = (queryPart: string): string[] => {
  if (queryPart === EMPTY_TEXT) {
    return [];
  }

  const queryKeys: string[] = [];
  let queryStartIndex = 0;
  let queryCursor = 0;

  while (queryCursor <= queryPart.length) {
    if (queryCursor === queryPart.length || queryPart[queryCursor] === QUERY_SEPARATOR) {
      const queryKey = queryPart.slice(queryStartIndex, queryCursor);

      if (queryKey !== EMPTY_TEXT) {
        queryKeys.push(queryKey);
      }

      queryStartIndex = queryCursor + 1;
    }

    queryCursor += 1;
  }

  return queryKeys;
};

export const parseTemplate = (template: string): CompiledTemplateMeta => {
  const parsedTemplateParts = parseTemplateParts(template);
  const pathSegments = splitPathSegments(parsedTemplateParts.pathPart);
  const queryKeys = splitQueryKeys(parsedTemplateParts.queryPart);

  if (process.env.NODE_ENV !== "production") {
    warnForDuplicateKeys("path parameter", pathSegments, 1, PATH_PARAMETER_SEGMENT_INTERVAL);
    warnForDuplicateKeys("query parameter", queryKeys, 0, 1);
  }

  return {
    pathSegments,
    queryKeys,
    hashKey: parsedTemplateParts.hashPart === EMPTY_TEXT ? undefined : parsedTemplateParts.hashPart,
    hashBeforeQuery: parsedTemplateParts.hashBeforeQuery,
  };
};
