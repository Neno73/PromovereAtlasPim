export default {
  /**
   * An asynchronous register function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data store,
   * run jobs, or perform some special logic.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data store,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Bootstrap suppliers from the brief
    await strapi.service('api::supplier.supplier').bootstrap();
  },
};
