"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { FacetDistribution, SearchParams } from "@/lib/types";
import { CategoryFilter } from "./filters/CategoryFilter";
import { BrandFilter } from "./filters/BrandFilter";
import { ColorFilter } from "./filters/ColorFilter";
import { SizeFilter } from "./filters/SizeFilter";
import { PriceRangeFilter } from "./filters/PriceRangeFilter";

// ---------------------------------------------------------------------------
// Collapsible section wrapper
// ---------------------------------------------------------------------------

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-sols-border/50 py-4 first:pt-0 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-sols-muted"
      >
        {title}
        <svg
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

interface FilterSidebarProps {
  facets?: FacetDistribution;
  params: SearchParams;
  onParamsChange: (next: Partial<SearchParams>) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function FilterSidebar({
  facets,
  params,
  onParamsChange,
  mobileOpen,
  onMobileClose,
  collapsed,
  onToggleCollapse,
}: FilterSidebarProps) {
  const sidebar = (
    <aside className="flex w-[280px] shrink-0 flex-col gap-0 overflow-y-auto p-4 lg:p-0">
      <FilterSection title="Category">
        <CategoryFilter
          facets={facets?.category}
          selected={params.category || ""}
          onChange={(v) => onParamsChange({ category: v || undefined })}
        />
      </FilterSection>

      <FilterSection title="Brand">
        <BrandFilter
          facets={facets?.brand}
          selected={params.brand || ""}
          onChange={(v) => onParamsChange({ brand: v || undefined })}
        />
      </FilterSection>

      <FilterSection title="Color">
        <ColorFilter
          facets={facets?.colors}
          selected={params.colors?.split(",").filter(Boolean) || []}
          onChange={(arr) =>
            onParamsChange({ colors: arr.length ? arr.join(",") : undefined })
          }
        />
      </FilterSection>

      <FilterSection title="Size">
        <SizeFilter
          facets={facets?.sizes}
          selected={params.sizes?.split(",").filter(Boolean) || []}
          onChange={(arr) =>
            onParamsChange({ sizes: arr.length ? arr.join(",") : undefined })
          }
        />
      </FilterSection>

      <FilterSection title="Price">
        <PriceRangeFilter
          min={params.price_min}
          max={params.price_max}
          onChange={(min, max) =>
            onParamsChange({ price_min: min, price_max: max })
          }
        />
      </FilterSection>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar with collapse toggle */}
      <div className="hidden lg:block">
        {collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-sols-border bg-white text-sols-muted transition-colors hover:bg-sols-light-gray hover:text-sols-dark"
            title="Show filters"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm4 6a1 1 0 011-1h8a1 1 0 010 2H8a1 1 0 01-1-1zm2 6a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1z" />
            </svg>
          </button>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-sols-muted">
                Filters
              </span>
              <button
                type="button"
                onClick={onToggleCollapse}
                className="rounded p-1 text-sols-muted transition-colors hover:text-sols-dark"
                title="Hide filters"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
            {sidebar}
          </div>
        )}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="relative z-10 h-full w-[300px] overflow-y-auto bg-white shadow-xl animate-slide-in-right">
            <div className="flex items-center justify-between border-b border-sols-border p-4">
              <span className="text-sm font-semibold">Filters</span>
              <button
                type="button"
                onClick={onMobileClose}
                className="rounded p-1 text-sols-muted hover:text-sols-dark"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </>
  );
}
