# Plan — Comidas del cielo + panel

Cada grupo se hace en una sesión nueva (`/clear`). Al arrancar: "Leé PLAN.md y hacé el grupo X".
Orden: **A primero** (cambia el esquema). B, C, D y E después, en cualquier orden.
Al cerrar un grupo: tildar sus tareas acá y commitear.

Archivos clave: `supabase/schema.sql`, `lib/recipes.ts` (tipos, validación, `RecipeCard`), `lib/recipe-store.ts` (fila ⇄ receta),
`app/panel/[site]/recipe-editor.tsx`, `app/recetas/[site]/recipe-browser.tsx`, `recipe-card.tsx`, `[slug]/page.tsx`.
Leer `node_modules/next/dist/docs/` antes de tocar APIs de Next (versión 16, cambia cosas).

---

## Taxonomía (decidida)

Una receta se describe con cuatro ejes independientes:

| Eje | Campo | Valores | Cardinalidad | Quién define los valores |
|---|---|---|---|---|
| **Momento** | `moments text[]` | `desayuno-merienda`, `almuerzo-cena`, `postre`, `cualquier-momento` | varios | fijos en código |
| **Tipo** | `categories text[]` (ya existe) | Salsas, Coberturas, Aderezos, Pastas, Carnes, Panes, Bebidas… | varios (hasta 12, como hoy) | libres, se gestionan en Panel › Categorías |
| **Nación** | `cuisine text` | Argentina, Italia, México… | uno (opcional) | libre con sugerencias de las ya usadas |
| **Complejidad** | `difficulty text` | `facil`, `media`, `dificil` | uno (opcional) | fijos en código |

- "Cualquier momento" es para recetas como panes saborizados; no se combina con los otros momentos (si se marca, se desmarcan los demás).
- Etiquetas visibles de momento: "Desayuno / Merienda", "Almuerzo / Cena", "Postre", "Cualquier momento".
- Migración: las categorías actuales que en realidad son momentos (desayuno, merienda, almuerzo, cena, postre…) pasan a `moments` y se quitan de `categories`. Hacerlo con un `update` idempotente en `schema.sql` y revisar a mano en el panel después.

---

## Grupo A — Datos y catálogo · **Opus**

- [x] **Esquema** en `schema.sql` (idempotente, `add column if not exists`):
  `moments text[] not null default '{}'`, `cuisine text`, `difficulty text check (difficulty in ('facil','media','dificil'))`, más la migración de categorías→momentos.
- [x] **Tipos y validación** en `lib/recipes.ts` + `lib/recipe-store.ts`: los tres campos nuevos en `Recipe`, `RecipeInput`, `blankRecipe`, validación y `RecipeCard`. Incluirlos en `search` y en el JSON-LD (`recipeCuisine`, `suitableForDiet` no; `recipeCategory` puede ser el momento).
- [x] **Descripción más larga** (tarea 1): subir el límite de `summary` de 600 a 3000 en `lib/recipes.ts`, textarea que crece en el editor, y en la tarjeta recortarla con `line-clamp` para que no rompa la grilla.
- [x] **Editor de admin**: momento como chips de selección múltiple, nación como combobox con sugerencias de las ya usadas, complejidad como selector segmentado de 3 opciones. Sumar "momento" y "complejidad" a los faltantes que muestra el resumen.
- [x] **Filtros del catálogo** en `recipe-browser.tsx`: Momento (chips arriba, el filtro más visible: tarea 12), Tipo, Nación, Complejidad. Un valor por eje, combinables entre ejes (AND). Una receta de “Cualquier momento” aparece también en cada momento. Los conteos de cada opción respetan los demás filtros. Reflejarlos en la URL (`?momento=postre&tipo=salsas`) para que se puedan compartir.
- [x] **Orden**: Más recientes (por `published_at`, default), Alfabético, Tiempo de preparación (menor a mayor; las que no tienen tiempo van al final).
- [x] **Categorías en mayúsculas** (tarea 10): solo visual con CSS (`text-transform: uppercase` + algo de `letter-spacing`), sin tocar los datos.
- [x] **Tarjetas** (tarea 13): mostrar tiempo · cantidad (`servings`) · dificultad, en ese orden, con íconos de Phosphor. Si falta un dato, se omite sin dejar hueco.

