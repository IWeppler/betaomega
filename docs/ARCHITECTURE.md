# Arquitectura

Qué es el sistema, de qué partes está hecho y dónde vive cada cosa. Para **cómo resolvemos** los problemas que se repiten, ver [PATTERNS.md](PATTERNS.md). Para las normas de escritura, [CONVENTIONS.md](CONVENTIONS.md). Para lo visual (Tailwind, tokens, temas), [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). Para lo que viene, [ROADMAP.md](ROADMAP.md).

> Esta versión de Next es la **16.3.8** y cambia cosas respecto de lo que se conoce (por ejemplo `proxy.ts` reemplaza a `middleware.ts`). Antes de tocar rutas, `proxy.ts`, metadata, cache o route handlers, leer la guía en `node_modules/next/dist/docs/01-app/`.

## 1. Qué es

Una **plataforma multisitio**: un mismo cliente tiene varios negocios y cada uno tiene su sitio público. Todo se administra desde **un solo panel** (BetaOmega). Los visitantes no deben notar que los sitios comparten aplicación.

| Sitio | Tipo (`kind`) | Qué es |
|---|---|---|
| Ñekurel | `herboristeria` | Catálogo de hierbas y tónicos, tienda con carrito por WhatsApp, vista interna para vendedores (`/equipo`). |
| Comidas del cielo | `recetas` | Recetas, comentarios, métricas, compartir, app instalable. |
| Purificación, Yakuchil | `productos` | Listas de productos con buscador (aguas, voces sagradas). |
| Fropexio (en camino) | `sauna` | Reservas con cupos y turnos, pago de seña online y packs de sesiones. Ver [SAUNA.md](SAUNA.md). |
| BetaOmega | — | El panel de administración. Es una app instalable (PWA); los sitios públicos no necesitan serlo. |

## 2. Decisiones de fondo

| Tema | Decisión | Por qué |
|---|---|---|
| Despliegue | **Una sola app Next en un solo proyecto de Vercel.** Todos los dominios apuntan al mismo deploy. | Un solo lugar que mantener mientras los sitios son pocos. Se separa por tipo cuando haga falta (ver [ROADMAP.md](ROADMAP.md), "Cuándo separar"). |
| Ruteo | `proxy.ts` lee el host y **reescribe** a `/<tipo>/<sitio>/<ruta>`. | Cada sitio tiene su dominio sin que el árbol de rutas lo sepa. |
| Árboles de rutas | Uno por **tipo** de sitio (`app/herboristeria/[site]`, `app/recetas/[site]`, `app/productos/[site]`). | Cada tipo tiene páginas distintas. El parámetro `site` elige datos y marca. |
| Registro de sitios | Tabla `sites` en Supabase, con la lista de `lib/sites.ts` como respaldo. | Sumar un sitio no debería exigir un deploy, y los sitios no caen si la base no responde. |
| Datos | Supabase (Postgres) por su API REST con la **clave secreta**, solo desde el servidor. | El navegador nunca habla con la base. |
| Organización del código | **Monolito modular por funcionalidad** con regla de dependencia (`app → modules → platform → shared`). Solo el sauna en adelante; lo existente no se migra. | Todo lo de una funcionalidad queda junto y las dependencias se verifican con `eslint`. No es FSD puro (choca con `app/` de Next y no cubre el servidor) ni orientado a objetos con clases (el límite servidor/cliente de Next exige objetos simples). |
| Estilos | **Tailwind primero; un solo `globals.css`.** Ver [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). | Un solo sistema, sin ~7.600 líneas de CSS paralelo. Migración por etapas. |
| Aislamiento entre sitios | Por código (`siteTable`), no por RLS. | La clave secreta se salta RLS; la capa de datos es el aislamiento. |
| Acceso | Una sesión de administrador firmada (cookie) y un código de vendedor para Ñekurel. Sin Supabase Auth. | Hoy accede una o dos personas. Los operadores con permisos están en el [ROADMAP](ROADMAP.md). |

## 3. Cómo llega una visita

