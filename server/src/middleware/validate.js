import { ZodError } from 'zod';

/**
 * Validation middleware for Express routes using Zod schemas
 *
 * Usage:
 * router.post('/endpoint', validateBody(CreatePostSchema), (req, res) => {
 *   // req.body is validated and typed
 * });
 */

export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors into user-friendly messages
        const errorMessages = error.errors.map(e => {
          const path = e.path.join('.');
          const message = e.message;
          return path ? `${path}: ${message}` : message;
        });

        return res.status(400).json({
          error: errorMessages[0] || 'Validation failed'
        });
      }
      next(error);
    }
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(e => {
          const path = e.path.join('.');
          const message = e.message;
          return path ? `${path}: ${message}` : message;
        });

        return res.status(400).json({
          error: errorMessages[0] || 'Validation failed'
        });
      }
      next(error);
    }
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(e => {
          const path = e.path.join('.');
          const message = e.message;
          return path ? `${path}: ${message}` : message;
        });

        return res.status(400).json({
          error: errorMessages[0] || 'Validation failed'
        });
      }
      next(error);
    }
  };
}

/**
 * Async handler wrapper that catches errors and passes them to Express error handler
 * This eliminates the need for try-catch blocks in async route handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
