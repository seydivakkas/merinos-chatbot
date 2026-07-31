import type { Product } from "@/lib/types";

export function ProductVisual({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  return (
    <div
      className={`product-visual ${product.pattern} ${compact ? "compact" : ""}`}
      role="img"
      aria-label={`${product.name} için temsili halı görseli`}
    >
      <span className="rug-label">{product.collection}</span>
    </div>
  );
}
