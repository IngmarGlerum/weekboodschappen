import { serve } from '@hono/node-server'
import { join } from 'node:path'
import { createSupabaseAuthenticator } from './auth.js'
import { loadConfig } from './config.js'
import { createPicnicApiFactory } from './picnic.js'
import { createApp } from './server.js'
import { Store } from './store.js'

const config = loadConfig()
const store = new Store(join(config.dataDir, 'picnic.db'), config.encryptionKey)
store.pruneRequests()

const app = createApp({
  config,
  auth: createSupabaseAuthenticator(config),
  store,
  picnic: createPicnicApiFactory(config.countryCode),
})

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Picnic-server luistert op poort ${info.port}`)
})

const shutdown = () => {
  server.close(() => {
    store.close()
    process.exit(0)
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
