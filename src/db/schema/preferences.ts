import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth'

export interface SavedBacklogFilters {
  repositoryId?: string
  status?: string[]
  priority?: string[]
  contributionType?: string[]
  tagIds?: string[]
  search?: string
}

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  defaultBacklogView: text('default_backlog_view').notNull().default('kanban'),
  savedFilters: jsonb('saved_filters')
    .$type<SavedBacklogFilters>()
    .notNull()
    .default({}),
  tableColumns: jsonb('table_columns')
    .$type<Record<string, boolean>>()
    .notNull()
    .default({}),
  theme: text('theme').notNull().default('system'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})
