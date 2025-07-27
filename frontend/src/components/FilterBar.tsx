import { useState, useEffect, FC } from 'react';
import { Category, Supplier } from '../types';
import { getLocalizedText } from '../utils/i18n';
import { apiService } from '../services/api';
import './FilterBar.css';

interface FilterBarProps {
  onFiltersChange: (filters: Record<string, any>) => void;
  loading?: boolean;
}

export const FilterBar: FC<FilterBarProps> = ({ onFiltersChange, loading }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    supplier: '',
    brand: '',
    priceMin: '',
    priceMax: '',
    isActive: 'true'
  });

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [categoriesResponse, suppliersResponse, brandsData] = await Promise.all([
          apiService.getCategories(),
          apiService.getSuppliers(),
          apiService.getBrands()
        ]);
        
        setCategories(categoriesResponse.data);
        setSuppliers(suppliersResponse.data);
        setBrands(brandsData);
      } catch (error) {
        console.error('Failed to load filter options:', error);
      }
    };

    loadFilterOptions();
  }, []);

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Clean empty filters before sending
    const cleanedFilters = Object.entries(newFilters)
      .filter(([_, value]) => value !== '' && value !== null && value !== undefined)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    
    onFiltersChange(cleanedFilters);
  };

  // Reset all filters
  const resetFilters = () => {
    const resetFilters = {
      search: '',
      category: '',
      supplier: '',
      brand: '',
      priceMin: '',
      priceMax: '',
      isActive: 'true'
    };
    setFilters(resetFilters);
    onFiltersChange({ isActive: 'true' });
  };

  return (
    <div className="filter-bar">
      <div className="filter-section">
        <h3>Filters</h3>
        
        {/* Search */}
        <div className="filter-group">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="text"
            placeholder="Search products..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Category Filter */}
        <div className="filter-group">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            disabled={loading}
          >
            <option value="">All Categories</option>
            {categories && categories.map((category) => (
              <option key={category.id} value={category.id}>
                {getLocalizedText(category.name)}
              </option>
            ))}
          </select>
        </div>

        {/* Supplier Filter */}
        <div className="filter-group">
          <label htmlFor="supplier">Supplier</label>
          <select
            id="supplier"
            value={filters.supplier}
            onChange={(e) => handleFilterChange('supplier', e.target.value)}
            disabled={loading}
          >
            <option value="">All Suppliers</option>
            {suppliers && suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>

        {/* Brand Filter */}
        <div className="filter-group">
          <label htmlFor="brand">Brand</label>
          <select
            id="brand"
            value={filters.brand}
            onChange={(e) => handleFilterChange('brand', e.target.value)}
            disabled={loading}
          >
            <option value="">All Brands</option>
            {brands && brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>

        {/* Price Range */}
        <div className="filter-group">
          <label>Price Range</label>
          <div className="price-range">
            <input
              type="number"
              placeholder="Min price"
              value={filters.priceMin}
              onChange={(e) => handleFilterChange('priceMin', e.target.value)}
              disabled={loading}
              min="0"
              step="0.01"
            />
            <span>to</span>
            <input
              type="number"
              placeholder="Max price"
              value={filters.priceMax}
              onChange={(e) => handleFilterChange('priceMax', e.target.value)}
              disabled={loading}
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {/* Active Status */}
        <div className="filter-group">
          <label htmlFor="isActive">Status</label>
          <select
            id="isActive"
            value={filters.isActive}
            onChange={(e) => handleFilterChange('isActive', e.target.value)}
            disabled={loading}
          >
            <option value="">All Products</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>

        {/* Reset Button */}
        <button 
          className="reset-filters-btn" 
          onClick={resetFilters}
          disabled={loading}
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
};
