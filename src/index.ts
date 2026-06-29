import { createRuroute } from "./builder";
import type { RurouteFactory } from "./types";

export { createRuroute };
export const ruroute: RurouteFactory = createRuroute();
export type {
  CreateRurouteOptions,
  QueryValue,
  RouteMeta,
  RurouteFactory,
  RurouteTemplate,
} from "./types";
