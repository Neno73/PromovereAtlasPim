export interface MultilingualText {
  en?: string;
  de?: string;
  fr?: string;
  es?: string;
  [key: string]: string | undefined;
}

export interface PriceTier {
  id: number;
  quantity: number;
  price: number;
  buying_price?: number;
  currency: string;
}

export interface Dimensions {
  id: number;
  length?: number;
  width?: number;
  height?: number;
  diameter?: number;
  weight?: number;
  unit: 'cm' | 'mm' | 'm' | 'in';
  weight_unit: 'g' | 'kg' | 'oz' | 'lb';
}

export interface Product {
  id: number;
  attributes: {
    sku: string;
    model?: string;
    article_number?: string;
    sku_supplier?: string;
    ean?: string;
    name: MultilingualText;
    description?: MultilingualText;
    color_name?: MultilingualText;
    color_code?: string;
    model_name?: MultilingualText;
    search_color?: string;
    size?: string;
    dimension?: string;
    meta_keyword?: string;
    weight?: number;
    brand?: string;
    material?: MultilingualText;
    country_of_origin?: string;
    delivery_time?: string;
    customs_tariff_number?: string;
    tax: 'H' | 'L';
    filter_codes?: string;
    main_category?: string;
    additional_categories?: string;
    maxcolors?: number;
    print_option_group?: string;
    must_have_imprint: boolean;
    customization?: any;
    refining?: any;
    refining_dimensions?: any;
    refining_location?: any;
    is_active: boolean;
    promidata_hash?: string;
    last_synced?: string;
    dimensions?: Dimensions;
    price_tiers?: PriceTier[];
    main_image?: {
      data?: {
        id: number;
        attributes: {
          name: string;
          url: string;
          alternativeText?: string;
          caption?: string;
          width?: number;
          height?: number;
        };
      };
    };
    gallery_images?: {
      data: Array<{
        id: number;
        attributes: {
          name: string;
          url: string;
          alternativeText?: string;
          caption?: string;
          width?: number;
          height?: number;
        };
      }>;
    };
    model_image?: {
      data?: {
        id: number;
        attributes: {
          name: string;
          url: string;
          alternativeText?: string;
          caption?: string;
          width?: number;
          height?: number;
        };
      };
    };
    categories?: {
      data: Category[];
    };
    supplier?: {
      data: {
        id: number;
        attributes: {
          name: string;
          code: string;
        };
      };
    };
    createdAt: string;
    updatedAt: string;
  };
}

export interface Category {
  id: number;
  attributes: {
    code: string;
    name: MultilingualText;
    sort_order: number;
    parent?: {
      data: Category;
    };
    children?: {
      data: Category[];
    };
    createdAt: string;
    updatedAt: string;
  };
}

export interface Supplier {
  id: number;
  attributes: {
    name: string;
    code: string;
    website?: string;
    email?: string;
    phone?: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface ApiResponse<T> {
  data: T;
  meta: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}
