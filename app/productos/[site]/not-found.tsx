import Link from "next/link";

// Next gives this page no params, so it cannot use the site's own word for its items.
export default function ProductNotFound() {
  return <main className="p-page">
    <h1 className="p-title">No encontramos esta página</h1>
    <p className="p-empty">Puede que la dirección esté mal escrita o que ya no esté publicada.</p>
    <p className="p-back"><Link href="/">Volver al inicio</Link></p>
  </main>;
}
