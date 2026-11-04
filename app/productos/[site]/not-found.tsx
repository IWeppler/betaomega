import Link from "next/link";

export default function ProductNotFound() {
  return <main className="p-page">
    <h1 className="p-title">No encontramos este producto</h1>
    <p className="p-empty">Puede que la dirección esté mal escrita o que ya no esté publicado.</p>
    <p className="p-back"><Link href="/">Ver todos los productos</Link></p>
  </main>;
}
