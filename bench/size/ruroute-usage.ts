import { defineRoutes, type } from '../../dist/index.mjs'

const routes = defineRoutes({
  baseUrl: 'https://api.example.com',
  routes: {
    '/health': type.empty,
    '/users': type.route({
      get: { query: { page: type.optional(type.number) } },
      post: type.empty,
    }),
    '/users/[id]': type.route({
      get: { params: { id: type.number }, hash: type.optional(type.string) },
    }),
  },
})

export const urls = [
  routes['/health'](),
  routes['/users']({ q: { page: 1 } }),
  routes['/users'].post(),
  routes['/users/[id]']({ p: { id: 1 }, h: 'top' }),
]