```
 nekurel.com/menta ─┐
 yakuchil.vercel.app/ ─┼─► proxy.ts ──► ¿host del panel? ──sí──► /panel/<ruta>
 panel.<dominio>/    ─┘                  │ no
                                         ▼
                              getSiteForHost(host)   (lib/site-registry.ts)
                                         │
                       ┌─────────────────┴──────────────────┐
                       ▼                                    ▼
               tabla `sites`+`site_domains`          respaldo: seedSites
               (cache 30 s, timeout 4 s)             (lib/sites.ts)
                       │
                       ▼
        reescribe a /<site.kind>/<site.id>/<ruta>
        ej.: nekurel.com/menta  →  app/herboristeria/[site]/(tienda)/[slug]  con site = "nekurel"
```

- `proxy.ts` corre en **Node** (default de Next 16). Next avisa que el proxy no debe depender de variables compartidas: el cache de 30 s **solo acelera**, una instancia fría vuelve a consultar.
- Un host desconocido (localhost, la IP de la tablet de la tienda, previews) recibe el sitio por defecto (`DEFAULT_SITE`, por defecto `nekurel`).
- Un sitio con `active = false` se está preparando: el panel lo administra (`listPanelSites`, `getPanelSite`) y el público no lo alcanza, ni por su dominio ni por sus APIs públicas (`listSites`, `getSite`).
- El matcher excluye `api/`, `_next/`, `favicon.ico`, `sw.js`, `panel-sw.js` e imágenes: son compartidos por todos los sitios y no se reescriben. **Toda ruta reescrita lleva prefijo**, así ningún árbol interno es alcanzable desde otro host.
- La URL canónica de cada sitio (`site.url`) se usa para metadata, sitemap, `robots.txt` y enlaces compartidos.

## 4. Estructura del código

Hay dos estructuras a la vez, a propósito: la **objetivo**, que usa todo código nuevo (el sauna en adelante), y la **actual (legado)**, que se mantiene tal cual y solo se reordena si hay un motivo explícito en el [ROADMAP](ROADMAP.md). **No se migra el código existente por migrar.**

### 4.1 Estructura objetivo: monolito modular, una carpeta por funcionalidad

```
app/                      Solo rutas. Finas: piden datos y componen. Sin reglas de negocio.
modules/
  <modulo>/               sauna, y a futuro los demás
    domain/               Reglas puras: tipos, validación, cálculos, transición de estados.
                          Sin red, sin react, sin next/*. Con sus tests al lado (*.test.ts).
    data/                 Acceso a Supabase y funciones SQL del módulo. Solo servidor.
    api/                  Lógica de los route handlers (validar, llamar a data, traducir errores).
    ui/                   Componentes React del módulo: sitio público y panel.
    panel.tsx             Secciones y proveedor del módulo para el registro del panel.
    index.ts              Entrada pública SEGURA PARA CLIENTE: tipos y domain.
    server.ts             Entrada pública DE SERVIDOR: data y api. Lleva `import "server-only"`.
platform/                 Lo que usan todos los módulos, sin conocer ninguno.
  sites/                  Registro de sitios y tipos (hoy lib/sites.ts y lib/site-registry.ts).
  auth/                   Sesión y permisos (hoy lib/auth.ts y lib/panel-access.ts).
  db/                     Cliente de Supabase y siteTable (hoy lib/supabase.ts y lib/site-table.ts).
  money/                  Dinero en centavos y porcentajes.
  panel/                  El shell del panel: menú, SiteContext, SaveForm, herramientas de lista.
shared/
  ui/                     Componentes visuales sin negocio (botones, selects, diálogos).
  lib/                    Utilidades sin dominio (normalizar texto, fechas).
supabase/schema.sql       Una sección por módulo.
```

**Regla de dependencia.** Se importa solo hacia abajo:

```
app  →  modules  →  platform  →  shared
```

