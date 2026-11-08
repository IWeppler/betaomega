"use client";

import { useState, type MutableRefObject } from "react";
import { Plus, Trash2 } from "lucide-react";
import { centsFromPesos, pesosFromCents } from "@/platform/money";
import { SaveForm, usePanel, useSite } from "@/platform/panel";
import type { TurnType } from "../domain/hours";
import type { Settings } from "../domain/setup";
import { Button, Card, Field, FormArea, inputClass } from "./controls";
import { sendJson } from "./fetch-json";

/** A row being edited: prices stay as typed until saving. `key` tells apart rows that have no id yet. */
type Row = {
  key: string;
  id: string | null;
  revision: number;
  name: string;
  duration: string;
  price: string;
  privatePrice: string;
  deposit: string;
};

const pesos = (cents: number | null) =>
  cents === null ? "" : pesosFromCents(cents);
const rowFrom = (type: TurnType): Row => ({
  key: type.id ?? "",
  id: type.id,
  revision: type.revision,
  name: type.name,
  duration: String(type.durationMinutes),
  price: pesos(type.priceCents),
  privatePrice: pesos(type.privatePriceCents),
  deposit: type.depositPercent === null ? "" : String(type.depositPercent),
});

/** A price that cannot be read goes as it is, so the server's validation answers instead of it silently meaning "not offered". */
const readPrice = (text: string) =>
  text.trim() === "" ? null : (centsFromPesos(text) ?? -1);

export function TypesForm({
  types,
  settings,
  onSaved,
  onDiscard,
  flushRef,
}: {
  types: TurnType[];
  settings: Settings;
  onSaved: () => Promise<void>;
  onDiscard: () => void;
  flushRef: MutableRefObject<() => Promise<boolean>>;
}) {
  const site = useSite();
  const panel = usePanel();
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>(() => types.map(rowFrom));
  const [deposit, setDeposit] = useState(String(settings.depositPercent));
  const [next, setNext] = useState(1);
  const patch = (key: string, change: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  const add = () => {
    setRows((current) => [
      ...current,
      {
        key: `nuevo-${next}`,
        id: null,
        revision: 1,
        name: "",
        duration: "60",
        price: "",
        privatePrice: "",
        deposit: "",
      },
    ]);
    setNext((value) => value + 1);
  };
  const save = async () => {
    panel.setBusy(true);
    setError("");
    try {
      const payload = (row: Row, active: boolean) => ({
        id: row.id,
        revision: row.revision,
        name: row.name,
        durationMinutes: Number(row.duration),
        priceCents: readPrice(row.price),
        privatePriceCents: readPrice(row.privatePrice),
        depositPercent: row.deposit.trim() === "" ? null : Number(row.deposit),
        active,
      });
      const unchanged = (row: Row) => {
        const before = types.find((type) => type.id === row.id);
        return (
          before && JSON.stringify(rowFrom(before)) === JSON.stringify(row)
        );
      };
      const removed = types
        .filter((type) => !rows.some((row) => row.id === type.id))
        .map((type) => payload(rowFrom(type), false));
      const changed = rows
        .filter((row) => !unchanged(row))
        .map((row) => payload(row, true));
      if (changed.length || removed.length)
        await sendJson(`/api/sites/${site.id}/sauna/types`, "PUT", {
          types: [...changed, ...removed],
        });
      if (Number(deposit) !== settings.depositPercent)
        await sendJson(`/api/sites/${site.id}/sauna/config`, "PATCH", {
          ...settings,
          depositPercent: Number(deposit),
        });
      await onSaved();
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    } finally {
      panel.setBusy(false);
    }
  };
  return (
    <FormArea>
      <SaveForm
        onSave={save}
        changes={JSON.stringify({ rows, deposit })}
        paused={panel.busy}
        error={error}
        registerRef={flushRef}
        onDiscard={onDiscard}
      >
        <div className="mb-4 grid gap-4">
          <Card>
            <Field
              label="Seña general, en porcentaje"
              hint="Vale para los tipos de turno que no tienen una seña propia."
              className="max-w-xs"
            >
              <input
                className={inputClass}
                type="number"
                min={0}
                max={100}
                value={deposit}
                onChange={(event) => setDeposit(event.target.value)}
                required
              />
            </Field>
          </Card>
          <Card className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 text-lg font-semibold text-ink">
                Tipos de turno
              </h2>
              <Button className="ml-auto" onClick={add}>
                <Plus size={15} aria-hidden="true" />
                Agregar tipo
              </Button>
            </div>
            <p className="m-0 text-muted">
              Dejá un precio vacío si ese tipo no ofrece esa modalidad.
            </p>
            {rows.length === 0 && (
              <p className="m-0 text-muted">Todavía no hay tipos de turno.</p>
            )}
            {rows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-2 items-start gap-3 rounded-field border border-line bg-bg p-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]"
              >
                <Field label="Nombre" className="col-span-2 lg:col-span-1">
                  <input
                    className={inputClass}
                    value={row.name}
                    maxLength={40}
                    required
                    onChange={(event) =>
                      patch(row.key, { name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Duración, en minutos">
                  <input
                    className={inputClass}
                    type="number"
                    min={5}
                    max={600}
                    value={row.duration}
                    required
                    onChange={(event) =>
                      patch(row.key, { duration: event.target.value })
                    }
                  />
                </Field>
                <Field label="Individual, $">
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={row.price}
                    onChange={(event) =>
                      patch(row.key, { price: event.target.value })
                    }
                  />
                </Field>
                <Field label="Grupal, $">
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={row.privatePrice}
                    onChange={(event) =>
                      patch(row.key, { privatePrice: event.target.value })
                    }
                  />
                </Field>
                <Field label="Seña, %" hint="Vacío usa la general.">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={100}
                    value={row.deposit}
                    onChange={(event) =>
                      patch(row.key, { deposit: event.target.value })
                    }
                  />
                </Field>
                <button
                  type="button"
                  aria-label={`Quitar ${row.name || "este tipo"}`}
                  onClick={() =>
                    setRows((current) =>
                      current.filter((item) => item.key !== row.key),
                    )
                  }
                  className="inline-grid size-control place-items-center self-center rounded-control text-muted hover:bg-sunken hover:text-danger lg:mt-6 lg:self-start"
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </div>
            ))}
          </Card>
        </div>
      </SaveForm>
    </FormArea>
  );
}
