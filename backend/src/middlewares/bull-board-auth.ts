/**
 * Bull Board Authentication Middleware
 *
 * Protects Bull Board routes (/admin/queues/*) with Strapi admin JWT verification
 *
 * Usage:
 * - Checks for Authorization header with Bearer token
 * - Verifies token against ADMIN_JWT_SECRET
 * - Returns 401 Unauthorized if token missing or invalid
 */

import jwt from 'jsonwebtoken';

export default (config, { strapi }) => {
  return async (ctx, next) => {
    // Only apply auth to Bull Board routes
    if (ctx.path.startsWith('/admin/queues')) {
      // Try to get token from Authorization header or cookie
      const authHeader = ctx.request.headers.authorization;
      const cookieToken = ctx.cookies.get('jwtToken');

      let token: string | null = null;

      // Priority: Authorization header > Cookie
      if (authHeader) {
        token = authHeader.split(' ')[1];
      } else if (cookieToken) {
        token = cookieToken;
      }

      if (!token) {
        ctx.status = 401;
        ctx.body = {
          error: 'Unauthorized',
          message: 'Missing authentication. Please log in to Strapi admin first.'
        };
        return;
      }

      try {
        // Verify JWT token using Strapi's admin JWT secret
        const adminJwtSecret = process.env.ADMIN_JWT_SECRET;

        if (!adminJwtSecret) {
          strapi.log.error('ADMIN_JWT_SECRET not configured');
          ctx.status = 500;
          ctx.body = {
            error: 'Internal Server Error',
            message: 'Admin JWT secret not configured'
          };
          return;
        }

        // Verify token
        const decoded = jwt.verify(token, adminJwtSecret);

        // Store decoded token in context for potential later use
        ctx.state.user = decoded;

        // Token is valid, continue to Bull Board
        await next();
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          ctx.status = 401;
          ctx.body = {
            error: 'Unauthorized',
            message: 'Token expired. Please log in again.'
          };
        } else if (error.name === 'JsonWebTokenError') {
          ctx.status = 401;
          ctx.body = {
            error: 'Unauthorized',
            message: 'Invalid token. Please log in again.'
          };
        } else {
          strapi.log.error('Bull Board auth error:', error);
          ctx.status = 500;
          ctx.body = {
            error: 'Internal Server Error',
            message: 'Authentication failed'
          };
        }
        return;
      }
    } else {
      // Not a Bull Board route, pass through
      await next();
    }
  };
};