- `domain/` no importa nada de afuera del módulo, salvo `platform/money` y `shared/lib`.
- **Un módulo no importa a otro módulo.** Si dos necesitan lo mismo, eso sube a `platform/` o se compone en `app/`.
- `platform/` no importa `modules/` ni `app/`.
- Fuera de un módulo se importa **solo por sus entradas públicas** (`@/modules/sauna`, `@/modules/sauna/server`, `@/modules/sauna/panel`, `@/modules/sauna/ui`, `@/modules/sauna/ui/public`), nunca por una ruta interna (`@/modules/sauna/data/bookings`). `ui` trae las pantallas del panel y `ui/public` lo que dibuja el sitio público, para que el código del panel no llegue a ese paquete.
- **Entradas separadas por entorno** (no una sola `index.ts` que lo mezcle todo): importar un archivo de servidor desde un componente cliente filtraría código y secretos al navegador. `server.ts` falla el build si lo hace un componente cliente.
- Estas reglas las **hace cumplir `eslint`** (`eslint.config.mjs`), no la memoria de las personas. Un módulo nuevo queda cubierto sin tocar la configuración, porque la lista sale de la carpeta `modules/`. Una ruta nueva bajo `app/` puede importar módulos; las carpetas legadas están enumeradas ahí y no pueden.

**Cómo se conecta un módulo con la app.**
- Rutas públicas: `app/<tipo>/[site]/…/page.tsx` importa la pantalla de `@/modules/<m>/ui` y le pasa el sitio.
- Rutas del panel: `app/panel/[site]/<sección>/page.tsx` es una línea que monta una pantalla de `@/modules/<m>/ui`. El módulo declara sus secciones en `panel.tsx` y `app/panel/[site]/kinds.tsx` las registra en `panelKinds`.
- APIs: `app/api/sites/[site]/<m>/…/route.ts` es una línea que delega en `@/modules/<m>/server`.
- Las rutas del panel son **compartidas por todos los tipos** (`app/panel/[site]/<sección>`): el nombre de una sección tiene que ser único en todo el panel. Hoy `categorias` y `sitio` las usan dos tipos de sitio a propósito. El sauna usa nombres propios (`agenda`, `reservas`, `horarios-precios`, `packs`, `codigos`, `politicas`, `pagos`, `ajustes`).

**Dónde va cada cosa:** la tabla completa está en [CONVENTIONS.md §3](CONVENTIONS.md).

### 4.2 Estructura actual (legado)

Organizada por **tipo de archivo**. Sigue vigente para los sitios existentes y es la fuente de verdad de cómo funcionan hoy.

```
app/
  layout.tsx                 Raíz compartida: solo fuentes. Cada sitio pone su metadata y estilos.
  herboristeria/[site]/      Sitio de Ñekurel: (tienda)/ catálogo y fichas, equipo/ (vendedores), manifest, og, pwa-icon.
  recetas/[site]/            Sitio de recetas: listado, [slug], filtros, comentarios, brand.ts, recetas.css, og, icon, sitemap.
  productos/[site]/          Sitio de productos: listado, [slug], brand.ts, productos.css, og, icon, sitemap.
  sauna/[site]/              Sitio de reservas: layout con su tema y rutas finas que montan modules/sauna (estructura objetivo, §4.1).
  panel/                     BetaOmega.
    layout.tsx, page.tsx     Fuente del panel, login o redirección al primer sitio.
    [site]/                  Todo el panel de un sitio.
      layout.tsx             Valida sitio y sesión; arma el shell con el proveedor de datos del tipo.
      kinds.tsx              Registro de qué trae el panel de cada tipo (secciones + proveedor). Ver PATTERNS.md.
      shell.tsx              Menú, cambio de sitio, salida segura de formularios (cliente).
      <sección>/page.tsx     Una carpeta por sección (tonicos, recetas, productos, comentarios, metricas, sitio…).
      *-context.tsx          Datos del tipo cargados una vez para todo el panel (catálogo, recetas, productos).
    panel.css                Estilos del panel, todo bajo `.panel` (legado: ver DESIGN-SYSTEM.md).
  globals.css                Tokens, temas y reglas base. El único CSS que usa el código nuevo.
  legacy.css                 CSS existente de Ñekurel y de los formularios del panel. Solo se achica.
  api/
    sites/[site]/…           APIs del panel por sitio (recetas, productos, comentarios, métricas, ajustes).
    session/, images/, catalog/, usage/   Sesión, fotos, catálogo de Ñekurel.
  *.tsx (en la raíz de app/)  Componentes cliente compartidos entre tipos (formularios, selectores, buscador…).
components/ui/               Primitivas de UI (Select).
lib/                         Lógica, plana (ver §5). Se traduce a platform/ y modules/ solo si se toca a fondo.
supabase/schema.sql          Esquema completo, idempotente. Se corre a mano en el SQL Editor.
tests/                       Pruebas de `lib/` con el test runner de Node.
public/                      Íconos, logos, `sw.js` (sitios) y `panel-sw.js` (panel).
proxy.ts                     Ruteo por host.
docs/                        Esta documentación. `docs/archivo/` guarda planes ya cumplidos.
```

