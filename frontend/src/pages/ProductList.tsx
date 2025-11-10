import { useState, useEffect, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, ApiResponse } from '../types';
import { apiService } from '../services/api';
import { ProductCard } from '../components/ProductCard';
import { FilterBar } from '../components/FilterBar';
import { LanguageSelector } from '../components/LanguageSelector';
import './ProductList.css';

export const ProductList: FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 12,
    pageCount: 0,
    total: 0
  });
  const [filters, setFilters] = useState<Record<string, any>>({ isActive: 'true' });
  const [sortBy, setSortBy] = useState('updatedAt:desc');

  // Load products using Meilisearch
  const loadProducts = async (page: number = 1, newFilters?: Record<string, any>) => {
    try {
      setLoading(true);
      setError(null);

      const currentFilters = newFilters || filters;

      // Extract search query
      const searchQuery = currentFilters.search || '';

      // Map filters to Meilisearch format
      const meilisearchFilters: any = {};

      if (currentFilters.supplier) {
        meilisearchFilters.supplier_code = currentFilters.supplier;
      }
      if (currentFilters.brand) {
        meilisearchFilters.brand = currentFilters.brand;
      }
      if (currentFilters.category) {
        meilisearchFilters.category = currentFilters.category;
      }
      if (currentFilters.priceMin !== undefined && currentFilters.priceMin !== '') {
        meilisearchFilters.price_min = parseFloat(currentFilters.priceMin);
      }
      if (currentFilters.priceMax !== undefined && currentFilters.priceMax !== '') {
        meilisearchFilters.price_max = parseFloat(currentFilters.priceMax);
      }
      if (currentFilters.isActive !== undefined) {
        meilisearchFilters.is_active = currentFilters.isActive === 'true' || currentFilters.isActive === true;
      }

      // Convert sort format (e.g., "updatedAt:desc" -> ["updatedAt:desc"])
      const sortArray = sortBy ? [sortBy] : [];

      // Request facets for filter dropdowns
      const facets = ['supplier_code', 'brand', 'category', 'colors', 'sizes'];

      // Try Meilisearch first, fallback to old API if not available
      let response: ApiResponse<Product[]>;
      try {
        response = await apiService.searchProducts({
          query: searchQuery,
          page,
          pageSize: pagination.pageSize,
          sort: sortArray,
          facets,
          filters: meilisearchFilters,
        });
      } catch (searchError) {
        console.warn('Meilisearch not available, falling back to old API:', searchError);
        // Fallback to old API
        response = await apiService.getProducts({
          page,
          pageSize: pagination.pageSize,
          sort: sortBy,
          filters: currentFilters,
        });
      }

      setProducts(response.data);
      if (response.meta.pagination) {
        setPagination(prev => ({
          ...prev,
          page: response.meta.pagination!.page,
          pageCount: response.meta.pagination!.pageCount,
          total: response.meta.pagination!.total,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadProducts(1);
  }, [sortBy]);

  // Handle filter changes
  const handleFiltersChange = (newFilters: Record<string, any>) => {
    setFilters(newFilters);
    loadProducts(1, newFilters);
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    loadProducts(newPage);
  };

  // Handle product click
  const handleProductClick = (productDocumentId: string) => {
    navigate(`/products/${productDocumentId}`);
  };

  // Handle sort change
  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
  };

  return (
    <div className="product-list-page">
      <div className="page-header">
        <h1>Products</h1>
        <div className="page-actions">
          <LanguageSelector />
          <div className="sort-section">
            <label htmlFor="sort">Sort by:</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              disabled={loading}
            >
              <option value="updatedAt:desc">Recently Updated</option>
              <option value="createdAt:desc">Recently Added</option>
              <option value="sku:asc">SKU A-Z</option>
              <option value="sku:desc">SKU Z-A</option>
              <option value="brand:asc">Brand A-Z</option>
              <option value="brand:desc">Brand Z-A</option>
              <option value="price_min:asc">Price Low to High</option>
              <option value="price_min:desc">Price High to Low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="product-list-content">
        <div className="sidebar">
          <FilterBar onFiltersChange={handleFiltersChange} loading={loading} />
        </div>

        <div className="main-content">
          {error && (
            <div className="error-message">
              <p>Error: {error}</p>
              <button onClick={() => loadProducts(pagination.page)}>
                Try Again
              </button>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <p>Loading products...</p>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="results-summary">
                <p>
                  Showing {products.length} of {pagination.total} products
                  {pagination.pageCount > 1 && ` (Page ${pagination.page} of ${pagination.pageCount})`}
                </p>
              </div>

              {products.length > 0 ? (
                <>
                  <div className="products-grid">
                    {products.map((product) => {
                      console.log('Rendering product:', product);
                      return (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onClick={() => handleProductClick(product.documentId)}
                        />
                      );
                    })}
                  </div>

                  {pagination.pageCount > 1 && (
                    <div className="pagination">
                      <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page <= 1 || loading}
                        className="pagination-btn"
                      >
                        Previous
                      </button>

                      <div className="pagination-info">
                        <span>
                          Page {pagination.page} of {pagination.pageCount}
                        </span>
                      </div>

                      <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.pageCount || loading}
                        className="pagination-btn"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-products">
                  <h3>No products found</h3>
                  <p>Try adjusting your filters or search terms.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
