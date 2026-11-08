# Patrones de diseño

Los problemas que se repiten en este proyecto y **cómo los resolvemos siempre**. Antes de inventar una solución nueva, buscar acá. Si hay que apartarse de un patrón, dejar escrito por qué en el commit o en [ROADMAP.md](ROADMAP.md).

Cada patrón dice: el problema, la solución, dónde está el ejemplo real y cuándo **no** usarlo. Los marcados **(para el sauna)** se aplican en `modules/sauna/` y en la sección del sauna de `supabase/schema.sql`, que todavía no se ejecutó en ninguna base.

---

## 1. Registro (un solo lugar que describe cada pieza)

**Problema.** Una pieza nueva (un tipo de sitio, una sección del panel) obliga a editar varios archivos y es fácil olvidarse de uno.

**Solución.** Un objeto que describe todo lo de esa pieza, tipado como `Record<Clave, …>` sobre la unión de claves. Agregar la clave sin registrarla **no compila**.

**Ejemplos.**
- `siteKinds` en `lib/sites.ts` define los tipos de sitio; `Record<SiteKind, PanelKind>` en `app/panel/[site]/kinds.tsx` define qué trae el panel de cada uno (`sections`, `provider`).
- La tabla `sites` define qué sitios existen; `lib/site-registry.ts` la lee.

**Para un tipo nuevo:** una entrada en `siteKinds`, una en `panelKinds` (que importa `modules/<m>/panel.tsx`), sus pantallas en `modules/<m>/ui/` montadas desde `app/panel/[site]/<sección>/` y su árbol público en `app/<tipo>/[site]/`.

**No usar** para configuración que cambia sola de un entorno a otro; eso va en variables de entorno.

---

## 2. Repositorio con alcance por sitio

**Problema.** Los datos de varios clientes viven en las mismas tablas y el servidor usa la clave secreta, que **se salta RLS**. Un `site_id` olvidado en una consulta filtra o pisa datos de otro sitio.

**Solución.** Nadie arma consultas a mano contra una tabla de un sitio. Se obtiene un acceso ya acotado: `siteTable<Row>("tabla", siteId, mensaje)`. Esa capa antepone `site_id=eq.<id>` a toda consulta, marca todo cuerpo de escritura con el sitio y **falla** si el llamador intenta fijar otro `site_id`.

**Ejemplo real.** `lib/site-table.ts`, usado por `lib/recipe-store.ts` y `lib/comment-store.ts`.

```ts
const comments = (siteId: string) => siteTable<Row>("recipe_comments", siteId, "Falta la tabla…");
await comments(siteId)(`recipe_id=${eq(recipeId)}&status=eq.approved&select=*`);
```

**Reglas.**
- Toda función de un almacén recibe `siteId` **como primer argumento**. Una función que lee por `id` global (`listApprovedComments(recipeId)`) es un error.
- Las funciones SQL (`rpc`) reciben `p_site` y filtran por él.
- Tablas nuevas de un sitio: columna `site_id text not null references public.sites(id)`.

**Documentos.** Un documento de `app_data` que pertenece a un sitio se accede igual, por `siteDocument("products", siteId)`: la clave la arma esa capa.

**No usar** para tablas que no pertenecen a un sitio (`sites`, `site_domains`).

---

## 3. Respaldo ante lo que falta (degradar, no caer)

**Problema.** El esquema se corre a mano, así que el código nuevo puede desplegarse **antes** de que exista la tabla o la columna. Y Supabase puede no responder.

**Solución.** Lo que es necesario para que el sitio se vea tiene un respaldo; lo opcional se omite con aviso.
- Registro de sitios: si la tabla falta, está vacía o no responde → `seedSites` de `lib/sites.ts` (`lib/site-registry.ts`).
- Columnas nuevas: se leen como opcionales y solo se envían cuando importan (`recipe-store.ts`: `images`, `moments`, `published_at`).
- Métricas y contadores: **nunca rompen la página** (`metric-store.ts`: `trackMetric` atrapa el error y avisa una vez).

**Reglas.**
- El aviso se emite una vez por ventana (no un log por visita) y dice qué falta y qué archivo correr.
- Si una operación **no puede** funcionar sin el cambio de esquema (por ejemplo, guardar fotos adicionales), falla con un mensaje que dice exactamente qué hacer. No degrada en silencio una escritura.

**No usar** para pagos, cupos ni nada que mueva dinero: ahí un fallo debe ser explícito (ver patrón 11).

---

## 4. Control de versión optimista (`revision`)

