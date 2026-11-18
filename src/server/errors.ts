export type AppErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'EXTERNAL_API_ERROR'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly statusCode: number
  readonly details?: Record<string, unknown>

  constructor(
    code: AppErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to access this resource') {
    super('FORBIDDEN', message, 403)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, resetAt?: Date) {
    super('RATE_LIMITED', message, 429, {
      resetAt: resetAt?.toISOString(),
    })
  }
}

export class ExternalApiError extends AppError {
  constructor(message: string, statusCode = 502) {
    super('EXTERNAL_API_ERROR', message, statusCode)
  }
}

export function toHttpErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      { status: err.statusCode },
    )
  }

  console.error('[ContribHub API Error]', err instanceof Error ? err.message : 'Unknown error')
  return Response.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred',
      },
    },
    { status: 500 },
  )
}
