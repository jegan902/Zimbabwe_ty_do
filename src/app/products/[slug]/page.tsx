import { getProductBySlug } from "@/lib/services/catalog.service";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "./detail-client";
import { CatalogRealtime } from "@/components/portal/catalog-realtime";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let product;
  try {
    product = await getProductBySlug(slug);
  } catch {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-10 sm:px-8 max-w-5xl">
      <CatalogRealtime />
      <ProductDetailClient product={product as any} />
    </div>
  );
}

