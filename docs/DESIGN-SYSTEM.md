# Sistema de diseño (interfaz)

Cómo se ve y cómo se construye la interfaz: **Tailwind primero**, tokens en un solo archivo, un tema por tipo de sitio. No confundir con la arquitectura del código ([ARCHITECTURE.md](ARCHITECTURE.md)): esto es lo visual.

> Estado: **base lista desde la fase E2**. `app/globals.css` ya cumple estas reglas y el sauna y todo lo nuevo nacen con ellas. Las pantallas existentes todavía usan ~7.500 líneas de CSS (§8), que se migran por etapas en la fase E3 ([ROADMAP.md](ROADMAP.md)).

## 1. La regla

1. **Todo estilo nuevo se escribe con utilidades de Tailwind en el `className`.** No se crean archivos `.css`, ni CSS Modules, ni `styled-jsx`, ni estilos en línea (salvo valores que vienen de datos, ver §4).
2. **Existe un solo archivo CSS: `app/globals.css`.** Ahí vive lo que Tailwind no puede expresar en un `className` (ver §2). El resto desaparece.
3. **La reutilización se hace con componentes de React** (`shared/ui`), no con clases CSS propias ni con `@apply`. Si un conjunto de utilidades se repite, se convierte en un componente.
4. **Los valores salen de tokens.** Nada de colores hexadecimales, radios ni tamaños sueltos en un `className`: se usa el token (`bg-surface`, `text-ink`, `rounded-card`). Un valor arbitrario (`w-[37px]`) solo si es único y va con un comentario que explique por qué.
5. **Sin `!important`** ni utilidades con `!`. Si algo hay que forzarlo, el problema es el CSS de legado (§7), no la utilidad.

## 2. Qué puede haber en `globals.css`

Límite: **menos de 400 líneas**. Solo estas secciones:

| Sección | Contenido |
|---|---|
| Orden de capas | `@layer theme, base, legacy, components, utilities;`, antes del import. |
| `@import "tailwindcss"` | Una vez. |
| `@theme static` | Los tokens semánticos (§3): colores, radios, alturas de control, tipografías, curvas de animación, `--animate-*`. `static` hace que se emitan todos, porque `legacy.css` los lee desde un archivo que Tailwind no analiza. |
| Temas | Un bloque por tema (`[data-theme="panel"] { … }`) que **redefine los valores** de los tokens. Nada más. |
| `@layer base` | Reinicio mínimo y reglas de elementos que no se pueden poner en un componente (foco visible, `prefers-reduced-motion`, `color-scheme`). |
| `@keyframes` | Solo las que referencia `--animate-*`. |
| Impresión | Solo si no se puede con la variante `print:` de Tailwind (la ficha de Ñekurel se imprime). |

No entran: clases por pantalla, componentes con nombre (`.btn`, `.card`), ni reglas por sitio.

## 3. Tokens

Tokens **semánticos**: nombran el rol, no el color. Un componente usa `bg-accent`, nunca `bg-green-600`; el tema decide el verde, el azul o el naranja.

| Token | Variable | Ejemplo de utilidad | Rol |
|---|---|---|---|
| `bg` · `surface` · `sunken` | `--color-*` | `bg-surface` | Fondo de página, superficie de tarjetas, fondo hundido (campos, bloques tranquilos). |
| `sidebar` · `surface-sidebar` | `--color-*` | `bg-sidebar` | Menú lateral y lo seleccionado en él. |
| `ink` · `muted` | `--color-*` | `text-ink` | Texto principal y secundario. |
| `line` · `line-strong` | `--color-*` | `border-line` | Bordes finos y marcados. |
| `accent` · `accent-hover` · `accent-ink` | `--color-*` | `bg-accent` | Color de acción, su estado al pasar el puntero y el texto que va encima. |
| `accent-soft` · `accent-wash` | `--color-*` | `bg-accent-soft` | Fondos tenues del acento (selección, avisos suaves). |
| `accent-text` | `--color-*` | `text-accent-text` | Acento oscurecido para **texto** chico sobre fondo claro (contraste 4,5:1). |
| `focus` | `--color-focus` | Regla base | Anillo de foco. |
| `warn-bg` · `warn-line` · `warn-ink` · `danger` | `--color-*` | `bg-warn-bg` | Advertencias (ámbar) y errores. Reservados para eso. |
| `success` · `success-soft` | `--color-*` | `bg-success-soft` | Éxito (verde): una reserva confirmada. Aparte del acento, que en el panel es azul. Reservado para eso. |
| `card` · `field` · `control` | `--radius-*` | `rounded-card` | Radio de contenedores, de campos y de botones. |
| `control` | `--spacing-control` | `min-h-control` | Alto mínimo de un control táctil (§6). |
| `card` · `lift` | `--shadow-*`, valor en `--elevation-*` | `shadow-lift` | Sombra de tarjetas y de lo que flota. **Un tema redefine `--elevation-*`:** Tailwind copia el valor de `--shadow-*` al compilar, así que redefinirlo en un tema no tendría efecto. |
| `standard` | `--ease-standard` | `ease-standard` | Curva de animación. |
| `display` · `text` | `--font-*` | `font-display` | Tipografía de títulos y de lectura. |

