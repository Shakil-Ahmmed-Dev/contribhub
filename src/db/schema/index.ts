import { relations } from 'drizzle-orm'

import { user, session, account, apiTokens } from './auth'
import { repositories, userRepositories } from './repositories'
import { contributions, contributionEvents } from './contributions'
import { githubAccounts, githubReferences } from './github'
import {
  contributionNotes,
  contributionChecklists,
  contributionResources,
} from './research'
import { tags, contributionTags } from './tags'
import { userPreferences } from './preferences'

export * from './enums'
export * from './auth'
export * from './repositories'
export * from './contributions'
export * from './github'
export * from './research'
export * from './tags'
export * from './preferences'

export const userRelations = relations(user, ({ one, many }) => ({
  sessions: many(session),
  accounts: many(account),
  apiTokens: many(apiTokens),
  githubAccount: one(githubAccounts, {
    fields: [user.id],
    references: [githubAccounts.userId],
  }),
  preferences: one(userPreferences, {
    fields: [user.id],
    references: [userPreferences.userId],
  }),
  trackedRepositories: many(userRepositories),
  contributions: many(contributions),
  tags: many(tags),
}))

export const repositoriesRelations = relations(repositories, ({ many }) => ({
  userRepositories: many(userRepositories),
  contributions: many(contributions),
}))

export const userRepositoriesRelations = relations(
  userRepositories,
  ({ one }) => ({
    user: one(user, {
      fields: [userRepositories.userId],
      references: [user.id],
    }),
    repository: one(repositories, {
      fields: [userRepositories.repositoryId],
      references: [repositories.id],
    }),
  }),
)

export const contributionsRelations = relations(
  contributions,
  ({ one, many }) => ({
    user: one(user, {
      fields: [contributions.userId],
      references: [user.id],
    }),
    repository: one(repositories, {
      fields: [contributions.repositoryId],
      references: [repositories.id],
    }),
    githubReferences: many(githubReferences),
    notes: many(contributionNotes),
    checklists: many(contributionChecklists),
    resources: many(contributionResources),
    events: many(contributionEvents),
    contributionTags: many(contributionTags),
  }),
)

export const githubReferencesRelations = relations(
  githubReferences,
  ({ one }) => ({
    contribution: one(contributions, {
      fields: [githubReferences.contributionId],
      references: [contributions.id],
    }),
    user: one(user, {
      fields: [githubReferences.userId],
      references: [user.id],
    }),
  }),
)

export const contributionNotesRelations = relations(
  contributionNotes,
  ({ one }) => ({
    contribution: one(contributions, {
      fields: [contributionNotes.contributionId],
      references: [contributions.id],
    }),
    user: one(user, {
      fields: [contributionNotes.userId],
      references: [user.id],
    }),
  }),
)

export const contributionChecklistsRelations = relations(
  contributionChecklists,
  ({ one }) => ({
    contribution: one(contributions, {
      fields: [contributionChecklists.contributionId],
      references: [contributions.id],
    }),
  }),
)

export const contributionResourcesRelations = relations(
  contributionResources,
  ({ one }) => ({
    contribution: one(contributions, {
      fields: [contributionResources.contributionId],
      references: [contributions.id],
    }),
  }),
)

export const contributionEventsRelations = relations(
  contributionEvents,
  ({ one }) => ({
    contribution: one(contributions, {
      fields: [contributionEvents.contributionId],
      references: [contributions.id],
    }),
    user: one(user, {
      fields: [contributionEvents.userId],
      references: [user.id],
    }),
  }),
)

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(user, {
    fields: [tags.userId],
    references: [user.id],
  }),
  contributionTags: many(contributionTags),
}))

export const contributionTagsRelations = relations(
  contributionTags,
  ({ one }) => ({
    contribution: one(contributions, {
      fields: [contributionTags.contributionId],
      references: [contributions.id],
    }),
    tag: one(tags, {
      fields: [contributionTags.tagId],
      references: [tags.id],
    }),
  }),
)
