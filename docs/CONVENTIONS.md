# Convenciones y normas

Cómo se escribe, se prueba y se entrega código en este proyecto. Es obligatorio para personas y para IA. Si algo de acá choca con lo que ves en el código, **el código manda y este archivo se corrige** en el mismo cambio.

Para el porqué de las decisiones ver [ARCHITECTURE.md](ARCHITECTURE.md); para las soluciones que se repiten, [PATTERNS.md](PATTERNS.md); para lo visual, [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

## 1. Reglas de trabajo (sin excepción)

1. **Leer antes de escribir.** Leer `AGENTS.md`, el archivo de [docs/](.) que corresponda a la tarea y, antes de tocar rutas, `proxy.ts`, metadata, cache o route handlers, la guía de Next 16 en `node_modules/next/dist/docs/01-app/`. Esta versión difiere de lo conocido.
2. **No hacer commit sin que se pida.** Se commitea solo cuando la persona lo pide de forma explícita. Nunca `--no-verify` ni saltar firmas o hooks.
3. **Probar antes de dar algo por hecho.** `tsc`, `eslint`, los tests y `next build` tienen que pasar (ver §8). Al informar, decir **qué se probó y qué no** (por ejemplo: "no se probó en un celular", "no se corrió contra Supabase real"). Un fallo no se oculta ni se da por bueno.
4. **Actualizar el roadmap al terminar.** Cada fase cerrada deja su estado en la tabla de [ROADMAP.md](ROADMAP.md) y notas en su "Registro". Una fase sin esa actualización no está terminada.
5. **Una fase por sesión.** Hacer solo la fase pedida, dejar el estado escrito y parar. No adelantar fases ni mezclar cambios de otra.

## 2. Idioma

| Qué | Idioma |
|---|---|
| Documentación (`docs/`, README) | Español |
| Textos de la interfaz | Español rioplatense (voseo), cortos y concretos |
| Mensajes de error al usuario | Español rioplatense |
| Identificadores, nombres de archivos, comentarios del código | Inglés |
| Segmentos de URL visibles | Español (`/recetas`, `/productos`, `/tonicos`) |
| Mensajes de commit | Español (ver §9) |

Los comentarios explican el **porqué** (una restricción, un riesgo, una decisión), no repiten lo que dice la línea.

## 3. Dónde va cada cosa y cómo se nombra

**Todo código nuevo (el sauna en adelante) sigue la estructura objetivo** de [ARCHITECTURE.md §4.1](ARCHITECTURE.md). El código existente queda como está (§4.2 de ese archivo) y no se mueve por prolijidad.

### Dónde va

| Si necesitás… | Va en… | Notas |
|---|---|---|
| Una regla de negocio (precio, cupo, estados, validación) | `modules/<m>/domain/` | Pura. Con su test al lado en el mismo cambio. |
| Una consulta o escritura a la base | `modules/<m>/data/` | Siempre por `siteTable`. Solo servidor. |
| Una función SQL o una tabla | Sección del módulo en `supabase/schema.sql` | Idempotente (patrón 9). |
| La lógica de un route handler | `modules/<m>/api/` | `route.ts` en `app/` solo la monta. |
| Un `route.ts` o una `page.tsx` | `app/…` | Una línea que delega en el módulo. Sin reglas de negocio. |
| Una pantalla o componente de un módulo | `modules/<m>/ui/` | Cliente solo si hace falta (`"use client"`). |
| Una sección nueva del panel | Componente en `modules/<m>/ui/`, ruta en `app/panel/[site]/<sección>/page.tsx`, declaración en `modules/<m>/panel.tsx` | Nombre de sección **único en todo el panel**. |
| Un componente usado por 2 o más módulos, sin negocio | `shared/ui/` | Con las 4 variantes de tema probadas. |
| Un componente usado por un solo módulo | Se queda en ese módulo | No subir "por si acaso". |
| Una utilidad sin dominio (texto, fechas) | `shared/lib/` | |
| Sesión, permisos, registro de sitios, cliente de base | `platform/` | Fachada de lo legado hasta que se mueva (ver [ARCHITECTURE.md §4.1](ARCHITECTURE.md)). |
| Dinero y porcentajes | `platform/money/` | Centavos enteros. |
| Un módulo nuevo (otro tipo de sitio) | `modules/<m>/` con sus entradas `index.ts`, `server.ts`, `panel.tsx` | Más: una entrada en `siteKinds` y en `panelKinds`. |
| Una variable de entorno | `.env.example` y la tabla de [ARCHITECTURE.md §9](ARCHITECTURE.md) | |
| Una decisión o un cambio de regla | El `docs/` que corresponde | En el mismo commit. |

### Reglas de módulos

1. **Se importa solo hacia abajo:** `app → modules → platform → shared`. Un módulo no importa a otro.
2. **Desde afuera de un módulo, solo por sus entradas públicas:** `@/modules/<m>` (cliente seguro), `@/modules/<m>/server` (servidor), `@/modules/<m>/panel`, `@/modules/<m>/ui`. Nunca por una ruta interna.
3. **`domain/` es puro:** no importa `react`, `next/*`, `platform/db` ni nada de `data/` o `ui/`.
4. **El código nuevo no importa de `lib/` ni del `app/` legado:** pasa por `platform/` (fachada).
5. **Una pantalla de `app/` no tiene reglas de negocio.** Si la regla se puede explicar sin pantalla, vive en `domain/`.
6. Cuando se rompe una regla de estas, `eslint` falla (`eslint.config.mjs`). No se desactiva la regla: se mueve el código.
7. **Un módulo nuevo se empieza copiando** [plantilla-modulo/](plantilla-modulo/README.md).

### Nombres

- **Archivos:** `kebab-case`. Componentes React: `PascalCase` dentro del archivo, nombre de archivo en `kebab-case` (`booking-card.tsx` exporta `BookingCard`).
- **Un componente exportado por archivo**, y un archivo no pasa de ~300 líneas: si crece, se parte por responsabilidad.
- **Sufijos con significado:** `route.ts`, `page.tsx`, `layout.tsx` (Next); `*.test.ts` (prueba junto al código); en el legado, `*-store.ts` y `*-context.tsx`.
- **Tipos y funciones del dominio** en inglés y con el vocabulario del negocio (`Booking`, `Slot`, `Deposit`, `priceFor`, `nextStatus`). Las URL visibles, en español.
- **Importar con `@/`** salvo dentro del mismo directorio.
- **En `domain/` y `shared/lib/`** (lo que cargan los tests) los imports relativos llevan la extensión `.ts`.
- No usar carpetas con `_` para rutas: en el App Router son privadas y no generan rutas. Las carpetas entre paréntesis `(grupo)` agrupan sin cambiar la URL.

## 4. TypeScript y React

- `strict: true`. Sin `any`; si hace falta salir del sistema de tipos, que sea `unknown` y validar.
- **Los datos que llegan de afuera se validan** (cuerpos de API, filas de la base, JSON guardado): funciones `clean*` / `validate*` en `lib/`. Un documento inválido cuenta como ausente y se avisa; no tira el sitio.
- **Servidor por defecto.** `"use client"` solo donde hay estado, efectos o eventos. Nada que lea `process.env` secreto, `next/headers` o Supabase puede terminar en un componente cliente.
- Los componentes cliente **no importan la lista de sitios** (`lib/sites.ts` es solo respaldo): reciben lo que necesitan del servidor (`SiteSummary`, `useSite()`).
- Las funciones que consultan el registro son `async` (`getSite`, `listSites`). No hay lectura síncrona de sitios.
- Hooks al principio del componente, antes de cualquier `return` anticipado.

## 5. Interfaz y estilos

El detalle (tokens, temas, componentes, migración) está en [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). Las reglas que no se discuten:

- **Tailwind primero.** Todo estilo nuevo es una utilidad en el `className`. **No se crean archivos `.css`**, ni CSS Modules, ni `styled-jsx`.
- **Un solo archivo CSS: `app/globals.css`**, con tokens (`@theme`), temas por `data-theme`, reglas base y animaciones. Nada de clases propias por pantalla.
- **Reutilizar = hacer un componente** (`shared/ui` o el módulo), no una clase CSS ni `@apply`.
- **Usar tokens**, no colores ni medidas sueltas (`bg-surface`, `text-ink`, `rounded-card`). Un valor arbitrario (`w-[37px]`) solo si es único y lleva un comentario.
- **Sin `!important` ni utilidades con `!`.** Es un parche para el CSS de legado y no se usa en código nuevo.
- **No se agrega CSS al legado.** Si hay que cambiar una pantalla vieja, o el cambio se hace con utilidades, o se migra la pantalla entera y se borran sus reglas CSS en el mismo cambio.
- **Íconos:** `lucide-react` en código nuevo. **Primitivas accesibles:** Radix UI.
- **Táctil:** los controles miden `control` (36 px; 44 px en pantallas táctiles). No bajar de ahí.
- **Accesibilidad:** `aria-label` en botones de solo ícono, `aria-current` en navegación, `aria-hidden` en íconos decorativos, foco visible, **contraste 4,5:1** (el acento de cada sitio debe cumplirlo con su texto).
- **Siempre se diseñan** los estados vacío, cargando, error y deshabilitado. No dejar pantallas en blanco.
- Los íconos de `public/` llevan esquinas transparentes y, para Android/Apple, una versión *maskable* a sangre.

## 6. Base de datos

- Todo cambio de esquema se **agrega al final** de `supabase/schema.sql` y es idempotente (ver patrón 9 de [PATTERNS.md](PATTERNS.md)). La persona corre el archivo entero a mano en el SQL Editor.
- Tablas: `snake_case`, plural (`recipe_comments`). Claves: `id uuid` o texto con `check` de formato (`sites.id`). Fechas: `timestamptz`, con `created_at` y `updated_at`.
- Toda tabla de un sitio: `site_id text not null references public.sites (id)`, índice que empiece por `site_id`, `enable row level security` y `revoke all … from anon, authenticated` (solo entra el servidor).
- **Dinero:** enteros en centavos, columnas `*_cents` de tipo `bigint`. Nunca decimales ni `float`.
- **Días:** los días de negocio son de `America/Argentina/Buenos_Aires`.
- Funciones SQL: `security invoker`, `set search_path = ''`, nombres calificados (`public.tabla`), `revoke` a `public, anon, authenticated` y `grant` a `service_role`.
- Restricciones nuevas sobre datos existentes: `not valid` y se validan aparte.

## 7. API y manejo de errores

- Forma de los route handlers: patrón 8 de [PATTERNS.md](PATTERNS.md). Autenticación **en cada handler**, no solo en el layout.
- Códigos: 400 entrada inválida, 401 sin sesión (lectura), 403 sin permiso o mismo origen (escritura), 404 sitio o recurso inexistente, 409 conflicto de versión, 413 cuerpo grande, 429 demasiados intentos, 500 falla propia.
- Los mensajes que ve la persona van en español y dicen **qué hacer** ("Recargá la página antes de guardar").
- Los registros del servidor llevan prefijo del módulo: `[products]`, `[sites]`, `[catalog PUT]`. Nada de secretos, tokens ni datos personales en logs.
- Un servicio externo que falla **no rompe una página pública** si no es esencial (métricas, comentarios): se degrada con aviso (patrón 3).

## 8. Pruebas y verificación

```powershell
npx tsc --noEmit
npx eslint
npm test            # tests/*.test.mjs y **/*.test.ts de modules/, platform/ y shared/
npm run build
```

- Los tests usan el runner de Node (`node:test`) y viven en `tests/<dominio>.test.mjs` (código legado) o **junto al código**, en `modules/<m>/domain/*.test.ts` (código nuevo). Un test `.ts` importa con ruta relativa y extensión `.ts`, porque Node no resuelve `@/`. Prueban lógica **pura**: validación, cálculos, texto, reglas. Los almacenes y las páginas se verifican a mano.
- Cada regla de negocio nueva lleva su test **en el mismo cambio**. Los casos de dinero y de cupos son obligatorios.
- Los nombres de los tests se escriben en español y dicen la regla ("una consulta que fija site_id por su cuenta es un error").
- Un test que cuida un acuerdo entre archivos es válido (por ejemplo, que el seed de `schema.sql` coincida con `seedSites`). Como no hay base de pruebas, `modules/sauna/schema.test.ts` lee `schema.sql` como texto y cuida que coincida con el dominio y con las normas de §6. Va fuera de `domain/` porque usa `node:fs`.
- `next build` valida tipos y rutas pero **no** el comportamiento: para cambios de interfaz o de datos, además se mira la pantalla.

### Probar sin tocar datos

El entorno local usa **la base real**: `.env.local` apunta al Supabase de producción y, por decisión, no hay una base de pruebas (ver [ROADMAP.md](ROADMAP.md) §5). Por eso:

- Para ver pantallas con datos sin escribir, levantar un servidor HTTP local y arrancar la app con `NEXT_PUBLIC_SUPABASE_URL` apuntando a él. Puede responder datos falsos en `/rest/v1/<tabla>` o ser un proxy que reenvía las lecturas al Supabase real y contesta él mismo toda escritura, sin reenviarla. Con `next dev` alcanza; para `next build` + `next start` hay que definir la variable también al compilar. Las variables `NEXT_PUBLIC_*` **se incrustan al compilar**, así que con `next build` + `next start` el cambio no se nota; con `next dev` el entorno del proceso gana a `.env.local`.
- Para el panel hace falta iniciar sesión: `POST /api/session` con la contraseña de `.env.local` y el encabezado `Origin` igual al `Host`.
- Si se hizo un `next build` con variables de prueba, **recompilar sin ellas** para que `.next` no quede apuntando al servidor falso.
- Nunca imprimir ni copiar la contraseña ni las claves de `.env.local` a un documento, un log o un commit.

### Entorno de desarrollo (Windows)

- Node.js 22.14 o posterior. Las dependencias se manejan con **pnpm** (`pnpm add`, `pnpm-lock.yaml`). Los scripts se corren igual con `npm run dev|build|start|lint|test`.
- Git Bash **no tiene** `pkill`. Para cerrar un servidor, buscar el proceso por puerto: `Get-NetTCPConnection -LocalPort 3111 -State Listen` y `Stop-Process -Id <pid>`. Antes de probar, confirmar que el puerto esté libre y que el log diga `Ready`: un servidor viejo sigue respondiendo y contamina la prueba.
- Para la tablet o el celular en la misma red: `npm run dev -- --hostname 0.0.0.0` y la IP de la computadora. Un host desconocido recibe el sitio por defecto.

## 9. Git

- **Mensajes:** `tipo(ámbito): resumen en español, en minúscula, sin punto final`. Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Ámbito = el módulo o tipo de sitio (`productos`, `panel`, `recetas`, `sauna`, `registro`).
  Ejemplos reales: `feat(productos): sitios Purificación y Yakuchil`, `feat(panel): instalable como app propia`.
- Un commit = un cambio con sentido, con sus tests y su documentación. No mezclar una refactorización con una función nueva.
- **Ramas:** `feat/<tema>`, `fix/<tema>`. La rama principal es `main`.
- Cuando una IA hace el commit, agrega su línea `Co-Authored-By` al final del mensaje.
- No se commitean secretos ni `.env.local`. `.env.example` lleva solo nombres y valores de ejemplo. Los archivos de `.agents/` y `skills-lock.json` pertenecen a las herramientas de IA; commitearlos es decisión de la persona.

## 10. Documentación

- Un cambio que altera una decisión, una regla o un mapa de carpetas **actualiza el archivo de `docs/` correspondiente** en el mismo commit.
- Los planes ya cumplidos se mueven a `docs/archivo/` y se dejan de editar.
- Cada fase del [ROADMAP.md](ROADMAP.md) termina con: estado en la tabla, notas en el "Registro" (qué se hizo, qué se verificó, **qué no se probó**) y lo pendiente.
- Escribir para quien llega sin contexto: ninguna referencia a "como hablamos" ni a conversaciones. Las decisiones tienen su porqué escrito.

## 11. Seguridad (mínimos)

- La clave secreta de Supabase y las credenciales de pago **solo en el servidor** y en variables de entorno.
- Toda escritura: sesión + mismo origen. Todo dato que viene del cliente se valida y se acota en tamaño.
- Montos, descuentos y cupos **se calculan en el servidor**. El cliente solo manda qué quiere, nunca cuánto cuesta.
- Los enlaces secretos (reserva de un invitado) llevan un token aleatorio largo y se comparan en tiempo constante (`equal()` de `lib/auth.ts`).
- Datos personales (nombre, WhatsApp): guardar lo mínimo, no registrarlos en logs, no exponerlos en rutas públicas. Revisar las obligaciones de datos personales aplicables en Argentina (Ley 25.326) antes de publicar el sauna.
- Las cookies de sesión son del host, sin `Domain=`.
