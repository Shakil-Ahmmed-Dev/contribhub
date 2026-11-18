export const PERSONAL_STATUSES = [
  'inbox',
  'researching',
  'ready',
  'in_progress',
  'pr_submitted',
  'completed',
  'abandoned',
] as const

export type PersonalStatus = (typeof PERSONAL_STATUSES)[number]

export const PERSONAL_STATUS_META: Record<
  PersonalStatus,
  { label: string; shortLabel: string; description: string; dotClass: string; badgeClass: string }
> = {
  inbox: {
    label: 'Inbox',
    shortLabel: 'Inbox',
    description: 'Newly captured opportunities awaiting triage',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
  },
  researching: {
    label: 'Researching',
    shortLabel: 'Research',
    description: 'Investigating codebase, reproducing bugs, designing approach',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  },
  ready: {
    label: 'Ready',
    shortLabel: 'Ready',
    description: 'Scoped and ready to implement',
    dotClass: 'bg-sky-500',
    badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  },
  in_progress: {
    label: 'In Progress',
    shortLabel: 'Active',
    description: 'Actively implementing changes locally',
    dotClass: 'bg-indigo-500',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
  },
  pr_submitted: {
    label: 'PR Submitted',
    shortLabel: 'PR Open',
    description: 'Pull request submitted and awaiting upstream review',
    dotClass: 'bg-purple-500',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  },
  completed: {
    label: 'Completed',
    shortLabel: 'Done',
    description: 'Personal work completed',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  },
  abandoned: {
    label: 'Abandoned',
    shortLabel: 'Abandoned',
    description: 'Decided not to pursue further',
    dotClass: 'bg-rose-400',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
  },
}

export const CONTRIBUTION_TYPES = [
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
] as const

export type ContributionType = (typeof CONTRIBUTION_TYPES)[number]

export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  existing_issue: 'Existing Issue',
  feature_idea: 'Feature Idea',
  bug_or_improvement: 'Bug / Improvement',
  documentation: 'Documentation',
  refactoring: 'Refactoring',
  performance: 'Performance',
  security: 'Security',
  developer_experience: 'DevEx',
  testing: 'Testing',
  other: 'Other',
}

export const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_META: Record<
  Priority,
  { label: string; weight: number; badgeClass: string }
> = {
  urgent: {
    label: 'Urgent',
    weight: 4,
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
  high: {
    label: 'High',
    weight: 3,
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  },
  medium: {
    label: 'Medium',
    weight: 2,
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  },
  low: {
    label: 'Low',
    weight: 1,
    badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  },
}

export const ESTIMATED_EFFORTS = ['xs', 's', 'm', 'l', 'xl'] as const
export type EstimatedEffort = (typeof ESTIMATED_EFFORTS)[number]

export const ESTIMATED_EFFORT_LABELS: Record<EstimatedEffort, string> = {
  xs: 'XS (< 1h)',
  s: 'S (Hours)',
  m: 'M (1-2d)',
  l: 'L (3-5d)',
  xl: 'XL (1w+)',
}

export const TRACKING_STATUSES = [
  'active',
  'watching',
  'paused',
  'archived',
] as const
export type TrackingStatus = (typeof TRACKING_STATUSES)[number]

export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  active: 'Active',
  watching: 'Watching',
  paused: 'Paused',
  archived: 'Archived',
}

export const UPSTREAM_OUTCOMES = [
  'none',
  'open_pr',
  'merged',
  'closed_unmerged',
  'accepted_externally',
] as const
export type UpstreamOutcome = (typeof UPSTREAM_OUTCOMES)[number]

export const UPSTREAM_OUTCOME_META: Record<
  UpstreamOutcome,
  { label: string; badgeClass: string }
> = {
  none: {
    label: 'No Upstream PR',
    badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  },
  open_pr: {
    label: 'PR Open Upstream',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  },
  merged: {
    label: 'Merged Upstream',
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  },
  closed_unmerged: {
    label: 'Closed (Unmerged)',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
  },
  accepted_externally: {
    label: 'Accepted Upstream',
    badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20',
  },
}

export const GITHUB_REF_TYPES = [
  'issue',
  'pull_request',
  'discussion',
  'commit',
] as const
export type GithubRefType = (typeof GITHUB_REF_TYPES)[number]

export const GITHUB_EXTERNAL_STATUSES = [
  'open',
  'closed',
  'merged',
  'unknown',
] as const
export type GithubExternalStatus = (typeof GITHUB_EXTERNAL_STATUSES)[number]

export const RESOURCE_TYPES = [
  'documentation',
  'source_file',
  'discussion',
  'external_url',
  'other',
] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  documentation: 'Documentation',
  source_file: 'Source File',
  discussion: 'Discussion',
  external_url: 'External Link',
  other: 'Other',
}

export const NOTE_CONTENT_TYPES = [
  'investigation',
  'code_snippet',
  'general',
] as const
export type NoteContentType = (typeof NOTE_CONTENT_TYPES)[number]

export const TAG_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#64748b',
] as const
