import { buildUrlFn } from "./builder";
import type { CompiledTemplateMeta } from "./parser";
import { parseTemplate } from "./parser";
import type { ValidateTypes } from "./types";

export type RouteFn<T> = (params: T) => string;

export interface RouteCreator<Template extends string> {
  types(): RouteFn<Record<string, never>>;
  types<T extends ValidateTypes<Template, T>>(): RouteFn<T>;
}

export type CreateRuroute = <Template extends string>(template: Template) => RouteCreator<Template>;

export interface CreateRurouteOptions {
  prefix?: string;
}

export const createRuroute = (options?: CreateRurouteOptions): CreateRuroute => {
  const prefix = options?.prefix ?? "";

  return <Template extends string>(template: Template): RouteCreator<Template> => {
    const compiledTemplateMeta: CompiledTemplateMeta = parseTemplate(template);

    return {
      types: <T extends ValidateTypes<Template, T> | undefined = undefined>(): RouteFn<
        T extends undefined ? Record<string, never> : T
      > => {
        return buildUrlFn<T extends undefined ? Record<string, never> : T>(
          compiledTemplateMeta,
          prefix,
        );
      },
    };
  };
};
