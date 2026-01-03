import { useState, useEffect, FC, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product, ProductVariant, ApiResponse, Media } from '../types';
import { apiService } from '../services/api';
import { getLocalizedText, formatPrice, getColorHex } from '../utils/i18n';
import { useLanguage } from '../contexts/LanguageContext';
import './ProductDetail.css';


interface ImageWithType {
  id: number;
  attributes: Media;
  type: 'main' | 'gallery' | 'model' | 'variant-primary' | 'variant-gallery';
  variantId?: number;
}

interface GroundingChunk {
  text: string;
  source?: string;
}

interface GeminiVerificationResult {
  found: boolean;
  chunks: number;
  responseText: string; // The AI's synthesized response
  groundingChunks: GroundingChunk[]; // Raw document chunks from FileSearchStore
  tracking: {
    hasGeminiUri: boolean;
    foundInStore: boolean;
    hashMatch: boolean;
    promidataHash: string | null;
    geminiSyncedHash: string | null;
  };
  searchQuery: string;
}

export const ProductDetail: FC = () => {
  const { id: documentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [mainImageFitStrategy, setMainImageFitStrategy] = useState<'cover' | 'contain'>('contain');
  const mainImageRef = useRef<HTMLImageElement>(null);

  // Gemini verification state
  const [geminiVerification, setGeminiVerification] = useState<GeminiVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

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

  // Set initial variant (primary variant or first variant)
  useEffect(() => {
    if (product && product.variants && product.variants.length > 0) {
      const primaryVariant = product.variants.find(v => v.is_primary_for_color);
      setSelectedVariant(primaryVariant || product.variants[0]);
    }
  }, [product]);

  // Reset fitting strategy and image index when selected variant changes
  useEffect(() => {
    setMainImageFitStrategy('contain');
    setSelectedImageIndex(0);
  }, [selectedVariant]);

  // Reset fitting strategy when selected image changes
  useEffect(() => {
    setMainImageFitStrategy('contain');
  }, [selectedImageIndex]);

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

  // Collect images for display (variant images if selected, otherwise product images)
  const getAllImages = (): ImageWithType[] => {
    const images: ImageWithType[] = [];

    // Show selected variant images only (don't mix with product images)
    if (selectedVariant) {
      if (selectedVariant.primary_image) {
        images.push({
          id: selectedVariant.primary_image.id,
          attributes: selectedVariant.primary_image,
          type: 'variant-primary' as const,
          variantId: selectedVariant.id
        });
      }

      if (selectedVariant.gallery_images) {
        images.push(...selectedVariant.gallery_images.map(img => ({
          id: img.id,
          attributes: img,
          type: 'variant-gallery' as const,
          variantId: selectedVariant.id
        })));
      }

      // If variant has images, return only those
      if (images.length > 0) {
        return images;
      }
    }

    // Fallback to product-level images only if no variant selected or variant has no images
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

  // Smart image fitting for main image
  const handleMainImageLoad = () => {
    const img = mainImageRef.current;
    if (img) {
      const aspectRatio = img.naturalWidth / img.naturalHeight;

      // Always use 'contain' in detail view to prevent cropping and show full image
      const strategy = 'contain';
      console.log(`Detail image aspect ratio: ${aspectRatio.toFixed(2)}, strategy: ${strategy}, dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
      setMainImageFitStrategy(strategy);
    }
  };

  // Handle Gemini verification
  const handleVerifyGemini = async () => {
    if (!documentId) return;

    setVerifying(true);
    setVerificationError(null);

    try {
      const response = await apiService.verifyGeminiChunks(documentId);
      if (response.success && response.data) {
        setGeminiVerification({
          found: response.data.found,
          chunks: response.data.chunks,
          responseText: response.data.responseText || '',
          groundingChunks: response.data.groundingChunks || [],
          tracking: response.data.tracking,
          searchQuery: response.data.searchQuery,
        });
      } else {
        setVerificationError(response.error || 'Verification failed');
      }
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  // Collect all image URLs for the R2 links section
  const collectAllImageUrls = (): Array<{ url: string; type: string; source: string }> => {
    const urls: Array<{ url: string; type: string; source: string }> = [];

    // Product images
    if (productData.main_image?.url) {
      urls.push({ url: productData.main_image.url, type: 'main', source: 'Product' });
    }
    if (productData.gallery_images) {
      productData.gallery_images.forEach((img, idx) => {
        if (img.url) urls.push({ url: img.url, type: `gallery-${idx}`, source: 'Product' });
      });
    }
    if (productData.model_image?.url) {
      urls.push({ url: productData.model_image.url, type: 'model', source: 'Product' });
    }

    // Variant images
    productData.variants?.forEach(variant => {
      if (variant.primary_image?.url) {
        urls.push({ url: variant.primary_image.url, type: 'primary', source: `Variant ${variant.sku}` });
      }
      variant.gallery_images?.forEach((img, idx) => {
        if (img.url) urls.push({ url: img.url, type: `gallery-${idx}`, source: `Variant ${variant.sku}` });
      });
    });

    return urls;
  };

  const name = getLocalizedText(productData.name, language);
  const description = getLocalizedText(productData.description, language);

  // Get unique colors from variants
  const uniqueColors = productData.variants
    ? Array.from(new Set(productData.variants.map(v => v.color).filter(Boolean)))
    : [];

  // Get variants for selected color
  const variantsForSelectedColor = selectedVariant
    ? productData.variants?.filter(v => v.color === selectedVariant.color) || []
    : [];

  const categories = productData.categories || [];
  const supplier = productData.supplier;
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
              <div className={`main-image ${mainImageFitStrategy === 'contain' ? 'image-contain' : 'image-cover'}`}>
                <img
                  ref={mainImageRef}
                  src={selectedImage.attributes.url}
                  alt={selectedImage.attributes.alternativeText || name}
                  onLoad={handleMainImageLoad}
                  style={{
                    objectFit: mainImageFitStrategy,
                  }}
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
              <span className="value">{productData.sku_supplier || productData.sku}</span>
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

          {/* Variant Selector */}
          {productData.variants && productData.variants.length > 0 && (
            <div className="variant-selector">
              <h3>Available Variants</h3>

              {/* Color Selector */}
              {uniqueColors.length > 0 && (
                <div className="color-selector">
                  <label>Color:</label>
                  <div className="color-options">
                    {uniqueColors.map(color => {
                      const variantForColor = productData.variants?.find(v => v.color === color && v.is_primary_for_color)
                        || productData.variants?.find(v => v.color === color);
                      const isSelected = selectedVariant?.color === color;
                      const hexColor = variantForColor?.hex_color || variantForColor?.supplier_color_code;
                      const displayColor = getColorHex(color, hexColor);
                      return (
                        <button
                          key={color}
                          className={`color-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            // Find primary variant for color, or fallback to first variant of that color
                            const variant = productData.variants?.find(v => v.color === color && v.is_primary_for_color)
                              || productData.variants?.find(v => v.color === color);
                            if (variant) setSelectedVariant(variant);
                          }}
                          title={color}
                        >
                          <span
                            className="color-swatch"
                            style={{ background: displayColor }}
                          >
                            {isSelected && <span className="color-check">✓</span>}
                          </span>
                          <span className="color-name">{color}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size Selector */}
              {variantsForSelectedColor.length > 1 && (
                <div className="size-selector">
                  <label htmlFor="size">Size:</label>
                  <select
                    id="size"
                    value={selectedVariant?.documentId || ''}
                    onChange={(e) => {
                      const variant = variantsForSelectedColor.find(v => v.documentId === e.target.value);
                      if (variant) setSelectedVariant(variant);
                    }}
                  >
                    {variantsForSelectedColor.map(variant => (
                      <option key={variant.documentId} value={variant.documentId}>
                        {variant.size || variant.sku}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Categories */}
          {categories.length > 0 && (
            <div className="product-categories">
              <h3>Categories</h3>
              <div className="category-tags">
                {categories.map((category) => (
                  <span key={category.id} className="category-tag">
                    {getLocalizedText(category.name, language)}
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

          {/* Sync Status Section */}
          <div className="sync-status-section">
            <h3>Sync Status</h3>
            <div className="sync-status-grid">
              <div className="sync-status-item">
                <span className="label">Promidata Hash:</span>
                <code className="hash-value">{(productData as any).promidata_hash || 'Not synced'}</code>
              </div>
              <div className="sync-status-item">
                <span className="label">Gemini Hash:</span>
                <code className="hash-value">{(productData as any).gemini_synced_hash || 'Not synced'}</code>
              </div>
              <div className="sync-status-item">
                <span className="label">Status:</span>
                {(productData as any).promidata_hash && (productData as any).gemini_synced_hash ? (
                  (productData as any).promidata_hash === (productData as any).gemini_synced_hash ? (
                    <span className="status-badge success">Up to date</span>
                  ) : (
                    <span className="status-badge warning">Needs resync</span>
                  )
                ) : (
                  <span className="status-badge neutral">Pending</span>
                )}
              </div>
              <div className="sync-status-item">
                <span className="label">Last Synced:</span>
                <span className="value">
                  {(productData as any).last_synced
                    ? new Date((productData as any).last_synced).toLocaleString()
                    : 'Never'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Image Sources Section (R2 Links) */}
          <div className="image-sources-section">
            <h3>Image Sources (R2)</h3>
            {collectAllImageUrls().length > 0 ? (
              <div className="image-sources-list">
                {collectAllImageUrls().map((img, idx) => (
                  <div key={idx} className="image-source-item">
                    <span className="source-badge">{img.source}</span>
                    <span className="type-badge">{img.type}</span>
                    <a href={img.url} target="_blank" rel="noopener noreferrer" className="r2-link">
                      {img.url.split('/').pop()}
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-images-text">No images uploaded</p>
            )}
          </div>

          {/* Gemini Verification Section */}
          <div className="gemini-verification-section">
            <h3>Gemini FileSearchStore</h3>

            <div className="gemini-tracking">
              <div className="tracking-item">
                <span className="label">Tracking Status:</span>
                {/* Show synced if found in store OR has tracking URI */}
                {(productData as any).gemini_file_uri || geminiVerification?.found ? (
                  <span className="status-badge success">Synced</span>
                ) : geminiVerification && !geminiVerification.found ? (
                  <span className="status-badge error">Not in store</span>
                ) : (
                  <span className="status-badge neutral">Unknown - Click Verify</span>
                )}
              </div>
            </div>

            <div className="verification-actions">
              <button
                onClick={handleVerifyGemini}
                disabled={verifying}
                className="verify-btn"
              >
                {verifying ? 'Verifying...' : 'Verify Chunks'}
              </button>
            </div>

            {verificationError && (
              <div className="verification-error">
                Error: {verificationError}
              </div>
            )}

            {geminiVerification && (
              <div className="verification-result">
                <div className="result-item">
                  <span className="label">Found in Store:</span>
                  {geminiVerification.found ? (
                    <span className="status-badge success">Yes</span>
                  ) : (
                    <span className="status-badge error">No</span>
                  )}
                </div>
                <div className="result-item">
                  <span className="label">Chunks Retrieved:</span>
                  <span className="value">{geminiVerification.chunks}</span>
                </div>
                <div className="result-item">
                  <span className="label">Search Query:</span>
                  <code className="query-value">{geminiVerification.searchQuery}</code>
                </div>
                <div className="result-item">
                  <span className="label">Hash Match:</span>
                  {geminiVerification.tracking.hashMatch ? (
                    <span className="status-badge success">Yes</span>
                  ) : (
                    <span className="status-badge warning">No</span>
                  )}
                </div>

                {/* Show the AI response text */}
                {geminiVerification.responseText && (
                  <div className="response-text-section">
                    <span className="label">Gemini Response (Synthesized):</span>
                    <div className="response-text-content">
                      {geminiVerification.responseText}
                    </div>
                  </div>
                )}

                {/* Show raw grounding chunks */}
                {geminiVerification.groundingChunks && geminiVerification.groundingChunks.length > 0 && (
                  <div className="grounding-chunks-section">
                    <span className="label">Retrieved Chunks ({geminiVerification.groundingChunks.length}):</span>
                    <div className="grounding-chunks-list">
                      {geminiVerification.groundingChunks.map((chunk, index) => (
                        <div key={index} className="grounding-chunk">
                          <div className="chunk-header">
                            <span className="chunk-number">Chunk {index + 1}</span>
                            {chunk.source && <span className="chunk-source">{chunk.source}</span>}
                          </div>
                          <div className="chunk-text">{chunk.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
  );
};
