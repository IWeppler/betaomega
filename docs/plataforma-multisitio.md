# Plataforma multisitio: objetivo, decisiones y plan por fases

Documento de traspaso entre sesiones y modelos, con el mismo formato que `docs/tienda-online.md`. Quien tome una fase lee el documento entero, hace solo su fase y al terminar actualiza "Estado" y deja notas en "Registro".

**Antes de escribir código:** esta versión de Next (16.3.8) difiere de lo conocido. Leer la guía en `node_modules/next/dist/docs/01-app/` antes de tocar rutas, `proxy.ts`, metadata o cache.

## 1. Objetivo

Un mismo cliente tiene varios negocios y quiere un sitio público independiente para cada uno: `nekurel.com` (herboristería), Comidas del cielo (recetas, `comidasdelcielo`) y los que vengan. Ningún visitante debe notar que comparten app. Toda la administración se hace desde **un solo panel**, en un dominio neutro (`betayomega`).

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Arquitectura | Una sola app Next en un solo proyecto de Vercel. Todos los dominios apuntan al mismo deploy. |
| Ruteo | `proxy.ts` (en Next 16 reemplaza a `middleware.ts`) lee el host y reescribe a `/<tipo>/<sitio>/<ruta>`. Ejemplo: `nekurel.com/menta` se sirve desde `app/herboristeria/[site]/(tienda)/[slug]`. |
| Carpetas | Un árbol de rutas por **tipo** de sitio (`app/herboristeria/[site]`, `app/recetas/[site]`), porque cada tipo tiene páginas distintas. El parámetro `site` elige datos y marca. No usar carpetas con `_` para rutas: en el App Router son privadas y no generan rutas. |
| Registro de sitios | `lib/sites.ts` en código (id, tipo, nombre, dominios, URL canónica). Pasa a una tabla `sites` cuando haya un tercer sitio o temas editables. |
| Datos de Ñekurel | **No se migran a tablas.** Siguen en el documento JSON `app_data` con clave `catalog` (validación, versión, CSV, combos, carrito y tests ya funcionan). El registro de sitios dice qué clave usa cada sitio. |
| Datos de recetas | Tablas reales con `site_id` (`recipes`, ingredientes, pasos), porque ahí importan las páginas por receta, la búsqueda y el SEO. |
| Fotos | Mismo bucket `images`, con prefijo por sitio para lo nuevo (`<site_id>/...`). Las fotos existentes de Ñekurel no se mueven. |
| Acceso | Sin Supabase Auth por ahora: el servidor usa la clave secreta, así que RLS no protege nada extra. La sesión firmada actual suma roles por sitio cuando haga falta. Supabase Auth recién cuando haya varias personas con cuentas reales. |
| Herramienta del vendedor | Pasa a `nekurel.com/equipo` (misma marca, sigue siendo PWA para la tablet). `nekurel.com/` pasa a ser la tienda. |
| Panel | Dominio neutro `betayomega` (variable `PANEL_HOSTS`). Selector de sitio arriba y menú lateral según el tipo. |
| Marca por sitio | Cada tipo tiene su template; el tema (colores, logo, fuentes) vive en código y pasa a la base cuando se edite desde el panel. |
| Separación | `manifest`, ícono, imagen para compartir, `robots` y `sitemap` dependen del host. Sin links cruzados ni pie compartido. Analytics con una propiedad por dominio. |
| Cache | Por sitio, con tags (`revalidateTag(tag, "max")` o `updateTag` en Server Actions; la forma de un argumento está deprecada). |

## 3. Cómo queda armado (después de la fase 1)

```
proxy.ts                                   host → /<tipo>/<sitio>/<ruta>; /catalogo/* → /* (308)
lib/sites.ts                               registro de sitios y siteForHost()
app/layout.tsx                             <html> y <body> solamente (más las fuentes, provisorio)
app/api/*                                  sin reescribir; por ahora solo de Ñekurel
app/herboristeria/[site]/layout.tsx        valida el sitio, metadata, estilos, service worker
app/herboristeria/[site]/(tienda)/...      tienda: /, /<producto>, /combos/<combo>, con carrito
app/herboristeria/[site]/equipo/page.tsx   buscador del vendedor y administración actual
app/herboristeria/[site]/manifest.webmanifest/route.ts, og/route.tsx, pwa-icon/route.tsx
```

- **Host desconocido:** se sirve el sitio de `DEFAULT_SITE` (o `nekurel`). Así siguen funcionando `localhost`, la IP de la tablet en la red local y `nekurel.vercel.app` durante la transición.
- **En desarrollo:** `http://nekurel.localhost:3000` elige el sitio por subdominio (Chrome resuelve `*.localhost` solo).
- **Archivos de metadata:** no se usan `opengraph-image.tsx` ni `manifest.ts` dentro de `[site]`, porque Next arma su URL con la ruta interna (`/herboristeria/nekurel/...`), que no existe para el visitante. Se usan route handlers en rutas públicas (`/og`, `/manifest.webmanifest`) y la metadata las nombra a mano.
- **Slugs reservados:** `combos`, `equipo`, `og`, `pwa-icon` (rutas propias del sitio). Un producto con ese nombre toma `<slug>-producto`.

## 4. Fases

### Fase 1. Base multisitio para Ñekurel. **Opus 5.5**

