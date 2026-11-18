import { z } from 'zod'
import {
  CONTRIBUTION_TYPES,
  ESTIMATED_EFFORTS,
  GITHUB_REF_TYPES,
  NOTE_CONTENT_TYPES,
  PERSONAL_STATUSES,
  PRIORITIES,
  RESOURCE_TYPES,
  TRACKING_STATUSES,
  UPSTREAM_OUTCOMES,
} from '../constants'

export const personalStatusSchema = z.enum(PERSONAL_STATUSES)
export const contributionTypeSchema = z.enum(CONTRIBUTION_TYPES)
export const prioritySchema = z.enum(PRIORITIES)
export const estimatedEffortSchema = z.enum(ESTIMATED_EFFORTS)
export const trackingStatusSchema = z.enum(TRACKING_STATUSES)
export const upstreamOutcomeSchema = z.enum(UPSTREAM_OUTCOMES)
export const githubRefTypeSchema = z.enum(GITHUB_REF_TYPES)
export const resourceTypeSchema = z.enum(RESOURCE_TYPES)
export const noteContentTypeSchema = z.enum(NOTE_CONTENT_TYPES)

const optionalUrlSchema = z
  .string()
  .trim()
  .refine(
    (v) => v === '' || /^https?:\/\/.+/i.test(v),
    'Must be a valid http:// or https:// URL',
  )
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

// Repositories
export const addRepositorySchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, 'Enter a GitHub repository URL or owner/name'),
  personalNotes: z.string().max(20_000).optional().default(''),
  trackingStatus: trackingStatusSchema.optional().default('active'),
  skipGithubLookup: z.boolean().optional().default(false),
})

export const updateUserRepositorySchema = z.object({
  repositoryId: z.string().uuid(),
  personalNotes: z.string().max(20_000).optional(),
  trackingStatus: trackingStatusSchema.optional(),
  isPinned: z.boolean().optional(),
})

// Contributions
export const createContributionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(240),
  description: z.string().max(50_000).optional().default(''),
  proposedSolution: z.string().max(50_000).optional().default(''),
  reproductionSteps: z.string().max(50_000).optional().default(''),
  repositoryId: z.string().uuid().nullable().optional(),
  repositoryIdentifier: z.string().trim().optional(),
  contributionType: contributionTypeSchema
    .optional()
    .default('bug_or_improvement'),
  personalStatus: personalStatusSchema.optional().default('inbox'),
  priority: prioritySchema.optional().default('medium'),
  estimatedEffort: estimatedEffortSchema.nullable().optional(),
  sourceUrl: optionalUrlSchema,
  githubIssueUrl: optionalUrlSchema,
  tagIds: z.array(z.string().uuid()).optional(),
  initialNote: z.string().max(20_000).optional(),
})

export const updateContributionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().max(50_000).optional(),
  proposedSolution: z.string().max(50_000).optional(),
  reproductionSteps: z.string().max(50_000).optional(),
  repositoryId: z.string().uuid().nullable().optional(),
  contributionType: contributionTypeSchema.optional(),
  personalStatus: personalStatusSchema.optional(),
  upstreamOutcome: upstreamOutcomeSchema.optional(),
  priority: prioritySchema.optional(),
  estimatedEffort: estimatedEffortSchema.nullable().optional(),
  sourceUrl: optionalUrlSchema,
  abandonedReason: z.string().max(2000).nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
})

export const moveContributionStatusSchema = z.object({
  id: z.string().uuid(),
  personalStatus: personalStatusSchema,
  kanbanPosition: z.number().finite().optional(),
  abandonedReason: z.string().max(2000).optional(),
})

export const listContributionsFilterSchema = z.object({
  repositoryId: z.string().uuid().optional(),
  statuses: z.array(personalStatusSchema).optional(),
  priorities: z.array(prioritySchema).optional(),
  types: z.array(contributionTypeSchema).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z
    .enum(['updatedAt', 'createdAt', 'priority', 'title', 'kanbanPosition'])
    .optional()
    .default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(200).optional().default(50),
})

// Research Workspace
export const createNoteSchema = z.object({
  contributionId: z.string().uuid(),
  title: z.string().trim().max(200).optional().default(''),
  content: z.string().trim().min(1, 'Note content is required').max(100_000),
  contentType: noteContentTypeSchema.optional().default('investigation'),
  codeLanguage: z.string().trim().max(40).nullable().optional(),
  isPinned: z.boolean().optional().default(false),
})

export const updateNoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().max(200).optional(),
  content: z.string().trim().min(1).max(100_000).optional(),
  contentType: noteContentTypeSchema.optional(),
  codeLanguage: z.string().trim().max(40).nullable().optional(),
  isPinned: z.boolean().optional(),
})

export const createChecklistItemSchema = z.object({
  contributionId: z.string().uuid(),
  title: z.string().trim().min(1, 'Checklist item cannot be empty').max(300),
})

export const updateChecklistItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(300).optional(),
  isCompleted: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
})

export const createResourceSchema = z.object({
  contributionId: z.string().uuid(),
  resourceType: resourceTypeSchema.optional().default('external_url'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  urlOrPath: z.string().trim().min(1, 'URL or path is required').max(2000),
  notes: z.string().max(5000).optional().default(''),
})

// Tags
export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required').max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a 6-digit hex code')
    .optional()
    .default('#6366f1'),
})

// GitHub Integration
export const linkGithubReferenceSchema = z.object({
  contributionId: z.string().uuid(),
  url: z.string().trim().min(1, 'GitHub URL is required'),
  referenceType: githubRefTypeSchema.optional(),
  title: z.string().trim().max(300).optional(),
  isPrimary: z.boolean().optional().default(false),
  fetchMetadata: z.boolean().optional().default(true),
})

// Preferences
export const updatePreferencesSchema = z.object({
  defaultBacklogView: z.enum(['kanban', 'table', 'repos', 'priority']).optional(),
  savedFilters: z
    .object({
      repositoryId: z.string().uuid().optional(),
      status: z.array(z.string()).optional(),
      priority: z.array(z.string()).optional(),
      contributionType: z.array(z.string()).optional(),
      tagIds: z.array(z.string()).optional(),
      search: z.string().optional(),
    })
    .optional(),
  tableColumns: z.record(z.string(), z.boolean()).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
})

// Extension / API v1 Quick Capture
export const quickCaptureApiSchema = z.object({
  url: z.string().trim().min(1),
  title: z.string().trim().max(240).optional(),
  contributionType: contributionTypeSchema.optional(),
  priority: prioritySchema.optional().default('medium'),
  note: z.string().max(10_000).optional(),
  personalStatus: personalStatusSchema.optional().default('inbox'),
})
