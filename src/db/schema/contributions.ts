import {
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { repositories } from './repositories'
import {
  actorTypeEnum,
  contributionEventTypeEnum,
  contributionTypeEnum,
  estimatedEffortEnum,
  personalStatusEnum,
  priorityEnum,
  upstreamOutcomeEnum,
} from './enums'

export const contributions = pgTable(
  'contributions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repository_id').references(() => repositories.id, {
      onDelete: 'restrict',
    }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    proposedSolution: text('proposed_solution').notNull().default(''),
    reproductionSteps: text('reproduction_steps').notNull().default(''),
    contributionType: contributionTypeEnum('contribution_type')
      .notNull()
      .default('bug_or_improvement'),
    personalStatus: personalStatusEnum('personal_status')
      .notNull()
      .default('inbox'),
    upstreamOutcome: upstreamOutcomeEnum('upstream_outcome')
      .notNull()
      .default('none'),
    priority: priorityEnum('priority').notNull().default('medium'),
    estimatedEffort: estimatedEffortEnum('estimated_effort'),
    sourceUrl: text('source_url'),
    kanbanPosition: doublePrecision('kanban_position').notNull().default(1000),
    personalCompletedAt: timestamp('personal_completed_at', {
      withTimezone: true,
    }),
    abandonedAt: timestamp('abandoned_at', { withTimezone: true }),
    abandonedReason: text('abandoned_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('contributions_user_status_pos_idx').on(
      t.userId,
      t.personalStatus,
      t.kanbanPosition,
    ),
    index('contributions_user_repo_idx').on(t.userId, t.repositoryId),
    index('contributions_user_priority_idx').on(t.userId, t.priority),
    index('contributions_user_updated_idx').on(t.userId, t.updatedAt),
  ],
)

export type EventMetadataValue = string | number | boolean | null | undefined
export type EventMetadata = Record<string, EventMetadataValue>

export const contributionEvents = pgTable(
  'contribution_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contributionId: uuid('contribution_id')
      .notNull()
      .references(() => contributions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    actorType: actorTypeEnum('actor_type').notNull().default('user'),
    eventType: contributionEventTypeEnum('event_type').notNull(),
    metadata: jsonb('metadata')
      .$type<EventMetadata>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('contribution_events_contrib_created_idx').on(
      t.contributionId,
      t.createdAt,
    ),
    index('contribution_events_user_created_idx').on(t.userId, t.createdAt),
  ],
)