- **Objetivo:** que Ñekurel funcione por host, sin cambios visibles salvo las URLs nuevas.
- **Alcance:** `lib/sites.ts`, `proxy.ts`, árbol `app/herboristeria/[site]`, tienda en `/`, vendedor en `/equipo`, redirección de `/catalogo/*`, manifest, ícono e imagen para compartir por sitio, service worker con versión nueva, slugs reservados, README.
- **Criterios:** `tsc`, `eslint` y los tests pasan; `/`, un producto, un combo y `/equipo` responden 200; `/catalogo/menta` redirige a `/menta`; `/herboristeria/nekurel` no es accesible desde afuera.

### Fase 2. Panel central. **Opus 5.5 (estructura) y Sonnet 5.5 (pantallas)**

- **Objetivo:** sacar la administración de `nekurel.com/equipo` a `betayomega`, con diseño profesional.
- **Alcance:**
  1. `PANEL_HOSTS` en `proxy.ts` → árbol `app/panel/...` con layout de barra lateral, selector de sitio y menú por tipo.
  2. Partir `app/page.tsx` (hoy `equipo/page.tsx`, ~1500 líneas) en módulos: Tónicos, Hierbas, Tienda, (luego) Recetas. La vista del vendedor queda en `/equipo` sin administración.
  3. APIs con sitio explícito (`/api/sites/<id>/...` o parámetro), con la sesión del panel. La cookie del panel es de su propio dominio.
  4. Sistema de diseño del panel: tokens propios, tablas densas, formularios con etiquetas arriba, estados vacíos y de carga.
- **Criterios:** la dueña hace desde el panel todo lo que hoy hace en "Administrar"; el vendedor no ve nada de administración.

### Fase 3. Sitio de recetas. **Opus 5.5 (modelo) y Sonnet 5.5 (interfaz)**

- **Objetivo:** `comidasricas.com` con su propio template y las recetas administradas desde el panel.
- **Alcance:** tablas `recipes` y relacionadas con `site_id`, validación y tests en `lib/`, módulo Recetas en el panel, `app/recetas/[site]` (portada, receta, búsqueda, categorías), `sitemap` y `robots` por host, cache por tag del sitio.

### Fase 4. Alta de sitios y temas desde el panel. **Sonnet 5.5**

- Tabla `sites` con tema y SEO, alta de dominios documentada (Vercel + DNS). Recién cuando haya un tercer sitio.

### Fase 5. Mejoras del panel de recetas. **Sonnet 5.5**

Acordado con la persona el 2026-11-02: estas tareas las hace **Sonnet 5.5**, en este orden, **una por sesión**. Al terminar cada una: marcarla en "Estado", dejar notas en "Registro" y parar. Las dos primeras del mismo pedido (orden por publicación y vista previa) ya están hechas; ver el Registro.

**Reglas para todas las subfases**
- Leer `AGENTS.md` y la guía de Next 16 en `node_modules/next/dist/docs/01-app/` antes de tocar rutas, metadata o route handlers.
- Formularios del panel: `SaveForm` (`app/save-form.tsx`) guarda **solo con el botón**; al salir con cambios pregunta (guardar, descartar o seguir). No volver a agregar guardado automático. Quien cambie de pantalla llama antes a `flushRef.current()` y sigue solo si devuelve `true`.
- Lógica pura (parseo, validación, armado de textos) en `lib/recipes.ts` con tests en `tests/recipes.test.mjs`. Correr los tests con el comando del README (`node --experimental-strip-types --test ...`). `lib/` no puede importar `next/*` si se usa en los tests (por eso existe `lib/preview.ts` aparte de `lib/auth.ts`).
- Cambios de base: agregarlos al final de `supabase/schema.sql`, siempre idempotentes (`if not exists`, `create or replace`, `drop trigger if exists`). La persona corre el archivo entero a mano; el código tiene que seguir andando **antes** de que lo corra (ver el fallback de `listPublishedRecipes`).
- **No escribir en Supabase para probar:** el entorno local usa la base real. Para ver pantallas con datos, usar un Supabase de prueba local (servidor HTTP que responda `/rest/v1/recipes`) y un `next build` + `next start` en otro puerto con `NEXT_PUBLIC_SUPABASE_URL` apuntando a él. Al terminar, **recompilar sin esas variables** para que `.next` no quede apuntando al de prueba.
- Textos de la interfaz en español rioplatense (vos), cortos y concretos, como el resto del panel. Estilos del panel en `app/panel/panel.css` (todo bajo `.panel`, con sus tokens); los del sitio en `app/recetas/[site]/recetas.css`.
- Verificar con `tsc`, `eslint`, tests y `next build`. Decir explícitamente qué no se pudo probar (por ejemplo, el panel pide sesión).

#### 5a. Categorías ordenadas

- **Problema:** las categorías son texto libre (`Recipe.categories: string[]`; en el editor se escriben separadas por comas y `splitTags` las parte). El sitio arma los botones con `recipeCategories`, que compara el texto exacto: "Postres", "postres" y "Postre" salen como tres categorías distintas.
- **Alcance:**
  1. **Sugerencias en el editor** (`app/panel/[site]/recipe-editor.tsx`): al escribir una categoría, sugerir las que ya existen en las recetas del sitio (de `useRecipes().recipes`). Si lo escrito coincide con una existente salvo mayúsculas o tildes, usar la existente. Puede ser un campo de etiquetas (chips con quitar) en lugar del texto con comas; mantener accesible con teclado.
  2. **Página Categorías** para el tipo `recetas`: agregar `{ path: "categorias", label: "Categorías", icon: Tag }` a `nav.recetas` en `shell.tsx` y crear la página. Hoy `app/panel/[site]/categorias/page.tsx` es la de Ñekurel (catálogo): separar por tipo de sitio como hace `[site]/page.tsx` con el Resumen. Lista con cada categoría, cuántas recetas la usan (publicadas y borradores), **renombrar** y **juntar** (pasar todas las recetas de una a otra).
  3. **Renombrar y juntar del lado del servidor:** un endpoint nuevo, por ejemplo `POST /api/sites/<id>/recipes/categories` con `{ from, to }`, solo administrador y `sameOrigin`, que reescriba las recetas afectadas con `saveRecipe` (respeta `revision`). Si alguna falla por conflicto, informar cuáles. Función pura `renameCategory(recipe, from, to)` en `lib/recipes.ts` (sin duplicados, conserva el orden) con tests.
