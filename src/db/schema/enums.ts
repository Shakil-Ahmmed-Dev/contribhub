import { pgEnum } from 'drizzle-orm/pg-core'

export const contributionTypeEnum = pgEnum('contribution_type', [
  'existing_issue',
  'feature_idea',
  'bug_or_improvement',
  'documentation',
  'refactoring',
  'performance',
  'security',
  'developer_experience',
  'testing',
  'other',
])

export const personalStatusEnum = pgEnum('personal_status', [
  'inbox',
  'researching',
  'ready',
  'in_progress',
  'pr_submitted',
  'completed',
  'abandoned',
])

export const upstreamOutcomeEnum = pgEnum('upstream_outcome', [
  'none',
  'open_pr',
  'merged',
  'closed_unmerged',
  'accepted_externally',
])

export const priorityEnum = pgEnum('priority', [
  'low',
  'medium',
  'high',
  'urgent',
])

export const estimatedEffortEnum = pgEnum('estimated_effort', [
  'xs',
  's',
  'm',
  'l',
  'xl',
])

export const trackingStatusEnum = pgEnum('tracking_status', [
  'active',
  'watching',
  'paused',
  'archived',
])

export const githubRefTypeEnum = pgEnum('github_ref_type', [
  'issue',
  'pull_request',
  'discussion',
  'commit',
])

export const githubExternalStatusEnum = pgEnum('github_external_status', [
  'open',
  'closed',
  'merged',
  'unknown',
])

export const resourceTypeEnum = pgEnum('resource_type', [
  'documentation',
  'source_file',
  'discussion',
  'external_url',
  'other',
])

export const noteContentTypeEnum = pgEnum('note_content_type', [
  'investigation',
  'code_snippet',
  'general',
])

export const actorTypeEnum = pgEnum('actor_type', [
  'user',
  'github_sync',
  'system',
])

export const contributionEventTypeEnum = pgEnum('contribution_event_type', [
  'created',
  'updated',
  'status_changed',
  'priority_changed',
  'repository_linked',
  'github_ref_linked',
  'github_ref_unlinked',
  'github_synced',
  'pr_merged_detected',
  'pr_closed_detected',
  'note_added',
  'checklist_item_completed',
  'completed',
  'abandoned',
])
