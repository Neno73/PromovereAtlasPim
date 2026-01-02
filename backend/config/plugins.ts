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
        indexName: "pim_products",
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
          const name = entry.name || {};
          const description = entry.description || {};
          const shortDescription = entry.short_description || {};
          return {
            id: entry.documentId,
            sku: entry.sku,
            a_number: entry.a_number,
            name_en: name.en || '',
            name_de: name.de || '',
            name_fr: name.fr || '',
            name_es: name.es || '',
            description_en: description.en || '',
            description_de: description.de || '',
            short_description_en: shortDescription.en || '',
            brand: entry.brand || '',
            supplier_name: entry.supplier?.name || entry.supplier_name || '',
            category: entry.category || '',
            colors: entry.available_colors || [],
            sizes: entry.available_sizes || [],
            hex_colors: entry.hex_colors || [],
            price_min: parseFloat(entry.price_min) || 0,
            price_max: parseFloat(entry.price_max) || 0,
            main_image_url: entry.main_image?.url || '',
            is_active: entry.is_active !== false,
            updated_at: entry.updatedAt,
          };
        },
      },
      category: {
        indexName: "pim_categories",
        transformEntry({ entry }) {
          const name = entry.name || {};
          return {
            id: entry.documentId,
            code: entry.code,
            name_en: name.en || '',
            name_de: name.de || '',
            name_fr: name.fr || '',
            name_es: name.es || '',
            sort_order: entry.sort_order || 0,
          };
        },
      },
      "product-variant": {
        indexName: "pim_product_variants",
        entriesQuery: {
          populate: [
            "product",
            "primary_image",
            "gallery_images",
          ],
        },
        transformEntry({ entry }) {
          return {
            id: entry.documentId,
            sku: entry.sku,
            name: entry.name || '',
            color: entry.color || '',
            size: entry.size || '',
            hex_color: entry.hex_color || '',
            product_sku: entry.product?.sku || '',
            product_name: entry.product?.name?.en || '',
            is_active: entry.is_active !== false,
            primary_image_url: entry.primary_image?.url || '',
          };
        },
      },
    },
  },
  documentation: {
    enabled: true,
    config: {
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'PromoAtlas PIM API',
        description: 'API documentation for PromoAtlas Product Information Management system',
        contact: {
          name: 'PromoAtlas Team',
        },
      },
      'x-strapi-config': {
        plugins: ['users-permissions', 'upload'],
      },
      servers: [
        {
          url: env('API_URL', 'http://localhost:1337'),
          description: 'Development server',
        },
      ],
    },
  },
});
