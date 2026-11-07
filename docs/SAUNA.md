# Sauna: especificación

Fropexio es un sitio de reservas con cupos, pago de seña online, packs de sesiones, códigos y políticas de cancelación. Es el primer sitio de tipo `sauna` (id `fropexio`) y el primero que guarda **datos de personas y dinero**; por eso tiene sus propios patrones (11 a 15 de [PATTERNS.md](PATTERNS.md)).

El orden de construcción está en [ROADMAP.md](ROADMAP.md) (fases S1 a S7). Este archivo define **qué** se construye. El modelo de datos de §5 quedó confirmado en la fase S1 y está en `supabase/schema.sql`. Las tablas ya existen en la base, pero **las funciones SQL todavía no corrieron completas con datos**: solo se probaron sus caminos de rechazo ([ROADMAP.md](ROADMAP.md), registro de S2).

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Modalidades | **Individual o grupal.** El módulo es para dos personas y no se junta a desconocidos en un espacio tan chico: **una reserva, de cualquier modalidad, ocupa la sala** en todo su horario. En el código, `shared` es individual y `private` es grupal. |
| Pago de la seña | **Mercado Pago** (confirmación automática por webhook) **y transferencia manual** (alguien marca la reserva como pagada en el panel). El cliente final elige. |
| Códigos | Descuento en porcentaje, descuento de monto fijo, **reserva sin pagar seña**, y **pase gratis / cortesía**. |
| Packs | Varias sesiones compradas juntas, a menor precio que sueltas, con vencimiento y máximo semanal. Ver §11. |
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

Quien compra un pack sigue el camino de §11.

**Quien atiende (panel).**
- **Agenda:** vistas de día, semana y mes, con quién viene y qué falta pagar. La semana es una grilla de horarios; al elegir un horario o un día aparece un panel lateral (debajo en celular) para marcarlo como **ocupado** o liberar su cierre completo. Distingue días ocupados enteros o en parte. Las reservas ya hechas no se cancelan. Al elegir hoy permite **no habilitar más turnos por hoy**, con confirmación; los horarios pasados son de solo lectura.
- **Reservas:** búsqueda y detalle; confirmar transferencia; cancelar con reintegro total, parcial o ninguno; ver pagos sin cupo; botones de WhatsApp (confirmación, recordatorio, cancelación).
- **Reservas manuales (S2d, puntos 1–4):** desde un horario futuro y libre de Semana, o desde el día seleccionado en Día/Mes, **Crear reserva** consulta los turnos disponibles y permite elegir uno con su inicio, fin y tipo. Es la acción principal; ocupar queda como secundaria. La disponibilidad se comprueba para la duración completa del turno. **Cargar datos** abre en el mismo panel lateral el formulario de modalidad, nombre y WhatsApp argentino, con duración, precio y saldo sin pagos. **Revisar reserva** valida y normaliza los datos; se puede seguir editando o cambiar de turno sin perderlos. El borrador queda solo en memoria y salir o descartarlo pregunta antes de perder datos. **Confirmar reserva** llama a la operación atómica del panel: reserva confirmada, total pendiente y aceptación del cliente pendiente, sin pagos. Se bloquean envíos y navegación durante el pedido; los errores conservan los datos. La migración está preparada sin aplicar; falta el resultado completo y la verificación del punto 5 en [el plan de S2d](tareas-reservas-manuales.md).
- **Horarios y precios:** una sola página, primero tipos de turno (duración, precios individual y grupal, seña propia y general) y después horarios (días abiertos, franjas, tipos ofrecidos, personas en el módulo e intervalo de inicio). Cada parte tiene su propio Guardar y Descartar; guardar una conserva la edición de la otra y salir pregunta por ambas en orden. Un tipo nuevo se puede elegir en las franjas después de guardarlo. Para cobrar distinto según día o franja se crea otro tipo. El ejemplo de inicios se actualiza con el intervalo y avisa si los turnos se superponen. Los cierres se cargan desde la Agenda, por un horario o un día por clic; se pueden ver y liberar completos los cierres de varios días existentes.
- **Packs:** crear planes y ver las compras con sus sesiones restantes.
- **Códigos:** crear, limitar usos y vigencia, ver cuántas veces se usó.
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
- Elegir transferencia (`held` → `pending_transfer`, con su retención): S3.

## 6. Pagos

