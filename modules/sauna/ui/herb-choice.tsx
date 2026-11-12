import type { SaunaHerb } from "../domain/herbs";

export function HerbChoice({ herbs, value, onChange, disabled = false, name = "herb" }: { herbs: SaunaHerb[]; value: string; onChange: (id: string) => void; disabled?: boolean; name?: string }) {
  if (!herbs.length) return null;
  return <fieldset disabled={disabled} className="m-0 grid min-w-0 gap-2 border-0 p-0">
    <legend className="mb-1 text-sm font-semibold">Hierba para tu sesión</legend>
    <p className="m-0 text-xs text-muted">Podés elegir una sola. Al elegir otra, reemplazás la anterior.</p>
    {[{ id: "", name: "Sin hierba", description: "" }, ...herbs].map(herb => <label key={herb.id} className={`flex min-h-control cursor-pointer items-start gap-3 rounded-field border p-3 has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-focus ${value === herb.id ? "border-accent bg-accent-soft" : "border-line-strong bg-surface"}`}>
      <input className="mt-1 accent-accent" type="radio" name={name} checked={value === herb.id} onChange={() => onChange(herb.id)} />
      <span className="min-w-0 text-sm"><span className="block font-semibold">{herb.name}</span>{herb.description && <span className="block whitespace-pre-line text-muted">{herb.description}</span>}</span>
    </label>)}
  </fieldset>;
}
