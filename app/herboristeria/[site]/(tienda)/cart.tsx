"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Check, Minus, Plus, ShoppingCart, Trash } from "@phosphor-icons/react";
import { WhatsappIcon } from "@/app/whatsapp-icon";
import { Screen } from "@/app/screen";
import { formatMoney } from "@/lib/catalog";
import { MAX_LINES, MAX_QTY, ORDER_LIMITS, addToCart, canAdd, cartCount, parseCart, removeFromCart, resolveCart, setQty, validateOrder, type Offer, type OrderDetails } from "@/lib/cart";
import { getRemoved, getServerRemoved, getServerSnapshot, getSnapshot, setRemoved, subscribe, writeCart } from "./cart-store";

type CartApi = { count: number; add: (key: string) => boolean; open: () => void };
const CartContext = createContext<CartApi | null>(null);
const useCart = () => useContext(CartContext);

/** Holds the cart for every store page. Prices come from `offers` (built on the server); the browser stores keys and quantities only. */
export function CartProvider({ siteId, offers, whatsapp, pricesDate, children }: { siteId: string; offers: Offer[]; whatsapp: string; pricesDate: string; children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const resolved = useMemo(() => resolveCart(parseCart(raw), offers), [raw, offers]);
  const [open, setOpen] = useState(false);
  const removedCount = useSyncExternalStore(subscribe, getRemoved, getServerRemoved);
  const [toast, setToast] = useState<{ text: string; problem: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((text: string, problem = false) => { setToast({ text, problem }); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 3500); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // A product that was hidden or deleted since it was added leaves the cart, and the customer is told.
  useEffect(() => {
    if (!resolved.removed.length) return;
    writeCart(resolved.cart, resolved.removed.length);
  }, [resolved]);
  const api = useMemo<CartApi>(() => ({
    count: cartCount(resolved.cart),
    open: () => setOpen(true),
    add: key => {
      // Read the stored cart, not the rendered one: two quick taps must both count.
      const current = parseCart(getSnapshot());
      if (!canAdd(current, key)) { say(`El carrito llegó al máximo de ${MAX_LINES} productos distintos.`, true); return false; }
      writeCart(addToCart(current, key));
      return true;
    },
  }), [resolved.cart, say]);
  return <CartContext.Provider value={api}>
    {children}
    <CartFab />
    {toast && <div className={`cart-toast${toast.problem ? " is-problem" : ""}`} role="alert">{toast.text}</div>}
    {open && <CartPanel siteId={siteId} resolved={resolved} whatsapp={whatsapp} pricesDate={pricesDate} removedCount={removedCount} onDismissRemoved={() => setRemoved(0)} onClose={() => setOpen(false)} />}
  </CartContext.Provider>;
}

/** Always-visible cart button with the number of units. The count is announced to screen readers whenever it changes. */
function CartFab() {
  const cart = useCart();
  if (!cart) return null;
  return <button type="button" className="cart-fab no-print" onClick={cart.open}>
    <ShoppingCart size={26} weight="bold" aria-hidden="true" />
    <span className="sr-only">Abrir el carrito</span>
    <span className="cart-count" aria-live="polite" aria-atomic="true"><span className="sr-only">{cart.count === 1 ? "1 unidad" : `${cart.count} unidades`}</span><span aria-hidden="true">{cart.count}</span></span>
  </button>;
}

/** Icon-only button: a plus that turns into a check for a moment once the product is in the cart. */
export function AddButton({ offerKey, name, className = "" }: { offerKey: string; name: string; className?: string }) {
  const cart = useCart();
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!cart) return null;
  const add = () => {
    if (!cart.add(offerKey)) return;
    setDone(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1400);
  };
  return <button type="button" className={`add-button no-print${done ? " is-done" : ""} ${className}`} onClick={add} aria-label={`Agregar ${name} al carrito`}>
    <Plus className="add-plus" size={24} weight="bold" aria-hidden="true" />
    <Check className="add-check" size={24} weight="bold" aria-hidden="true" />
  </button>;
}

const blankOrder = (): OrderDetails => ({ name: "", delivery: "pickup", address: "", note: "" });

function CartPanel({ siteId, resolved, whatsapp, pricesDate, removedCount, onDismissRemoved, onClose }: { siteId: string; resolved: ReturnType<typeof resolveCart>; whatsapp: string; pricesDate: string; removedCount: number; onDismissRemoved: () => void; onClose: () => void }) {
  const [details, setDetails] = useState<OrderDetails>(blankOrder);
  const [attempted, setAttempted] = useState(false);
  const [warnedFor, setWarnedFor] = useState("");
  const [verified, setVerified] = useState<{ url: string; tooLong: boolean; total: number; pending: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [step, setStep] = useState<"cart" | "details">("cart");
  const form = useRef<HTMLFormElement>(null);
  const errors = validateOrder(details);
  const shown = attempted ? errors : {};
  const patch = (change: Partial<OrderDetails>) => { setDetails(current => ({ ...current, ...change })); setVerified(null); setWarnedFor(""); setOrderError(""); };
  const lines = resolved.lines;
  const pending = verified?.pending ?? resolved.pending;
  const priced = lines.length - pending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (Object.keys(errors).length) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    if (sending) return;
    setSending(true);
    setOrderError("");
    // Open within the user gesture so mobile browsers allow the tab; sever the opener before navigating.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/herbal/order`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cart: resolved.cart, details }),
      });
      const quote = await response.json();
      if (!response.ok) throw new Error(quote.error || "No pudimos verificar los precios.");
      setVerified(quote);
      if (quote.tooLong && warnedFor !== quote.url) { popup?.close(); setWarnedFor(quote.url); return; }
      if (popup) popup.location.href = quote.url;
    } catch (error) {
      popup?.close(); setVerified(null); setOrderError(error instanceof Error ? error.message : "Intentá de nuevo.");
    } finally { setSending(false); }
  };

  const inDetails = step === "details" && lines.length > 0;
  return <Screen title={inDetails ? "Tus datos" : "Tu carrito"} onClose={onClose}>
    {removedCount > 0 && <div className="alert warn" role="status"><span>Quitamos del carrito {removedCount === 1 ? "1 producto que ya no está disponible" : `${removedCount} productos que ya no están disponibles`}.</span><button type="button" aria-label="Cerrar aviso" onClick={onDismissRemoved}>Entendido</button></div>}
    {!lines.length ? <><p className="screen-intro">Tu carrito está vacío. Agregá productos desde el catálogo y armá tu pedido.</p><button type="button" className="button primary" onClick={onClose}>Ver el catálogo</button></> : inDetails ? <>
      <button type="button" className="button back-button" disabled={sending} onClick={() => { setVerified(null); setWarnedFor(""); setStep("cart"); }}><ArrowLeft size={20} aria-hidden="true" />Volver al carrito</button>
      <div className="cart-total" role="status">
        <p><span>{resolved.cart.length === 1 ? "1 producto" : `${resolved.cart.length} productos`}</span><strong>{priced ? formatMoney(verified?.total ?? resolved.total) : "A confirmar"}</strong></p>
        {pending > 0 && <small>{priced ? "Los productos sin precio se confirman por WhatsApp." : "Los precios se confirman por WhatsApp."}</small>}
      </div>
      <form ref={form} className="order-form" onSubmit={submit} noValidate>
        <h3>Datos del pedido</h3>
        <label className="field"><span>Tu nombre<span className="required-tag">Obligatorio</span></span>
          <input name="name" disabled={sending} value={details.name} maxLength={ORDER_LIMITS.name + 20} autoComplete="name" aria-invalid={Boolean(shown.name)} aria-describedby={shown.name ? "order-name-error" : undefined} onChange={e => patch({ name: e.target.value })} />
          {shown.name && <small className="field-error" id="order-name-error">{shown.name}</small>}
        </label>
        <fieldset className="order-delivery" aria-describedby={shown.delivery ? "order-delivery-error" : undefined}>
          <legend>¿Cómo lo recibís?</legend>
          <label className="check"><input type="radio" disabled={sending} name="delivery" checked={details.delivery === "pickup"} onChange={() => patch({ delivery: "pickup" })} />Retiro en el local</label>
          <label className="check"><input type="radio" disabled={sending} name="delivery" checked={details.delivery === "delivery"} onChange={() => patch({ delivery: "delivery" })} />Envío</label>
          {shown.delivery && <small className="field-error" id="order-delivery-error">{shown.delivery}</small>}
        </fieldset>
        {details.delivery === "delivery" && <label className="field"><span>Dirección de envío<span className="required-tag">Obligatorio</span></span>
          <input name="address" disabled={sending} value={details.address} maxLength={ORDER_LIMITS.address + 20} autoComplete="street-address" aria-invalid={Boolean(shown.address)} aria-describedby={shown.address ? "order-address-error" : undefined} onChange={e => patch({ address: e.target.value })} />
          {shown.address && <small className="field-error" id="order-address-error">{shown.address}</small>}
        </label>}
        <label className="field"><span>Nota (opcional)</span>
          <textarea name="note" disabled={sending} rows={3} value={details.note} maxLength={ORDER_LIMITS.note + 50} aria-invalid={Boolean(shown.note)} aria-describedby={shown.note ? "order-note-error" : undefined} onChange={e => patch({ note: e.target.value })} />
          {shown.note && <small className="field-error" id="order-note-error">{shown.note}</small>}
        </label>
        {!whatsapp ? <div className="alert warn" role="status"><span>Esta tienda todavía no cargó su número de WhatsApp, así que por ahora no podemos recibir pedidos por acá. Podés consultar por las redes o acercarte al local.</span></div> : <>
          {verified?.tooLong && warnedFor === verified.url && <div className="alert warn" role="alert"><span>Tu pedido es muy largo y puede que WhatsApp no lo abra. Te conviene dividirlo en dos pedidos. Si querés, podés intentar abrirlo igual.</span></div>}
          {orderError && <p className="text-danger" role="alert">{orderError}</p>}
          <button className="button primary full order-send" type="submit" disabled={sending}><WhatsappIcon size={22} />{sending ? "Verificando precios…" : verified?.tooLong && warnedFor === verified.url ? "Abrir WhatsApp igual" : "Pedir por WhatsApp"}</button>
          {verified && (!verified.tooLong || warnedFor === verified.url) && <a className="block py-2 text-center underline" href={verified.url} target="_blank" rel="noopener noreferrer">Si no se abrió, abrí tu pedido en WhatsApp</a>}
          <small className="order-hint">Se abre WhatsApp con tu pedido listo. Vos lo enviás desde ahí.</small>
        </>}
      </form>
    </> : <>
      <ul className="cart-lines" aria-label="Productos del pedido">
        {lines.map(line => <li className="cart-line" key={line.key}>
          <div className="cart-line-info">
            <strong>{line.name}</strong>
            {line.unit && <span>{line.unit}</span>}
            <span>{line.subtotal === undefined ? "Precio a confirmar" : `${formatMoney(line.unitPrice!)} c/u`}</span>
          </div>
          <div className="qty" role="group" aria-label={`Cantidad de ${line.name}`}>
            <button type="button" className="qty-step" aria-label={`Una unidad menos de ${line.name}`} onClick={() => writeCart(setQty(resolved.cart, line.key, line.qty - 1))}><Minus size={18} weight="bold" aria-hidden="true" /></button>
            <output aria-label={`${line.qty} unidades`}>{line.qty}</output>
            <button type="button" className="qty-step" aria-label={`Una unidad más de ${line.name}`} disabled={line.qty >= MAX_QTY} onClick={() => writeCart(setQty(resolved.cart, line.key, line.qty + 1))}><Plus size={18} weight="bold" aria-hidden="true" /></button>
          </div>
          <strong className="cart-subtotal">{line.subtotal === undefined ? "A confirmar" : formatMoney(line.subtotal)}</strong>
          <button type="button" className="icon-button cart-remove" aria-label={`Quitar ${line.name} del carrito`} onClick={() => writeCart(removeFromCart(resolved.cart, line.key))}><Trash size={22} aria-hidden="true" /></button>
        </li>)}
      </ul>
      <div className="cart-total" role="status">
        <p><span>Total</span><strong>{priced ? formatMoney(resolved.total) : "A confirmar"}</strong></p>
        {resolved.pending > 0 && <small>{priced ? `${resolved.pending === 1 ? "1 producto" : `${resolved.pending} productos`} sin precio no suma${resolved.pending === 1 ? "" : "n"} al total: se confirma por WhatsApp.` : "Los precios se confirman por WhatsApp."}</small>}
        <small>Precios al {pricesDate}. Se confirman al enviar el pedido.</small>
      </div>
      <div className="cart-steps">
        {whatsapp ? <button type="button" className="button primary full" onClick={() => setStep("details")}>Finalizar compra</button> : <div className="alert warn" role="status"><span>Esta tienda todavía no cargó su número de WhatsApp, así que por ahora no podemos recibir pedidos por acá. Podés consultar por las redes o acercarte al local.</span></div>}
        <button type="button" className="button full" onClick={onClose}>Seguir comprando</button>
      </div>
      {confirmClear
        ? <div className="cart-clear"><span>¿Vaciar todo el carrito?</span><button type="button" className="button danger" onClick={() => { writeCart([]); setConfirmClear(false); }}>Sí, vaciar</button><button type="button" className="button" onClick={() => setConfirmClear(false)}>Cancelar</button></div>
        : <button type="button" className="button cart-clear-open" onClick={() => setConfirmClear(true)}><Trash size={20} aria-hidden="true" />Vaciar carrito</button>}
    </>}
  </Screen>;
}