### Mercado Pago
- El dinero entra a la **cuenta del dueño del sauna**, y la comisión la absorbe esa cuenta: quien reserva paga el monto exacto de la seña o del pack.
- La reserva en `held` crea una **preferencia de pago** con `external_reference = booking.id` y `notification_url` al webhook del sitio. Se vuelve a la página de la reserva (`back_urls`). Los packs hacen lo mismo con su compra.
- **El webhook no se cree:** verifica la firma, **consulta el pago a Mercado Pago por su id** y compara referencia y monto con la reserva. Recién ahí llama a `sauna_confirm_payment`. Repetir el aviso no duplica nada (`provider_ref` único).
- La retención del cupo mientras se paga dura **15 minutos** (configurable). Conviene que la preferencia venza junto con la retención para reducir los pagos tardíos; S3 verifica cómo hacerlo.
- Las credenciales son secretos de servidor y se guardan por sitio. S3 define el nombre de las variables.

### Transferencia manual
- La reserva pasa a `pending_transfer` con una retención de **12 horas** (configurable), que nunca llega más allá del inicio del turno. La página de la reserva muestra el alias/CBU del sitio, el monto exacto y un botón de WhatsApp para enviar el comprobante.
- En el panel, quien atiende ve las reservas pendientes de transferencia y la confirma: eso crea el movimiento de pago (`method = transfer`) y pasa a `confirmed`. Si vence, se libera el cupo; si la transferencia aparece después, se aplica la regla de pago tardío de §3.

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
- Limitar intentos de reserva y de validación de códigos por origen, para evitar adivinar códigos y llenar la agenda de reservas falsas.
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

## 11. Packs

Un pack son varias sesiones compradas juntas a menor precio que sueltas, por ejemplo 10 sesiones con un máximo de 4 por semana. **El descuento por volumen es el precio del pack:** no hay otra regla de descuento a largo plazo. Los planes se crean en la sección `packs` del panel.

**Comprar.**
1. La persona elige un plan, deja nombre y WhatsApp, y acepta los términos.
2. **Paga el total al comprar**, por Mercado Pago o transferencia, con las mismas retenciones de §6. No hay seña.
3. Al confirmarse el pago, el pack queda activo y recibe su enlace secreto (`/pack/<token>`). Un pago tardío sobre una compra vencida activa el pack: no depende de un cupo.

Estados de una compra: `held`, `pending_transfer`, `active`, `expired`, `cancelled`. `expired` indica una compra sin pagar a tiempo. El vencimiento del pack ya pagado se decide por `valid_until`, sin cambiar de estado.

**Usar.** Desde su enlace, la persona ve las sesiones restantes y reserva turnos. Cada sesión es una reserva `confirmed`, sin cobro y sin seña.

| Regla | Detalle |
|---|---|
| Vencimiento | Cada plan define sus días de validez, que corren desde la confirmación del pago. El turno tiene que empezar antes de `valid_until`. |
| Máximo semanal | Cuenta turnos de lunes a domingo en hora de Buenos Aires, según la fecha del turno y no la del día en que se reserva. |
| Saldo | Se calcula: sesiones del pack menos reservas que las consumen. Un ausente (`no_show`) consume la sesión. |
| Concurrencia | `sauna_reserve` bloquea la compra, así dos reservas simultáneas no pueden usar la última sesión. |

**Cancelar una sesión** sigue la política guardada al comprar. El panel propone devolver la sesión solo si el tramo reintegra el 100 %; quien atiende puede decidir otra cosa y queda registrado.

**Cancelar el pack entero** no tiene propuesta automática: quien atiende fija el reintegro manual, hasta lo cobrado.

**Decisiones de alcance, que se pueden revisar:**
- Un pack sirve para un lugar en un turno compartido, no para la sala completa.
- Un código no se aplica a la compra de un pack ni a sus sesiones.
- Un pack es personal: el enlace identifica a quien lo compró.

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

**Imagen.** `public/fropexio.jpeg`: dorados y tonos cálidos sobre fondo oscuro, bambú, agua y vapor. Trae el logo incorporado, así que no sirve de fondo ancho y ya no se usa en la portada; `fropexio-og.jpg`, un recorte de ella, sigue siendo la imagen para enlaces. `fropexio-paisaje.jpg` (hero) y `fropexio-sala.jpg` (sección del espacio) vienen del sitio original de Fropexio, **sin origen ni licencia confirmados** y sin ser del lugar real: se confirman o se reemplazan antes de publicar. `fropexio-bancos.jpg` ("Tamminiemi sauna interior", de Ypsilon from Finland, CC0) y `fropexio-piedras.jpg` ("Heat Storage Sauna Stove", de Omegaosiris, CC0), fotos libres de Wikimedia Commons, quedaron sin uso. El tema `sauna` de `globals.css` sale de esta imagen y es **solo oscuro**, porque la marca lo es.