Los valores de cada tema, tomados del código, son:

| | Herboristería (Ñekurel) | Panel (BetaOmega) | Recetas | Productos |
|---|---|---|---|---|
| Fondo / superficie | `#f3f5f1` / `#ffffff` | `#fffefe` / `#fbfafa` | `#fffefe` / `#fafafa` | `#f6f8f8` |
| Texto / secundario | `#13211a` / `#4f5e56` | `#1c1c1a` / `#5f5e5a` | `#231a14` / `#6a5b50` | `#14211f` / `#4d5c5a` |
| Borde | `#dde3da` | `#e8e7e4` (fuerte `#d0cfca`) | `#ebe8e5` | `#d9e0df` |
| Acento | `#1c7a4d` (verde) | `#0c8de8` (azul); texto `#0a6fb8` | `#ed6300` (naranja); texto `#b34a00`; apoyo amarillo `#fbca6d`, lila `#d5a3eb` | **viene de la base**: `sites.options.accent` |
| Foco | `#1d5fd1` | acento | `#7b3fa6` | acento |
| Radio tarjeta / campo | 28 px / 16 px, controles en píldora | 12 px / 8 px | 24 px / 18 px, píldoras | 14 px |
| Tipografía | Poppins (títulos) + Atkinson Hyperlegible | Geist | Instrument Sans (títulos) + Atkinson Hyperlegible | Barlow Condensed (títulos) + Atkinson Hyperlegible |
| Tamaño base | 18 px | 14 px | 17 px | 18 px |

El tema del **sauna** (Fropexio) sigue las mismas reglas y es el único oscuro: fondo `#12110c`, texto `#f2ead8`, secundario `#bdb298` y acento dorado `#d9b45f` con texto `#17140b`, tomados de `public/fropexio.jpeg`. Radios chicos (tarjeta 6 px, campos y botones 3 px). Tipografías: Cinzel Decorative en peso 400 (logo y todos los títulos) y Arial/Helvetica (lectura). Ver [SAUNA.md §12](SAUNA.md).

## 4. Un tema por tipo de sitio (y por sitio)

- Un **tema** es un conjunto de valores de los tokens. Se activa con `data-theme="<tema>"` en el elemento raíz del layout del tipo. Los temas viven en `globals.css` (§2).
- **Los valores de `@theme` son los predeterminados y coinciden con el tema de Ñekurel.** Ñekurel no tiene un elemento raíz propio, y `<body>` queda fuera de cualquier `data-theme`, así que no lleva un bloque aparte.
- Los componentes **no saben en qué tema están**: usan tokens.
- Lo que cambia **por sitio** (no por tipo) viene de la base y se aplica como variable en el elemento raíz del layout, en una línea:
  ```tsx
  <div data-theme="productos" style={{ "--color-accent": site.products?.accent } as React.CSSProperties}>
  ```
  Es la única excepción a "sin estilos en línea". Quien guarda un color en `sites.options` debe garantizar su contraste (4,5:1 con texto blanco).
- Las tipografías se cargan con `next/font` y se exponen como variables que el tema asigna a `font-display` / `font-text`.

## 5. Componentes

- Los componentes de interfaz reutilizables viven en **`shared/ui/`** (hoy `components/ui/`). Un componente que usa un solo módulo se queda en ese módulo.
- Primitivas con comportamiento accesible (diálogos, selects, menús): **Radix UI**, ya instalado. No reescribir a mano un diálogo ni un select.
- **shadcn/ui es la receta, no una dependencia.** `shared/ui/` (`switch`, `select`, `dialog`) copia sus componentes sobre Radix y reemplaza sus clases por nuestros tokens. No se usa su CLI, porque agrega tokens propios (`bg-primary`) y escribe en `globals.css`. Un componente nuevo se agrega igual.
- Lo que se abre en un portal va dentro del elemento con `data-theme` (`themeRoot()`, en `shared/ui/theme-root.ts`): en `<body>` perdería los colores y tipografías de su sitio.
- Variantes: por **props tipadas** (`variant="primary" | "quiet"`), resueltas dentro del componente. Un `className` externo solo para ajustar diseño (márgenes), no para cambiar el aspecto.
- Íconos: **`lucide-react`** en el código nuevo. `@phosphor-icons/react` sigue en las pantallas que ya lo usan y se reemplaza al migrarlas; no se agregan más usos.
- Cada componente nuevo funciona en los cuatro temas sin cambios: se prueba cambiando `data-theme`.
- Estados que **siempre** se diseñan: vacío, cargando, error, deshabilitado, foco.

## 6. Accesibilidad y adaptación

