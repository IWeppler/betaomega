# Plantilla de módulo

Punto de partida para un módulo nuevo. **No es código vivo:** nada la importa y sus tests no corren con `npm test`. `tsc` y `eslint` sí la revisan, así que no queda desactualizada sin que se note.

## Cómo usarla

1. Copiá esta carpeta a `modules/<m>/`, sin este `README.md`.
2. Renombrá `thing` y `Thing` con el vocabulario del negocio.
3. Reemplazá las tablas, secciones y textos de ejemplo.
4. Corré `npx eslint`, `npx tsc --noEmit` y `npm test`.

Para que el módulo sea un tipo de sitio, además:

- Agregá la clave a `siteKinds` (`lib/sites.ts`) y a `panelKinds` (`app/panel/[site]/kinds.tsx`), importando `@/modules/<m>/panel`.
- Agregá la sección del módulo al final de `supabase/schema.sql` (patrón 9 de [PATTERNS.md](../PATTERNS.md)).
- Montá las rutas con una línea que delegue en el módulo:
  - Panel: `app/panel/[site]/<sección>/page.tsx`, con `@/modules/<m>/ui`.
  - API: `app/api/sites/[site]/<m>/route.ts`, con `@/modules/<m>/server`.
  - Sitio público: `app/<tipo>/[site]/`.

## Qué hay en cada archivo

| Archivo | Rol |
|---|---|
| `domain/thing.ts` | Reglas puras, con imports relativos con extensión `.ts`. |
| `domain/thing.test.ts` | Tests de esas reglas, al lado del código. |
| `data/things.ts` | Acceso a la base por `siteTable`. Solo servidor. |
| `api/things.ts` | Lógica del route handler (patrón 8). |
| `ui/thing-list.tsx` | Pantalla del panel, solo con utilidades de Tailwind. |
| `ui/index.ts` | Entrada pública de las pantallas. |
| `panel.tsx` | Secciones y proveedor para el registro del panel. |
| `index.ts` | Entrada pública segura para el cliente: tipos y dominio. |
| `server.ts` | Entrada pública de servidor, con `import "server-only"`. |
