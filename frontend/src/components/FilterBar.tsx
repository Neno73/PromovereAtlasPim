import { useState, useEffect, FC, useCallback } from 'react';
import { Category, Supplier, FacetDistribution } from '../types';
import { apiService } from '../services/api';
import { useDebounce } from '../hooks/useDebounce';
import { CategoryTree } from './CategoryTree';
import './FilterBar.css';

interface FilterBarProps {
  onFiltersChange: (filters: Record<string, any>) => void;
  loading?: boolean;
  facets?: FacetDistribution;
  categories?: Category[];
}

// Collapsible section component
const FilterSection: FC<{
  title: string;
  count?: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}> = ({ title, count, defaultExpanded = true, children }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={`filter-section-collapsible ${expanded ? 'expanded' : 'collapsed'}`}>
      <button
        className="filter-section-header"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <span className="filter-section-title">
          {title}
          {count !== undefined && count > 0 && (
            <span className="filter-count-badge">{count}</span>
          )}
        </span>
        <span className="filter-section-toggle">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && <div className="filter-section-content">{children}</div>}
    </div>
  );
};

// Color swatch component
const ColorSwatch: FC<{
  color: string;
  hexColor?: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
}> = ({ color, hexColor, count, selected, onClick }) => {
  // Map common color names to hex values
  const colorMap: Record<string, string> = {
    'Red': '#E53935', 'Blue': '#1E88E5', 'Green': '#43A047', 'Yellow': '#FDD835',
    'Orange': '#FB8C00', 'Purple': '#8E24AA', 'Pink': '#D81B60', 'Black': '#212121',
    'White': '#FAFAFA', 'Grey': '#757575', 'Gray': '#757575', 'Brown': '#6D4C41',
    'Navy': '#1A237E', 'Beige': '#D7CCC8', 'Gold': '#FFD700', 'Silver': '#C0C0C0',
  };

  const bgColor = hexColor || colorMap[color] || '#999';
  const isLight = ['White', 'Yellow', 'Beige', 'Silver'].includes(color);

  return (
    <button
      type="button"
      className={`color-swatch ${selected ? 'selected' : ''}`}
      onClick={onClick}
      title={`${color}${count !== undefined ? ` (${count})` : ''}`}
      style={{ backgroundColor: bgColor }}
    >
      {selected && <span className={`checkmark ${isLight ? 'dark' : 'light'}`}>✓</span>}
      {count !== undefined && <span className="swatch-count">{count}</span>}
    </button>
  );
};

// Size chip component
const SizeChip: FC<{
  size: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
}> = ({ size, count, selected, onClick }) => (
  <button
    type="button"
    className={`size-chip ${selected ? 'selected' : ''}`}
    onClick={onClick}
  >
    {size}
    {count !== undefined && <span className="chip-count">({count})</span>}
  </button>
);

