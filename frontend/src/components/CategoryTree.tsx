import { useState, useEffect, FC, useMemo } from 'react';
import { Category, CategoryTreeNode, FacetDistribution } from '../types';
import { getLocalizedText } from '../utils/i18n';
import './CategoryTree.css';

/**
 * Get display name for a category (last segment of path)
 * e.g., "Taschen & Gepäck/Rucksäcke" → "Rucksäcke"
 */
function getCategoryDisplayName(category: Category): string {
  const fullName = getLocalizedText(category.name);
  // If name contains path separator, get the last segment
  if (fullName.includes('/')) {
    const parts = fullName.split('/');
    return parts[parts.length - 1].trim();
  }
  return fullName;
}

interface CategoryTreeProps {
  categories: Category[];
  selectedCategory: string;
  onCategorySelect: (categoryCode: string) => void;
  facets?: FacetDistribution;
  loading?: boolean;
}

interface TreeNodeProps {
  node: CategoryTreeNode;
  selectedCategory: string;
  onCategorySelect: (categoryCode: string) => void;
  facetCounts?: Record<string, number>;
  expandedNodes: Set<string>;
  onToggleExpand: (code: string) => void;
}

/**
 * Build a hierarchical tree from flat category list
 * Supports two hierarchy methods:
 * 1. Parent relation (cat.parent.code)
 * 2. Code path hierarchy (e.g., "BAGS/BACKPACKS" is child of "BAGS")
 */
function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  // Create a map for quick lookup by code
  const categoryMap = new Map<string, CategoryTreeNode>();

  // Initialize all categories as tree nodes
  categories.forEach(cat => {
    categoryMap.set(cat.code, {
      ...cat,
      children: [],
      level: 0,
    });
  });

  // Build the tree by assigning children to parents
  const rootNodes: CategoryTreeNode[] = [];

  categories.forEach(cat => {
    const node = categoryMap.get(cat.code)!;

    // Determine parent code using multiple methods:
    // 1. From parent relation
    // 2. From code path (BAGS/BACKPACKS → BAGS)
    let parentCode: string | undefined = cat.parent?.code;

    if (!parentCode && cat.code.includes('/')) {
      // Extract parent from code path
      const pathParts = cat.code.split('/');
      if (pathParts.length > 1) {
        parentCode = pathParts.slice(0, -1).join('/');
      }
    }

    if (parentCode && categoryMap.has(parentCode)) {
      // Add to parent's children
      const parentNode = categoryMap.get(parentCode)!;
      node.level = parentNode.level + 1;
      parentNode.children.push(node);
    } else {
      // No parent or parent not found - this is a root node
      rootNodes.push(node);
    }
  });

  // Sort children by sort_order then name
  const sortNodes = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return getLocalizedText(a.name).localeCompare(getLocalizedText(b.name));
    });
    nodes.forEach(node => sortNodes(node.children));
  };

  sortNodes(rootNodes);
  return rootNodes;
}

/**
 * Get total count for a category including all descendants
 */
function getTotalCount(node: CategoryTreeNode, facetCounts?: Record<string, number>): number {
  if (!facetCounts) return 0;

  let count = facetCounts[node.code] || 0;
  node.children.forEach(child => {
    count += getTotalCount(child, facetCounts);
  });
  return count;
}

/**
 * Single tree node component
 */
