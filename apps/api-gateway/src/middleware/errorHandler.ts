import { Request, Response, NextFunction } from 'express';
import type { APIResponse } from '@ai-feedback/shared-types';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('API Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';

  if (error.message.includes('validation')) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Invalid request data';
  } else if (error.message.includes('not found')) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = 'Resource not found';
  } else if (error.message.includes('unauthorized')) {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (error.message.includes('forbidden')) {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    message = 'Access denied';
  } else if (error.message.includes('conflict')) {
    statusCode = 409;
    errorCode = 'CONFLICT';
    message = 'Resource conflict';
  }

  // Handle Multer errors (file upload)
  if (error.message.includes('Only audio files are allowed')) {
    statusCode = 400;
    errorCode = 'INVALID_FILE_TYPE';
    message = 'Only audio files are allowed';
  }

  if (error.message.includes('File too large')) {
    statusCode = 413;
    errorCode = 'FILE_TOO_LARGE';
    message = 'File size exceeds maximum limit';
  }

  // Handle database errors
  if (error.message.includes('duplicate key')) {
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    message = 'Resource already exists';
  }

  if (error.message.includes('foreign key')) {
    statusCode = 400;
    errorCode = 'INVALID_REFERENCE';
    message = 'Referenced resource does not exist';
  }

  const response: APIResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          originalMessage: error.message,
          stack: error.stack
        }
      })
    }
  };

  res.status(statusCode).json(response);
}