/**
 * Custom Application Error Class
 *
 * Distinguishes between operational errors (expected, user-facing) and programming errors (bugs).
 *
 * Usage:
 *   throw new AppError('Feed not found', 404, 'NOT_FOUND');
 *
 * Operational errors (isOperational = true):
 * - Expected error conditions (validation failed, resource not found)
 * - Safe to display to users
 * - Should be handled gracefully
 *
 * Programming errors (isOperational = false):
 * - Unexpected errors (bugs, system failures)
 * - Should be logged for debugging
 * - Generic message shown to users
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Capture stack trace (excluding constructor call)
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a 400 Bad Request error
   */
  static badRequest(message = 'Bad request', code = 'BAD_REQUEST') {
    return new AppError(message, 400, code, true);
  }

  /**
   * Create a 401 Unauthorized error
   */
  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code, true);
  }

  /**
   * Create a 403 Forbidden error
   */
  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new AppError(message, 403, code, true);
  }

  /**
   * Create a 404 Not Found error
   */
  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new AppError(message, 404, code, true);
  }

  /**
   * Create a 409 Conflict error
   */
  static conflict(message = 'Resource conflict', code = 'CONFLICT') {
    return new AppError(message, 409, code, true);
  }

  /**
   * Create a 422 Unprocessable Entity error (validation failed)
   */
  static validation(message = 'Validation failed', code = 'VALIDATION_ERROR') {
    return new AppError(message, 422, code, true);
  }

  /**
   * Create a 429 Too Many Requests error
   */
  static tooManyRequests(message = 'Too many requests', code = 'RATE_LIMIT_EXCEEDED') {
    return new AppError(message, 429, code, true);
  }

  /**
   * Create a 500 Internal Server error (programming error)
   */
  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    return new AppError(message, 500, code, false);
  }
}

/**
 * Async Handler Wrapper
 *
 * Wraps async route handlers to catch errors and pass them to Express error middleware.
 * Prevents unhandled promise rejections from crashing the server.
 *
 * Usage:
 *   router.get('/', asyncHandler(async (req, res) => {
 *     const data = await someAsyncOperation();
 *     res.json(data);
 *   }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not Found Handler
 *
 * Catches requests to undefined routes
 */
export function notFound(req, res, next) {
  const error = new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(error);
}

/**
 * Global Error Handler Middleware
 *
 * Catches all errors and returns appropriate JSON responses.
 * Must be registered AFTER all routes and BEFORE any other error middleware.
 *
 * Error handling priority:
 * 1. Zod validation errors → 400 with validation message
 * 2. Operational AppError → Custom status code and message
 * 3. Programming errors → 500 with generic message
 */
export function errorHandler(err, req, res, next) {
  // Log all errors for debugging
  console.error('Error:', {
    name: err.name,
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    isOperational: err.isOperational,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: err.errors[0]?.message || 'Validation failed',
      code: 'VALIDATION_ERROR'
    });
  }

  // Operational errors (safe to show to users)
  if (err.isOperational) {
    return res.status(err.statusCode || 500).json({
      error: err.message,
      code: err.code || 'ERROR'
    });
  }

  // Programming errors (don't leak details to users)
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
}

export default {
  AppError,
  asyncHandler,
  notFound,
  errorHandler
};
