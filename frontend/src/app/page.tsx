"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { searchProducts } from "@/lib/api";
import { useChatContext } from "@/lib/chat-context";
import type {
  FacetDistribution,
  MeilisearchProduct,
  SearchParams,
} from "@/lib/types";

import { SearchBar } from "@/components/SearchBar";
import { SortDropdown } from "@/components/SortDropdown";
import { ActiveFilters, type ActiveFilter } from "@/components/ActiveFilters";
import { FilterSidebar } from "@/components/FilterSidebar";
import { ProductGrid } from "@/components/ProductGrid";
import { ChatWidget } from "@/components/ChatWidget";
import { ChatPanel } from "@/components/ChatPanel";

const PAGE_SIZE = 24;

// ---------------------------------------------------------------------------
// Helpers to sync URL <-> state
// ---------------------------------------------------------------------------

function paramsFromURL(sp: URLSearchParams): SearchParams {
  return {
    q: sp.get("q") || undefined,
    sort: sp.get("sort") || "updatedAt:desc",
    brand: sp.get("brand") || undefined,
    category: sp.get("category") || undefined,
    colors: sp.get("colors") || undefined,
    sizes: sp.get("sizes") || undefined,
    supplier_code: sp.get("supplier_code") || undefined,
    price_min: sp.get("price_min") ? Number(sp.get("price_min")) : undefined,
    price_max: sp.get("price_max") ? Number(sp.get("price_max")) : undefined,
    ids: sp.get("ids") || undefined,
    offset: sp.get("offset") ? Number(sp.get("offset")) : 0,
    limit: PAGE_SIZE,
    is_active: true,
  };
}

function paramsToURL(p: SearchParams): string {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.sort && p.sort !== "updatedAt:desc") qs.set("sort", p.sort);
  if (p.brand) qs.set("brand", p.brand);
  if (p.category) qs.set("category", p.category);
  if (p.colors) qs.set("colors", p.colors);
  if (p.sizes) qs.set("sizes", p.sizes);
  if (p.supplier_code) qs.set("supplier_code", p.supplier_code);
  if (p.price_min != null) qs.set("price_min", String(p.price_min));
  if (p.price_max != null) qs.set("price_max", String(p.price_max));
  if (p.ids) qs.set("ids", p.ids);
  if (p.offset && p.offset > 0) qs.set("offset", String(p.offset));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------------------
// Active-filter chips
// ---------------------------------------------------------------------------

function buildActiveFilters(p: SearchParams): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  if (p.brand) filters.push({ key: "brand", label: "Brand", value: p.brand });
  if (p.category)
    filters.push({ key: "category", label: "Category", value: p.category });
  if (p.colors) {
    p.colors.split(",").forEach((c) => {
      filters.push({ key: "colors", label: "Color", value: c });
    });
  }
  if (p.sizes) {
    p.sizes.split(",").forEach((s) => {
      filters.push({ key: "sizes", label: "Size", value: s });
    });
  }
  if (p.supplier_code)
    filters.push({
      key: "supplier_code",
      label: "Supplier",
      value: p.supplier_code,
    });
  if (p.price_min != null)
    filters.push({
      key: "price_min",
      label: "Min price",
      value: `${p.price_min}`,
    });
  if (p.price_max != null)
    filters.push({
      key: "price_max",
      label: "Max price",
      value: `${p.price_max}`,
    });
  if (p.ids)
    filters.push({
      key: "ids",
      label: "AI selection",
      value: `${p.ids.split(",").length} products`,
    });
  return filters;
}

// ---------------------------------------------------------------------------
// Loading skeleton for Suspense fallback
// ---------------------------------------------------------------------------

