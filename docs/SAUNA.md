# Sauna: especificación

Fropexio es un sitio de reservas con cupos, pago de seña online, packs de sesiones, códigos y políticas de cancelación. Es el primer sitio de tipo `sauna` (id `fropexio`) y el primero que guarda **datos de personas y dinero**; por eso tiene sus propios patrones (11 a 15 de [PATTERNS.md](PATTERNS.md)).

El orden de construcción está en [ROADMAP.md](ROADMAP.md) (fases S1 a S7). Este archivo define **qué** se construye. El modelo de datos de §5 quedó confirmado en la fase S1 y está en `supabase/schema.sql`. Las tablas ya existen en la base, pero **las funciones SQL todavía no corrieron completas con datos**: solo se probaron sus caminos de rechazo ([ROADMAP.md](ROADMAP.md), registro de S2).

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Modalidades | **Individual o grupal.** El módulo es para dos personas y no se junta a desconocidos en un espacio tan chico: **una reserva, de cualquier modalidad, ocupa la sala** en todo su horario. En el código, `shared` es individual y `private` es grupal. |
| Pago de la seña | **Mercado Pago** (confirmación automática por webhook) **y transferencia manual** (alguien marca la reserva como pagada en el panel). El cliente final elige. |
| Códigos | Descuento en porcentaje, descuento de monto fijo, **reserva sin pagar seña**, y **pase gratis / cortesía**. |
| Planes | Varios turnos a un precio fijo, elegidos todos juntos antes de pagar, uno por día y dentro de una ventana de días. Seña sobre el total. Reemplazan a los packs. Ver §11. |
| Apertura | El sitio toma reservas desde una fecha configurable (Configuración → Reservas, "Reservas desde"). Antes de esa fecha los turnos se muestran pero no se pueden reservar (`not_open_yet`); el panel sí puede cargar reservas manuales. |
| Quién reserva | **Invitado:** nombre y WhatsApp, sin cuenta. Se identifica por un enlace secreto de su reserva. La tabla de clientes queda lista para sumar cuentas después sin migrar. |
| Avisos | **WhatsApp con enlace precargado** (`wa.me`): el panel arma el mensaje y quien atiende lo envía con un toque. No hay envío automático. |
| Cancelación | **Políticas configurables desde el panel**, por sitio. Cancela siempre quien atiende, y puede **reintegrar una parte** de lo cobrado y no necesariamente todo. Ver §7. |
| Panel | Un solo panel (BetaOmega). Por ahora entran el dueño del proyecto y el cliente con acceso total; las secciones ya llevan su permiso para cuando haya operadores. |
| Dónde vive | Tipo de sitio `sauna` en la misma app, con su dominio registrado igual que Ñekurel, Comidas del cielo y Purificación. El sauna es de **primer nivel**: se construye antes que los permisos y recibe más cuidado de pruebas que los demás sitios. |

## 2. Qué ve cada persona

**Quien reserva (sitio público).**
1. Conoce el lugar en la portada (§12).
2. Elige fecha → ve los turnos del día con lugares libres y precio.
3. Elige modalidad: individual o grupal, según lo que ofrezca el turno.
4. Deja nombre y WhatsApp, y opcionalmente un código.
5. Ve el resumen: precio, descuento, seña a pagar, saldo a pagar en el lugar, y la política de cancelación que aplica. Un aviso junto al botón dice que, al reservar, acepta los términos y declara ser mayor de 18 años.
6. Paga la seña con Mercado Pago, o elige transferencia y recibe el alias y las instrucciones.
7. Queda en una página de su reserva (`/reserva/<token>`) con el estado y los botones de WhatsApp para consultar o pedir la cancelación.

Quien reserva un plan sigue el camino de §11.

**Quien atiende (panel).**
- **Agenda:** vistas de día, semana y mes, con quién viene y qué falta pagar. La semana es una grilla de horarios; al elegir un horario o un día aparece un panel lateral (debajo en celular) para marcarlo como **ocupado** o liberar su cierre completo. Distingue días ocupados enteros o en parte. Las reservas ya hechas no se cancelan. Al elegir hoy permite **no habilitar más turnos por hoy**, con confirmación; los horarios pasados son de solo lectura.
- **Reservas:** búsqueda y detalle; confirmar transferencia; cancelar con reintegro total, parcial o ninguno; ver pagos sin cupo; botones de WhatsApp (confirmación, recordatorio, cancelación).
  - **Lista (2026-11-10, rehecha el mismo día):** un select de estado con la cantidad de cada opción: **Todas** por defecto (lo que viene por fecha y después lo pasado), **Para resolver** (seña o transferencia por confirmar, pago para devolver, turno empezado sin asistencia; primero lo que vence antes), **Próximas** (confirmadas por delante, por fecha), **Pasadas**, **Canceladas y vencidas**. Las pestañas usan el estado real de cada turno (una retención vencida es vencida), por eso se aplican en la ruta y no en la consulta. Una fila por compra: un turno suelto o **un plan entero**, que se abre para manejar cada turno (`domain/booking-groups.ts`). La fila se lee por el turno que importa en esa pestaña; dice el cobro en una frase (devolver, falta la seña, cobrar en el lugar, pagado) y trae su acción principal (confirmar transferencia, confirmar, asistió) sin abrirse. Tabla en escritorio y tarjetas en el celular, 20 filas por página, filtro por tipo (turnos sueltos o planes). Tocar el nombre de alguien muestra todas sus reservas. Búsqueda, estado y tipo son tres campos de la misma altura en una fila. **Colores, con una sola regla en todo el panel del sauna:** verde es confirmada (token `success`, aparte del acento, que en el panel es azul), azul es pagado, ámbar es que falta algo de alguien (retenida, espera transferencia, falta la seña, falta marcar asistencia), rojo es que se cayó o hay que devolver (cancelada, devolver un pago) y gris es terminado (asistió, no vino; vencida en gris punteado). Todos los estados son la misma píldora con su ícono y su palabra. Lo que dice qué es algo y no cómo va (el nombre del plan, un código) no lleva color de estado: etiqueta con borde. Una leyenda bajo la tabla lo recuerda.