- **Criterios:** no se pueden crear dos categorías que solo difieren en mayúsculas o tildes desde el editor; renombrar actualiza el sitio público (los links `?categoria=` viejos dejan de filtrar, es aceptable); tests de `renameCategory`.

#### 5b. Cargar recetas más rápido

- **Pegar ingredientes y pasos:** en el editor, un botón "Pegar lista" en Ingredientes y otro en Pasos que abre un cuadro de texto. Ingredientes: una fila por renglón, separando la cantidad del nombre ("1 kg carne picada", "200 g de harina", "1/2 taza de leche", "3 huevos", "sal a gusto" → cantidad vacía). Pasos: un paso por renglón o párrafo, quitando numeración ("1.", "1)", "Paso 1:", viñetas). Se **agregan** a las filas existentes (o se ofrece reemplazar). Funciones puras `parseIngredientLines` y `parseStepLines` en `lib/recipes.ts`, con tests de casos reales (fracciones, "c/n", "a gusto", renglones vacíos, emojis de viñeta).
- **Duplicar receta:** botón en el editor (o en la fila de la lista) que abre una receta nueva con los mismos datos: `id` nuevo, `revision: 0`, `published: false`, título "<nombre> (copia)", dirección vacía para que siga al nombre. No se guarda hasta tocar Guardar. Si hay cambios sin guardar en la receta abierta, pasa por `flushRef` como cualquier cambio de selección.
- **Criterios:** pegar el texto de una receta de WhatsApp deja ingredientes y pasos listos para revisar; duplicar no toca la original.

#### 5c. Cómo se ve al compartir

- En el editor, una sección plegable "Cómo se ve al compartir" con dos vistas: resultado de Google (título, dirección, descripción) y tarjeta de WhatsApp (foto, título, descripción, dominio).
- **Una sola fuente:** sacar de `generateMetadata` en `app/recetas/[site]/[slug]/page.tsx` el armado de título, descripción e imagen a una función pura en `lib/recipes.ts` (por ejemplo `recipeShareInfo(recipe, siteName)`) y usarla en la página y en el panel, para que nunca difieran. Si no hay foto, la imagen es `/og` del sitio.
- Avisos: sin foto ("WhatsApp va a mostrar la imagen general del sitio"), sin descripción (se usa el texto genérico), descripción de más de 160 caracteres (Google la corta).
- Muestra los datos del formulario **actual** (sin guardar), no los guardados.
- **Criterios:** test de `recipeShareInfo`; la página pública sigue generando la misma metadata que antes.

#### 5d. Datos del sitio editables

- Hoy el lema, la descripción y los colores están en código (`app/recetas/[site]/brand.ts`).
- **Alcance:** sección "Sitio" en el menú de recetas para editar **lema, descripción para buscadores, Instagram y un contacto** (WhatsApp o mail, opcionales). Los colores y las tipografías siguen en código.
- **Dónde guardar:** sin tabla nueva por ahora: un documento en `app_data` con clave `site:<id>` (ya existen `readDocument` y el patrón de `revision` en `lib/supabase.ts` / `save_catalog`). Validación en una función pura con tests. Si no hay documento, usar los valores de `brand.ts`. Cuando se haga la fase 4 (tabla `sites`), esto se migra ahí.
- El sitio público lee estos datos en el layout y la portada (lema y descripción en metadata y encabezado) y muestra Instagram y contacto en el pie. Cache: el sitio es `force-dynamic`, alcanza con leer en cada request (usar `cache()` de React para leer una vez por request).
- **Criterios:** cambiar el lema en el panel cambia el título del sitio y su metadata sin desplegar; sin documento el sitio se ve igual que hoy.

#### 5e. Más adelante (cada una necesita datos nuevos; confirmar con la persona antes de empezar)

- **Recetas más vistas:** contador por receta. Reusar el patrón de `increment_usage` de `schema.sql` (función en Postgres llamada por RPC con la clave secreta). Contar desde el servidor al renderizar la receta, sin contar vistas previas (`?vista=`) ni bots obvios. Mostrar en el Resumen las 5 más vistas.
- **Publicación programada:** campo "Publicar el" en el editor. Cuidado con `published_at` y su trigger (ver Registro): la portada filtra `published_at <= now()` y el trigger no debe pisar una fecha futura elegida a mano. Las recetas programadas se ven como borrador (con vista previa) hasta su fecha.
- **Varias fotos o foto por paso:** `images` como `jsonb` (lista) o `image` opcional por paso. `recipeJsonLd` ya acepta una lista de imágenes. Límite de tamaño y de cantidad en `cleanRecipe`.

## 5. Estado

