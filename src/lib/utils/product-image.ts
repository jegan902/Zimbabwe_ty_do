export const DEFAULT_PRODUCT_IMAGE = "/images/products/default-product.jpg";

/**
 * Returns the product image URL or the default product image fallback.
 */
export function getProductImageUrl(image?: string | null): string {
  if (image && typeof image === "string" && image.trim().length > 0) {
    return image.trim();
  }
  return DEFAULT_PRODUCT_IMAGE;
}