- **Reservas manuales (S2d, puntos 1–4):** desde un horario futuro y libre de Semana, o desde el día seleccionado en Día/Mes, **Crear reserva** consulta los turnos disponibles y permite elegir uno con su inicio, fin y tipo. Es la acción principal; ocupar queda como secundaria. La disponibilidad se comprueba para la duración completa del turno. **Cargar datos** abre en el mismo panel lateral el formulario de modalidad, nombre y WhatsApp argentino, con duración, precio y saldo sin pagos. **Revisar reserva** valida y normaliza los datos; se puede seguir editando o cambiar de turno sin perderlos. El borrador queda solo en memoria y salir o descartarlo pregunta antes de perder datos. **Confirmar reserva** llama a la operación atómica del panel: reserva confirmada, total pendiente y aceptación del cliente pendiente, sin pagos. Se bloquean envíos y navegación durante el pedido; los errores conservan los datos. La migración está preparada sin aplicar; falta el resultado completo y la verificación del punto 5 en [el plan de S2d](tareas-reservas-manuales.md).
- **Horarios y precios:** una sola página, primero tipos de turno (duración, precios individual y grupal, seña propia y general) y después horarios (días abiertos, franjas, tipos ofrecidos, personas en el módulo e intervalo de inicio). Cada parte tiene su propio Guardar y Descartar; guardar una conserva la edición de la otra y salir pregunta por ambas en orden. Un tipo nuevo se puede elegir en las franjas después de guardarlo. Para cobrar distinto según día o franja se crea otro tipo. El ejemplo de inicios se actualiza con el intervalo y avisa si los turnos se superponen. Los cierres se cargan desde la Agenda, por un horario o un día por clic; se pueden ver y liberar completos los cierres de varios días existentes.
- **Planes:** crear y editar los planes de varios turnos (§11).
- **Códigos:** crear y editar (texto, tipo, valor, máximo de usos total y por persona, vigencia por días, restricción a un tipo de turno, nota, activo), ver cuántas veces se usa (reservas vigentes, como cuenta `sauna_reserve`) y si está vigente, vencido o agotado. No se borran: se desactivan. La restricción a sala existe en el modelo pero el panel no la ofrece, porque hay una sola sala.
- **Políticas de cancelación.**
- **Pagos:** movimientos de cada reserva o pack (señas, reintegros).
- **Sitio:** textos, WhatsApp de contacto, datos de transferencia, retenciones y anticipación, estado de la conexión con Mercado Pago.

## 3. Estados de una reserva

```
            reservar (cupo tomado, vence)
                     │
                     ▼
                  ┌──────┐   vence sin pagar        ┌─────────┐
                  │ held │ ──────────────────────► │ expired │
                  └──┬───┘                         └────┬────┘
       pagó (MP) /   │  eligió transferencia            │ pago tardío
       código sin    │         │                        │ con cupo libre
       seña / gratis │         ▼                        │
       / pack        │   ┌──────────────────┐  vence    │
                     │   │ pending_transfer │ ──► expired
                     │   └────────┬─────────┘           │
                     │            │ operador confirma   │
                     ▼            ▼                     │
                  ┌───────────────────┐ ◄───────────────┘
                  │     confirmed     │ ──cancela──► cancelled (reintegro total, parcial o ninguno)
                  └─────────┬─────────┘
                            │ pasó el turno
                            ▼
                 ┌───────────────┐   o   ┌─────────┐
                 │   completed   │       │ no_show │
                 └───────────────┘       └─────────┘
```

- `held` y `pending_transfer` **ocupan cupo** hasta que vencen, y también se pueden cancelar antes. Un vencido libera el lugar por consulta (ver patrón 11), sin tarea programada.
- Una reserva `confirmed` sin seña (por código), gratis o con una sesión de pack nunca pasa por el cobro.
- **Carga manual del panel:** se crea como `confirmed`, sin vencimiento de retención (`expiresAt = null`), sin seña exigida y sin movimientos de pago. El precio completo queda pendiente; un precio configurado en cero deja saldo cero sin crear un pago. Confirmar toma el turno, no significa cobrarlo. S2d punto 4 conecta una única RPC atómica; la migración está preparada al final de `schema.sql` y todavía no se ejecutó. El punto 5 sigue pendiente.
- Todo cambio de estado deja una fila en el historial (quién, cuándo, de qué a qué).
- **Vencimiento sin tarea programada.** Nadie cambia el estado guardado cuando vence una retención, así que una fila puede decir `held` y estar vencida. Toda decisión y toda pantalla leen el estado efectivo (`effectiveStatus` en `domain/booking.ts`).
- **Pago tardío.** Si un pago aprobado llega con la reserva vencida, siempre se registra el movimiento y se vuelve a comprobar el turno bajo bloqueo:
  - Si el turno no empezó, no está cerrado y el cupo sigue libre, la reserva pasa a `confirmed`.
  - Si no, queda `expired` y marcada como **pago sin cupo**. El panel la muestra para hacer el reintegro manual.
- **Dinero que no se puede aplicar.** Un pago por otro monto, o sobre una reserva ya confirmada, cancelada o terminada, no cambia el estado. El movimiento se registra igual y la reserva queda marcada con `needs_refund`, igual que un pago sin cupo. La marca se quita sola cuando los reintegros devuelven lo que sobraba.

## 4. Reglas de negocio

