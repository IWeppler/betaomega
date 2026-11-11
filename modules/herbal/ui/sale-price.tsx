import { saleItem } from "../sale-item";
import { formatCents } from "@/platform/money";

export function SalePrice({ item, partial = false }: { item: {
  price?: number; priceUnit?: string; pricePerKgCents?: number; promoPrice?: number; promoUntil?: string; presentationWeightGrams?: number;
}; partial?: boolean }) {
  const pricing = saleItem(item);
  const text = partial ? "Precio de la selección a confirmar." : pricing.price === undefined
    ? item.presentationWeightGrams === undefined ? "Precio a confirmar" : "Precio pendiente de calcular"
    : `${formatCents(Math.round(pricing.price * 100))}${pricing.priceUnit ? ` / ${pricing.priceUnit}` : ""}`;
  return <span className="block text-sm font-medium text-ink">{text}</span>;
}
