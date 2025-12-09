import { FC } from 'react';
import { Product, ProductData, ProductVariant, PriceTier } from '../types';
import { getLocalizedText, formatPrice, getColorHex } from '../utils/i18n';
import { useLanguage } from '../contexts/LanguageContext';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export const ProductCard: FC<ProductCardProps> = ({ product, onClick }) => {
  const { language } = useLanguage();

  if (!product) {
    // This will prevent the component from crashing if the product data is malformed.
    return null;
  }

  // ProductData type supports both Strapi nested format and Meilisearch flat format
  const productData = product as ProductData;

  // Get primary variant (for display in product list)
  const primaryVariant = productData.variants?.find((v: ProductVariant) => v.is_primary_for_color);

  // Get the best available image URL (prioritize variant, fallback to product)
  const getImageUrl = (): string | null => {
    // Try primary variant images first
    if (primaryVariant?.primary_image?.url) {
      return primaryVariant.primary_image.url;
    }
    if (primaryVariant?.gallery_images?.[0]?.url) {
      return primaryVariant.gallery_images[0].url;
    }

    // Check for Meilisearch flat string format (main_image_url)
    if (productData.main_image_url) {
      return productData.main_image_url;
    }

    // Fallback to product-level images (Strapi object format)
    if (productData.main_image?.url) {
      return productData.main_image.url;
    }
    if (productData.gallery_images?.[0]?.url) {
      return productData.gallery_images[0].url;
    }
    if (productData.model_image?.url) {
      return productData.model_image.url;
    }
    return null;
  };

  const imageUrl = getImageUrl();

  // Helper to get localized text from both Meilisearch flat format and Strapi nested format
  const getLocalizedField = (baseName: string): string => {
    // Use Record type for dynamic field access
    const data = productData as unknown as Record<string, string | number | object | undefined>;

    // Try Meilisearch flat format first: name_en, name_de, etc.
    const langKey = `${baseName}_${language}`;
    if (data[langKey] && typeof data[langKey] === 'string') {
      return data[langKey] as string;
    }
    // Fallback chain for Meilisearch: en → de → fr → es
    if (data[`${baseName}_en`]) return data[`${baseName}_en`] as string;
    if (data[`${baseName}_de`]) return data[`${baseName}_de`] as string;
    if (data[`${baseName}_fr`]) return data[`${baseName}_fr`] as string;
    if (data[`${baseName}_es`]) return data[`${baseName}_es`] as string;

    // Try Strapi nested format: { en: "...", de: "..." }
    if (data[baseName] && typeof data[baseName] === 'object') {
      return getLocalizedText(data[baseName] as Record<string, string>, language);
    }
    // Return as string if it's a plain string
    if (typeof data[baseName] === 'string') {
      return data[baseName] as string;
    }
    return '';
  };

  const name = getLocalizedField('name');
  const description = getLocalizedField('description');
  
  // Get lowest price - supports both Meilisearch (price_min) and Strapi (price_tiers) formats
  const getLowestPrice = (): { price: number; currency: string } | null => {
    // Try Meilisearch flat format first
    if (productData.price_min !== undefined && productData.price_min !== null) {
      return {
        price: productData.price_min,
        currency: productData.currency || 'EUR'
      };
    }

    // Fallback to Strapi price_tiers format
    if (!productData.price_tiers || productData.price_tiers.length === 0) {
      return null;
    }
    const lowestTier = productData.price_tiers.reduce((min: PriceTier, tier: PriceTier) =>
      tier.price < min.price ? tier : min,
      productData.price_tiers[0]
    );
    return {
      price: lowestTier.price,
      currency: lowestTier.currency || 'EUR'
    };
  };

  const lowestPrice = getLowestPrice();

  // Get category - supports both Meilisearch (category string) and Strapi (categories array)
  const getCategoryName = (): string => {
    // Try Meilisearch flat format
    if (productData.category && typeof productData.category === 'string') {
      return productData.category;
    }
    // Try Strapi categories array format
    if (productData.categories?.[0]) {
      const cat = productData.categories[0];
      if (typeof cat.name === 'object') {
        return getLocalizedText(cat.name, language);
      }
      return cat.name || cat.code || '';
    }
    return '';
  };

  // Get supplier name - supports both Meilisearch (supplier_name) and Strapi (supplier.name)
  const getSupplierName = (): string => {
    if (productData.supplier_name) {
      return productData.supplier_name;
    }
    if (productData.supplier?.name) {
      return productData.supplier.name;
    }
    return '';
  };

  const categoryName = getCategoryName();
  const supplierName = getSupplierName();

  return (
    <div className="product-card" onClick={onClick}>
      <div className="product-image">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
          />
        ) : (
          <div className="no-image">
            <span>No Image</span>
          </div>
        )}
        {productData.brand && (
          <div className="product-brand-badge">
            {productData.brand}
          </div>
        )}
      </div>
      
      <div className="product-info">
        <h3 className="product-title">{name}</h3>
        
        <div className="product-meta">
          <p className="product-sku">SKU: {productData.sku_supplier || productData.sku}</p>
          {productData.model && (
            <p className="product-model">Model: {productData.model}</p>
          )}
        </div>
        
        {description && (
          <p className="product-description">
            {description.length > 140 ? `${description.substring(0, 140)}...` : description}
          </p>
        )}
        
        {lowestPrice && (
          <div className="product-pricing">
            <p className="product-price">
              From {formatPrice(lowestPrice.price, lowestPrice.currency)}
            </p>
            {productData.price_tiers && productData.price_tiers.length > 1 && (
              <p className="price-tiers-info">
                {productData.price_tiers.length} price tiers
              </p>
            )}
          </div>
        )}
        
        <div className="product-details">
          {categoryName && (
            <span className="product-category">
              {categoryName}
            </span>
          )}

          {supplierName && (
            <span className="product-supplier">
              {supplierName}
            </span>
          )}
        </div>

        {/* Show color info - from variants or Meilisearch colors array */}
        {(primaryVariant?.color || (productData.colors && productData.colors.length > 0)) && (() => {
          const colorName = primaryVariant?.color || productData.colors?.[0] || '';
          const hexColor = primaryVariant?.hex_color || primaryVariant?.supplier_color_code || productData.hex_colors?.[0];
          const displayColor = getColorHex(colorName, hexColor);
          return (
            <div className="product-color">
              <span className="color-label">Color:</span>
              <span className="color-name">{colorName}</span>
              <span
                className="color-swatch"
                style={{ background: displayColor }}
                title={colorName}
              ></span>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
