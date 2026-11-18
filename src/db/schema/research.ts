import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { contributions } from './contributions'
import { noteContentTypeEnum, resourceTypeEnum } from './enums'

export const contributionNotes = pgTable(
  'contribution_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contributionId: uuid('contribution_id')
      .notNull()
      .references(() => contributions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default(''),
    content: text('content').notNull(),
    contentType: noteContentTypeEnum('content_type')
      .notNull()
      .default('investigation'),
    codeLanguage: text('code_language'),
    isPinned: boolean('is_pinned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('contribution_notes_contrib_idx').on(t.contributionId, t.createdAt),
    index('contribution_notes_user_idx').on(t.userId),
  ],
)

export const contributionChecklists = pgTable(
  'contribution_checklists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contributionId: uuid('contribution_id')
      .notNull()
      .references(() => contributions.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    isCompleted: boolean('is_completed').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('contribution_checklists_contrib_pos_idx').on(
      t.contributionId,
      t.position,
    ),
  ],
)

export const contributionResources = pgTable(
  'contribution_resources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contributionId: uuid('contribution_id')
      .notNull()
      .references(() => contributions.id, { onDelete: 'cascade' }),
    resourceType: resourceTypeEnum('resource_type')
      .notNull()
      .default('external_url'),
    title: text('title').notNull(),
    urlOrPath: text('url_or_path').notNull(),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('contribution_resources_contrib_idx').on(t.contributionId)],
)