const TreeNode: FC<TreeNodeProps> = ({
  node,
  selectedCategory,
  onCategorySelect,
  facetCounts,
  expandedNodes,
  onToggleExpand,
}) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.code);
  const isSelected = selectedCategory === node.code;
  const directCount = facetCounts?.[node.code] || 0;
  const totalCount = getTotalCount(node, facetCounts);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(node.code);
  };

  const handleSelect = () => {
    onCategorySelect(isSelected ? '' : node.code);
  };

  return (
    <div className="tree-node" data-level={node.level}>
      <div
        className={`tree-node-content ${isSelected ? 'selected' : ''} ${totalCount === 0 ? 'empty' : ''}`}
        style={{ paddingLeft: `${node.level * 16 + 8}px` }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            className={`tree-toggle ${isExpanded ? 'expanded' : ''}`}
            onClick={handleToggle}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
          </button>
        ) : (
          <span className="tree-toggle-placeholder" />
        )}

        {/* Category name and count */}
        <button
          type="button"
          className="tree-node-label"
          onClick={handleSelect}
        >
          <span className="node-name">{getCategoryDisplayName(node)}</span>
          {totalCount > 0 && (
            <span className="node-count">
              {hasChildren && directCount !== totalCount
                ? `${directCount}/${totalCount}`
                : totalCount}
            </span>
          )}
        </button>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeNode
              key={child.code}
              node={child}
              selectedCategory={selectedCategory}
              onCategorySelect={onCategorySelect}
              facetCounts={facetCounts}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Category tree component for hierarchical navigation
 */
export const CategoryTree: FC<CategoryTreeProps> = ({
  categories,
  selectedCategory,
  onCategorySelect,
  facets,
  loading,
}) => {
  // Build tree structure from flat categories
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Track expanded nodes - start with top-level expanded
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Expand root nodes by default
    tree.forEach(node => initial.add(node.code));
    return initial;
  });

  // Expand parent nodes when selection changes
  useEffect(() => {
    if (selectedCategory) {
      // Find the selected category and expand its ancestors
      const findAndExpand = (nodes: CategoryTreeNode[], ancestors: string[] = []): boolean => {
        for (const node of nodes) {
          if (node.code === selectedCategory) {
            // Found it - expand all ancestors
            setExpandedNodes(prev => {
              const next = new Set(prev);
              ancestors.forEach(code => next.add(code));
              return next;
            });
            return true;
          }
          if (node.children.length > 0) {
            if (findAndExpand(node.children, [...ancestors, node.code])) {
              return true;
            }
          }
        }
        return false;
      };
      findAndExpand(tree);
    }
  }, [selectedCategory, tree]);

  const handleToggleExpand = (code: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allCodes = new Set<string>();
    const collectCodes = (nodes: CategoryTreeNode[]) => {
      nodes.forEach(node => {
        allCodes.add(node.code);
        collectCodes(node.children);
      });
    };
    collectCodes(tree);
    setExpandedNodes(allCodes);
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
  };

  const facetCounts = facets?.category;

  if (loading && categories.length === 0) {
    return (
      <div className="category-tree loading">
        <div className="loading-placeholder">Loading categories...</div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="category-tree empty">
        <p>No categories available</p>
      </div>
    );
  }

  return (
    <div className="category-tree">
      {/* Header with actions */}
      <div className="tree-header">
        <button
          type="button"
          className={`tree-all-btn ${!selectedCategory ? 'selected' : ''}`}
          onClick={() => onCategorySelect('')}
        >
          All Categories
          {facetCounts && (
            <span className="all-count">
              {Object.values(facetCounts).reduce((sum, n) => sum + n, 0)}
            </span>
          )}
        </button>
        <div className="tree-actions">
          <button
            type="button"
            className="tree-action-btn"
            onClick={handleExpandAll}
            title="Expand all"
          >
            +
          </button>
          <button
            type="button"
            className="tree-action-btn"
            onClick={handleCollapseAll}
            title="Collapse all"
          >
            −
          </button>
        </div>
      </div>

      {/* Tree nodes */}
      <div className="tree-content">
        {tree.map(node => (
          <TreeNode
            key={node.code}
            node={node}
            selectedCategory={selectedCategory}
            onCategorySelect={onCategorySelect}
            facetCounts={facetCounts}
            expandedNodes={expandedNodes}
            onToggleExpand={handleToggleExpand}
          />
        ))}
      </div>
    </div>
  );
};
