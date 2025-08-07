/**
 * API Factory - Eliminates copy-paste boilerplate across API modules
 * Instead of having identical controllers/routes/services, generate them dynamically
 */

import { factories } from "@strapi/strapi";

/**
 * Creates standard Strapi controller for an API
 */
export function createStandardController(apiPath: any) {
  return factories.createCoreController(apiPath);
}

/**
 * Creates standard Strapi router for an API
 */
export function createStandardRouter(apiPath: any) {
  return factories.createCoreRouter(apiPath);
}

/**
 * Creates standard Strapi service for an API
 */
export function createStandardService(apiPath: any) {
  return factories.createCoreService(apiPath);
}

/**
 * Creates extended controller with custom methods
 */
export function createExtendedController(apiPath: any, extensions: any) {
  return factories.createCoreController(apiPath, extensions);
}

/**
 * Creates extended service with custom methods
 */
export function createExtendedService(apiPath: any, extensions: any) {
  return factories.createCoreService(apiPath, extensions);
}
