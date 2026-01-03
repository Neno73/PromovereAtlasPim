import { FC } from 'react';
import './ActiveFilters.css';

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  displayValue: string;
}

interface ActiveFiltersProps {
  filters: Record<string, any>;
  onRemoveFilter: (key: string, value?: string) => void;
  onClearAll: () => void;
  supplierDisplay?: string;
  categoryDisplay?: string;
}

/**
 * Active filter pills displayed above search results
 * Shows removable chips for each active filter
 */
export const ActiveFilters: FC<ActiveFiltersProps> = ({
  filters,
  onRemoveFilter,
  onClearAll,
  supplierDisplay,
  categoryDisplay,
}) => {
  // Build list of active filters
  const activeFilters: ActiveFilter[] = [];

  if (filters.search) {
    activeFilters.push({
      key: 'search',
      label: 'Search',
      value: filters.search,
      displayValue: `"${filters.search}"`,
    });
  }

  if (filters.category) {
    activeFilters.push({
      key: 'category',
      label: 'Category',
      value: filters.category,
      displayValue: categoryDisplay || filters.category,
    });
  }

  if (filters.supplier) {
    activeFilters.push({
      key: 'supplier',
      label: 'Supplier',
      value: filters.supplier,
      displayValue: supplierDisplay || filters.supplier,
    });
  }

  if (filters.brand) {
    activeFilters.push({
      key: 'brand',
      label: 'Brand',
      value: filters.brand,
      displayValue: filters.brand,
    });
  }

  if (filters.colors && filters.colors.length > 0) {
    filters.colors.forEach((color: string) => {
      activeFilters.push({
        key: 'colors',
        label: 'Color',
        value: color,
        displayValue: color,
      });
    });
  }

  if (filters.sizes && filters.sizes.length > 0) {
    filters.sizes.forEach((size: string) => {
      activeFilters.push({
        key: 'sizes',
        label: 'Size',
        value: size,
        displayValue: size,
      });
    });
  }

  if (filters.priceMin) {
    activeFilters.push({
      key: 'priceMin',
      label: 'Min Price',
      value: filters.priceMin,
      displayValue: `€${filters.priceMin}`,
    });
  }

  if (filters.priceMax) {
    activeFilters.push({
      key: 'priceMax',
      label: 'Max Price',
      value: filters.priceMax,
      displayValue: `€${filters.priceMax}`,
    });
  }

  // Don't show isActive filter as a pill (it's a default)

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="active-filters">
      <span className="active-filters-label">Active filters:</span>
      <div className="filter-pills">
        {activeFilters.map((filter, index) => (
          <button
            key={`${filter.key}-${filter.value}-${index}`}
            className="filter-pill"
            onClick={() => onRemoveFilter(filter.key, filter.value)}
            title={`Remove ${filter.label}: ${filter.displayValue}`}
          >
            <span className="pill-label">{filter.label}:</span>
            <span className="pill-value">{filter.displayValue}</span>
            <span className="pill-remove">×</span>
          </button>
        ))}
      </div>
      {activeFilters.length > 1 && (
        <button className="clear-all-btn" onClick={onClearAll}>
          Clear All
        </button>
      )}
    </div>
  );
};
