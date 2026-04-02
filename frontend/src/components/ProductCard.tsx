"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { cn, formatPrice } from "@/lib/utils";
import { ColorSwatch } from "./ColorSwatch";
import type { MeilisearchProduct } from "@/lib/types";

interface ProductCardProps {
  product: MeilisearchProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const name =
    product.name_en ||
    product.name_de ||
    product.name_fr ||
    product.name_es ||
    product.sku;

  const imgSrc = product.main_image_url || product.main_image_thumbnail_url;
  const maxSwatches = 5;
  const visibleColors = product.colors.slice(0, maxSwatches);
  const overflowCount = product.colors.length - maxSwatches;

  const priceLabel = (() => {
    if (product.price_min != null && product.price_max != null) {
      if (product.price_min === product.price_max) {
        return formatPrice(product.price_min, product.currency);
      }
      return `${formatPrice(product.price_min, product.currency)} - ${formatPrice(product.price_max, product.currency)}`;
    }
    if (product.price_min != null)
      return `from ${formatPrice(product.price_min, product.currency)}`;
    return null;
  })();

  return (
    <motion.div
      layout
      layoutId={`product-${product.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="group"
    >
      <Link
        href={`/products/${product.id}`}
        className={cn(
          "flex flex-col overflow-hidden rounded-xl bg-white",
          "border border-sols-border/60",
          "transition-all duration-200",
          "hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5",
        )}
      >
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-sols-light-gray">
          {imgSrc ? (
            <Image
              src={imgSrc}
              alt={name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sols-muted/40">
              <svg
                className="h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* Brand badge */}
          {product.brand && (
            <span className="absolute left-2.5 top-2.5 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-sols-dark shadow-sm backdrop-blur-sm">
              {product.brand}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-2 p-3.5">
          {/* Category tag */}
          {product.category && (
            <span className="self-start rounded-full bg-sols-light-gray px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sols-muted">
              {product.category}
            </span>
          )}

          {/* Name */}
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-sols-dark">
            {name}
          </h3>

          {/* Price */}
          {priceLabel && (
            <p className="text-sm font-semibold text-sols-accent">
              {priceLabel}
            </p>
          )}

          {/* Colors */}
          {visibleColors.length > 0 && (
            <div className="flex items-center gap-1 pt-0.5">
              {visibleColors.map((color, i) => (
                <ColorSwatch
                  key={`${color}-${i}`}
                  colorName={color}
                  hex={product.hex_colors?.[i]}
                  size="sm"
                  showTooltip
                />
              ))}
              {overflowCount > 0 && (
                <span className="ml-0.5 text-[11px] text-sols-muted">
                  +{overflowCount}
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto flex items-center justify-between border-t border-sols-border/40 pt-2 text-[11px] text-sols-muted">
            <span>{product.supplier_name}</span>
            {product.total_variants_count > 0 && (
              <span>
                {product.total_variants_count} variant
                {product.total_variants_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
