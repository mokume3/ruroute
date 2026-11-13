import { defineRoutes, type } from '../../dist/index.mjs'

export const API_VERSION = 'v1'

// エントリからは API_VERSION だけを使い、routes は使わない
export const routes = defineRoutes({
  baseUrl: 'https://api.example.com',
  routes: {
    '/a': type.empty,
    '/b/[id]': type.route({
      get: {
        params: { id: type.union([type.string, type.number]) },
        query: {
          sort: type.optional(type.literal(['name', 'date'])),
          tags: type.array(type.string),
          cursor: type.custom<`c_${string}`>(),
        },
      },
    }),
  },
})
