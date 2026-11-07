# S2d: reservas manuales desde Agenda

El panel permitirá tomar una reserva por teléfono o en el lugar, empezando por elegir el turno en el calendario. Se implementa por puntos; completar el primero no habilita la creación de reservas.

## 1. Entrada desde Agenda

**Hecho (2026-11-06).** Las verificaciones y sus límites están en el registro de ROADMAP.md.

Al seleccionar un horario futuro y libre en Semana, el panel lateral ofrece **Crear reserva** como acción principal. En Día o Mes se parte del día seleccionado y se elige entre sus turnos disponibles. **Marcar como ocupado** conserva su función de crear cierres y pasa a ser secundaria.

La acción consulta la disponibilidad existente, con sesión de administrador incluso si el sitio está sin publicar. Se elige un turno concreto (inicio, fin y tipo), no solo una celda: la disponibilidad debe cubrir su duración completa. Una reserva vigente ocupa el módulo completo. Los turnos pasados, cerrados, sin modalidad ofrecida o no disponibles se excluyen. La consulta conserva por ahora la anticipación y el horizonte vigentes del sitio público; la excepción para carga manual corresponde al punto 4.

Hay estados de carga, error con reintento y lista vacía. La selección se guarda por clave y se vuelve a contrastar con la disponibilidad cuando esta se actualiza. Se puede volver a la agenda. El punto 2 agrega Cargar datos sobre el turno elegido; la creación sigue pendiente.

## 2. Formulario

En el mismo panel lateral: tipo y modalidad, nombre y WhatsApp, resumen de duración, precio y saldo, y confirmación. En celular queda debajo del calendario. Reutilizar el turno elegido en el punto 1.

**Hecho (2026-11-06), solo interfaz.** Cargar datos abre el formulario del turno elegido, con las modalidades que tengan precio. Nombre y WhatsApp argentino se validan con el dominio existente; Revisar reserva muestra los datos normalizados, día, inicio y fin, duración, precio y saldo sin pagos registrados. No se resta una seña que no se cobró. Se puede seguir editando o cambiar de turno conservando los datos. El borrador vive solo en la memoria de la pantalla, sobrevive a cambios de selección y lecturas automáticas, y se pide confirmación antes de descartarlo o salir de la sección; también se protege la recarga/cierre mediante beforeunload. No se persiste en el navegador ni se envía a una API.

Confirmar reserva está deshabilitado y se explica que los datos no se guardaron: habilitar esa acción necesita la operación atómica del punto 4. No se registra aceptación de condiciones ni pagos en este punto.

## 3. Comportamiento manual

**Hecho (2026-11-06), en el dominio y la revisión; todavía no persiste reservas.** Al confirmar una carga manual se deberá crear en estado `confirmed`, con `expiresAt = null`: no vence por falta de pago. No se exige seña (`depositCents = 0`) ni se registra ningún movimiento de dinero; el total queda pendiente de cobro. Confirmar toma el turno, no significa que se pagó. Si el precio configurado es cero, se confirma con saldo cero y sin inventar un pago. Los movimientos de dinero corresponden a S3.

`prepareManualBooking` valida y prepara ese estado inicial a partir del turno y el borrador normalizado. Individual guarda un lugar y cobra el precio individual; grupal guarda la capacidad y cobra el precio de sala, sin multiplicarlo. Ambas modalidades bloquean el módulo completo bajo las reglas existentes. El precio sale del turno, sin descuentos ni importes libres aportados por el borrador. Rechaza un turno pasado, no ofrecido, cerrado, con cupo ocupado o con fechas/capacidad inválidas. La revisión muestra el estado que tendrá al confirmar y explica la deuda y la ausencia de vencimiento automático, sin presentar el turno como ya reservado.

La preparación es una función pura: no asigna identificadores, no guarda un cliente, no crea pagos ni afirma que se aceptaron condiciones. El punto 4 debe volver a leer precios y disponibilidad del sitio dentro de la operación atómica, bajo bloqueo de sala: ni la preparación del navegador ni una celda libre autorizan una escritura. Se conservan horarios, cierres y bloqueo de superposiciones; no se habilitan precios libres ni reservas pasadas. La excepción a la anticipación mínima sigue pendiente del punto 4. Los puntos 4 y 5 siguen pendientes y Confirmar reserva permanece deshabilitado.

## 4. Servidor y seguridad

Entrada propia del panel con sesión, mismo origen y sitio acotado. Operación atómica que reutilice las reglas de disponibilidad, calcule precios y registre que la reserva se cargó desde el panel. Evaluar la migración SQL necesaria; no crear y confirmar mediante dos pedidos separados. Definir la excepción a la anticipación mínima para turnos futuros y cómo registrar la aceptación de condiciones en una carga manual, sin atribuir una aceptación inexistente al cliente.

**Implementado (2026-11-06), migración preparada sin ejecutar.** `GET/POST /api/sites/[site]/sauna/manual-bookings` exige sesión; POST también exige mismo origen, limita el cuerpo y rechaza campos ajenos al contrato. El sitio sale de la ruta validada, incluso si está sin publicar. Confirmar envía una sola operación y bloquea envíos y navegación mientras espera; un error conserva los datos.

La migración al final de `supabase/schema.sql`, marcada `S2d: manual booking`, agrega `origin` y `manual_request_id` y permite `terms_accepted_at = null` solo para cargas del panel. La RPC manual deja origen `panel`, aceptación pendiente, estado `confirmed`, vencimiento nulo, seña y descuento cero, sin pagos. Conserva la política y versión de condiciones vigentes como referencia, sin afirmar aceptación. El evento registra actor panel porque la sesión de administración es compartida.

Las entradas pública y manual delegan en reglas comunes de reserva y disponibilidad. La pública conserva su anticipación y aceptación obligatoria. La manual admite inicios estrictamente futuros, también dentro de la anticipación mínima; mantiene horizonte, semana, duración completa, cierres y bloqueo de superposiciones. Relee configuración, sala y tipo bajo bloqueos, calcula el precio real y rechaza si cambió respecto del mostrado; el importe esperado nunca fija el cobro. Comprueba nuevamente la hora real después de esperar bloqueos y antes de escribir.

Una clave de pedido se conserva durante el reintento del mismo formulario. La RPC serializa esa clave por sitio con un bloqueo de transacción y un índice único: un reintento compatible devuelve la misma reserva; reutilizarla con otro turno o modalidad se rechaza. Cliente, turno, reserva y evento se guardan juntos, sin una segunda llamada para confirmar. Las funciones nuevas quedan reservadas a `service_role`.

Los estados anteriores de los puntos 1–3 describen sus entregas parciales: con este punto Confirmar queda habilitado y el selector usa la disponibilidad manual. **Para habilitar escrituras reales falta aplicar la migración**; no se ejecutó SQL contra producción. Se verificó la conexión mediante proxy con escrituras en memoria; eso no prueba sintaxis ni concurrencia de Postgres. El punto 5 sigue pendiente, incluido el toast y la revisión completa de resultados y conflictos.

## 5. Resultado y verificación completa (pendiente)

Toast y reserva visible en la agenda, con WhatsApp. Ante un conflicto conservar los datos y ofrecer otro turno. Probar cierres, superposiciones, doble envío, saldos y turnos próximos a empezar. Revisar a 1280 y 390 px y con teclado. Las escrituras se verifican con el proxy de CONVENTIONS §8; registrar por separado lo que no se ejecutó contra Postgres.
