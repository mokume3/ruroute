import { defineRoutes, type } from '../dist/index.mjs'

const routes = defineRoutes({
  baseUrl: 'https://api.example.com',
  routes: {
    '/health': type.empty,
    '/users': type.route({
      get: {
        query: {
          page: type.optional(type.number),
          aaa: type.string,
        },
      },
      post: type.empty,
    }),
    '/users/[id]': type.route({
      get: { params: { id: type.number }, hash: type.optional(type.string) },
    }),
  },
})

export const aaaa = routes['/health']()
export const bbbb = routes['/users']({ q: { page: 1, aaa: '1' } })
export const cccc = routes['/users'].post()
export const dddd = routes['/users/[id]']({ p: { id: 1 }, h: 'top' })

const routes2 = defineRoutes({
  baseUrl: '/a',
  routes: {
    /** ヘルスURL */
    '/health/aaa': type.empty,
    /** ユーザーURL */
    '/users': type.route({
      get: {
        query: {
          page: type.optional(type.number),
          aaa: type.literal(['1', '2']),
        },
      },
      post: type.route(),
    }),
    '/users/[id]/[id1]': type.route({
      get: {
        params: {
          id: type.number,
          id1: type.number,
        },
        hash: type.optional(type.string),
      },
    }),
  },
})

export const aaaa2 = routes2['/health/aaa']()
export const bbbb2 = routes2['/users']({ q: { page: 1, aaa: '2' } })
export const cccc2 = routes2['/users'].post()
export const dddd2 = routes2['/users/[id]/[id1]']({ p: { id: 1, id1: 1 }, h: 'top' })

const routes3 = defineRoutes({
  routes: {
    /** ユーザーURL */
    '/users': type.route({
      get: {
        query: {
          page: type.optional(type.number),
          aaa: type.literal(['1', '2']),
        },
      },
    }),
  },
})

export const aaaa3 = routes3['/users']({ q: { page: 1, aaa: '2' } })
