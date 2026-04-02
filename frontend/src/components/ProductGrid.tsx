"use client";

import { AnimatePresence } from "framer-motion";
import { ProductCard } from "./ProductCard";
import type { MeilisearchProduct } from "@/lib/types";

interface ProductGridProps {
  products: MeilisearchProduct[];
  total: number;
  loading: boolean;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse-subtle overflow-hidden rounded-xl border border-sols-border/40 bg-white">
      <div className="aspect-square bg-sols-light-gray" />
      <div className="flex flex-col gap-2.5 p-3.5">
        <div className="h-3 w-16 rounded bg-sols-mid-gray" />
        <div className="h-4 w-full rounded bg-sols-mid-gray" />
        <div className="h-4 w-2/3 rounded bg-sols-mid-gray" />
        <div className="h-4 w-20 rounded bg-sols-mid-gray" />
        <div className="mt-2 flex gap-1">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-4 w-4 rounded-full bg-sols-mid-gray"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({ products, total, loading }: ProductGridProps) {
  if (loading) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-2">
          <div className="h-5 w-32 animate-pulse-subtle rounded bg-sols-mid-gray" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(12)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg
          className="mb-4 h-16 w-16 text-sols-mid-gray"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-sols-dark">
          No products found
        </h3>
        <p className="mt-1 text-sm text-sols-muted">
          Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <span className="inline-flex items-center rounded-full bg-sols-light-gray px-3 py-1 text-xs font-semibold text-sols-muted">
          {total.toLocaleString()} product{total !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