**Convivencia sin migrar.**
- El código legado **no importa** de `modules/`, y no se mueve ni se edita para acomodarse a la estructura objetivo.
- El código nuevo **no importa de `lib/` ni de `app/` directamente**: lo hace a través de `platform/`. `platform/` es una **fachada**: cada carpeta reexporta lo que ya existe, separado por entorno igual que un módulo. La tabla de qué trae cada entrada está en [platform/README.md](../platform/README.md). Lo único realmente nuevo ahí es `platform/money`.
- Es una excepción transitoria de la regla "`platform/` no importa `app/`": se acepta porque evita tocar los ~35 archivos que usan esas piezas. Cuando un archivo legado se reescriba a fondo, se **mueve detrás de su fachada** y se borra el original; no antes.

## 5. `lib/` (legado): lógica pura y acceso a datos

Esta es la organización actual. En el código nuevo, la lógica pura va en `modules/<m>/domain/` y el acceso a datos en `modules/<m>/data/` (§4.1); las reglas de separación son las mismas.

La regla es separar **lógica pura** (sin red ni `next/*`, con tests) de **almacenes** (hablan con Supabase).

| Rol | Archivos | Notas |
|---|---|---|
| Tipos y lógica pura de dominio | `catalog.ts`, `recipes.ts`, `recipe.ts`, `products.ts`, `comments.ts`, `metrics.ts`, `cart.ts`, `shop.ts`, `csv.ts`, `site-settings.ts`, `images.ts`, `preview.ts`, `store-tools.ts` | Validación, normalización, armado de textos. Importan con extensión `.ts` para que los tests las carguen. |
| Registro de sitios | `sites.ts`, `site-registry.ts` | `sites.ts`: tipos, respaldo y funciones puras. `site-registry.ts`: lectura async con cache. |
| Acceso a Supabase | `supabase.ts`, `site-table.ts` | `supabase.ts`: REST, `rpc`, documentos de `app_data`. `site-table.ts`: tablas con alcance por sitio. |
| Almacenes por entidad | `recipe-store.ts`, `comment-store.ts`, `product-store.ts`, `site-store.ts`, `metric-store.ts`, `store.ts` | Traducen filas ⇄ objetos del dominio. Solo servidor. |
| Seguridad | `auth.ts`, `usage.ts` | Sesión firmada (HMAC), `sameOrigin`, límite de intentos. |
| Permisos del panel | `panel-access.ts` | `visibleSections`, `canOpen`. Todavía sin uso real; ver [ROADMAP](ROADMAP.md). |

## 6. Datos

Hay **dos formas** de guardar, a propósito:

1. **Documento JSON en `app_data`** (`key`, `data`, `revision`): catálogo de Ñekurel (`catalog`), uso (`usage`), ajustes de sitio (`site:<id>`), productos (`products:<id>`). Con control de versión optimista por `revision`. Sirve cuando el dato se edita entero y no se consulta por partes.
2. **Tablas relacionales**: `recipes`, `recipe_comments`, `site_metrics`, y el registro `sites` / `site_domains`. Sirven cuando hay filas independientes, consultas y restricciones. **El sauna es relacional**: reservas, cupos y pagos no caben en un documento.

