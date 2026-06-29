import { buildUrlFn } from "./builder";
import type { CompiledTemplateMeta } from "./parser";
import { parseTemplate } from "./parser";
import type { ValidateTypes } from "./types";

export type RouteFn<T> = (
  ...params: [T] extends [Record<string, never>] ? [] : [params: T]
) => string;

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
      types: <T extends ValidateTypes<Template, T>>(): RouteFn<T> => {
        return buildUrlFn<T>(compiledTemplateMeta, prefix);
      },
    };
  };
};

export const ruroute = createRuroute();
