import { buildUrlFn } from "./builder";
import type { CompiledTemplateMeta } from "./parser";
import { parseTemplate } from "./parser";
import type { ValidateTypes } from "./types";

export interface RurouteOptions {
  strictQueryParams?: boolean;
}

export type RouteFn<T> = (params: T) => string;

export interface RouteCreator<Template extends string> {
  types<T extends ValidateTypes<Template, T>>(): RouteFn<T>;
}

export type CreateRuroute = <Template extends string>(template: Template) => RouteCreator<Template>;

export const createRuroute = (_options?: RurouteOptions): CreateRuroute => {
  return <Template extends string>(template: Template): RouteCreator<Template> => {
    const compiledTemplateMeta: CompiledTemplateMeta = parseTemplate(template);

    return {
      types: <T extends ValidateTypes<Template, T>>() => {
        return buildUrlFn<T>(compiledTemplateMeta);
      },
    };
  };
};
