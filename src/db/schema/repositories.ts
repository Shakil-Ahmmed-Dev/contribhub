import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { trackingStatusEnum } from './enums'

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    githubRepositoryId: bigint('github_repository_id', {
      mode: 'number',
    }).unique(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    fullName: text('full_name').notNull(),
    normalizedFullName: text('normalized_full_name').notNull().unique(),
    description: text('description'),
    url: text('url').notNull(),
    language: text('language'),
    defaultBranch: text('default_branch'),
    stars: integer('stars').notNull().default(0),
    forks: integer('forks').notNull().default(0),
    visibility: text('visibility').notNull().default('public'),
    isArchived: boolean('is_archived').notNull().default(false),
    etag: text('etag'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('repositories_owner_idx').on(t.owner),
    index('repositories_language_idx').on(t.language),
  ],
)

export const userRepositories = pgTable(
  'user_repositories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'restrict' }),
    personalNotes: text('personal_notes').notNull().default(''),
    trackingStatus: trackingStatusEnum('tracking_status')
      .notNull()
      .default('active'),
    isPinned: boolean('is_pinned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('user_repositories_user_repo_uidx').on(
      t.userId,
      t.repositoryId,
    ),
    index('user_repositories_user_status_idx').on(t.userId, t.trackingStatus),
  ],
)