**Problema.** Dos personas editan lo mismo (o la misma persona en dos pestañas) y la última pisa a la primera sin darse cuenta.

**Solución.** Cada documento o fila lleva `revision`. El cliente manda la revisión que leyó; el servidor actualiza **solo si coincide**, en **una sola sentencia** (`UPDATE … WHERE revision = $leída`). Si no actualizó nada, hay conflicto y se le pide recargar. Nunca "leer, comparar y escribir" en pasos separados.

**Ejemplos.** `saveDocument` en `lib/supabase.ts`; `saveRecipe` / `write` en `lib/recipe-store.ts`; la función SQL `save_catalog`. El error de conflicto se traduce a HTTP 409 (`*ConflictError` → `failure()` del route handler).

**No usar** para contadores (`views`): ahí el incremento atómico es mejor (patrón 12).

---

## 5. Núcleo puro + cáscara con efectos

**Problema.** La lógica que decide (validar, calcular, armar textos) mezclada con red y base es lenta de probar y frágil.

**Solución.** La decisión va en funciones puras, sin `next/*` ni fetch, con tests. Los almacenes solo traducen fila ⇄ objeto y llaman a la base. En el código nuevo: `modules/<m>/domain/` (puro) y `modules/<m>/data/` (almacén). En el legado: `lib/<dominio>.ts` y `lib/<dominio>-store.ts`.

**Ejemplos.** `lib/recipes.ts` + `lib/recipe-store.ts`; `lib/products.ts` + `lib/product-store.ts`; `lib/panel-access.ts` (puro) usado por el menú y las rutas.

**Reglas.**
- Un archivo de `lib/` que lo cargan los tests importa a sus pares **con extensión `.ts`** (`from "./catalog.ts"`).
- Si una función pura necesita algo de `next/*`, separarla (por eso `lib/preview.ts` existe aparte de `lib/auth.ts`).
- Calcular en el servidor, **nunca confiar en un valor calculado por el cliente** (precios, descuentos, cupos, montos).

---

## 6. Proveedor de datos por tipo + resumen del servidor al cliente

**Problema.** El panel de cada tipo necesita sus datos cargados una vez y compartidos por todas sus pantallas, y los componentes cliente no pueden consultar el registro de sitios.

**Solución.**
- Cada tipo tiene un contexto (`catalog-context`, `recipes-context`, `products-context`) que carga, refresca (al volver el foco y cada 30 s, solo con la pestaña visible y salvo que se esté editando) y guarda. Lo elige `panelKinds[kind].provider`.
- El layout (servidor) arma un **resumen** del sitio (`SiteSummary`: id, nombre, tipo, url, ícono, opciones) y lo entrega al shell, que lo publica con `SiteContext` / `useSite()`. **Los componentes cliente no importan la lista de sitios.**
- Cuando un proveedor tiene `key={site.id}`, al cambiar de sitio se descarta la lista cargada: los datos de un sitio nunca pueden guardarse en otro.

**No usar** para datos que cambian por visita; eso se consulta desde el servidor en la página.

---

## 7. Salir de un formulario sin perder trabajo (`flushRef`)

**Problema.** Guardar solo con el botón, pero no perder cambios al navegar o cambiar de sitio.

**Solución.** `SaveForm` (`app/save-form.tsx`) guarda **solo con el botón**; al salir con cambios pregunta (guardar, descartar o seguir). El formulario abierto registra su "guardar si hace falta" en `flushRef`. Quien cambie de pantalla llama antes a `flushRef.current()` y sigue **solo si devuelve `true`**. No volver a agregar guardado automático.

---

## 8. Route handler del panel

**Problema.** Cada API repite la misma defensa y las mismas respuestas de error.

**Solución.** Todos los route handlers de administración siguen esta forma (ejemplo completo: `app/api/sites/[site]/products/route.ts`):

1. `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`
2. Lecturas: `if (!await isAdmin())` → 401. Escrituras: `if (!sameOrigin(request) || !await isAdmin())` → 403.
3. Resolver el sitio con `getSite()` y comprobar su `kind`; si no existe o es de otro tipo → 404.
4. Limitar el tamaño del cuerpo (`body.length`) → 413.
5. Un `failure(error, acción)` único: los errores de validación y conflicto van al usuario tal cual (400/409); los de Supabase se registran con prefijo (`[products]`) y se resumen.
6. Respuestas de lectura con `Cache-Control: no-store`.

---

## 9. Migración idempotente

**Problema.** El esquema se aplica a mano en producción y puede correrse más de una vez.

