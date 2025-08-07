/**
 * Promidata Sync Controller
 * Handles API endpoints for managing Promidata synchronization
 */

import {
  withErrorHandling,
  getService,
  successResponse,
  createControllerMethod,
  StandardContext,
} from "../../../utils/controller-helpers";

const SYNC_SERVICE = "api::promidata-sync.promidata-sync";

export default {
  /**
   * Start manual sync for all suppliers or a specific supplier
   */
  startSync: withErrorHandling(async (ctx: StandardContext) => {
    const { supplierId } = ctx.request.body;
    const service = getService(SYNC_SERVICE);
    const result = await service.startSync(supplierId);

    ctx.body = successResponse(result, "Sync started successfully");
  }),

  /**
   * Get sync status for all suppliers
   */
  getSyncStatus: createControllerMethod(SYNC_SERVICE, "getSyncStatus"),

  /**
   * Get sync history/logs
   */
  getSyncHistory: withErrorHandling(async (ctx: StandardContext) => {
    const { page = 1, pageSize = 25 } = ctx.query;
    const service = getService(SYNC_SERVICE);
    const history = await service.getSyncHistory({
      page: Number(page),
      pageSize: Number(pageSize),
    });

    ctx.body = successResponse(history);
  }),

  /**
   * Import categories from CAT.csv
   */
  importCategories: createControllerMethod(
    SYNC_SERVICE,
    "importCategories",
    "Categories imported successfully"
  ),

  /**
   * Test connection to Promidata API
   */
  testConnection: createControllerMethod(
    SYNC_SERVICE,
    "testConnection",
    "Connection test successful"
  ),
};