- **Cupo.** Una reserva vigente de cualquier modalidad llena la sala: `sauna_peak_seats` devuelve toda la capacidad si algo se pisa con el horario pedido. Una individual guarda `seats = 1`; una grupal, la capacidad. La API no acepta otra cantidad.
- **Precio.** Individual: el precio por persona. Grupal: el precio de la sala. Vienen del tipo de turno, y un tipo que no tiene uno de los dos precios no ofrece esa modalidad. Pueden variar por día o franja, eligiendo otro tipo en esa franja. Se calcula **siempre en el servidor** y se guarda en la reserva (patrón 13).
- **Seña.** Siempre es un **porcentaje del precio**, entre 0 y 100. Hay un valor por sitio que cada tipo de turno puede sobrescribir, ambos editables desde el panel. No hay seña de monto fijo. La carga manual se confirma sin exigir seña (`depositCents = 0`), sin que eso registre un pago.
- **Tipos de turno.** Cada tipo define su duración, por ejemplo 45 y 60 minutos, y la persona elige cuál quiere a la misma hora. Un turno empieza cada tantos minutos desde el inicio de la franja (30 por defecto) y tiene que terminar dentro de ella.
- **Turnos que se pisan.** Una reserva de 60 minutos a las 10:00 deja sin ofrecer el turno de 45 de las 10:30, de cualquier modalidad. Ninguna reserva nueva puede tocar el horario de otra vigente.
- **Código.** Se valida **al reservar**, en la misma transacción que toma el cupo. Orden de aplicación: primero el descuento sobre el precio, después se calcula la seña sobre el precio ya descontado. Tipos:

  | Tipo | Efecto |
  |---|---|
  | `percent` | Resta un porcentaje del precio. |
  | `fixed` | Resta un monto (nunca deja el precio por debajo de cero). |
  | `no_deposit` | La reserva se confirma sin cobrar seña; el total queda a pagar en el lugar. |
  | `free` | Precio cero; se confirma sin cobro. Siempre con límite de usos. |

  Cada código tiene: texto único por sitio (sin distinguir mayúsculas), vigencia (desde/hasta), máximo de usos total, máximo de usos por persona, restricción a un turno o sala, activo/inactivo y una nota interna ("regalo de cumpleaños de Ana"). El máximo por persona y la restricción son opcionales.
- **Usos de un código.** Se **cuentan por consulta** bajo bloqueo de la fila del código: valen las reservas vigentes que lo usan. Una reserva vencida o cancelada devuelve el uso, sin tarea programada. Si un pago tardío confirma una reserva vencida, se respeta el precio ya guardado aunque el código se haya agotado.
- **Límite por persona.** Se cuenta por WhatsApp, que no se verifica: **desalienta el abuso pero no lo impide**. Para algo que deba ser estricto se usa un código de un solo uso.
- **Hora.** Los turnos se guardan en `timestamptz` y se muestran en `America/Argentina/Buenos_Aires`.
- **Anticipación.** Se puede reservar hasta **1 hora antes** del turno y hasta **60 días** hacia adelante. Ambos valores son configurables por sitio.
- **Cierre del día.** "No habilitar más turnos por hoy" crea un cierre desde ahora hasta el final del día. Un cierre impide reservas nuevas (`sauna_reserve` lo comprueba también, no solo la disponibilidad) y **no cancela las ya hechas**.
- **Términos.** Al reservar o comprar un pack, la persona acepta los términos y declara tener 18 años o más. Por pedido del dueño del proyecto no hay casilla: lo dice un aviso visible junto al botón, y apretarlo es la aceptación. Se guarda la versión aceptada y la fecha. La revisión legal de S7 tiene que confirmar que alcanza.
- **WhatsApp.** Solo números argentinos: el campo trae el +54 fijo y la API rechaza otro país. **No se guardan datos de salud.**

## 5. Modelo de datos

Código en `modules/sauna/` (ver [ARCHITECTURE.md §4.1](ARCHITECTURE.md)): reglas puras en `domain/`, consultas y funciones SQL en `data/`, pantallas solo con Tailwind en `ui/` ([DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)). Las secciones del panel usan estos nombres de ruta: `agenda`, `reservas`, `horarios-precios`, `packs`, `codigos`, `politicas`, `pagos` y `ajustes` (la sección "Sitio" de §2), únicos en todo el panel. Las antiguas rutas `horarios` y `precios` se quitaron sin redirección.

Todas las tablas llevan `site_id` con clave foránea a `sites(id)`, RLS activado y sin acceso para `anon`/`authenticated` (convención). Montos en centavos enteros (`bigint`). Las claves foráneas entre estas tablas incluyen `site_id`, así que la base impide que una fila apunte a otro sitio. Salas, horarios, códigos y planes se desactivan, no se borran.