export const FilterBar: FC<FilterBarProps> = ({
  onFiltersChange,
  loading,
  facets,
  categories: propCategories
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Local search state for debouncing
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  const [filters, setFilters] = useState({
    search: '',
    category: '',
    supplier: '',
    brand: '',
    colors: [] as string[],
    sizes: [] as string[],
    priceMin: '',
    priceMax: '',
    isActive: 'true'
  });

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [categoriesResponse, suppliersResponse] = await Promise.all([
          propCategories ? Promise.resolve({ data: propCategories }) : apiService.getCategories(),
          apiService.getSuppliers(),
        ]);

        setCategories(categoriesResponse.data);
        setSuppliers(suppliersResponse.data);
      } catch (error) {
        console.error('Failed to load filter options:', error);
      }
    };

    loadFilterOptions();
  }, [propCategories]);

  // Handle debounced search changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      handleFilterChange('search', debouncedSearch);
    }
  }, [debouncedSearch]);

  // Handle filter changes
  const handleFilterChange = useCallback((key: string, value: any) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };

      // Clean empty filters before sending
      const cleanedFilters = Object.entries(newFilters)
        .filter(([_, v]) => {
          if (Array.isArray(v)) return v.length > 0;
          return v !== '' && v !== null && v !== undefined;
        })
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

      // Defer state update callback
      setTimeout(() => onFiltersChange(cleanedFilters), 0);

      return newFilters;
    });
  }, [onFiltersChange]);

  // Toggle array filter (colors, sizes)
  const toggleArrayFilter = (key: 'colors' | 'sizes', value: string) => {
    const currentValues = filters[key];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    handleFilterChange(key, newValues);
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchInput('');
    const resetState = {
      search: '',
      category: '',
      supplier: '',
      brand: '',
      colors: [] as string[],
      sizes: [] as string[],
      priceMin: '',
      priceMax: '',
      isActive: 'true'
    };
    setFilters(resetState);
    onFiltersChange({ isActive: 'true' });
  };

  // Count active filters
  const activeFilterCount = [
    filters.category,
    filters.supplier,
    filters.brand,
    filters.colors.length > 0,
    filters.sizes.length > 0,
    filters.priceMin,
    filters.priceMax,
  ].filter(Boolean).length;

  // Get sorted facet entries
  const getSortedFacetEntries = (facetKey: keyof FacetDistribution) => {
    const facetData = facets?.[facetKey];
    if (!facetData) return [];
    return Object.entries(facetData).sort((a, b) => b[1] - a[1]);
  };

  // Build supplier options with counts
  const supplierOptions = suppliers.map(s => ({
    ...s,
    count: facets?.supplier_code?.[s.code]
  })).filter(s => !facets || s.count === undefined || s.count > 0);

  // Get colors and sizes from facets
  const colorFacets = getSortedFacetEntries('colors');
  const sizeFacets = getSortedFacetEntries('sizes');
  const brandFacets = getSortedFacetEntries('brand');

  return (
    <div className="filter-bar">
      {/* Search - always visible, not disabled */}
      <div className="filter-group search-group">
        <label htmlFor="search">Search</label>
        <div className="search-input-wrapper">
          <input
            id="search"
            type="text"
            placeholder="Search products..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={loading ? 'searching' : ''}
          />
          {loading && <span className="search-spinner" />}
        </div>
      </div>

      {/* Category Tree - hierarchical */}
      <CategoryTree
        categories={categories}
        selectedCategory={filters.category}
        onCategorySelect={(code) => handleFilterChange('category', code)}
        facets={facets}
        loading={loading}
      />

      {/* Supplier - collapsible */}
      <FilterSection
        title="Supplier"
        count={filters.supplier ? 1 : 0}
        defaultExpanded={true}
      >
        <select
          id="supplier"
          value={filters.supplier}
          onChange={(e) => handleFilterChange('supplier', e.target.value)}
        >
          <option value="">All Suppliers</option>
          {supplierOptions.map((supplier) => (
            <option key={supplier.id} value={supplier.code}>
              {supplier.name}
              {supplier.count !== undefined && ` (${supplier.count})`}
            </option>
          ))}
        </select>
      </FilterSection>

      {/* Brand - collapsible with facet counts */}
      <FilterSection
        title="Brand"
        count={filters.brand ? 1 : 0}
        defaultExpanded={brandFacets.length > 0}
      >
        {brandFacets.length > 0 ? (
          <div className="brand-list">
            <button
              type="button"
              className={`brand-option ${!filters.brand ? 'selected' : ''}`}
              onClick={() => handleFilterChange('brand', '')}
            >
              All Brands
            </button>
            {brandFacets.slice(0, 20).map(([brand, count]) => (
              <button
                key={brand}
                type="button"
                className={`brand-option ${filters.brand === brand ? 'selected' : ''}`}
                onClick={() => handleFilterChange('brand', brand)}
              >
                {brand} <span className="facet-count">({count})</span>
              </button>
            ))}
          </div>
        ) : (
          <select
            id="brand"
            value={filters.brand}
            onChange={(e) => handleFilterChange('brand', e.target.value)}
          >
            <option value="">All Brands</option>
          </select>
        )}
      </FilterSection>

      {/* Colors - collapsible with swatches */}
      {colorFacets.length > 0 && (
        <FilterSection
          title="Colors"
          count={filters.colors.length}
          defaultExpanded={false}
        >
          <div className="color-swatches">
            {colorFacets.map(([color, count]) => (
              <ColorSwatch
                key={color}
                color={color}
                count={count}
                selected={filters.colors.includes(color)}
                onClick={() => toggleArrayFilter('colors', color)}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Sizes - collapsible with chips */}
      {sizeFacets.length > 0 && (
        <FilterSection
          title="Sizes"
          count={filters.sizes.length}
          defaultExpanded={false}
        >
          <div className="size-chips">
            {sizeFacets.map(([size, count]) => (
              <SizeChip
                key={size}
                size={size}
                count={count}
                selected={filters.sizes.includes(size)}
                onClick={() => toggleArrayFilter('sizes', size)}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Price Range - collapsible */}
      <FilterSection title="Price Range" defaultExpanded={false}>
        <div className="price-range">
          <input
            type="number"
            placeholder="Min"
            value={filters.priceMin}
            onChange={(e) => handleFilterChange('priceMin', e.target.value)}
            min="0"
            step="0.01"
          />
          <span>to</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.priceMax}
            onChange={(e) => handleFilterChange('priceMax', e.target.value)}
            min="0"
            step="0.01"
          />
        </div>
      </FilterSection>

      {/* Status - collapsible */}
      <FilterSection title="Status" defaultExpanded={false}>
        <select
          id="isActive"
          value={filters.isActive}
          onChange={(e) => handleFilterChange('isActive', e.target.value)}
        >
          <option value="">All Products</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
      </FilterSection>

      {/* Reset Button */}
      <button
        className="reset-filters-btn"
        onClick={resetFilters}
        disabled={activeFilterCount === 0 && !searchInput}
      >
        Reset Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
      </button>
    </div>
  );
};
