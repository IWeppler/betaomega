import type { ReactNode } from "react";
import { CartProvider } from "./cart";
import { getShop, pricesDate } from "./get-shop";

export default async function CatalogLayout({ children, params }: { children: ReactNode; params: Promise<{ site: string }> }) {
  let shop;
  try { shop = await getShop(); } catch {
    // Each page shows its own error; without the catalogue there is nothing to put in a cart.
    return children;
  }
  return <CartProvider siteId={(await params).site} offers={shop.offers} whatsapp={shop.store.whatsapp ?? ""} pricesDate={pricesDate()}>{children}</CartProvider>;
}