| Fase | Modelo | Estado |
|---|---|---|
| 1. Base multisitio para Ñekurel | Opus 5.5 | Hecho |
| 2. Panel central | Opus 5.5 y Sonnet 5.5 | Panel hecho; falta sacar la administración de `/equipo` (2b) |
| 3. Sitio de recetas | Opus 5.5 y Sonnet 5.5 | Hecho (3a panel, 3b sitio público) |
| 4. Alta de sitios y temas | Sonnet 5.5 | Pendiente |
| 5a. Categorías ordenadas | Sonnet 5.5 | Hecho |
| 5b. Cargar recetas más rápido | Sonnet 5.5 | Hecho |
| 5c. Cómo se ve al compartir | Sonnet 5.5 | Hecho |
| 5d. Datos del sitio editables | Sonnet 5.5 | Hecho |
| 5e. Más vistas, programadas, varias fotos | Sonnet 5.5 | Hecho (foto por paso no hecha) |

## 6. Registro

- 2026-11-02: plan acordado con la persona. Ñekurel no se migra a tablas; recetas sí. Vendedor en `/equipo`. Panel en `betayomega` (falta confirmar el dominio exacto).
- 2026-11-02, fase 1 (Opus 5.5):
  - Hecho como dice la sección 3. `app/page.tsx` pasó a `app/herboristeria/[site]/equipo/page.tsx` sin cambios internos (solo imports a `@/app/...`); sus componentes siguen en `app/` hasta la fase 2.
  - La tienda está en el grupo `(tienda)` para que el carrito no envuelva `/equipo`.
  - Las APIs (`/api/*`) no se reescriben y siguen leyendo la clave `catalog`: el parámetro `site` todavía no llega a los datos. `catalogKey` de `lib/sites.ts` es para la fase 2.
  - Manifest con `id: "/"` (el `start_url` anterior) y `start_url: "/equipo"`, para que las tablets que ya la instalaron sigan con la misma app.
  - `NEXT_PUBLIC_SITE_URL` se reemplazó por `url` en `lib/sites.ts`; nueva variable opcional `DEFAULT_SITE`.
  - Las fuentes siguen en `app/layout.tsx` porque `globals.css` las resuelve en `:root`. Moverlas al layout de cada tipo cuando un sitio use otras.
  - Verificado con `next start`: `/`, `/burrito`, `/equipo`, `/manifest.webmanifest`, `/og` y `/pwa-icon` dan 200; `/catalogo/menta?x=1` da 308 a `/menta?x=1`; `/herboristeria/nekurel` da 404; `www.` y `nekurel.localhost` resuelven a Ñekurel; `/api/catalog` sin sesión sigue en 401. Sin combos en los datos, la ficha de combo solo se probó con 404. 57 tests, `tsc`, `eslint` y `build` sin errores. Falta probar `/equipo` en el navegador (entrar como vendedor y como administrador).
  - Pendiente de la persona: confirmar el dominio exacto del panel (`betayomega`).
- 2026-11-02, fase 2 (Opus 5.5). Dominio del panel: `betayomega.vercel.app` hasta que se compre uno propio.
  - **Ruteo:** `PANEL_HOSTS` (lista separada por comas; por defecto `betayomega.vercel.app,panel.localhost`) → `proxy.ts` reescribe a `app/panel/...`. Desde un dominio público `/panel` da 404. En local: `http://panel.localhost:3000`.
  - **Estructura:** `app/panel/layout.tsx` (fuente Geist, `panel.css`), `page.tsx` (login o redirección al primer sitio), `[site]/layout.tsx` (valida sitio y sesión, `CatalogProvider` y `PanelShell`), páginas `[site]/` Resumen, `tonicos`, `hierbas`, `categorias`, `tienda`. El menú depende del tipo de sitio (`nav` en `shell.tsx`): para recetas se agrega su entrada ahí.
  - **Estado compartido:** `catalog-context.tsx` carga el catálogo una vez para todo el panel y lo refresca al volver el foco y cada 30 s, salvo que haya una ficha abierta o cambios sin guardar. Al cambiar de sección se guarda primero el formulario abierto (`flushRef`); si falla, no se cambia.
  - **Reutilizado sin cambios de reglas:** editores de tónico y hierba (`editors.tsx`, misma validación que el administrador anterior), `StoreTab`, `CategoryImageEditor` (nuevo prop `inline`), `SaveForm` (antes `AutoSaveForm`; ahora guarda solo con el botón y pregunta al salir con cambios). Los campos compartidos pasaron a `app/admin-fields.tsx` y los usan el panel y `/equipo`.
  - **Diseño:** `app/panel/panel.css`, todo bajo `.panel`. Redefine los tokens de `globals.css` (radios 8 y 12 px, controles de 36 px y 44 px en pantallas táctiles, base 14 px, un solo acento verde) y ajusta los componentes compartidos. La tienda pública no cambia. Solo modo claro por ahora.
  - **Resumen:** números del catálogo y una lista "Para revisar" con enlaces (sin WhatsApp, combos rotos, borradores, productos sin precio).
  - **Sin cambios en las APIs:** el panel usa `/api/catalog`, `/api/images` y `/api/session` en su propio dominio, con su propia cookie. Siguen leyendo la clave `catalog`; el sitio explícito en las APIs se agrega con el segundo sitio (fase 3), porque hoy hay uno solo.
  - **Verificado en el navegador** (`next start`, contraseña de prueba generada para el servidor local, sin guardar nada porque local escribe en el Supabase real): login, Resumen, Tónicos con editor abierto, Hierbas, Categorías, Tienda (Datos, Precios, Promociones), menú móvil a 390 px; sin errores en consola. Tests nuevos en `tests/sites.test.mjs`. **No se probó guardar** desde el panel.
  - `next dev` falló en esta máquina con un error de Turbopack al crear un proceso de Node (`0xc0000142`, de Windows); `next build` y `next start` funcionan.
  - **Fase 2b, pendiente:** cuando la dueña confirme que el panel le sirve, quitar la administración de `/equipo` (rol Administrador, pestañas Tónicos/Hierbas/Tienda, categorías, CSV) y dejar solo el buscador del vendedor. Hasta entonces conviven los dos.
