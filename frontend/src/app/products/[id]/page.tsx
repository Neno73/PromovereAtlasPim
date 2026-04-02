import type { Metadata } from "next";
import Link from "next/link";
import { ProductDetail } from "./ProductDetail";

const API_BASE = process.env.STRAPI_INTERNAL_URL || "http://localhost:1337";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function fetchProduct(id: string) {
  const res = await fetch(`${API_BASE}/api/products/${id}?populate=*`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProduct(id);

  if (!product) {
    return { title: "Product Not Found | PromoAtlas" };
  }

  const name =
    product.name?.en ||
    product.name?.de ||
    product.name?.fr ||
    product.sku ||
    "Product";

  const description =
    product.description?.en ||
    product.description?.de ||
    `${name} - promotional product from ${product.supplier?.code || "PromoAtlas"}`;

  return {
    title: `${name} | PromoAtlas`,
    description: description.slice(0, 160),
    openGraph: {
      title: name,
      description: description.slice(0, 160),
      images: product.main_image?.url
        ? [{ url: product.main_image.url }]
        : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const product = await fetchProduct(id);

  if (!product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-sols-dark">
          Product not found
        </h1>
        <p className="mt-2 text-sols-muted">
          The product you are looking for does not exist or has been removed.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-lg bg-sols-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sols-accent-hover"
        >
          Back to catalog
        </Link>
      </div>
    );
  }

  return <ProductDetail product={product} />;
}
