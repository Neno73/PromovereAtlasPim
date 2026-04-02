"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  facets?: Record<string, number>;
  selected: string;
  onChange: (value: string) => void;
}

interface CategoryNode {
  name: string;
  fullPath: string;
  count: number;
  children: CategoryNode[];
}

function buildTree(facets: Record<string, number>): CategoryNode[] {
  const roots: CategoryNode[] = [];
  const map = new Map<string, CategoryNode>();

  // Sort keys so parents come first
  const keys = Object.keys(facets).sort();

  for (const key of keys) {
    const parts = key.split("/");
    const name = parts[parts.length - 1];
    const node: CategoryNode = {
      name,
      fullPath: key,
      count: facets[key],
      children: [],
    };
    map.set(key, node);

    if (parts.length === 1) {
      roots.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      const parent = map.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}

function CategoryNodeItem({
  node,
  selected,
  onChange,
  depth = 0,
}: {
  node: CategoryNode;
  selected: string;
  onChange: (v: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(
    selected.startsWith(node.fullPath),
  );
  const isSelected = selected === node.fullPath;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1"
        style={{ paddingLeft: depth * 12 }}
      >
        {hasChildren && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="shrink-0 rounded p-0.5 text-sols-muted hover:text-sols-dark"
          >
            <svg
              className={cn(
                "h-3 w-3 transition-transform",
                expanded && "rotate-90",
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {!hasChildren && <span className="w-4" />}

        <button
          type="button"
          onClick={() => onChange(isSelected ? "" : node.fullPath)}
          className={cn(
            "flex-1 truncate rounded px-1.5 py-1 text-left text-xs transition-colors",
            isSelected
              ? "font-semibold text-sols-accent"
              : "text-sols-dark hover:bg-sols-light-gray",
          )}
        >
          {node.name}
          <span className="ml-1 text-sols-muted">({node.count})</span>
        </button>
      </div>

      {expanded &&
        node.children.map((child) => (
          <CategoryNodeItem
            key={child.fullPath}
            node={child}
            selected={selected}
            onChange={onChange}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export function CategoryFilter({
  facets,
  selected,
  onChange,
}: CategoryFilterProps) {
  const tree = useMemo(() => buildTree(facets || {}), [facets]);

  if (tree.length === 0) {
    return (
      <p className="text-xs text-sols-muted">No categories available</p>
    );
  }

  return (
    <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
      {tree.map((node) => (
        <CategoryNodeItem
          key={node.fullPath}
          node={node}
          selected={selected}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