| Tabla | Para qué | Campos clave |
|---|---|---|
| `customers` | Persona que reserva (genérica, la pueden usar otros tipos). | `name`, `whatsapp` (internacional, solo dígitos; `cleanWhatsapp`), `created_at`, `anonymized_at`. Único por `(site_id, whatsapp)`. Una persona ya registrada conserva su nombre: el número no se verifica, así que el pedido de otro no puede renombrarla. |
| `sauna_settings` | Configuración del sitio (una fila por sitio). | `deposit_percent`, `min_lead_minutes` (60), `max_advance_days` (60), `mp_hold_minutes` (15), `transfer_hold_hours` (12), `terms_version`, `contact_whatsapp`, `start_step_minutes` (30), `revision`. |
| `sauna_rooms` | Sala. El panel maneja una sola: se crea sola al guardar los horarios y su cupo sigue al de los turnos. El modelo admite más, por si hiciera falta. | `name`, `capacity`, `active`. |
| `sauna_turn_types` | Lo que se vende. Un tipo que se quita queda inactivo, porque hay reservas que lo nombran. | `name`, `duration_minutes`, `price_cents`, `private_price_cents` (al menos uno), `deposit_percent` (opcional: si falta, usa el del sitio), `active`, `revision`. |
| `sauna_time_bands` | Franjas de cada día. Se reemplazan juntas al guardar la semana. | `room_id`, `weekday` (0 = domingo), `start_time`, `end_time`. |
| `sauna_band_types` | Qué tipos ofrece cada franja. | `band_id`, `turn_type_id`. |
| `sauna_schedules` | **Sin uso.** Una fila por turno, del modelo anterior; `schema.sql` migró sus datos una vez a tipos y franjas, y se conserva solo como historial. | `room_id`, `weekday` (0 = domingo), `start_time`, `duration_minutes`, `mode` (`shared`/`private`/`either`), `capacity`, `price_cents`, `private_price_cents` (cada precio es obligatorio solo si el modo lo ofrece), `deposit_percent` (opcional: si falta, usa el del sitio), `active`. |
| `sauna_closures` | Rangos ocupados: un horario, un día, cierres de varios días existentes o "no más turnos por hoy". Impiden reservas nuevas aunque solo se superpongan en parte; no cancelan las hechas. Desde el panel se libera siempre el rango completo. | `room_id` (vacío = todas), `starts_at`, `ends_at`, `reason`. |
| `sauna_slots` | Turno concreto: una sala, un inicio y un tipo. **Se crea al primer uso** (la función de reserva lo inserta si no existe). Sirve de registro: lo que se ofrece sale de las franjas y lo que se prometió queda en la reserva. | `room_id`, `turn_type_id`, `starts_at`, `ends_at`, `mode`, `capacity`, precios y seña de ese momento. Único por `(site_id, room_id, starts_at, turn_type_id)`. |
| `sauna_bookings` | La reserva. | `slot_id`, `customer_id`, `seats`, `kind` (`shared`/`private`), `status`, `price_cents`, `discount_cents`, `deposit_cents`, `code_id`, `pack_purchase_id`, `pack_session_returned`, `policy_snapshot jsonb`, `terms_version`, `terms_accepted_at` (nulo en carga manual), `origin` (`public`/`panel`), `manual_request_id` (único por sitio para reintentos), `token`, `expires_at`, `needs_refund`, `origin_hash` (hash con clave del origen, para limitar reservas; anonimizar lo vacía). |
| `sauna_pack_plans` | Packs a la venta. | `name`, `sessions`, `price_cents`, `valid_days`, `max_per_week`, `active`. |
| `sauna_pack_purchases` | Pack comprado. Copia las condiciones del plan (patrón 13). | `plan_id`, `customer_id`, `status`, `sessions`, `price_cents`, `valid_days`, `valid_until` (se fija al confirmar el pago), `max_per_week`, `policy_snapshot jsonb`, `terms_version`, `terms_accepted_at`, `token`, `expires_at`, `needs_refund`. |
| `booking_events` | Historial de estados de reservas y packs. | `booking_id` o `pack_purchase_id`, `from_status`, `to_status`, `actor`, `note`, `created_at`. |
| `payments` | Libro de movimientos (patrón 15). Un disparador impide editar o borrar montos: solo se pueden vaciar `raw` y `note`, porque anonimizar lo necesita. | `booking_id` o `pack_purchase_id` (exactamente uno), `method` (`mercadopago`/`transfer`/`cash`), `kind` (`deposit`/`balance`/`pack`/`refund`), `amount_cents` (siempre positivo), `provider_ref` (único por sitio), `actor`, `note`, `raw jsonb`. No lleva `status`: solo registra dinero que se movió, y un pago rechazado no es una fila. |
| `discount_codes` | Códigos. Los usos no se guardan: se cuentan. | `code` (único por sitio sin distinguir mayúsculas), `type`, `value` (porcentaje o centavos), `max_uses` (obligatorio en `free`), `max_uses_per_customer`, `room_id`, `schedule_id`, `valid_from`, `valid_until`, `active`, `note`. |
| `sauna_code_attempts` | Intentos fallidos de un código por origen (S4), para limitar quien prueba códigos. | `origin_hash` (hash con clave, nunca la dirección), `created_at`. Sin el texto probado; se borra lo de más de un día. |
| `sauna_mercadopago_accounts` | La cuenta de Mercado Pago donde cobra el sitio, conectada desde el panel (§6). Una por sitio. | `user_id`, `nickname`, `access_token` y `refresh_token` **cifrados**, `expires_at`, `live_mode`, `connected_at`. |
| `cancellation_policies` | Políticas configurables. | `name`, `rules jsonb` (la lista de tramos de §7), `active`, `is_default` (una sola por sitio). |

**Funciones SQL (todas con `security invoker`, `search_path` vacío).** Los bloqueos conservan el orden compra de pack → sala → código → reserva. La creación toma antes un bloqueo compartido de configuración y, después de la sala, uno compartido del tipo para estabilizar semana, capacidad y precio. La carga manual toma primero un bloqueo de transacción por sitio y clave de pedido; las demás operaciones no lo toman. Se bloquea la sala y no el turno, porque los turnos de distinta duración se pisan y compiten por los mismos lugares.
- `sauna_peak_seats(site, room, from, to)` devuelve los lugares ocupados en el momento más lleno de un horario. Solo es confiable bajo el bloqueo de la sala.
- `sauna_save_week(site, revision, capacity, step, bands)` guarda toda la semana en una transacción, con la revisión comprobada adentro, y crea la sala si no hay.
- `sauna_reserve(site, room, starts_at, turn_type, kind, seats, name, whatsapp, code, pack_token, terms_accepted)` bloquea la sala, comprueba que la semana ofrezca ese turno, los cierres y la anticipación, cuenta el cupo por solapamiento, valida el código, calcula montos y crea el turno si falta. Si la reserva usa una sesión de pack, bloquea la compra y comprueba saldo, vencimiento y máximo semanal. Crea la reserva en `held`, o en `confirmed` si no hay nada que cobrar. Devuelve la reserva o el motivo del rechazo (`reserveRejections`, en `domain/rejections.ts`).
- `sauna_reserve_manual(site, room, starts_at, turn_type, kind, name, whatsapp, request_id, expected_price)` comparte las reglas mediante `sauna_reserve_core`. Solo permite turnos futuros; exceptúa la anticipación mínima pública y mantiene horizonte y cierres. Calcula el precio desde el tipo y usa `expected_price` exclusivamente para detectar un cambio. Crea cliente, turno, reserva confirmada y evento en una transacción, sin pagos, seña ni vencimiento; deja `origin = panel`, `terms_accepted_at = null` y actor panel. La versión y política copiadas no significan aceptación. La clave de pedido por sitio tiene índice único y [bloqueo de transacción](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS): un reintento compatible devuelve la misma reserva. La entrada pública fija modo público y conserva sus reglas; el navegador nunca elige el modo de la RPC.
- `sauna_confirm_payment(site, booking, provider_ref, amount, method, actor, raw)` idempotente: registra el pago y lo aplica según §3. Devuelve qué pasó (`paymentOutcomes`, en el mismo archivo).
- `sauna_record_refund(site, booking, amount, method, ref, actor, note)` agrega un reintegro al libro, sin superar lo cobrado y en cualquier estado. Hace falta aparte de cancelar para los reintegros parciales sucesivos y para un pago sin cupo, que no se cancela.
- `sauna_cancel(site, booking, refund_cents, refund_method, return_session, note, actor)` cancela, libera el cupo, registra el reintegro y, si corresponde, devuelve la sesión del pack.
- `sauna_set_status(site, booking, to, note, actor)` hace los cambios de estado que no mueven dinero: confirmar a mano una retención vigente y marcar asistencia cuando el turno ya empezó. Una retención vencida no se confirma por acá: solo vuelve con un pago, bajo la regla de §3.
- `sauna_availability(site, from, to)` devuelve una fila por inicio y tipo, con sus lugares libres en el momento más lleno y si está cerrado, hasta 93 días por consulta.
- `sauna_manual_availability(site, from, to)` comparte `sauna_availability_core` con la pública y solo cambia la anticipación por inicio estrictamente futuro. Su API exige sesión de panel, admite sitios sin publicar y limita la consulta a 32 días inclusive. Las nuevas funciones se restringen a `service_role`. La migración S2d está preparada, **sin ejecutar en Postgres**.
- `sauna_anonymize_customer(site, customer)` aplica §9, punto 12. Además vacía las notas y las respuestas del proveedor de pagos asociadas a esa persona, que pueden identificarla.