**Hecho (2026-11-03).** Falta correr `supabase/schema.sql` en el SQL Editor (agrega las columnas y mueve las categorías que eran momentos).

**Listo cuando:** se crea una receta con los cuatro ejes, aparece filtrable y ordenable en el catálogo, y las recetas viejas siguen viéndose bien.

---

## Grupo B — Detalle de receta · **Sonnet**

- [x] **Desplegables** (tarea 11): Ingredientes y Preparación como cards plegables. Abiertas por defecto en escritorio; en celular, Ingredientes abierta y Preparación cerrada. Usar `<details>/<summary>` (accesible y sin JS). Mantener el tachado de ingredientes de `ingredient-list.tsx`.
- [x] **Comentarios sin puntuación** (tarea 8):
  - Tabla `recipe_comments (id uuid, recipe_id uuid references recipes on delete cascade, name text, body text, status text check in ('pending','approved','hidden'), created_at, ip_hash text)`, RLS cerrada como el resto (solo service role).
  - Formulario público: nombre (opcional) + comentario (máx. 1000). Anti-spam: honeypot, límite por `ip_hash` (p. ej. 3 por hora) y tiempo mínimo de llenado.
  - Moderación: los comentarios entran como `pending`. En el panel, una sección "Comentarios" con aprobar / ocultar y un contador de pendientes en la navegación.
  - En la receta se muestran solo los aprobados, del más nuevo al más viejo. **No** hay estrellas ni puntaje, y no se toca el JSON-LD `aggregateRating`.

**Hecho (2026-11-03).** Falta correr `supabase/schema.sql` en el SQL Editor (crea `recipe_comments`). Detalles que no estaban en el plan: los comentarios con enlaces (`http://`, `www.`) se rechazan; el mismo texto dos veces en una hora se guarda una sola vez; un formulario enviado en menos de 3 s se rechaza; los comentarios se moderan desde Panel › Comentarios (aprobar, ocultar, volver a pendiente, eliminar) y el menú muestra cuántos esperan revisión.

---

## Grupo C — Métricas propias · **Sonnet**

Sin Vercel Analytics ni servicios externos: todo en Supabase y se ve en el panel.

- [x] **Tabla** `site_metrics (site_id text, recipe_id uuid null, kind text check in ('page_view','recipe_view','share'), channel text null, day date, count integer, primary key (site_id, recipe_id, kind, channel, day))`: contadores agregados por día para que la tabla no crezca por evento. Como `recipe_id` y `channel` pueden ser null y una PK no admite nulls, usar `coalesce` a un valor centinela o un índice único con `nulls not distinct`.
- [x] **Función** `track_metric(site, recipe, kind, channel)` que hace upsert +1, solo ejecutable por service role (mismo patrón que `increment_recipe_view`).
- [x] **Endpoint** `POST /api/sites/[site]/metrics` que llama a la función. Usar `navigator.sendBeacon` desde el cliente. Filtros: ignorar bots por user-agent, ignorar visitas con sesión de admin y deduplicar la misma receta en la misma pestaña (sessionStorage).
- [x] **Qué se mide** (tarea 7):
  - `page_view`: cualquier página pública del sitio.
  - `recipe_view`: la página de detalle. Reemplaza al contador `views` actual: migrar su valor como total histórico y dejar de usar `increment_recipe_view`.
  - `share`: cada uso de los botones de compartir (`whatsapp-share.tsx`, `site-actions.tsx`, Web Share API), con `channel` = whatsapp / nativo / copiar-link.
- [x] **Panel › Métricas**: totales de los últimos 7 / 30 / 90 días (visitas, vistas de recetas, compartidos), gráfico de visitas por día, y una tabla de recetas ordenable por vistas y compartidos. Cargar la skill `dataviz` antes de hacer los gráficos.
- Visitantes únicos: fuera de alcance por ahora (necesitaría cookie o hash de IP; se puede sumar después).

**Hecho (2026-11-03).** Falta correr `supabase/schema.sql` en el SQL Editor (crea `site_metrics` y tres funciones). El SQL de los grupos A, B y C se probó completo en un Postgres local: corre en limpio, se puede repetir y la migración de categorías a momentos queda bien.

