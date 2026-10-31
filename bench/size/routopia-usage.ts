import { empty, routes, type } from 'routopia'

const myRoutes = routes('https://api.example.com', {
  '/health': { get: empty },
  '/users': {
    get: { queries: { page: type as number | undefined } },
    post: empty,
  },
  '/users/[id]': {
    get: { params: { id: type as number }, hash: type as string },
  },
})

export const urls = [
  myRoutes['/health'].get(),
  myRoutes['/users'].get({ queries: { page: 1 } }),
  myRoutes['/users'].post(),
  myRoutes['/users/[id]'].get({ params: { id: 1 }, hash: 'top' }),
]
