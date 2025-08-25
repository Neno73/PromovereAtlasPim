import { useState, useEffect, FC } from 'react';
import { useParams } from 'react-router-dom';
import { Product, ApiResponse } from '../types';
import { apiService } from '../services/api';
import { getLocalizedText, formatPrice, formatDimensions, formatWeight } from '../utils/i18n';
import './ProductDetail.css';

// Simple navigation function for now
const navigate = (path: string) => {
  window.location.href = path;
};

interface ImageWithType {
  id: number;
  attributes: {
    name: string;
    url: string;
    alternativeText?: string;
    caption?: string;
    width?: number;
    height?: number;
  };
  type: 'main' | 'gallery' | 'model';
}

export const ProductDetail: FC = () => {
  const { id: documentId } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (!documentId) {
      setError('Product ID is required');
      setLoading(false);
      return;
    }

    const loadProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const response: ApiResponse<Product> = await apiService.getProduct(documentId);
        setProduct(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product');
        console.error('Failed to load product:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [documentId]);

  if (loading) {
    return (
      <div className="product-detail-page">
        <div className="loading-state">
          <p>Loading product...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="product-detail-page">
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={() => navigate('/products')}>
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-page">
        <div className="error-message">
          <p>Product not found</p>
          <button onClick={() => navigate('/products')}>
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  const productData = product;
  
  // Collect all product images
  const getAllImages = (): ImageWithType[] => {
    const images: ImageWithType[] = [];
    
    if (productData.main_image) {
      images.push({
        id: productData.main_image.id,
        attributes: productData.main_image,
        type: 'main' as const
      });
    }
    
    if (productData.gallery_images) {
      images.push(...productData.gallery_images.map(img => ({
        id: img.id,
        attributes: img,
        type: 'gallery' as const
      })));
    }
    
    if (productData.model_image) {
      images.push({
        id: productData.model_image.id,
        attributes: productData.model_image,
        type: 'model' as const
      });
    }
    
    return images;
  };

  const allImages = getAllImages();
  const selectedImage = allImages[selectedImageIndex];

  const name = getLocalizedText(productData.name);
  const description = getLocalizedText(productData.description);
  const colorName = getLocalizedText(productData.color_name);
  // const modelName = getLocalizedText(productData.model_name);
  const material = getLocalizedText(productData.material);

  const categories = productData.categories || [];
  const supplier = productData.supplier;
  const dimensions = productData.dimensions;
  const priceTiers = productData.price_tiers || [];

  return (
    <div className="product-detail-page">
      {/* Header */}
      <div className="page-header">
        <button onClick={() => navigate('/products')} className="back-btn">
          ← Back to Products
        </button>
        <div className="product-status">
          <span className={`status-badge ${productData.is_active ? 'active' : 'inactive'}`}>
            {productData.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="product-detail-content">
        {/* Images Section */}
        <div className="product-images">
          {allImages.length > 0 ? (
            <>
              <div className="main-image">
                <img
                  src={selectedImage.attributes.url}
                  alt={selectedImage.attributes.alternativeText || name}
                />
                <div className="image-type-badge">
                  {selectedImage.type === 'main' ? 'Main' : 
                   selectedImage.type === 'model' ? 'Model' : 'Gallery'}
                </div>
              </div>
              
              {allImages.length > 1 && (
                <div className="image-thumbnails">
                  {allImages.map((image, index) => (
                    <button
                      key={image.id}
                      className={`thumbnail ${index === selectedImageIndex ? 'active' : ''}`}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img
                        src={image.attributes.url}
                        alt={image.attributes.alternativeText || name}
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="no-images">
              <p>No images available</p>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="product-info">
          <div className="product-header">
            <h1>{name}</h1>
            {productData.brand && (
              <div className="brand-badge">{productData.brand}</div>
            )}
          </div>

          {/* Basic Info */}
          <div className="product-meta">
            <div className="meta-item">
              <span className="label">SKU:</span>
              <span className="value">{productData.sku}</span>
            </div>
            {productData.model && (
              <div className="meta-item">
                <span className="label">Model:</span>
                <span className="value">{productData.model}</span>
              </div>
            )}
            {productData.article_number && (
              <div className="meta-item">
                <span className="label">Article Number:</span>
                <span className="value">{productData.article_number}</span>
              </div>
            )}
            {productData.ean && (
              <div className="meta-item">
                <span className="label">EAN:</span>
                <span className="value">{productData.ean}</span>
              </div>
            )}
            {supplier && (
              <div className="meta-item">
                <span className="label">Supplier:</span>
                <span className="value">{supplier.name}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {description && (
            <div className="product-description">
              <h3>Description</h3>
              <p>{description}</p>
            </div>
          )}

          {/* Categories */}
          {categories.length > 0 && (
            <div className="product-categories">
              <h3>Categories</h3>
              <div className="category-tags">
                {categories.map((category) => (
                  <span key={category.id} className="category-tag">
                    {getLocalizedText(category.name)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Price Tiers */}
          {priceTiers.length > 0 && (
            <div className="price-tiers">
              <h3>Pricing</h3>
              <div className="price-table">
                <div className="price-header">
                  <span>Quantity</span>
                  <span>Price</span>
                  {priceTiers.some(tier => tier.buying_price) && <span>Buying Price</span>}
                </div>
                {priceTiers.map((tier) => (
                  <div key={tier.id} className="price-row">
                    <span>{tier.quantity}+</span>
                    <span>{formatPrice(tier.price, tier.currency)}</span>
                    {tier.buying_price && (
                      <span>{formatPrice(tier.buying_price, tier.currency)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Details */}
          <div className="product-details">
            <h3>Details</h3>
            <div className="details-grid">
              {colorName && (
                <div className="detail-item">
                  <span className="label">Color:</span>
                  <div className="color-info">
                    <span className="value">{colorName}</span>
                    {productData.color_code && (
                      <span 
                        className="color-swatch" 
                        style={{ backgroundColor: productData.color_code }}
                        title={productData.color_code}
                      ></span>
                    )}
                  </div>
                </div>
              )}
              
              {productData.size && (
                <div className="detail-item">
                  <span className="label">Size:</span>
                  <span className="value">{productData.size}</span>
                </div>
              )}
              
              {material && (
                <div className="detail-item">
                  <span className="label">Material:</span>
                  <span className="value">{material}</span>
                </div>
              )}
              
              {productData.weight && (
                <div className="detail-item">
                  <span className="label">Weight:</span>
                  <span className="value">{formatWeight(productData.weight)}</span>
                </div>
              )}
              
              {dimensions && (
                <div className="detail-item">
                  <span className="label">Dimensions:</span>
                  <span className="value">{formatDimensions(dimensions)}</span>
                </div>
              )}
              
              {productData.country_of_origin && (
                <div className="detail-item">
                  <span className="label">Origin:</span>
                  <span className="value">{productData.country_of_origin}</span>
                </div>
              )}
              
              {productData.delivery_time && (
                <div className="detail-item">
                  <span className="label">Delivery Time:</span>
                  <span className="value">{productData.delivery_time}</span>
                </div>
              )}
              
              {productData.customs_tariff_number && (
                <div className="detail-item">
                  <span className="label">Customs Tariff:</span>
                  <span className="value">{productData.customs_tariff_number}</span>
                </div>
              )}
              
              <div className="detail-item">
                <span className="label">Tax Rate:</span>
                <span className="value">{productData.tax === 'H' ? 'High' : 'Low'}</span>
              </div>
              
              {productData.maxcolors && (
                <div className="detail-item">
                  <span className="label">Max Colors:</span>
                  <span className="value">{productData.maxcolors}</span>
                </div>
              )}
              
              <div className="detail-item">
                <span className="label">Must Have Imprint:</span>
                <span className="value">{productData.must_have_imprint ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {/* Technical Info */}
          <div className="technical-info">
            <h3>Technical Information</h3>
            <div className="tech-grid">
              <div className="tech-item">
                <span className="label">Created:</span>
                <span className="value">{new Date(productData.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="tech-item">
                <span className="label">Last Updated:</span>
                <span className="value">{new Date(productData.updatedAt).toLocaleDateString()}</span>
              </div>
              {productData.last_synced && (
                <div className="tech-item">
                  <span className="label">Last Synced:</span>
                  <span className="value">{new Date(productData.last_synced).toLocaleDateString()}</span>
                </div>
              )}
              {productData.promidata_hash && (
                <div className="tech-item">
                  <span className="label">Promidata Hash:</span>
                  <span className="value mono">{productData.promidata_hash.substring(0, 16)}...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
