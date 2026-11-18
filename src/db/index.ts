import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  __contribhubPgClient?: postgres.Sql
}

function getConnectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is not set. Configure .env or start local PostgreSQL.',
    )
  }
  return url
}

function createPgClient(): postgres.Sql {
  return postgres(getConnectionString(), {
    prepare: false,
    max: process.env.VERCEL ? 5 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
  })
}

const pgClient = globalForDb.__contribhubPgClient ?? createPgClient()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__contribhubPgClient = pgClient
}

export const db = drizzle(pgClient, { schema })
export type Database = typeof db
export { pgClient }