function CatalogSkeleton() {
  return (
    <div className="mx-auto max-w-[1920px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex gap-3">
        <div className="h-10 flex-1 animate-pulse rounded-lg bg-sols-mid-gray" />
        <div className="h-10 w-40 animate-pulse rounded-lg bg-sols-mid-gray" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse overflow-hidden rounded-xl border border-sols-border/40 bg-white"
          >
            <div className="aspect-square bg-sols-light-gray" />
            <div className="flex flex-col gap-2.5 p-3.5">
              <div className="h-3 w-16 rounded bg-sols-mid-gray" />
              <div className="h-4 w-full rounded bg-sols-mid-gray" />
              <div className="h-4 w-20 rounded bg-sols-mid-gray" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner catalog component (uses useSearchParams)
// ---------------------------------------------------------------------------

function CatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { isChatOpen, sidebarCollapsed, toggleSidebar, clearChat } =
    useChatContext();

  const [params, setParams] = useState<SearchParams>(() =>
    paramsFromURL(searchParams),
  );
  const [products, setProducts] = useState<MeilisearchProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [facets, setFacets] = useState<FacetDistribution | undefined>();
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const currentPage = Math.floor((params.offset || 0) / PAGE_SIZE) + 1;

  // Fetch products
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await searchProducts(params);
        if (cancelled) return;
        setProducts(res.data);
        setTotal(res.meta.pagination.total);
        setPageCount(res.meta.pagination.pageCount);
        setFacets(res.meta.facets);
      } catch (err) {
        if (cancelled) return;
        console.error("Search failed:", err);
        setProducts([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [params]);

  // Reset loading when params change
  const paramsRef = useRef(params);
  if (paramsRef.current !== params) {
    paramsRef.current = params;
    setLoading(true);
  }

  // Push state to URL and scroll to top on filter/search changes
  useEffect(() => {
    const url = paramsToURL(params);
    router.replace(`/${url}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [params, router]);

  // Update params helper (resets offset)
  const updateParams = useCallback((next: Partial<SearchParams>) => {
    setParams((prev) => ({
      ...prev,
      ...next,
      offset: 0,
    }));
  }, []);

  // Filter removal
  const removeFilter = useCallback(
    (key: string, value: string) => {
      if (key === "colors") {
        const arr = (params.colors || "").split(",").filter((c) => c !== value);
        updateParams({ colors: arr.length ? arr.join(",") : undefined });
      } else if (key === "sizes") {
        const arr = (params.sizes || "").split(",").filter((s) => s !== value);
        updateParams({ sizes: arr.length ? arr.join(",") : undefined });
      } else if (key === "ids") {
        updateParams({ ids: undefined });
      } else {
        updateParams({ [key]: undefined });
      }
    },
    [params, updateParams],
  );

  const clearAllFilters = useCallback(() => {
    setParams({
      q: undefined,
      sort: "updatedAt:desc",
      offset: 0,
      limit: PAGE_SIZE,
      is_active: true,
    });
    clearChat();
  }, [clearChat]);

  const activeFilters = useMemo(() => buildActiveFilters(params), [params]);

  return (
    <div className="mx-auto max-w-[1920px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Top bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          {/* Mobile filter toggle */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-sols-border bg-white px-3 text-sm font-medium text-sols-dark lg:hidden"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm4 6a1 1 0 011-1h8a1 1 0 010 2H8a1 1 0 01-1-1zm2 6a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1z" />
            </svg>
            Filters
          </button>

          <SearchBar
            value={params.q || ""}
            onChange={(q) => updateParams({ q: q || undefined })}
          />
        </div>

        <SortDropdown
          value={params.sort || "updatedAt:desc"}
          onChange={(sort) => updateParams({ sort })}
        />
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="mb-4">
          <ActiveFilters
            filters={activeFilters}
            onRemove={removeFilter}
            onClearAll={clearAllFilters}
          />
        </div>
      )}

      {/* Content area: filters | products | chat panel */}
      <div className="flex gap-8">
        <FilterSidebar
          facets={facets}
          params={params}
          onParamsChange={updateParams}
          mobileOpen={mobileFiltersOpen}
          onMobileClose={() => setMobileFiltersOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        <div className="min-w-0 flex-1">
          <ProductGrid
            products={products}
            total={total}
            loading={loading}
            chatOpen={isChatOpen}
            activeColor={params.colors?.split(",")[0] || undefined}
          />

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() =>
                  setParams((p) => ({
                    ...p,
                    offset: Math.max(0, (p.offset || 0) - PAGE_SIZE),
                  }))
                }
                className="rounded-lg border border-sols-border px-3 py-2 text-sm font-medium text-sols-dark transition-colors hover:bg-sols-light-gray disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <span className="px-3 text-sm text-sols-muted">
                Page {currentPage} of {pageCount}
              </span>

              <button
                type="button"
                disabled={currentPage >= pageCount}
                onClick={() =>
                  setParams((p) => ({
                    ...p,
                    offset: (p.offset || 0) + PAGE_SIZE,
                  }))
                }
                className="rounded-lg border border-sols-border px-3 py-2 text-sm font-medium text-sols-dark transition-colors hover:bg-sols-light-gray disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Chat panel: always mounted, hidden via CSS for state persistence */}
        <ChatPanel
          currentFilters={params}
          currentFacets={facets}
          currentTotal={total}
          onApplyFilters={updateParams}
        />
      </div>

      {/* Chat toggle button */}
      <ChatWidget />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export (wraps inner component in Suspense for useSearchParams)
// ---------------------------------------------------------------------------

export default function CatalogPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CatalogContent />
    </Suspense>
  );
}
