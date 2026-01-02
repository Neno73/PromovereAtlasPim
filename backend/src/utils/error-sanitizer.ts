/**
 * Error Sanitization Utility
 * Formats errors for API responses, hiding sensitive information in production
 */

interface SanitizedError {
    message: string;
    code?: string;
    statusCode?: number;
    details?: any;
}

/**
 * Sanitize error for API response
 * Hides stack traces and internal paths in production
 * 
 * @param error The error to sanitize
 * @param includeStack Whether to include stack trace (default: false in production)
 * @returns Sanitized error object safe for API response
 */
export function sanitizeError(
    error: any,
    includeStack: boolean = process.env.NODE_ENV !== 'production'
): SanitizedError {
    const sanitized: SanitizedError = {
        message: 'An error occurred',
        statusCode: 500,
    };

    // Extract message
    if (error.message) {
        // Remove file paths from error messages
        sanitized.message = error.message.replace(/\/[^\s]+/g, '[PATH]');
    }

    // Extract status code
    if (error.statusCode) {
        sanitized.statusCode = error.statusCode;
    } else if (error.response?.status) {
        sanitized.statusCode = error.response.status;
    }

    // Extract error code
    if (error.code) {
        sanitized.code = error.code;
    }

    // Include stack trace only in development
    if (includeStack && error.stack) {
        sanitized.details = {
            stack: error.stack,
            name: error.name,
        };
    }

    // Include additional details in development
    if (includeStack) {
        if (error.response?.data) {
            sanitized.details = {
                ...sanitized.details,
                responseData: error.response.data,
            };
        }
    }

    return sanitized;
}

/**
 * Format error for logging
 * Includes full details for debugging
 * 
 * @param error The error to format
 * @param context Additional context
 * @returns Formatted error object for logging
 */
export function formatErrorForLogging(error: any, context?: Record<string, any>) {
    return {
        message: error.message,
        name: error.name,
        code: error.code,
        statusCode: error.statusCode || error.response?.status,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
    };
}