- 2026-11-02, fase 3a: módulo de recetas en el panel (Opus 5.5).
  - **El sitio se llama Comidas del cielo** (id `comidasdelcielo`, tipo `recetas`). Sin dominio propio todavía: `comidasdelcielo.vercel.app` y `comidasdelcielo.localhost`. Cuando se compre, agregarlo en `domains` y `url` de `lib/sites.ts` (y en Vercel).
  - **Datos:** tabla `recipes` en `supabase/schema.sql` (correr el archivo entero en el SQL Editor; es idempotente). Una fila por receta con `site_id`; ingredientes y pasos van como `jsonb` en la misma fila en lugar de tablas aparte, porque siempre se leen y guardan juntos. `unique (site_id, slug)`. Concurrencia con `revision` (el PATCH filtra por la revisión leída).
  - **Código:** `lib/recipes.ts` (tipos, `cleanRecipe` valida y descarta campos desconocidos, `slugify`; tests en `tests/recipes.test.mjs`), `lib/recipe-store.ts` (solo servidor), API `GET /api/sites/<id>/recipes` y `PUT|DELETE /api/sites/<id>/recipes/<uuid>`, solo administrador. Una receta nueva tiene `revision: 0` y el PUT la crea.
  - **Panel:** `PanelContext` (`panel-context.tsx`) separa lo que necesitan el shell y `useSelection` de los datos de cada tipo. `CatalogProvider` (herboristería) y `RecipesProvider` (recetas) lo proveen; `[site]/layout.tsx` elige por tipo. El Resumen de `[site]/page.tsx` también elige por tipo (`herb-summary.tsx`, `recipe-summary.tsx`). Una sección de otro tipo (`/comidasdelcielo/tonicos`) muestra "Esta sección no existe".
  - **Editor:** borrador o publicada; para publicar hacen falta al menos un ingrediente y un paso. Filas vacías se ignoran al guardar. La dirección (slug) sigue al nombre mientras es borrador y queda fija al publicar.
  - **Fotos:** las de recetas se guardan en `images/comidasdelcielo/<uuid>.<ext>` (`ImageField` con prop `site`). `/api/images/[name]` pasó a `/api/images/[...path]`; las fotos de Ñekurel siguen en la raíz y sus URLs no cambian.
  - **Verificado:** tests, `tsc`, `eslint` y `build`. En el navegador (`next start`) con la API de recetas reemplazada en memoria, porque la tabla todavía no existe: crear, agregar filas, completar, publicar y renombrar (la dirección no cambia), sin errores en consola. **No se probó contra Supabase real.**
  - **Fase 3b, pendiente:** `app/recetas/[site]` (portada, receta, búsqueda, categorías), `sitemap` y `robots` por host. Hasta entonces `comidasdelcielo.*` responde 404.
- 2026-11-02, fase 3b: sitio público de recetas (Opus 5.5).
  - **Rutas** (`app/recetas/[site]`): `/` portada con buscador (por nombre, descripción, categoría o ingrediente, sin importar tildes), chips de categoría (`?categoria=` en la dirección, para compartir) y grilla; `/<slug>` receta con foto, tiempos y porciones, ingredientes tildables, pasos numerados, consejos, compartir (menú del teléfono o WhatsApp), imprimir y "Más recetas"; `/og`, `/icon`, `/robots.txt`, `/sitemap.xml`. Solo se ven las recetas publicadas; un borrador da 404.
  - **Marca:** `brand.ts` (lema, colores) y `recetas.css`, independiente de `globals.css`: fondo crema, acento terracota, Fraunces para títulos y Nunito Sans para el texto, solo modo claro, estilos de impresión.
  - **SEO:** el sitio se indexa (a diferencia de Ñekurel): canonical por página, Open Graph con la foto de la receta, datos estructurados schema.org/Recipe (`recipeJsonLd` en `lib/recipes.ts`) y sitemap. Cuando se compre el dominio, cambiar `url` en `lib/sites.ts`: canonical y sitemap lo siguen solos.
  - **Slugs reservados:** `og` e `icon` (`reservedRecipeSlugs`; el panel avisa si alguien los usa).
  - `robots.txt` y `sitemap.xml` llevan `dynamic = "force-dynamic"`: Next trata las rutas con nombre de archivo de metadata como estáticas y las prerenderiza con un sitio de relleno.
  - `app/favicon.ico` pasó a `public/favicon.ico` y lo nombra solo el layout de Ñekurel: en `app/` Next lo agregaba a todos los sitios.
  - **Verificado:** tests (71), `tsc`, `eslint`, `build`. Con datos reales (sin recetas publicadas todavía): portada vacía con "Estamos preparando las primeras recetas", robots y sitemap. Con un Supabase de prueba local y cuatro recetas: portada, filtro por categoría, receta completa y sitemap en el navegador a 1280 px, sin errores en consola. **No se vio en un celular real** (la ventana no se pudo achicar a 390 px).
