export type QueryValue = string | number | boolean;

export type RurouteFactory = <Template extends string>(
  template: Template,
) => RurouteTemplate<Template>;

export interface CreateRurouteOptions {
  prefix?: string;
}

export interface RouteMeta {
  pathSegments: string[];
  queryKeys: string[];
  hashKey: string | undefined;
  hashBeforeQuery: boolean;
}

export interface RurouteTemplate<Template> {
  types(): HasParams<Template> extends false ? () => string : never;
  types<
    Params extends RouteParamsOf<Template> &
      Record<Exclude<keyof RouteParamsOf<Template>, keyof Params>, never> &
      Record<Exclude<keyof Params, keyof RouteParamsOf<Template>>, never>,
  >(): (params: Params) => string;
}

type RouteParamsOf<Template> =
  Section<Template> extends {
    path: infer Path;
    query: infer Query;
    hash: infer Hash;
  }
    ? { [Key in PathParamKeys<Path> & string]: string } & {
        [Key in QueryParamKeys<Query> & string]?: QueryValue;
      } & { [Key in HashParamKey<Hash> & string]: string }
    : never;

type RemoveScheme<Template> = Template extends `${string}://${infer Rest}` ? Rest : Template;

type Section<Template> =
  RemoveScheme<Template> extends `${infer Before}#${infer After}`
    ? After extends `${infer Hash}?${infer Query}`
      ? { path: Before; query: Query; hash: Hash }
      : Before extends `${infer Path}?${infer Query}`
        ? { path: Path; query: Query; hash: After }
        : { path: Before; query: ""; hash: After }
    : RemoveScheme<Template> extends `${infer Before}?${infer Query}`
      ? { path: Before; query: Query; hash: "" }
      : { path: RemoveScheme<Template>; query: ""; hash: "" };

type PathParamKeys<Path> = Path extends `${string}:${infer Rest}`
  ? Rest extends `${infer Name}/${infer After}`
    ? Name | PathParamKeys<After>
    : Rest
  : never;

type QueryParamKeys<Query> = Query extends ""
  ? never
  : Query extends `${infer Key}&${infer Rest}`
    ? Key | QueryParamKeys<Rest>
    : Query;

type HashParamKey<Hash> = Hash extends "" ? never : Hash;

type HasParams<Template> = keyof RouteParamsOf<Template> extends never ? false : true;
