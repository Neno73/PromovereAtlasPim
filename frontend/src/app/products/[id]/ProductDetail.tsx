"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn, formatPrice, getLocalizedText } from "@/lib/utils";
import { ColorSwatch } from "@/components/ColorSwatch";
import type { Product, StrapiMedia, ProductVariant } from "@/lib/types";

// ---------------------------------------------------------------------------
// Image gallery
// ---------------------------------------------------------------------------

function ImageGallery({ images }: { images: StrapiMedia[] }) {
  const [selected, setSelected] = useState(0);
  const current = images[selected];

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl bg-sols-light-gray">
        <svg
          className="h-24 w-24 text-sols-mid-gray"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative aspect-square overflow-hidden rounded-xl bg-sols-light-gray">
        <Image
          src={current.url}
          alt={current.alternativeText || "Product image"}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain p-4"
          priority
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id || i}
              type="button"
              onClick={() => setSelected(i)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                i === selected
                  ? "border-sols-accent"
                  : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              <Image
                src={
                  img.formats?.thumbnail?.url || img.url
                }
                alt=""
                fill
                sizes="64px"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail component
// ---------------------------------------------------------------------------

interface ProductDetailProps {
  product: Product;
}

export function ProductDetail({ product }: ProductDetailProps) {
  const name = getLocalizedText(product.name);
  const description = getLocalizedText(product.description);
  const material = getLocalizedText(product.material);

  // Gather all images
  const allImages: StrapiMedia[] = [];
  if (product.main_image) allImages.push(product.main_image);
  if (product.model_image) allImages.push(product.model_image);
  if (product.gallery_images) allImages.push(...product.gallery_images);

  // Group variants by color
  const colorGroups = new Map<string, ProductVariant[]>();
  for (const v of product.variants || []) {
    const color = v.color || "Default";
    if (!colorGroups.has(color)) colorGroups.set(color, []);
    colorGroups.get(color)!.push(v);
  }

  const [selectedColor, setSelectedColor] = useState<string>(
    colorGroups.keys().next().value || "",
  );

  const variantsForColor = colorGroups.get(selectedColor) || [];

  // Price display
  const priceLabel = (() => {
    if (product.price_min != null && product.price_max != null) {
      if (product.price_min === product.price_max) {
        return formatPrice(product.price_min);
      }
      return `${formatPrice(product.price_min)} - ${formatPrice(product.price_max)}`;
    }
    if (product.price_min != null) return `from ${formatPrice(product.price_min)}`;
    return null;
  })();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-sols-muted transition-colors hover:text-sols-dark"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M15 19l-7-7 7-7" />
        </svg>
        Back to catalog
      </Link>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        {/* Left: Images */}
        <ImageGallery images={allImages} />

        {/* Right: Info */}
        <div className="flex flex-col gap-5">
          {/* Brand + Category */}
          <div className="flex flex-wrap items-center gap-2">
            {product.brand && (
              <span className="rounded-md bg-sols-light-gray px-2.5 py-1 text-xs font-semibold text-sols-dark">
                {product.brand}
              </span>
            )}
            {product.category && (
              <span className="rounded-full bg-sols-light-gray px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sols-muted">
                {product.category}
              </span>
            )}
          </div>

          {/* Name */}
          <h1 className="text-2xl font-extrabold leading-tight text-sols-dark lg:text-3xl">
            {name}
          </h1>

          {/* SKU / A-Number */}
          <div className="flex gap-4 text-xs text-sols-muted">
            <span>SKU: {product.sku}</span>
            <span>Art: {product.a_number}</span>
            {product.supplier?.code && (
              <span>Supplier: {product.supplier.code}</span>
            )}
          </div>

          {/* Price */}
          {priceLabel && (
            <p className="text-xl font-bold text-sols-accent">{priceLabel}</p>
          )}

          {/* Description */}
          {description && (
            <div className="prose prose-sm max-w-none text-sols-dark/80">
              <p>{description}</p>
            </div>
          )}

          {/* Color selector */}
          {colorGroups.size > 1 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sols-muted">
                Color: {selectedColor}
              </h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(colorGroups.keys()).map((color) => {
                  const variant = colorGroups.get(color)?.[0];
                  return (
                    <ColorSwatch
                      key={color}
                      colorName={color}
                      hex={variant?.hex_color}
                      size="lg"
                      selected={color === selectedColor}
                      onClick={() => setSelectedColor(color)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Size variants */}
          {variantsForColor.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sols-muted">
                Available sizes
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {variantsForColor.map((v) => (
                  <span
                    key={v.documentId}
                    className="rounded-md border border-sols-border bg-white px-3 py-1.5 text-xs font-medium text-sols-dark"
                  >
                    {v.size || v.name || v.sku}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Price tiers */}
          {product.price_tiers && product.price_tiers.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sols-muted">
                Price tiers
              </h3>
              <div className="overflow-hidden rounded-lg border border-sols-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-sols-light-gray text-sols-muted">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Qty</th>
                      <th className="px-3 py-2 font-semibold">Price</th>
                      {product.price_tiers.some((t) => t.buying_price) && (
                        <th className="px-3 py-2 font-semibold">Buying</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sols-border/40">
                    {product.price_tiers.map((tier, i) => (
                      <tr key={i} className="text-sols-dark">
                        <td className="px-3 py-2 font-medium">
                          {tier.quantity}+
                        </td>
                        <td className="px-3 py-2">
                          {formatPrice(tier.price, tier.currency || "EUR")}
                        </td>
                        {product.price_tiers!.some((t) => t.buying_price) && (
                          <td className="px-3 py-2 text-sols-muted">
                            {tier.buying_price
                              ? formatPrice(tier.buying_price, tier.currency || "EUR")
                              : "-"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Specs */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sols-muted">
              Specifications
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {material && (
                <>
                  <dt className="text-sols-muted">Material</dt>
                  <dd className="font-medium text-sols-dark">{material}</dd>
                </>
              )}
              {product.dimensions?.length != null && (
                <>
                  <dt className="text-sols-muted">Dimensions</dt>
                  <dd className="font-medium text-sols-dark">
                    {[
                      product.dimensions.length && `L: ${product.dimensions.length}`,
                      product.dimensions.width && `W: ${product.dimensions.width}`,
                      product.dimensions.height && `H: ${product.dimensions.height}`,
                    ]
                      .filter(Boolean)
                      .join(" x ")}{" "}
                    {product.dimensions.unit || "cm"}
                  </dd>
                </>
              )}
              {product.dimensions?.weight != null && (
                <>
                  <dt className="text-sols-muted">Weight</dt>
                  <dd className="font-medium text-sols-dark">
                    {product.dimensions.weight}{" "}
                    {product.dimensions.weight_unit || "g"}
                  </dd>
                </>
              )}
              {product.total_variants_count > 0 && (
                <>
                  <dt className="text-sols-muted">Variants</dt>
                  <dd className="font-medium text-sols-dark">
                    {product.total_variants_count}
                  </dd>
                </>
              )}
              {product.available_colors && product.available_colors.length > 0 && (
                <>
                  <dt className="text-sols-muted">Colors</dt>
                  <dd className="font-medium text-sols-dark">
                    {product.available_colors.length}
                  </dd>
                </>
              )}
              {product.available_sizes && product.available_sizes.length > 0 && (
                <>
                  <dt className="text-sols-muted">Sizes</dt>
                  <dd className="font-medium text-sols-dark">
                    {product.available_sizes.join(", ")}
                  </dd>
                </>
              )}
            </dl>
          </div>

          {/* Imprint positions */}
          {product.imprint_position && product.imprint_position.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sols-muted">
                Imprint positions
              </h3>
              <div className="flex flex-col gap-2">
                {product.imprint_position.map((imp, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-sols-border/50 bg-sols-light-gray/50 px-3 py-2 text-xs"
                  >
                    {imp.position && (
                      <span className="font-medium">{imp.position}</span>
                    )}
                    {imp.technique && (
                      <span className="ml-2 text-sols-muted">
                        {imp.technique}
                      </span>
                    )}
                    {imp.size_width && imp.size_height && (
                      <span className="ml-2 text-sols-muted">
                        {imp.size_width} x {imp.size_height} mm
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