- 2026-11-02, orden por publicación y vista previa (Opus 5.5).
  - **Orden de la portada:** columna `published_at` en `recipes`, que completa un trigger la primera vez que la receta se guarda publicada y no cambia más (despublicar y volver a publicar conserva la fecha). El sitio ordena por ella; editar una receta vieja ya no la sube. **Hay que correr `supabase/schema.sql` de nuevo** (agrega la columna, el trigger y completa las ya publicadas con su `created_at`). Mientras no se corra, `listPublishedRecipes` ordena por `updated_at` como antes y avisa en el log.
  - **Ver en el sitio / vista previa:** en el editor, debajo de "Publicada en el sitio". Publicada: enlace a la receta. Borrador: enlace firmado `/<slug>?vista=<firma>` y botón para copiarlo. La firma (`lib/preview.ts`) es un HMAC de sitio + id de receta con `ANKORA_SESSION_SECRET`: no vence, sirve para un solo borrador y sobrevive a cambios de nombre; cambiar el secreto invalida todos los links. La API del panel la agrega a cada receta (`previewToken`, nunca se guarda). La vista previa muestra lo último guardado, con un aviso, `noindex` y sin canonical ni datos estructurados.
  - En desarrollo (panel en `panel.localhost`) los enlaces apuntan a `<sitio>.localhost` con el mismo puerto; en producción, a `url` de `lib/sites.ts`.
  - **Verificado:** 72 tests, `tsc`, `eslint`. Contra Supabase real (solo lecturas, sin la columna nueva): la portada sigue andando; el borrador "Empanadas" da 404 sin firma o con firma falsa y 200 con la firma correcta. **No se probó** el editor del panel en el navegador (pide sesión) ni el trigger (requiere correr el SQL).

- 2026-11-02, fase 5a: categorías ordenadas (Sonnet 5.5).
  - **Editor:** el campo de categorías pasó a chips (`category-input.tsx`): Enter o coma agregan, Backspace con el campo vacío quita la última, cada chip tiene botón para quitar, y un `datalist` sugiere las del sitio. Lo escrito se compara con las existentes sin mayúsculas, tildes ni espacios de más (`canonicalCategory`) y usa la existente. Al guardar se vuelve a normalizar (`normalizeCategories`).
  - **Servidor:** `cleanRecipe` también descarta categorías repetidas por clave, así que ni la API deja crear "Postres" y "postres" juntas. Antes solo descartaba repetidas exactas.
  - **Página Categorías de recetas** (`app/panel/[site]/categorias/page.tsx` elige por tipo; la de Ñekurel quedó en `herb-categories.tsx`): tabla con publicadas y borradores por categoría, y acciones Renombrar y Juntar en el panel lateral. Si el nombre nuevo coincide con otra categoría (aunque cambie la mayúscula), las recetas pasan a esa.
  - **Endpoint:** `POST /api/sites/<id>/recipes/categories` con `{ from, to }`, solo administrador y `sameOrigin`. Reescribe con `saveRecipe` desde la revisión leída; devuelve `{ to, changed, failed }`, donde `failed` lista las recetas con conflicto (el panel las muestra y pide repetir). No es transaccional: si falla a la mitad, las ya cambiadas quedan cambiadas.
  - **Lib:** `categoryKey`, `canonicalCategory`, `normalizeCategories`, `renameCategory`, `categoryUsage`, `toRecipeInput`, con tests (75 en total).
  - **Verificado:** tests, `tsc`, `eslint` y `next build`. **No se probó en el navegador** (el panel pide sesión y local escribe en el Supabase real) ni el endpoint contra datos reales.
- 2026-11-02, fase 5b: cargar recetas más rápido (Sonnet 5.5).
  - **Pegar lista** (`paste-list.tsx`): botón junto a "Agregar ingrediente" y "Agregar paso". Abre un cuadro de texto, cuenta cuántas filas saldrían y ofrece "Agregar al final" o "Reemplazar los actuales" (las filas en blanco se descartan al agregar).
  - **`parseIngredientLines`** (`lib/recipes.ts`): separa cantidad y nombre con número (entero, decimal con coma o punto, fracción, mixto "1 1/2", ½ ¼ ¾, rango "2 a 3") más unidad opcional y "de". Sin cantidad ("sal a gusto", "pimienta c/n") deja la línea entera como nombre. Quita viñetas, emojis y renglones que terminan en ":" (encabezados como "Ingredientes:"). Lista de unidades en `unitWords`: si una unidad común falta, el renglón queda con la cantidad sola y el resto en el nombre.
  - **`parseStepLines`**: sin renglones en blanco, un paso por renglón. Con renglones en blanco, cada bloque es un paso y los renglones cortados se unen, salvo que traigan su propio número o viñeta. Quita "1.", "2)", "Paso 3:", viñetas y emojis; no confunde "1.5 horas" ni "1-2 minutos".
  - **Duplicar receta:** botón en el editor (solo si la receta ya está guardada). Pasa por `flushRef` (guardar, descartar o seguir) y copia lo último guardado con `duplicateRecipe`: id nuevo, `revision: 0`, borrador, "<nombre> (copia)", dirección vacía. Se abre sin guardar; la original no se toca.
  - **Verificado:** 79 tests (4 nuevos), `tsc`, `eslint` y `next build`. **No se probó en el navegador** (el panel pide sesión y local escribe en el Supabase real).