**Solución.** Todo cambio se **agrega al final** de `supabase/schema.sql` y es seguro de repetir: `create … if not exists`, `create or replace`, `drop trigger if exists`, `insert … on conflict do nothing`, `add column if not exists`. Los datos sembrados usan `on conflict do nothing` para no pisar lo que el panel cambió. Las claves foráneas sobre datos viejos se agregan `not valid` y se validan aparte.

**Regla.** El código tiene que seguir andando **antes** de que se corra el archivo (patrón 3).

---

## 10. Resolver por host

**Problema.** Un mismo deploy atiende muchos dominios.

**Solución.** Solo `proxy.ts` conoce los hosts. El resto del código trabaja con `siteId` / `site.kind` y no lee `Host`. Las páginas reciben el sitio por el parámetro de ruta `[site]`.

**Regla.** Una cookie de sesión **no** lleva `Domain=` (ver [ARCHITECTURE.md §7](ARCHITECTURE.md)).

---

## Patrones del sauna (a construir así)

## 11. Reserva transaccional con bloqueo **(para el sauna)**

**Problema.** Dos personas reservan el último lugar al mismo tiempo; o se cobra una seña por un cupo que ya no existe.

**Solución.** Tomar un cupo es **una función SQL** (`rpc`) que bloquea la fila de la sala (`select … for update`), cuenta los lugares ocupados por reservas vigentes en el momento más lleno de ese horario, porque los turnos de distinta duración se pisan, y crea la reserva en estado `held` con vencimiento, todo en una transacción. El cliente nunca decide si hay lugar. Un `held` vencido libera el cupo (por consulta, no por tarea programada: el cupo disponible siempre excluye los `held` vencidos).

