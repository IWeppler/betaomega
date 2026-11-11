"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

export function PreparationSteps({ steps, onChange }: { steps: string[]; onChange: (steps: string[]) => void }) {
  const move = (index: number, to: number) => {
    const next = [...steps];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };
  const button = "inline-flex min-h-control min-w-control items-center justify-center rounded-control border border-line px-3";
  return <fieldset className="flex min-w-0 flex-col gap-3 rounded-card border border-line p-4">
    <legend className="px-2 font-medium">Preparación e indicaciones internas</legend>
    <p className="text-sm text-muted">Escribí el método y los tiempos, un paso por renglón. Al menos uno para guardar.</p>
    <ol className="flex flex-col gap-4">
      {steps.map((step, index) => <li key={index} className="flex flex-col gap-2">
        <label className="flex flex-col gap-2"><span className="text-sm font-medium">Paso {index + 1}</span>
          <textarea value={step} rows={3} maxLength={10000} required={steps.length === 1}
            className="w-full rounded-field border border-line bg-surface p-3 text-ink"
            onChange={event => onChange(steps.map((value, n) => n === index ? event.target.value : value))} />
        </label>
        <div className="flex gap-2">
          <button className={button} type="button" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Subir paso ${index + 1}`}><ArrowUp size={16} aria-hidden="true" /></button>
          <button className={button} type="button" disabled={index === steps.length - 1} onClick={() => move(index, index + 1)} aria-label={`Bajar paso ${index + 1}`}><ArrowDown size={16} aria-hidden="true" /></button>
          <button className={button} type="button" onClick={() => onChange(steps.filter((_, n) => n !== index))} aria-label={`Quitar paso ${index + 1}`}><X size={16} aria-hidden="true" /></button>
        </div>
      </li>)}
    </ol>
    <button className={`${button} self-start gap-2`} type="button" disabled={steps.length >= 100} onClick={() => onChange([...steps, ""])}><Plus size={16} aria-hidden="true" />Agregar paso</button>
  </fieldset>;
}
