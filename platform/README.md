# platform

Lo que usan todos los módulos, sin conocer ninguno. Dónde va cada cosa: [CONVENTIONS.md §3](../docs/CONVENTIONS.md).

Por ahora casi todo es una **fachada**: reexporta el código legado sin moverlo, y esa es una excepción aceptada a la regla "`platform/` no importa `app/`" ([ARCHITECTURE.md §4.2](../docs/ARCHITECTURE.md)). Cuando un archivo legado se reescribe a fondo, se mueve detrás de su fachada y se borra el original; no antes.

| Importar desde | Entorno | Qué trae |
|---|---|---|
| `@/platform/db` | Servidor | `siteTable`, `siteDocument`, `rpc` y sus errores, y `panelTable` solo para las tablas `panel_*`, que no son de un sitio. El cliente `supabase` crudo queda afuera a propósito. |
| `@/platform/sites` | Cliente y servidor | `siteKinds` y los tipos de sitio. |
| `@/platform/sites/server` | Servidor | `getSite`, `listSites` (solo sitios activos: lo público) y `getPanelSite` (también los inactivos: solo detrás de una sesión). Caché pública: `publicRevalidate`, `publicTags` y `refreshPublic`, que llama toda ruta que guarde algo visible en un sitio público con ISR. |
| `@/platform/auth` | Cliente y servidor | `canOpen`, `visibleSections`. |
| `@/platform/auth/server` | Servidor | `isAdmin`, `sameOrigin`, `equal`. |
| `@/platform/panel` | Pantallas del panel | `SaveForm`, `PageHeader`, `PanelContext`, `useSite`, `usePanel`, herramientas de lista y los tipos del registro del panel. |
| `@/platform/money` | Cliente y servidor | Centavos, `percentOf` (el redondeo único), `formatCents` y la lectura de precios escritos por una persona (`centsFromPesos`, `pesosFromCents`). No es fachada: es código propio y puro. Desde `domain/` se importa por ruta relativa con extensión `.ts`. |

| `platform/notifications` | Cliente y servidor | Avisos del panel ([tareas-notificaciones.md](../docs/tareas-notificaciones.md)): eventos, textos y enlaces, filtro por sitio y códigos para vincular Telegram. Código propio y puro, como `money`. `@/platform/notifications/server` (servidor): `notify()` para avisar después de responder y `sendNotice()` para mandar ya. |

Se agrega a una fachada lo que un módulo necesite cuando lo necesite.

**Cuidado con `@/platform/panel`.** `PageHeader` vive en `shell.tsx`, que importa `kinds.tsx`, que importa el `panel.tsx` de cada módulo. Eso cierra un ciclo, así que `panel.tsx` no puede usar nada de esta fachada mientras se carga, solo dentro de sus funciones. Los tipos no cuentan, porque desaparecen al compilar. Lo mismo vale para lo que `panel.tsx` importe, como el proveedor del módulo. Con el sauna registrado se comprobó que el ciclo no molesta mientras se cumpla esta regla.