- 2026-11-02, fase 5c: cómo se ve al compartir (Sonnet 5.5).
  - **Una sola fuente:** `recipeShareInfo(recipe, siteName)` en `lib/recipes.ts` arma título de página (`<nombre> | <sitio>`), dirección, descripción (resumen o texto genérico, máximo 200 caracteres), foto (`undefined` → `/og` del sitio) y avisos. `generateMetadata` de `app/recetas/[site]/[slug]/page.tsx` la usa para descripción e imagen; la metadata resultante es la misma que antes.
  - **Panel:** sección plegable "Cómo se ve al compartir" al final del editor (`share-preview.tsx`) con la vista de Google y la tarjeta de WhatsApp. Lee nombre, dirección, foto y descripción del formulario actual, sin guardar (la descripción es un campo sin control; el editor copia su valor con `onInput` solo para la vista previa). El editor recibe `siteName` nuevo.
  - **Avisos:** sin foto, sin descripción, y descripción de más de 160 caracteres (Google la corta; la vista de Google también la corta con "…").
  - **Verificado:** 80 tests (uno nuevo de `recipeShareInfo`), `tsc`, `eslint`, `next build`. **No se probó en el navegador** (el panel pide sesión) ni la metadata pública contra datos reales. La tarjeta de WhatsApp es una aproximación del aspecto, no la de la app real.
- 2026-11-02, fase 5d: datos del sitio editables (Sonnet 5.5).
  - **Datos:** documento `site:<id>` en `app_data` con `{ tagline, description, instagram, contact, revision }`. Lógica pura en `lib/site-settings.ts` (validación `cleanSettings`, `effectiveSettings` con los valores por defecto del template, `socialLinks`); acceso al servidor en `lib/site-store.ts`. **No hay SQL nuevo:** el guardado usa REST con filtro de revisión (`PATCH ... &revision=eq.N`, o `POST` si es el primero), así que una carrera da 409 igual que en `save_catalog`. Instagram se normaliza a usuario sin "@" (acepta el link); el contacto es un mail o un número de WhatsApp reducido a dígitos con código de país.
  - **API:** `GET|PUT /api/sites/<id>/settings`, solo administrador y `sameOrigin`; solo sitios de tipo `recetas`. El GET devuelve lo guardado (vacío = usar el texto del template).
  - **Panel:** sección "Sitio" en el menú de recetas (`app/panel/[site]/sitio/page.tsx`), con `SaveForm` (guarda solo con el botón). Los valores por defecto se muestran en la ayuda de cada campo.
  - **Sitio público:** `getSettings(siteId)` en `brand.ts` (una lectura por request con `cache()`; si falla, usa los valores del template y avisa en el log). Lo usan el layout (título y descripción de la metadata, Open Graph y Twitter), la portada (encabezado), `/og` y el pie (`SiteFooter` ahora es async y recibe `siteId`; muestra Instagram y contacto como links, nada si están vacíos). `brand.tagline` y `brand.description` siguen existiendo como valores por defecto, tomados de `recipeSiteDefaults`.
  - **Fase 4:** cuando exista la tabla `sites`, migrar `site:<id>` ahí. Los colores y fuentes siguen en `brand.ts` y `recetas.css`.
  - **Verificado:** 83 tests (3 nuevos), `tsc`, `eslint`, `next build`. **No se probó en el navegador** ni el guardado contra Supabase real (el panel pide sesión y local escribe en la base real), y no corrí `next start` para ver el sitio sin documento: el comando de prueba fue rechazado por el entorno.
- 2026-11-02, fase 5e: más vistas, publicación programada y varias fotos (Sonnet 5.5, confirmado por la persona).
  - **Hay que correr `supabase/schema.sql` de nuevo** (agrega `recipes.views`, `recipes.images` y la función `increment_recipe_view`). Mientras no se corra, todo sigue andando: guardar una receta sin fotos adicionales ni fecha elegida no manda las columnas nuevas (si `images` no existe y la lista está vacía, `saveRecipe` reintenta sin ella); contar una vista falla en silencio con un aviso en el log; el Resumen muestra "Todavía no hay vistas". Programar o agregar fotos antes de correr el SQL da un mensaje que pide correrlo.
  - **Más vistas:** columna `views`; el sitio público cuenta con `after()` en `/<slug>` (no bloquea la respuesta). No cuenta vistas previas, bots ni previews de enlaces (`looksLikeBot` en `lib/recipes.ts`, que trata la falta de user agent como bot) ni prefetch del router. Las visitas del propio equipo sí cuentan. El Resumen del panel muestra las 5 más vistas entre las publicadas.
  - **Programada:** campo "Publicar el" (`datetime-local`, hora del navegador) en el editor. Se guarda en `published_at`, que el trigger ya no pisa si viene con valor. `listPublishedRecipes` filtra `published_at <= now` (con `or` para nulos), así que la receta aparece sola al llegar la fecha y entra al sitemap. Hasta entonces es "Programada" en el panel y se ve con el link de vista previa (el banner lo aclara). El campo solo manda fecha si la cambiaste; si vaciás una fecha futura se publica ya (`pickSchedule`); si la receta es un borrador la fecha se ignora. `RecipeInput.scheduledAt` es lo que viaja; `Recipe.publishedAt` es lo guardado.
  - **Varias fotos:** `images` (jsonb, hasta 6, `maxExtraImages`) además de la principal. En el editor, "Más fotos" con subir, quitar y agregar; `cleanRecipe` descarta vacías, repetidas y la principal. La receta pública las muestra en una galería bajo el encabezado (no se imprimen) y el JSON-LD lista todas. **La foto por paso no se hizo:** el plan decía "o"; si se quiere, es un `image` opcional por paso (hoy `steps` es `string[]`).
  - **Verificado:** 86 tests (3 nuevos), `tsc`, `eslint`, `next build`. Con `next start` y datos reales (solo lectura): portada, `/og`, `sitemap.xml` y `robots.txt` dan 200 con el filtro de fecha nuevo. **No se probó** el editor en el navegador ni ningún guardado (el panel pide sesión y local escribe en la base real), ni el contador ni el trigger (requieren correr el SQL).