- Contraste de texto **4,5:1** como mínimo (3:1 para texto grande). El `accent` debe cumplirlo con `accent-ink`; si no, existe `accent-text`.
- **Foco visible** siempre; no se quita el anillo.
- **Táctil:** los controles miden `control` (36 px; 44 px en pantallas táctiles con `pointer: coarse`). El panel se usa en celular.
- **Movimiento:** respetar `prefers-reduced-motion` (regla global en `@layer base`).
- **Cada tema tiene un solo modo**, sin alternar según el sistema: claro en todos, salvo el sauna, oscuro por su marca (`color-scheme: dark` en su bloque).
- **Mobile primero.** Utilidades base para móvil y variantes `sm:`, `md:`, `lg:` para crecer. Se usan los puntos de corte por defecto de Tailwind; el valor suelto de 900 px del panel actual desaparece al migrarlo.
- Botones de solo ícono con `aria-label`; íconos decorativos con `aria-hidden`; `aria-current` en navegación.
- Textos de la interfaz: español rioplatense, cortos, que digan qué hacer.

## 7. Convivencia con el CSS de legado

El CSS viejo de Ñekurel y del panel vive en la capa `legacy`, ordenada **antes** de `utilities`: `@layer theme, base, legacy, components, utilities`. Verificado en la fase E2. Así:
- Las utilidades ganan sin `!`.
- El CSS viejo sigue compitiendo igual entre sí, por especificidad. Por eso `panel.css` va en la misma capa: sin capa, le ganaría siempre a `legacy.css`.
- Al migrar cada pantalla se borran sus reglas y, cuando la capa queda vacía, se elimina.

Detalles que hay que respetar:
- `legacy.css` traduce los tokens a los nombres viejos (`--ink: var(--color-ink)`) en `:root, [data-theme]`. Tiene que estar en cada elemento con tema: un `var()` se resuelve donde se declara, y en `:root` solo conservaría el valor del tema predeterminado.
- `recetas.css` y `productos.css` siguen sin capa y sin cargar `globals.css`. Sus layouts ya llevan `data-theme`, que no tiene efecto hasta que migren.
- Cuando una utilidad se aplica sobre un elemento que también usa reglas viejas, ahora gana la utilidad. Si una utilidad vieja no se notaba, puede empezar a notarse: pasó con `font-medium` en "Cerrar sesión".

Reglas hasta entonces:
- **El sauna no importa el CSS de legado.** Solo `globals.css` ya limpio (E2).
- Al tocar una pantalla vieja no se agrega CSS: o se hace el cambio con utilidades, o se migra la pantalla entera.
- Una pantalla migrada **borra** las reglas que dejó sin uso en el mismo cambio.

## 8. Estado de la migración

| Archivo | Líneas | Qué es | Quién lo carga | Destino |
|---|---|---|---|---|
| `app/globals.css` | ~190 | Tokens, temas y reglas base (§2). | Herboristería y panel | Es el estado final. Recetas y productos lo cargan al migrar. |
| `app/legacy.css` | ~3.770 | Lo que era de `globals.css`: **Ñekurel** (buscador, administración, vendedor, tienda, carrito) y formularios y botones que el panel reutiliza. En la capa `legacy`. | Herboristería y **panel** | Migrar (E3b y E3d) y eliminar. |
| `app/panel/panel.css` | ~1.580 | Componentes del panel (todo bajo `.panel`, ~308 selectores). Sus tokens ya están en el tema `panel`. En la capa `legacy`. | Panel | Migrar a utilidades (E3b). Al hacerlo, pasar el color de foco al tema: hoy lo pone `.panel :focus-visible`. |
| `app/recetas/[site]/recetas.css` | 2.016 | Tema y componentes de recetas (`.r-*`, ~340 selectores). Independiente de `globals.css`. | Recetas | Migrar (E3). |
| `app/productos/[site]/productos.css` | 130 | Tema y componentes de productos (`.p-*`). Independiente. | Productos | Migrar (E3, **primero**: es el más chico y sirve de prueba del método). |
| Utilidades de Tailwind en `className` | ~60 usos | Casi solo el menú lateral del panel. | — | Crece con cada migración. |

Orden de migración (de menor a mayor riesgo, y por uso real): **productos → panel → recetas → herboristería (Ñekurel)**. Ñekurel va último porque hoy se usa poco y es lo más grande. Cada pantalla migrada se verifica en el navegador, en celular y en los temas que use (§9).

## 9. Cómo se verifica

- `npm run build` y `eslint` limpios. **Tailwind no avisa de una clase mal escrita**: la ignora sin error. En `modules/` y `shared/` la detecta `eslint`, con `eslint-plugin-better-tailwindcss`; en el legado solo se ve mirando la pantalla, porque ahí el plugin marcaría cada clase de CSS propio.
- Se mira la pantalla **antes y después** de migrarla, en ancho de celular (~390 px) y de escritorio, con teclado (foco) y, si hay formularios, con un error visible.
- Se informa qué no se pudo ver (por ejemplo, "no se probó en un celular real").
