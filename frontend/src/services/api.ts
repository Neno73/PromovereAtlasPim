import { Product, Category, Supplier, ApiResponse, VerificationStatus } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337/api';

class ApiService {
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Products
  async getProducts(params?: {
    page?: number;
    pageSize?: number;
    sort?: string;
    filters?: Record<string, any>;
    populate?: string[];
  }): Promise<ApiResponse<Product[]>> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('pagination[page]', params.page.toString());
    if (params?.pageSize) searchParams.append('pagination[pageSize]', params.pageSize.toString());
    if (params?.sort) searchParams.append('sort', params.sort);
    
    const populate = params?.populate || [
      'main_image',
      'gallery_images',
      'model_image',
      'categories',
      'supplier',
      'dimensions',
      'price_tiers',
      'variants',
      'variants.primary_image',
      'variants.gallery_images'
    ];
    populate.forEach(field => {
      searchParams.append('populate', field);
    });

    if (params?.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (key === 'search') {
            searchParams.append('filters[$or][0][sku][$containsi]', value);
            searchParams.append('filters[$or][1][model][$containsi]', value);
            searchParams.append('filters[$or][2][article_number][$containsi]', value);
            searchParams.append('filters[$or][3][brand][$containsi]', value);
            searchParams.append('filters[$or][4][name][$containsi]', value);
          } else if (key === 'category') {
            searchParams.append('filters[categories][id][$eq]', value.toString());
          } else if (key === 'supplier') {
            searchParams.append('filters[supplier][id][$eq]', value.toString());
          } else if (key === 'priceMin') {
            searchParams.append('filters[price_tiers][price][$gte]', value.toString());
          } else if (key === 'priceMax') {
            searchParams.append('filters[price_tiers][price][$lte]', value.toString());
          } else if (key === 'brand') {
            searchParams.append('filters[brand][$containsi]', value);
          } else if (key === 'isActive') {
            searchParams.append('filters[is_active][$eq]', value.toString());
          } else {
            searchParams.append(`filters[${key}][$containsi]`, value.toString());
          }
        }
      });
    }

    const queryString = searchParams.toString();
    const endpoint = `/products${queryString ? `?${queryString}` : ''}`;
    
    return this.fetch<ApiResponse<Product[]>>(endpoint);
  }

  async getProduct(documentId: string): Promise<ApiResponse<Product>> {
    const populate = [
      'main_image',
      'gallery_images',
      'model_image',
      'categories',
      'supplier',
      'dimensions',
      'price_tiers',
      'variants',
      'variants.primary_image',
      'variants.gallery_images'
    ];
    const searchParams = new URLSearchParams();
    populate.forEach(field => searchParams.append('populate', field));

    return this.fetch<ApiResponse<Product>>(`/products/${documentId}?${searchParams.toString()}`);
  }

  // Categories (with parent for hierarchy building)
  // Fetches all pages since Strapi caps at 100 per page
  async getCategories(): Promise<ApiResponse<Category[]>> {
    const allCategories: Category[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.fetch<ApiResponse<Category[]>>(
        `/categories?pagination[page]=${page}&pagination[pageSize]=100&populate=parent&sort=sort_order:asc,name:asc`
      );
      allCategories.push(...response.data);
      hasMore = page < (response.meta?.pagination?.pageCount || 1);
      page++;
    }

    return {
      data: allCategories,
      meta: { pagination: { page: 1, pageSize: allCategories.length, pageCount: 1, total: allCategories.length } }
    };
  }

  // Suppliers
  async getSuppliers(): Promise<ApiResponse<Supplier[]>> {
    return this.fetch<ApiResponse<Supplier[]>>('/suppliers?pagination[pageSize]=100');
  }

  // Get unique brands from efficient backend endpoint
  async getBrands(): Promise<string[]> {
    try {
      const response = await this.fetch<{ data: string[]; meta: { total: number } }>('/products/brands');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch brands:', error);
      return [];
    }
  }

  // Verify Gemini chunks for a product
  async verifyGeminiChunks(documentId: string): Promise<{
    success: boolean;
    data?: {
      found: boolean;
      chunks: number;
      responseText: string; // The AI's synthesized response
      groundingChunks: Array<{ text: string; source?: string }>; // Raw document chunks from FileSearchStore
      product: { documentId: string; sku: string; name: any; a_number: string };
      tracking: {
        hasGeminiUri: boolean;
        foundInStore: boolean; // Whether the product was found via semantic search
        hashMatch: boolean;
        promidataHash: string | null;
        geminiSyncedHash: string | null;
      };
      searchQuery: string;
    };
    error?: string;
  }> {
    return this.fetch(`/gemini-sync/verify-product/${documentId}`, {
      method: 'POST',
    });
  }

  // Get verification status for multiple products (batch)
  async getProductVerificationStatus(documentIds: string[]): Promise<{
    success: boolean;
    data: Record<string, VerificationStatus>;
  }> {
    return this.fetch('/products/verification-status', {
      method: 'POST',
      body: JSON.stringify({ documentIds }),
    });
  }

  // Get queue statistics for sync dashboard
  async getQueueStats(): Promise<{
    success: boolean;
    data: {
      queues: Array<{
        name: string;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
      }>;
    };
  }> {
    return this.fetch('/queue-manager/stats');
  }

  // Meilisearch search endpoint
  async searchProducts(params?: {
    query?: string;
    page?: number;
    pageSize?: number;
    sort?: string[];
    facets?: string[];
    filters?: {
      supplier_code?: string;
      brand?: string;
      category?: string;
      colors?: string[];
      sizes?: string[];
      price_min?: number;
      price_max?: number;
      is_active?: boolean;
    };
  }): Promise<ApiResponse<Product[]>> {
    const searchParams = new URLSearchParams();

    // Search query
    if (params?.query) {
      searchParams.append('q', params.query);
    }

    // Pagination (convert page to offset)
    const pageSize = params?.pageSize || 20;
    const page = params?.page || 1;
    const offset = (page - 1) * pageSize;
    searchParams.append('limit', pageSize.toString());
    searchParams.append('offset', offset.toString());

    // Facets (request facet distribution)
    if (params?.facets && params.facets.length > 0) {
      searchParams.append('facets', params.facets.join(','));
    }

    // Sort
    if (params?.sort && params.sort.length > 0) {
      searchParams.append('sort', params.sort.join(','));
    }

    // Filters
    if (params?.filters) {
      if (params.filters.supplier_code) {
        searchParams.append('supplier_code', params.filters.supplier_code);
      }
      if (params.filters.brand) {
        searchParams.append('brand', params.filters.brand);
      }
      if (params.filters.category) {
        searchParams.append('category', params.filters.category);
      }
      if (params.filters.colors && params.filters.colors.length > 0) {
        searchParams.append('colors', params.filters.colors.join(','));
      }
      if (params.filters.sizes && params.filters.sizes.length > 0) {
        searchParams.append('sizes', params.filters.sizes.join(','));
      }
      if (params.filters.price_min !== undefined) {
        searchParams.append('price_min', params.filters.price_min.toString());
      }
      if (params.filters.price_max !== undefined) {
        searchParams.append('price_max', params.filters.price_max.toString());
      }
      if (params.filters.is_active !== undefined) {
        searchParams.append('is_active', params.filters.is_active.toString());
      }
    }

    const queryString = searchParams.toString();
    const endpoint = `/products/search${queryString ? `?${queryString}` : ''}`;

    return this.fetch<ApiResponse<Product[]>>(endpoint);
  }
}

export const apiService = new ApiService();
