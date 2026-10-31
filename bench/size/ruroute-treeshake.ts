import { defineRoutes, type } from '../../dist/index.mjs'

// type.empty / type.route / type.number だけを使う
export const routes = defineRoutes({
  routes: {
    '/a': type.empty,
    '/b/[id]': type.route({ get: { params: { id: type.number } } }),
  },
})
