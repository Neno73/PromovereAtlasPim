/**
 * Controller Helpers - Eliminates repetitive patterns in controllers
 * Standard error handling, service access, and response formatting
 */

// Standard context interface for controllers
export interface StandardContext {
  request: {
    body: any;
  };
  query: any;
  body: any;
  params: any;
  badRequest: (message: string, details?: any) => void;
  notFound: (message: string) => void;
  throw: (status: number, message: string) => void;
}

/**
 * Standard try-catch wrapper for controller methods
 */
export function withErrorHandling(
  handler: (ctx: StandardContext) => Promise<any>
) {
  return async (ctx: StandardContext) => {
    try {
      return await handler(ctx);
    } catch (error) {
      ctx.badRequest("Operation failed", { details: error.message });
    }
  };
}

/**
 * Standard service accessor
 */
export function getService(servicePath: string) {
  return strapi.service(servicePath as any);
}

/**
 * Standard success response
 */
export function successResponse(data: any, message?: string) {
  return {
    success: true,
    ...(message && { message }),
    data,
  };
}

/**
 * Standard controller method factory
 */
export function createControllerMethod(
  servicePath: string,
  serviceMethod: string,
  successMessage?: string
) {
  return withErrorHandling(async (ctx: StandardContext) => {
    const service = getService(servicePath);
    const result = await service[serviceMethod](
      ctx.request.body,
      ctx.query,
      ctx.params
    );

    ctx.body = successResponse(result, successMessage);
  });
}
