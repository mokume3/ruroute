import { defineRoutes, type } from '../../src'

const routes = defineRoutes({
  routes: {
    '/users': type.route({
      get: {
        query: {
          /** ページ */
          page: type.optional(type.number),
          /** 並び順 */
          sort: type.literal(['asc', 'desc']),
        },
      },
    }),
    '/users/[id]': type.route({
      get: {
        params: {
          /** ユーザー ID */
          id: type.number,
        },
        /** 見出し */
        hash: type.optional(type.string),
      },
    }),
  },
})

export const queryCall = routes['/users']({ query: { page: 1, sort: 'asc' } })
export const queryShorthandCall = routes['/users']({ q: { page: 1, sort: 'asc' } })
export const methodCall = routes['/users'].get({ q: { page: 1, sort: 'asc' } })
export const paramsAndHashCall = routes['/users/[id]']({ params: { id: 1 }, hash: 'top' })
export const paramsShorthandCall = routes['/users/[id]']({ p: { id: 1 } })