Cómo quedó, para quien siga:
- Una visita manda **un** pedido (`kind: "view"`, con `recipeId` si es una receta): el servidor suma `page_view` y, si hay receta, `recipe_view`. Los compartidos mandan `kind: "share"` con canal (`nativo` o `whatsapp`; `copiar` está aceptado pero ningún botón lo usa todavía).
- `recipes.views` quedó **congelada** como el total de antes de las métricas. El panel muestra `views` + lo registrado (lo suma `listRecipes`), así que "Más vistas" del Resumen sigue funcionando. `increment_recipe_view` ya no se llama.
- Se ignoran: buscadores y previews (por user-agent), pedidos sin user-agent, recetas no publicadas, y la misma página en la misma pestaña dentro de 30 min. Límite conocido: la sesión de admin vive en otro dominio (el del panel), así que **las visitas del administrador al sitio público sí se cuentan**; el chequeo de admin solo sirve si ambos comparten host.
- Panel › Métricas: totales de 7/30/90 días, gráfico de visitas y vistas por día (con tabla alternativa), canales de compartido y tabla de recetas ordenable.

---

## Grupo D — Marca y UI · **Sonnet**

- [x] **Confirmación de guardado** (tarea 2): que el mensaje de "Guardado" / error aparezca justo debajo del botón Guardar del editor (`save-form.tsx` / `recipe-editor.tsx`), no en otro lugar de la pantalla. Que se vaya solo a los ~3 s si es éxito y quede fijo si es error.
- [x] **OG de Comidas del cielo** (tarea 3): revisar `app/recetas/[site]/og/route.tsx` y la metadata de `layout.tsx` y `[slug]/page.tsx`. Imagen de 1200×630 con el logo (`public/comidasdelcielo-logo.webp`; ojo, `next/og` no soporta webp, convertir a png) y, por receta, la foto + el título. Verificar con el depurador de Facebook o con opengraph.xyz.
- [x] **Loader con el logo** (tarea 4): pantalla completa con el logo centrado y, al cargar, el logo se achica y viaja hasta su lugar en el navbar (técnica FLIP o View Transitions). Solo en la primera visita de la sesión (sessionStorage), respetar `prefers-reduced-motion` y no retrasar el LCP más de ~1 s.
  Imagen: la portada "Yodhkum (Comidas del cielo)", la misma que ya usa el navbar (`public/comidasdelcielo-logo.webp`).
- [x] **Footer** (tarea 5): rediseño con logo, navegación por momentos (enlaces a los filtros del grupo A), redes / WhatsApp y créditos. Cargar la skill `design-taste-frontend`.

**Hecho (2026-11-03).** Detalles: el mensaje de guardado está debajo del botón en el `SaveForm` compartido (vale para todos los editores del panel; éxito 3 s, error fijo). `/og` ahora trae el logo (`public/comidasdelcielo-logo.png`, conversión del webp) y `/og?receta=slug` arma foto + título; las recetas sin foto caen en la tarjeta del sitio, y la metadata de cada receta apunta siempre a `/og?receta=`. El loader es `splash.tsx` (FLIP al logo del navbar, una vez por sesión, sin movimiento con `prefers-reduced-motion`; sin JS se desvanece solo a los ~2 s). Footer nuevo con logo, enlaces por momento, contacto con íconos y créditos. Sin verificar en navegador real: el vuelo del splash y el debugger de Facebook.

---

## Grupo E — PWA · **Sonnet**

- [ ] Ya existen `app/register-sw.tsx` y `public/sw.js`: revisar qué cachean hoy antes de cambiar nada.
- [ ] **Dos apps instalables separadas**: el catálogo de Comidas del cielo (scope `/`, en su dominio) y el panel de admin (scope `/panel`, en el host del panel). Cada una con su propio manifest (`name`, `short_name`, `theme_color`, íconos 192/512 + maskable) servido según el host, igual que hoy se resuelve el sitio en `proxy.ts`.
- [ ] **Caché**: el catálogo funciona offline con las recetas ya visitadas (stale-while-revalidate para páginas y fotos). El panel **no** cachea respuestas de la API (siempre red), solo el shell.
- [ ] Verificar en Chrome DevTools › Application que ambos manifests sean instalables y que el SW de uno no capture rutas del otro.

---

## Pendientes de decidir

- Lista inicial de naciones (o dejarla libre y que se arme sola con el uso).