**Quedan para la fase que las usa:**
- `sauna_buy_pack(...)` y `sauna_confirm_pack_payment(purchase, provider_ref, amount)`, y el reintegro y la cancelación de un pack entero: S4b.
- ~~Elegir transferencia: S3.~~ Hecho: `sauna_choose_transfer(site, booking, actor)` pasa una retención vigente con seña a `pending_transfer`, con `transfer_hold_hours` que nunca pasan del inicio del turno ni acortan lo que ya tenía. Bloquea la sala antes que la reserva, como el pago. Repetirla no cambia nada y rechaza con `transferRejections` si el sitio no tiene cuenta cargada. Migración al final de `schema.sql`, **sin ejecutar en Postgres**; agrega también `transfer_alias`, `transfer_cbu` y `transfer_holder` a `sauna_settings`.

## 6. Pagos

### Mercado Pago
- El dinero entra a la **cuenta del dueño del sauna**, y la comisión la absorbe esa cuenta: quien reserva paga el monto exacto de la seña o del pack.
- La reserva en `held` crea una **preferencia de pago** con `external_reference = booking.id` y `notification_url` al webhook del sitio. Se vuelve a la página de la reserva (`back_urls`). Los packs hacen lo mismo con su compra.
- **El webhook no se cree:** verifica la firma, **consulta el pago a Mercado Pago por su id** y compara referencia y monto con la reserva. Recién ahí llama a `sauna_confirm_payment`. Repetir el aviso no duplica nada (`provider_ref` único).
- La retención del cupo mientras se paga dura **15 minutos** (configurable). **La preferencia vence con la retención** (`expires` y `expiration_date_to` = `expires_at`, en hora argentina), usa `binary_mode` (aprobado o rechazado, nunca pendiente) y **excluye Rapipago, Pago Fácil y cajeros** (`ticket`, `atm`), que se acreditan horas después. Una cuota. Así un pago tardío es raro, y si llega igual se aplica la regla de §3.
- `external_reference = booking:<id>` (los packs usarán su propio prefijo). Cada clic crea una preferencia nueva: es inofensivo porque la que no se paga vence con la retención.
- Desde la página de la reserva, quien reserva elige **Pagar con Mercado Pago** o **Pagar por transferencia** (`POST /api/sites/<sitio>/sauna/reservations/payment` con el token y el medio; el monto lo pone el servidor). Una transferencia pendiente puede pasarse a Mercado Pago, y la preferencia vence con su retención de 12 horas.
- **Webhook:** `POST /api/sites/<sitio>/sauna/mercadopago`. Verifica `x-signature` (HMAC-SHA256 de `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con el secreto del sitio), consulta `GET /v1/payments/<id>` y solo aplica un pago `approved`, en `ARS` y con referencia de una reserva. Llama a `sauna_confirm_payment` con `provider_ref = mp:<id>`. Responde 401 a una firma inválida, 200 a lo que no hay que aplicar y 500 cuando Mercado Pago o la base fallan, para que Mercado Pago reintente.
- **Vuelta del checkout:** la página de la reserva recibe `payment_id` y lo consulta a Mercado Pago igual que el webhook, solo para esa reserva. La confirmación no depende de que el aviso llegue antes, y en local funciona sin webhook.
- En el libro (`raw`) se guarda solo id, estado, detalle, medio, fecha y monto del pago: **nada del pagador**.
- **Cuenta conectada desde el panel (OAuth).** La plataforma tiene una sola aplicación de Mercado Pago, con sus credenciales en el servidor ([ARCHITECTURE.md §9](ARCHITECTURE.md)). Cada sitio conecta la cuenta donde cobra desde **Configuración → Cobros**: **Conectar Mercado Pago** lleva a autorizar la aplicación y vuelve al panel; **Cambiar de cuenta** repite el camino y reemplaza la anterior; **Desconectar** deja de ofrecer el medio. Sin cuenta, el sitio no ofrece Mercado Pago.
  - **Seguridad del vínculo.** Esa cuenta es adonde va el dinero, así que vincularla no puede quedar al alcance de un enlace armado. Solo inicia la conexión una sesión de administrador; el inicio deja una cookie `HttpOnly`, `SameSite=Lax` y de 10 minutos con el sitio, un `state` aleatorio y el verificador PKCE (S256). La vuelta es **una sola para todos los sitios** (`/api/mercadopago/oauth`), porque Mercado Pago solo acepta una URL fija y registrada: el sitio sale de la cookie, y la vuelta solo se acepta con ese mismo `state`. La sesión del panel es `SameSite=Strict` y no viaja en esa vuelta desde Mercado Pago, por eso la prueba es la cookie del inicio.
  - **Tokens.** Se guardan en `sauna_mercadopago_accounts`, cifrados con AES-256-GCM y una clave derivada de `ANKORA_SESSION_SECRET`; el panel solo ve el apodo y el número de la cuenta. El token dura 180 días y se renueva solo una semana antes con el `refresh_token`. Si no se puede usar, el sitio deja de ofrecer Mercado Pago en vez de mandar a un checkout que falla.
  - **Webhook.** La firma se verifica con el secreto de la aplicación y el pago se consulta con el token de la cuenta conectada. Un pago que esa cuenta ya no puede leer (401, 403 o 404, por ejemplo después de cambiar de cuenta) responde 200 y queda en el log, porque reintentar no lo cambiaría.
  - **Solo cuentas de Argentina.** Al conectar se consulta `/users/me`, y una cuenta con `site_id` distinto de `MLA` no se guarda: cobraría en otra moneda y sus pagos nunca se aplicarían. El panel lo avisa.
  - En la aplicación de Mercado Pago se carga **una sola URL de redireccionamiento**, `https://betayomega.vercel.app/api/mercadopago/oauth`, igual a `MERCADOPAGO_REDIRECT_URL`, y conviene habilitar PKCE. Sirve para cualquier sitio y cualquier cuenta. La conexión se inicia desde el panel abierto en ese mismo host; desde otro, el panel lo avisa en vez de fallar en Mercado Pago.

### Transferencia manual
- La cuenta se carga en **Configuración → Cobros**: alias y/o CBU/CVU y titular. El CBU/CVU se valida con sus dos dígitos verificadores. Con los tres vacíos no se ofrece transferencia.
- La reserva pasa a `pending_transfer` con una retención de **12 horas** (configurable), que nunca llega más allá del inicio del turno. La página de la reserva muestra el alias/CBU del sitio, el monto exacto y un botón de WhatsApp para enviar el comprobante.
- En el panel, quien atiende ve las reservas pendientes de transferencia y toca **Confirmar transferencia**: registra un pago por el monto de la seña (`method = transfer`, `provider_ref = transfer:<id>`, así un doble clic no duplica) con `sauna_confirm_payment`, que confirma la reserva. El botón sigue en una transferencia cuya retención venció (con la etiqueta "Esperaba transferencia"): si aparece después, se aplica la regla de pago tardío de §3 y el aviso dice cómo quedó. Una reserva que espera transferencia ya no ofrece el "Confirmar" sin pago.

### Saldo
Lo que no cubre la seña se paga en el lugar. El panel permite registrar ese cobro (`kind = balance`, `method = cash` o `transfer`) para que la agenda muestre "pagado completo".

### Comprobantes
No se emiten comprobantes fiscales: está fuera de alcance.

## 7. Política de cancelación

Configurable en el panel (sección **Políticas**), por sitio, con una política marcada por defecto.

**Reglas por tramos.** Cada política es una lista de tramos "si se cancela con al menos X horas de anticipación, se reintegra Y % de la seña":

```json
{ "rules": [
  { "hoursBefore": 48, "refundPercent": 100 },
  { "hoursBefore": 24, "refundPercent": 50 },
  { "hoursBefore": 0,  "refundPercent": 0 }
] }
```

- **Cancela siempre quien atiende.** La persona lo pide por WhatsApp desde su enlace; no hay cancelación por cuenta propia.
- Al cancelar, el panel **propone** el reintegro que corresponde según la política que aplicaba al reservar (la instantánea guardada en la reserva, patrón 13).
- El operador puede **aceptar la propuesta o poner otro monto**: total, parcial (cualquier importe hasta lo que se pagó) o ninguno, y dejar una nota. Queda registrado quién lo decidió.
- Cada reintegro es **una fila nueva** en `payments` (`kind = refund`). Puede haber varios parciales; la suma nunca supera lo cobrado.
- **Los reintegros son manuales**, también los de Mercado Pago: el dinero se devuelve por fuera del sistema y el panel lo registra. El reintegro por API queda en el backlog.
- La política vigente se **muestra al reservar** y en la página de la reserva.
- Cambiar una política no altera las reservas ya hechas.
- Las sesiones de pack siguen la misma política; ver §11.

## 8. Avisos por WhatsApp

Mensajes armados por el panel con el nombre, fecha, hora, lugares y saldo; la persona que atiende los envía con un toque (`wa.me`):
- **Confirmación** al confirmar la reserva (también se ofrece a quien reserva en la página de su reserva).
- **Recordatorio:** el panel lista "reservas de mañana" con un botón por cada una.
- **Cancelación / reintegro.**
- **Instrucciones de transferencia.**
- **Pack:** compra confirmada, con su enlace y las sesiones que incluye.

No se guarda ningún mensaje. No hay envío automático (decisión consciente: sin costo ni aprobación de plantillas). Si se quiere automatizar después, se agrega como una fase aparte.

## 9. Respuestas del cliente

Registradas el 2026-11-05. No quedan preguntas abiertas. Los puntos marcados como *supuesto* no los pidió el cliente: se adoptaron sin objeciones y se pueden cambiar.

| # | Tema | Respuesta |
|---|---|---|
| 1 | Seña | Porcentaje del precio, configurable desde el panel y por turno. |
| 2 | Precios | Pueden variar por día o franja; se configuran desde el panel. Los valores los carga el cliente. |
| 3 | Turnos | Duración habitual de 45 a 60 minutos (*supuesto:* la respuesta decía "entre 1 hora y 45 minutos"). Horarios, cupo y salas se configuran desde el panel. |
| 4 | Mercado Pago | El dinero entra al dueño del sauna. *Supuesto:* la comisión también la absorbe el dueño. |
| 5 | Reintegros por Mercado Pago | Manuales por ahora. |
| 6 | Retenciones | 15 minutos para Mercado Pago y 12 horas para transferencia, configurables. |
| 7 | Cancelación por cuenta propia | No. Las cancelaciones son manuales. |
| 8 | Códigos | Límite por persona y restricción a turno o sala, configurables. |
| 9 | Anticipación | Hasta 1 hora antes del turno, configurable. *Supuesto:* hasta 60 días hacia adelante. |
| 10 | Legales | Texto a redactar en S6, a revisar por el cliente o un profesional antes de publicar. Edad mínima: 18 años. |
| 11 | Facturación | No hay. |
| 12 | Datos personales | Quien reserva no tiene usuario; queda como cliente del sistema con su nombre y WhatsApp, necesarios para atender la reserva. **No hay plazo de conservación: se anonimiza cuando la persona lo pide.** Eso borra nombre y WhatsApp, y conserva reservas y pagos sin identificarla. |
| 13 | Dominio | Igual que los demás sitios: una fila en `sites` con su dominio en `site_domains`. No depende del dominio base de la fase R1. |
| 14 | Pedidos nuevos | Agenda semanal y mensual, portada con contenido, packs, descuento por volumen, cierre del día y tipografía. Ver §2, §4, §11 y §12. |

## 10. Seguridad y pruebas específicas

- Ningún monto, descuento ni cupo viene del navegador. La API recibe *qué* se quiere y devuelve el cálculo.
- El token de una reserva o de un pack es aleatorio y largo; se compara en tiempo constante. Su página **no revela otras reservas**.
- Limitar intentos de reserva y de validación de códigos por origen, para evitar adivinar códigos y llenar la agenda de reservas falsas. Hecho: 10 reservas por hora y **10 códigos fallidos por hora** por origen, sumando la comprobación del formulario y las reservas con un código rechazado. Los fallos se guardan en `sauna_code_attempts` (solo el hash con clave del origen, sin el texto probado) y se borran al día.
- Webhooks: firma + reconsulta + idempotencia (patrón 12). Los logs no incluyen datos personales ni tokens.
- Tests obligatorios (en `modules/sauna/domain/` y `platform/money/`, puros, junto al código): cálculo de precio, descuento y seña con redondeo; tramos de reintegro; reintegro parcial que no supera lo cobrado; estados válidos e inválidos, incluido el pago tardío; vigencia y usos de un código, incluida la devolución del uso; cupo y sala completa; saldo, vencimiento, máximo semanal y devolución de sesión de un pack; formato de los mensajes de WhatsApp.
- **Pruebas contra la base, sin hacer porque no hay base de pruebas** ([ROADMAP.md §5](ROADMAP.md)). S7 decide cómo se comprueban antes de activar el sitio:
  - Dos personas reservan el último lugar a la vez: queda una sola reserva.
  - Sala completa y lugar compartido a la vez en un turno vacío: gana una.
  - Dos reservas sobre la última sesión de un pack, o dos personas sobre el último uso de un código: se acepta una.
  - Una reserva vence: libera el lugar y devuelve el uso del código.
  - Un aviso de pago repetido registra un solo pago, y un pago tardío sigue la regla de §3.
  - Correr `schema.sql` dos veces no falla ni cambia datos.
  - Una función con el sitio equivocado no lee ni toca filas de otro sitio.

## 11. Planes (reemplazan a los packs)

**Decidido el 2026-11-09, a pedido del cliente:** el plan reemplaza al pack de sesiones que se compraban y se reservaban después. Las tablas `sauna_pack_plans` y `sauna_pack_purchases`, y el camino de `p_pack_token` en `sauna_reserve_core`, quedan en la base sin uso; no se borran para no perder nada.

Un plan es **un precio fijo por una cantidad de turnos que la persona elige todos juntos antes de pagar**. Ejemplo: "Plan Vitalidad", 4 turnos por un precio, dentro de 30 días. Se crea y se edita en la sección **Planes** del panel (`planes`): nombre, descripción opcional, cantidad de turnos (2 a 12), precio total, días para usarlo, **duración de cada turno** y si **acepta códigos de descuento**. Un plan se desactiva, nunca se borra; la única excepción es deshacer su creación desde el aviso del panel mientras nadie lo reservó ([PATTERNS.md §19](PATTERNS.md)).

**Duración (2026-11-10).** Se elige entre las duraciones de los tipos de turno activos; el diálogo de reserva solo muestra los turnos de esa duración y `sauna_reserve_plan` rechaza otros (`plan_wrong_duration`). Los planes guardados antes no tienen duración: aceptan cualquiera, el panel los marca con "Falta la duración" y piden elegirla al editarlos.

**Reservar.**
1. En el diálogo de reserva, la persona elige "Un turno" o uno de los planes activos.
2. Con un plan, cada turno que toca se suma a una lista ("Tus turnos: 2 de 4"). Cada turno va en un **día distinto**, y entre el primero y el último no pueden pasar más días que los del plan (contando el primero). Solo se ofrecen turnos con modalidad individual y de la duración del plan.
3. Con todos los turnos elegidos, deja nombre y WhatsApp, y un código si el plan los acepta, y reserva. `sauna_reserve_plan` reserva **todos los turnos o ninguno**: cada uno pasa por `sauna_reserve_core` con las mismas comprobaciones y bloqueos que una reserva suelta.
4. **Seña sobre el total:** el porcentaje de seña del sitio sobre el precio del plan, después del descuento. Precio, descuento y seña se reparten entre las reservas del plan en centavos enteros: el precio en partes iguales (el resto va al primer turno); el descuento y la seña en proporción, con totales acumulados redondeados hacia abajo, para que ningún turno quede con un descuento mayor que su precio ni una seña mayor que lo que cuesta (`splitPlan` en `domain/plans.ts`). Todas comparten la misma retención, que vence como mucho al empezar el primer turno.
5. Un solo pago (Mercado Pago, con `external_reference = plan:<id>`, o transferencia) paga la seña completa. `sauna_confirm_plan_payment` registra la parte de cada turno con su propia referencia (`<ref>:<reserva>`) a través de `sauna_confirm_payment`, así cada turno sigue la regla del pago tardío. Un monto distinto del total se registra entero en el primer turno, que queda marcado para devolver.
6. La persona llega a la página del plan (`/plan/<token>`), con todos sus turnos, lo que falta pagar y el botón para reservar otro turno.

En el panel, cada reserva de un plan muestra el nombre del plan. Registrar la transferencia de una reserva de un plan registra la del plan entero. Cancelar se hace turno por turno, con la política vigente al reservar.

**Códigos en un plan (2026-11-10).** Solo si el plan los acepta (`plan_no_code` si no). El código se comprueba como en una reserva suelta, después de bloquear las salas y en cada turno (sala y tipo de turno a los que está limitado), y se aplica al **precio total del plan**: porcentaje, monto fijo (nunca por debajo de cero), pase gratis (precio cero, sin seña, confirmado al instante) o sin seña (el precio queda entero para pagar en el lugar). Cada turno lleva el código, pero **el plan cuenta como un solo uso** mientras alguno de sus turnos siga vigente, también en el límite por persona. La compra guarda el descuento (`discount_cents`) y la página del plan muestra el precio con descuento.

**Decisiones de alcance, que se pueden revisar:**
- Un plan reserva un lugar individual en cada turno, no la sala en modo grupal.
- No hay máximo por semana: alcanza con un turno por día y la ventana de días.

## 12. Sitio público e identidad

**Portada.** Contiene reserva, precios, qué incluye el turno, qué traer, recomendaciones, indicaciones, contraindicaciones, horarios, cómo llegar y política de cancelación. Los textos se editan desde el panel, en la sección Sitio, y se guardan en el documento `saunaPage:<sitio>` de `app_data` (`domain/page.ts`). Una sección sin texto no se muestra. Los textos iniciales son generales, no prometen beneficios de salud y **tiene que revisarlos un profesional antes de publicar**. Qué incluye el turno también se escribió sin confirmar con el cliente. Los packs se suman a la portada en S4b, cuando se puedan comprar. Los términos están en `/terminos`; el texto inicial es un borrador.

**Tipografía.** Pedido del cliente: Cinzel como tipografía principal ([referencia](https://fonts.google.com/specimen/Cinzel+Decorative)).

| Uso | Tipografía |
|---|---|
| Logo y todos los títulos | Cinzel Decorative, peso 400 |
| Textos de lectura y formularios | Arial/Helvetica, porque Cinzel no se lee bien en textos largos |
| Etiquetas chicas | Arial/Helvetica en mayúsculas y espaciadas, 10 a 11 px como mínimo |
| Panel | Geist, como el resto de BetaOmega |

**Estructura.** Sigue al sitio original de Fropexio: hero a pantalla completa con el encabezado encima, secciones numeradas (esencia, sesiones, espacio, preguntas, horarios), títulos en dos tonos, filas separadas por líneas finas y cierre con llamado a reservar. La reserva se abre en un diálogo con la dirección `#reservar`: todo botón de reservar es un enlace común a esa dirección. Las sesiones son los tipos de turno reales, con sus precios. Título, presentación y listas se editan en el panel; las frases de marca que los rodean están fijas en `ui/site-home.tsx`, no prometen beneficios de salud y **no se editan desde el panel**. Contraindicaciones arranca abierta, para que nadie se la pierda por no abrirla.

**Imagen.** `public/fropexio.jpeg`: dorados y tonos cálidos sobre fondo oscuro, bambú, agua y vapor. Trae el logo incorporado, así que no sirve de fondo ancho y ya no se usa en la portada. Es la imagen para enlaces (Open Graph y Twitter), entera y vertical (1024 × 1536), a pedido del usuario el 2026-11-07; `fropexio-og.jpg`, el recorte horizontal que se usaba antes, quedó sin uso. **Ícono** (favicon, Apple y app instalada): `public/sauna.png`, limpiado en `fropexio-icon.png` y `fropexio-icon-maskable.png` porque su "transparencia" es un damero pintado; lo sirven `/icon` y `/manifest.webmanifest`. `fropexio-paisaje.jpg` (hero) y `fropexio-sala.jpg` (sección del espacio) vienen del sitio original de Fropexio, **sin origen ni licencia confirmados** y sin ser del lugar real: se confirman o se reemplazan antes de publicar. `fropexio-bancos.jpg` ("Tamminiemi sauna interior", de Ypsilon from Finland, CC0) y `fropexio-piedras.jpg` ("Heat Storage Sauna Stove", de Omegaosiris, CC0), fotos libres de Wikimedia Commons, quedaron sin uso. El tema `sauna` de `globals.css` sale de esta imagen y es **solo oscuro**, porque la marca lo es.

**Movimiento e imágenes (2026-11-07).** Las dos fotografías usan importación estática de Next Image con placeholder desenfocado y tamaños adaptativos; la portada usa `preload`, conserva una zona oscura de lectura y aplica un desplazamiento leve de la imagen con `requestAnimationFrame`. Las anclas internas tienen desplazamiento progresivo, cancelable con rueda, toque o teclas de navegación; no se intercepta el scroll manual ni el hash de reserva. Se respeta `prefers-reduced-motion`, incluido su cambio durante la visita. Las preguntas animan su altura mediante filas de CSS Grid, mantienen controles de teclado, `aria-expanded` y respuestas cerradas inertes; Contraindicaciones sigue abierta inicialmente. El menú móvil se cierra con Escape y devuelve el foco. Para Safari/iOS, el diálogo fija temporalmente el cuerpo y restaura su posición al cerrar, con controles de al menos 16 px para evitar el zoom automático de campos. Las barras nativas usan el esquema oscuro y los tokens del sauna; los cambios en la raíz se restauran al salir.

**Mapa de ubicación (2026-11-07).** Se integró una adaptación reducida de [mapcn](https://www.mapcn.dev/docs), con su licencia MIT conservada en `ui/map.LICENSE`, y la dependencia `maplibre-gl`. El componente queda en el módulo porque solo lo usa el sauna. Importa únicamente el CSS de distribución del proveedor; los estilos propios siguen siendo utilidades Tailwind. El mapa se descarga al aproximarse a la sección Horarios, usa CARTO oscuro con atribución visible, marcador, zoom y botón para volver al lugar; la rueda no captura el desplazamiento normal de la página. La ubicación se extrae del enlace de Maps guardado por el panel: las coordenadas del marcador tienen prioridad sobre las de la cámara. Los enlaces cortos se resuelven en el servidor con tiempo y cantidad de redirecciones limitados, comprobando HTTPS y una lista cerrada de hosts en cada salto; no se geocodifican direcciones ni se inventan puntos. Un caché acotado evita resolverlo en cada visita. El enlace externo permanece disponible si falla el mapa o WebGL. El worker de MapLibre se carga desde unpkg fijado a la versión instalada, según la [instalación oficial de mapcn](https://www.mapcn.dev/docs/installation); las teselas y fuentes cartográficas se obtienen de CARTO, sin claves de API. No se modifica la ubicación ni ningún dato en producción.
