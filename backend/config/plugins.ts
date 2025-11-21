export default ({ env }) => ({
  upload: {
    config: {
      provider: "strapi-provider-cloudflare-r2",
      providerOptions: {
        accessKeyId: env("R2_ACCESS_KEY_ID"),
        secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
        endpoint: env("R2_ENDPOINT"),
        accountId: env("R2_ACCOUNT_ID"),
        params: {
          Bucket: env("R2_BUCKET_NAME"),
        },
        publicUrl: env("R2_PUBLIC_URL"),
        cloudflarePublicAccessUrl: env("R2_PUBLIC_URL"),
        pool: true,
      },
    },
  },
  meilisearch: {
    enabled: true,
    config: {
      host: env("MEILISEARCH_HOST"),
      apiKey: env("MEILISEARCH_ADMIN_KEY"),
      product: {
        indexName: env("MEILISEARCH_INDEX_NAME", "promoatlas_products"),
        entriesQuery: {
          populate: [
            "supplier",
            "categories",
            "variants",
            "main_image",
            "gallery_images",
            "price_tiers",
            "dimensions",
          ],
        },
        transformEntry({ entry }) {
          // Transform Strapi entry to Meilisearch document
          return {
            id: entry.documentId,
            ...entry,
          };
        },
      },
      "product-variant": {
        indexName: "promoatlas_product_variant",
        entriesQuery: {
          populate: [
            "product",
            "primary_image",
            "gallery_images",
          ],
        },
        transformEntry({ entry }) {
          // Transform Strapi entry to Meilisearch document
          return {
            id: entry.documentId,
            ...entry,
          };
        },
      },
    },
  },
});