**Carga manual (S2d).** La misma operación transaccional admite una entrada exclusiva del panel que fija estado confirmado, sin vencimiento ni seña y sin registrar pagos o aceptación del cliente. La RPC pública fija el modo público; no recibe un modo del navegador. Una clave por sitio serializa los reintentos antes del bloqueo de configuración y sala y devuelve la reserva existente cuando el pedido coincide. El precio esperado del navegador solo detecta conflictos; el importe real se calcula bajo bloqueo del tipo. Detalle y límite de la migración sin ejecutar: [SAUNA.md §5](SAUNA.md#5-modelo-de-datos).

**Regla.** Las modalidades compartida/completa usan el mismo mecanismo: una reserva completa ocupa todos los lugares del turno.

## 12. Operaciones atómicas e idempotentes **(para el sauna)**

**Problema.** Los webhooks de pago se repiten, llegan desordenados o se reintentan; los códigos tienen límite de usos.

**Solución.**
- Un webhook **no confía en su cuerpo**: verifica la firma, vuelve a pedir el pago al proveedor por su id y recién ahí actúa.
- Cada pago tiene una clave de idempotencia (`provider_ref` único); procesar dos veces el mismo aviso no duplica nada.
- Lo que se consume y no se devuelve solo se descuenta con una sola sentencia condicional: `update … set stock = stock - 1 where id = $1 and stock > 0 returning …`. Si no devuelve fila, no había disponibilidad.
- Lo que un vencimiento puede devolver **no se guarda como contador**: los cupos, los usos de un código y las sesiones de un pack se cuentan por consulta, bloqueando la fila dueña (`select … for update`) en la misma transacción. Un contador exigiría una tarea programada para devolver lo vencido (patrón 11).

## 13. Instantánea de reglas al comprar **(para el sauna)**

**Problema.** Si el cliente cambia después el precio, la seña o la política de cancelación, no puede cambiar lo que ya se prometió.

**Solución.** La reserva guarda una **copia** de lo que aplicaba al reservar (precio, seña, descuento, política de cancelación) en columnas o en un `jsonb`. Los cálculos posteriores (reintegro, informes) leen la copia, no la configuración vigente.

## 14. Dinero en enteros **(para el sauna)**

Los montos se guardan en **centavos enteros** (`amount_cents bigint`), nunca en decimales ni en `float`. `integer` llega solo a unos 21 millones de pesos, poco para un pack con la inflación argentina. El formateo a pesos se hace solo al mostrar. Un porcentaje se aplica con redondeo definido en un único lugar (`percentOf` en `platform/money/`, con tests): la mitad exacta de un centavo redondea hacia arriba. La función SQL `sauna_percent_of` repite la misma fórmula entera y un test cuida que coincidan.

## 15. Libro de movimientos **(para el sauna)**

Los pagos y reintegros son **filas que se agregan**, no campos que se editan: un pago, un reintegro parcial y otro reintegro son tres filas. El saldo de una reserva se calcula sumando. Así el historial es auditable y no se puede "corregir" un monto sin dejar rastro.

---

## Estructura y estilos

## 16. Módulo por funcionalidad con entradas públicas

**Problema.** Organizado por tipo de archivo, tocar una funcionalidad obliga a editar siete carpetas (así está "recetas" hoy), y nada impide que una pantalla importe un detalle interno de otra.

**Solución.** Todo lo de una funcionalidad vive en `modules/<m>/`, dividido por **responsabilidad** (`domain`, `data`, `api`, `ui`) y con **entradas públicas separadas por entorno**: `index.ts` (cliente seguro: tipos y dominio), `server.ts` (servidor), `panel.tsx` (registro del panel), `ui`. Se importa solo hacia abajo (`app → modules → platform → shared`) y un módulo no importa a otro. `eslint` lo hace cumplir.

**Por qué entradas separadas y no una `index.ts` única:** en Next, un archivo que mezcla código de servidor y de cliente puede arrastrar secretos o consultas a Supabase al navegador. El archivo `server.ts` lleva `import "server-only"` y el build falla si un componente cliente lo importa.

**Ejemplo.** `modules/sauna/`. La estructura completa está en [ARCHITECTURE.md §4.1](ARCHITECTURE.md).

**No usar** para el código legado: no se migra. Ni para una utilidad suelta: eso es `shared/lib/`.

---

## 17. Entidad sin clases: tipos + funciones puras + transición de estados

**Problema.** Querer el orden de la programación orientada a objetos (una "reserva" que sabe qué puede hacer y qué no) sin usar clases, que en Next no pasan del servidor al navegador (solo cruzan objetos simples serializables).

**Solución.** La entidad es un **tipo de datos plano** y sus reglas son **funciones puras** en `domain/`, con un vocabulario del negocio. Los cambios de estado pasan por **una sola función de transición** que rechaza los inválidos; nadie asigna `booking.status = …` a mano.

```ts
// modules/sauna/domain/booking.ts (forma, no código final)
export type BookingStatus = "held" | "pending_transfer" | "confirmed" | "cancelled" | "expired" | "completed" | "no_show";
export type Booking = { id: string; status: BookingStatus; seats: number; totalCents: number; depositCents: number /* … */ };

const allowed: Record<BookingStatus, BookingStatus[]> = {
  held: ["pending_transfer", "confirmed", "expired", "cancelled"],
  pending_transfer: ["confirmed", "expired", "cancelled"],
  confirmed: ["cancelled", "completed", "no_show"],
  expired: ["confirmed"], // only a late payment, when the seat is still free
  cancelled: [], completed: [], no_show: [],
};
export function transition(booking: Booking, to: BookingStatus): Booking {
  if (!allowed[booking.status].includes(to)) throw new InvalidTransitionError(booking.status, to);
  return { ...booking, status: to };
}
```

**Equivalencias con el vocabulario de objetos** (para quien lo piense así): *entidad* = tipo + `id`; *objeto de valor* = tipo inmutable sin `id` (`Money`, `Deposit`); *agregado* = la reserva con sus pagos, que se modifica entera y por una sola puerta (`transition`); *repositorio* = `data/`; *servicio* = función de `domain/` que combina entidades.

**Reglas.** Las transiciones y los cálculos tienen test (todos los caminos válidos y al menos un inválido por estado). La base **también** valida (la función SQL que cambia el estado comprueba el estado anterior en la misma sentencia): el dominio puro protege la interfaz, la base protege los datos.

---

## 18. Tema por variables

**Problema.** Cada tipo de sitio (y cada sitio) tiene su propia identidad visual, y hacerlo con un archivo CSS por sitio duplicó miles de líneas.

**Solución.** Los componentes usan **tokens semánticos** (`bg-surface`, `text-ink`, `bg-accent`) definidos en `@theme`. Un **tema** es un bloque de `globals.css` que redefine los valores (`[data-theme="panel"] { … }`) y se activa con `data-theme` en la raíz del layout. Lo que cambia por sitio viene de la base y se aplica como variable en esa misma raíz (`--color-accent` desde `sites.options`).

**Reglas.** Un componente nunca sabe en qué tema está. Se prueba cambiando `data-theme`. Un color guardado en la base debe cumplir contraste 4,5:1 con su texto. Detalle y valores actuales: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).
