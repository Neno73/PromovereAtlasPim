/**
 * Database Helpers - Eliminates repetitive database operations
 * Standard CRUD operations and query patterns
 */

/**
 * Standard entity operations with proper typing
 */
export class EntityManager {
  constructor(private entityPath: any) {}

  async findMany(filters: any = {}, options: any = {}): Promise<any[]> {
    const result = await strapi.entityService.findMany(this.entityPath as any, {
      filters,
      ...options,
    });
    // Ensure we always return an array
    return Array.isArray(result) ? result : [result].filter(Boolean);
  }

  async findOne(id: string | number, options: any = {}) {
    return strapi.entityService.findOne(this.entityPath as any, id, options);
  }

  async findByCode(code: string, options: any = {}) {
    const results = await this.findMany({ code }, options);
    return results.length > 0 ? results[0] : null;
  }

  async create(data: any) {
    return strapi.entityService.create(this.entityPath as any, { data });
  }

  async update(id: string | number, data: any) {
    return strapi.entityService.update(this.entityPath as any, id, { data });
  }

  async delete(id: string | number) {
    return strapi.entityService.delete(this.entityPath as any, id);
  }

  async createOrUpdate(
    identifierField: string,
    identifierValue: any,
    data: any
  ) {
    const existing = await this.findMany({
      [identifierField]: identifierValue,
    });

    if (existing.length > 0) {
      return {
        entity: await this.update(existing[0].id, data),
        created: false,
      };
    } else {
      return {
        entity: await this.create(data),
        created: true,
      };
    }
  }
}

/**
 * Entity manager factory
 */
export function createEntityManager(entityPath: string) {
  return new EntityManager(entityPath);
}

/**
 * Service accessor utility
 */
export function getService(servicePath: string) {
  return strapi.service(servicePath as any);
}

/**
 * Common entity managers
 */
export const productManager = createEntityManager("api::product.product");
export const supplierManager = createEntityManager("api::supplier.supplier");
export const categoryManager = createEntityManager("api::category.category");
export const syncConfigManager = createEntityManager(
  "api::sync-configuration.sync-configuration"
);
