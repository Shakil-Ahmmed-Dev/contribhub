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
import { contributions } from './contributions'
import { githubExternalStatusEnum, githubRefTypeEnum } from './enums'

export const githubAccounts = pgTable('github_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  githubUserId: bigint('github_user_id', { mode: 'number' }).notNull().unique(),
  username: text('username').notNull(),
  avatarUrl: text('avatar_url'),
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  tokenIv: text('token_iv').notNull(),
  tokenAuthTag: text('token_auth_tag').notNull(),
  keyVersion: integer('key_version').notNull().default(1),
  scopes: text('scopes').notNull().default(''),
  rateLimitRemaining: integer('rate_limit_remaining'),
  rateLimitResetAt: timestamp('rate_limit_reset_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const githubReferences = pgTable(
  'github_references',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contributionId: uuid('contribution_id')
      .notNull()
      .references(() => contributions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    referenceType: githubRefTypeEnum('reference_type').notNull(),
    externalId: text('external_id'),
    number: integer('number'),
    url: text('url').notNull(),
    normalizedUrl: text('normalized_url').notNull(),
    title: text('title'),
    externalStatus: githubExternalStatusEnum('external_status')
      .notNull()
      .default('unknown'),
    isDraft: boolean('is_draft').notNull().default(false),
    isPrimary: boolean('is_primary').notNull().default(false),
    mergedAt: timestamp('merged_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
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
    uniqueIndex('github_refs_contrib_url_uidx').on(
      t.contributionId,
      t.normalizedUrl,
    ),
    index('github_refs_user_url_idx').on(t.userId, t.normalizedUrl),
    index('github_refs_user_type_status_idx').on(
      t.userId,
      t.referenceType,
      t.externalStatus,
    ),
  ],
)
