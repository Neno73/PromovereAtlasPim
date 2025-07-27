import { FC } from 'react';
import { Product } from '../types';
import { getLocalizedText, formatPrice } from '../utils/i18n';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export const ProductCard: FC<ProductCardProps> = ({ product, onClick }) => {
  if (!product) {
    // This will prevent the component from crashing if the product data is malformed.
    return null;
  }

  const productData = product;

  // Get the best available image
  const getProductImage = () => {
    if (productData.main_image) {
      return productData.main_image;
    }
    if (productData.gallery_images?.[0]) {
      return productData.gallery_images[0];
    }
    if (productData.model_image) {
      return productData.model_image;
    }
    return null;
  };

  const productImage = getProductImage();
  const imageUrl = productImage ? productImage.url : null;
  
  const name = getLocalizedText(productData.name);
  const description = getLocalizedText(productData.description);
  
  // Get lowest price from price tiers
  const getLowestPrice = () => {
    if (!productData.price_tiers || productData.price_tiers.length === 0) {
      return null;
    }
    const lowestTier = productData.price_tiers.reduce((min, tier) => 
      tier.price < min.price ? tier : min,
      productData.price_tiers[0]
    );
    return lowestTier;
  };

  const lowestPrice = getLowestPrice();
  const primaryCategory = productData.categories?.[0];
  const supplier = productData.supplier;

  return (
    <div className="product-card" onClick={onClick}>
      <div className="product-image">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={productImage?.alternativeText || name}
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
          <p className="product-sku">SKU: {productData.sku}</p>
          {productData.model && (
            <p className="product-model">Model: {productData.model}</p>
          )}
        </div>
        
        {description && (
          <p className="product-description">
            {description.length > 100 ? `${description.substring(0, 100)}...` : description}
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
          {primaryCategory && (
            <span className="product-category">
              {getLocalizedText(primaryCategory.name)}
            </span>
          )}
          
          {supplier && (
            <span className="product-supplier">
              {supplier.name}
            </span>
          )}
        </div>

        {productData.color_name && (
          <div className="product-color">
            <span className="color-label">Color:</span>
            <span className="color-name">{getLocalizedText(productData.color_name)}</span>
            {productData.color_code && (
              <span 
                className="color-swatch" 
                style={{ backgroundColor: productData.color_code }}
                title={productData.color_code}
              ></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
