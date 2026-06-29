import {
  HASH_START,
  PATH_PARAM_PREFIX,
  PATH_SEPARATOR,
  QUERY_SEPARATOR,
  QUERY_START,
  WILDCARD,
} from "./constants";
import type { RouteMeta } from "./types";

export const parseTemplate = (template: string): RouteMeta => {
  const firstHash = template.indexOf(HASH_START);
  const firstQuery = template.indexOf(QUERY_START);

  let pathPart = template;
  let queryPart = "";
  let hashPart: string | undefined;
  let hashBeforeQuery = false;

  if (firstHash !== -1 && firstQuery !== -1) {
    if (firstHash < firstQuery) {
      hashBeforeQuery = true;
      pathPart = template.slice(0, firstHash);
      hashPart = template.slice(firstHash + 1, firstQuery);
      queryPart = template.slice(firstQuery + 1);
    } else {
      pathPart = template.slice(0, firstQuery);
      queryPart = template.slice(firstQuery + 1, firstHash);
      hashPart = template.slice(firstHash + 1);
    }
  } else if (firstQuery !== -1) {
    pathPart = template.slice(0, firstQuery);
    queryPart = template.slice(firstQuery + 1);
  } else if (firstHash !== -1) {
    pathPart = template.slice(0, firstHash);
    hashPart = template.slice(firstHash + 1);
  }

  if (pathPart.indexOf(WILDCARD) !== -1) {
    throw new Error('[ruroute] Wildcard "*" in path is not supported.');
  }

  const seen = Object.create(null);
  let hasDuplicate = false;

  const pathSegments: string[] = [];
  const length = pathPart.length;
  let literalStart = 0;
  let index = 0;
  while (index < length) {
    if (pathPart[index] === PATH_PARAM_PREFIX && pathPart[index + 1] !== PATH_SEPARATOR) {
      pathSegments.push(pathPart.slice(literalStart, index));
      const nameStart = index + 1;
      let nameEnd = nameStart;
      while (nameEnd < length && pathPart[nameEnd] !== PATH_SEPARATOR) {
        nameEnd++;
      }
      const name = pathPart.slice(nameStart, nameEnd);
      if (seen[name]) {
        hasDuplicate = true;
      } else {
        seen[name] = true;
      }
      pathSegments.push(name);
      literalStart = nameEnd;
      index = nameEnd;
    } else {
      index++;
    }
  }
  if (pathSegments.length > 0) {
    pathSegments.push(pathPart.slice(literalStart));
  } else {
    pathSegments.push(pathPart);
  }

  const queryKeys: string[] = [];
  if (queryPart.length > 0) {
    let keyStart = 0;
    const queryLength = queryPart.length;
    for (let charIndex = 0; charIndex <= queryLength; charIndex++) {
      if (charIndex === queryLength || queryPart[charIndex] === QUERY_SEPARATOR) {
        const key = queryPart.slice(keyStart, charIndex);
        if (key.length > 0) {
          if (seen[key]) {
            hasDuplicate = true;
          } else {
            seen[key] = true;
          }
          queryKeys.push(key);
        }
        keyStart = charIndex + 1;
      }
    }
  }

  const hashKey = hashPart && hashPart.length > 0 ? hashPart : undefined;
  if (hashKey) {
    if (seen[hashKey]) {
      hasDuplicate = true;
    }
  }

  if (hasDuplicate) {
    console.warn(`[ruroute] Duplicate parameter keys in template: ${template}`);
  }

  return { pathSegments, queryKeys, hashKey, hashBeforeQuery };
};