- 2026-11-02, rediseño del sitio de recetas al estilo de la tienda de Ñekurel (Sonnet 5.5).
  - **Look:** mismos tokens que `globals.css` (fondo `#f3f5f1`, verde `#1c7a4d`, tarjetas de 28 px con borde, controles en píldora, Poppins para títulos y Atkinson Hyperlegible para el texto). `recetas.css` sigue siendo independiente de `globals.css`.
  - **Portada:** encabezado con logo, nombre (h1), subtítulo (lema · cantidad de recetas) y "Compartir"; buscador y chips de categoría con contador pegados arriba al scrollear; grilla de tarjetas con foto arriba. Se quitó el título grande anterior. Los chips aparecen desde la primera categoría.
  - **Logo:** `public/comidasdelcielo-logo.webp` (el póster de Yodhkum, 900 × 1200, 200 KB), en `brand.logo`. `SiteHeader` lo muestra completo en 54 × 72. Es un logo por plantilla; cuando haya tabla `sites` (fase 4), pasa a ser por sitio. El nombre del sitio sigue siendo "Comidas del cielo" (`lib/sites.ts`).
  - Los colores de `brand` (usados por `/og` y `themeColor`) pasaron al verde.
- 2026-11-02, ajustes al rediseño del sitio de recetas (Sonnet 5.5).
  - **Tarjeta:** vuelve a la de antes (foto con esquinas redondeadas y el texto abajo, sin marco; radio 18 px, grilla de 300 px). Encabezado, buscador y chips siguen al estilo de Ñekurel.
  - **Hover:** `RecipeCard.hoverImage` es la segunda foto disponible (`toRecipeCard`: la principal y después `images`, o las dos primeras de `images` si no hay principal). `RecipePhoto` la pone encima con un fundido al pasar el mouse o enfocar con teclado; sin segunda foto no cambia nada. En pantallas táctiles no hay hover.
  - **Colores:** celeste (`#0b72a8` de acento, fondo `#f2f7fb`, tinta `#10212e`) en `recetas.css` y `brand.ts` (también `/og` y `themeColor`). El acento cumple contraste 5,3:1 con texto blanco.
  - **No se vio el hover en el navegador:** los datos reales tienen una receta con una sola foto y el entorno local no escribe datos de prueba.
- 2026-11-04, sitios de productos: Purificación y Yakuchil (Opus 5.5).
  - **Tipo nuevo `productos`** (`lib/sites.ts`). `Site.products` guarda lo que cambia entre sitios: título de la descripción, si piden uso (beber o piel) y color de acento.
  - **Datos:** documento `products:<id>` en `app_data` con `{ revision, products }`, sin SQL nuevo. `saveDocument` (`lib/supabase.ts`, ahora también lo usa `site-store`) guarda con filtro de revisión. Lógica pura y búsqueda en `lib/products.ts`, tests en `tests/products.test.mjs`; `lib/product-store.ts` es solo servidor. API: `GET|PUT /api/sites/<id>/products`, solo administrador. El PUT reemplaza la lista entera.
  - **Reglas:** para publicar hacen falta descripción y una frase en "para qué sirve"; en Purificación también el uso, para que un agua de piel nunca se muestre sin aviso. La imagen no bloquea: el Resumen avisa si falta. La dirección se fija en el primer guardado y no cambia al renombrar.
  - **Búsqueda:** reutiliza `relevance` de `lib/catalog.ts` sobre nombre y "para qué sirve"; no mira la descripción. Corre en el navegador y queda en `?q=`; cada frase de la ficha es un link a esa búsqueda.
  - **Sitio público** (`app/productos/[site]`): portada, `/<slug>`, `/og`, `/icon`, `/manifest.webmanifest`, `robots.txt`, `sitemap.xml`. Solo modo claro, como los otros sitios. Se puede instalar como app, con botón en el pie cuando el navegador lo permite. Purificación tiene ícono propio (`public/purificacion-icon*.png`, en `products.icon`); Yakuchil, sin archivos, usa su inicial.
  - **Panel:** menú Resumen, Productos y Sitio. Sitio muestra solo el botón de donar, guardado en `site:<id>` como en recetas; sin documento usa `defaultDonation`. No tienen comentarios ni métricas: esas APIs siguen siendo solo de recetas. Las fotos van a `images/<id>/`.
  - **Donar:** corazón arriba a la derecha y botón en el pie, con los mismos `useDonate` y `useInstall` de recetas. Vacío en el panel, se ocultan los dos.
  - **Verificado:** tests, `tsc`, `eslint`, `build`. En navegador, con Supabase de prueba local: crear con tildes, avisos de validación, fotos, portada, búsqueda sin tildes y fichas de los dos sitios a 1536 px. **No se probó** contra Supabase real ni en un celular.