Regla: todo lo que pertenece a un sitio lleva `site_id` con clave foránea a `sites(id)` y se lee por `siteTable`. Los documentos de `app_data` llevan el id del sitio en la clave, y se acceden por `siteDocument` (`lib/site-table.ts`), que la arma. **Se quedan en `app_data`:** se editan enteros y nunca se consultan por partes, así que una tabla con `site_id` no aporta nada, y moverlos exigiría migrar datos reales. El catálogo y el uso de Ñekurel siguen con clave fija (`catalog`, `usage`) porque hay una sola herboristería; ver el backlog del [ROADMAP](ROADMAP.md).

Fotos: bucket privado `images` de Supabase Storage, servidas por `/api/images/<nombre>`. Los sitios nuevos guardan en una carpeta con su id.

## 7. Acceso y sesiones

- **Administrador:** contraseña (`ANKORA_ADMIN_PASSWORD`) → cookie `HttpOnly`, `SameSite=Strict`, firmada con HMAC (`ANKORA_SESSION_SECRET`), dura 8 horas. Intentos limitados.
- **Vendedor (solo Ñekurel):** código (`ANKORA_SELLER_CODE`) que se pide una vez por dispositivo; dura 30 días. Su firma cubre otro contenido, así que su cookie nunca pasa por la de administrador. Cambiar el código cierra la sesión de todos los vendedores.
- **Escrituras:** exigen sesión de administrador **y** mismo origen (`sameOrigin`).
- **Las cookies son del host, no del dominio.** Nunca fijar `Domain=` en una cookie de sesión: con subdominios comodín, la sesión del panel quedaría visible para los sitios públicos.
- El panel confía en `isAdmin()` en el layout para **decidir qué mostrar**, y las APIs lo vuelven a verificar en cada lectura y escritura. El layout no es una barrera de seguridad.

## 8. Aplicaciones instaladas (PWA)

- **BetaOmega** es la app: `app/panel/manifest.webmanifest`, `public/panel-sw.js`, íconos `betayomega-*`.
- Los sitios públicos tienen `manifest.webmanifest` e íconos propios (Ñekurel se usa en la tablet de la tienda; los de recetas y productos son instalables). Instalar es opcional y no debe ser requisito de ningún flujo.
- Los service workers solo se registran en producción.

## 9. Variables de entorno

| Variable | Para qué | Obligatoria |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase. **Se incrusta al compilar** (`NEXT_PUBLIC_`): cambiarla exige un nuevo build. | Sí |
| `SUPABASE_SECRET_KEY` | Clave secreta. Solo servidor. Nunca con prefijo `NEXT_PUBLIC_`. | Sí |
| `ANKORA_ADMIN_PASSWORD` | Contraseña del administrador. | Sí |
| `ANKORA_SESSION_SECRET` | Secreto de las firmas (≥ 32 caracteres). Cambiarlo cierra todas las sesiones. | Sí |
| `ANKORA_SELLER_CODE` | Código del equipo de Ñekurel. | Sí |
| `PANEL_HOSTS` | Hosts del panel, separados por coma. | No (`betayomega.vercel.app,panel.localhost`) |
| `DEFAULT_SITE` | Sitio para hosts desconocidos. | No (`nekurel`) |

`.env.example` es la referencia; las secretas viven en `.env.local` y en Vercel. **El entorno local apunta a la base real, y no hay base de pruebas por decisión** (ver [ROADMAP](ROADMAP.md) §5 y "Probar sin tocar datos" en [CONVENTIONS.md](CONVENTIONS.md)).

## 10. Qué cambia con el sauna

El sauna es el primer tipo que guarda **datos de personas** (nombre y WhatsApp) y **dinero** (señas, reintegros). Eso trae requisitos que los otros tipos no tienen: transacciones con bloqueo de cupos, pagos con confirmación externa (webhook), idempotencia, auditoría y datos personales. Está especificado en [SAUNA.md](SAUNA.md).
