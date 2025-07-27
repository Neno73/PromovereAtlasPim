import { Product, Category, Supplier, ApiResponse } from '../types';

interface BrandProduct {
  id: number;
  brand?: string;
}

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
      'price_tiers'
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
    return this.fetch<ApiResponse<Product>>(`/products/${documentId}?populate=*`);
  }

  // Categories
  async getCategories(): Promise<ApiResponse<Category[]>> {
    return this.fetch<ApiResponse<Category[]>>('/categories?pagination[pageSize]=100&populate=parent');
  }

  // Suppliers
  async getSuppliers(): Promise<ApiResponse<Supplier[]>> {
    return this.fetch<ApiResponse<Supplier[]>>('/suppliers?pagination[pageSize]=100');
  }

  // Get unique brands
  async getBrands(): Promise<string[]> {
    try {
      const response = await this.fetch<ApiResponse<BrandProduct[]>>('/products?fields[0]=brand&pagination[pageSize]=1000');
      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }
      const brands = response.data
        .map(product => product.brand)
        .filter((brand): brand is string => brand !== undefined && brand !== null && brand.trim() !== '')
        .filter((brand, index, array) => array.indexOf(brand) === index)
        .sort();
      return brands;
    } catch (error) {
      console.error('Failed to fetch brands:', error);
      return [];
    }
  }
}

export const apiService = new ApiService();
