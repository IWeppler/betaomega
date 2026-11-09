# N1: avisos al celular (push y Telegram)

Quien atiende el panel pasa el día en un sitio y se entera tarde de lo que llega a los otros. El menú lateral ya muestra avisos de los otros sitios (registro de [ROADMAP.md](ROADMAP.md), 2026-11-09), pero solo con el panel abierto. Esta fase manda esos avisos al celular aunque el panel esté cerrado, por dos canales:

- **Celular 1: notificaciones push** del panel instalado como app (PWA en Chrome para Android).
- **Celular 2: mensajes de Telegram** de un bot propio.

Los dos canales reciben los mismos eventos y cada destino elige de qué sitios quiere avisos. Se implementa por puntos, en orden; cada uno dice cuándo está hecho.

## Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| App nativa | **No.** Se descartó React Native. | En Android, una app nativa y una PWA usan el mismo servicio de Google (FCM) para recibir notificaciones: no es más estable. Sumaría una segunda app que mantener y publicar. |
| Push | Web Push estándar con claves VAPID y la librería `web-push`, sobre el service worker que el panel ya tiene (`public/panel-sw.js`). | No necesita Firebase ni una cuenta de Google: el navegador entrega la notificación. |
| Telegram | Un bot propio creado con @BotFather. El chat se vincula desde el panel con un enlace de un solo uso. | Casi no pierde mensajes y no depende de la batería del navegador. |
| Cuándo se manda | Después de responder al pedido (`after()` de Next), sin esperar a Telegram ni al servicio de push. | Un aviso que falla nunca deshace ni demora una reserva, un pago o un comentario. |
| Qué dice | Sitio, qué pasó, día y hora, **solo el primer nombre** y, si hace falta, el monto de la seña. Nunca el WhatsApp. | Telegram guarda los mensajes en sus servidores, y una notificación se ve con el celular bloqueado. |
| Dónde viven los datos | Tablas del panel, no de un sitio: un destino puede recibir avisos de varios sitios. Cada destino guarda la lista de sitios que le interesan. | Con P1–P5 (operadores), cada destino pasará a pertenecer a una persona. |
| Código | **`platform/notifications/`**, no un módulo (cambiado al hacer el punto 1). Los sitios solo llaman a `notify(evento)`. | Avisan un módulo (el sauna) y el código viejo (recetas). Un módulo no puede importar otro módulo y el código viejo no puede importar módulos (`eslint.config.mjs`), pero los dos pueden usar `platform/`. |

## Eventos de la primera versión

| Evento | Cuándo se dispara | Mensaje de ejemplo | Abre |
|---|---|---|---|
| `sauna.booking_new` | Reserva o plan hecho desde el sitio público (`postReservation`, `postPlanReservation`). No las cargadas desde el panel. | **Fropexio** · Nueva reserva: Ana, sáb 14/11 19:00, Individual. Falta la seña. | Reservas |
| `sauna.transfer_chosen` | La persona eligió pagar por transferencia. | **Fropexio** · Ana va a transferir $12.000. Revisá la cuenta y confirmala. | Reservas |
| `sauna.payment_confirmed` | Mercado Pago confirmó una seña (resultado `confirmed` o `late_confirmed`, nunca `duplicate`). | **Fropexio** · Seña pagada: Ana, sáb 14/11 19:00. Reserva confirmada. | Agenda |
| `sauna.payment_problem` | Un pago quedó para devolver (`no_seat`, `amount_mismatch`, `unapplied`). | **Fropexio** · Pago para devolver: Ana. Revisalo en el panel. | Resumen |
| `recetas.comment_new` | Llega un comentario (queda pendiente de aprobación). | **Comidas del cielo** · Comentario por aprobar en "Guiso de lentejas". | Comentarios |

Fuera de esta versión: retención vencida (no hay tarea programada que lo detecte), resumen diario, avisos al cliente final.

## 1. Modelo y reglas puras

**Hecho (2026-11-09).** Reglas en `platform/notifications/index.ts`, con pruebas en `notifications.test.ts` y `schema.test.ts`. Las tablas van antes de la sección del sauna en `supabase/schema.sql`; **falta correrlo**. El texto de abajo es el pedido original.

`platform/notifications/index.ts`: tipos de evento, armado del texto y del enlace de cada uno, y el filtro "¿este destino quiere este evento?". Textos sin datos sensibles (solo primer nombre), escapados para el HTML de Telegram y recortados al largo que acepta cada canal.

SQL en `supabase/schema.sql`, antes de la sección del sauna, idempotente y con RLS y `revoke` como el resto:
- `panel_push_subscriptions`: `endpoint` (único), `p256dh`, `auth`, `label` ("Celular de Ana"), `site_ids text[]` (vacío = todos), `failures`, `last_sent_at`, `created_at`.
- `panel_telegram_chats`: `chat_id` (único), `label`, `site_ids text[]`, `failures`, `last_sent_at`, `created_at`.
- `panel_telegram_links`: código de vinculación **guardado como hash**, que vence a los 10 minutos y se usa una sola vez.

**Hecho cuando.** Hay pruebas de cada texto, del escape para Telegram, del filtro por sitio y del vencimiento del código. El esquema pasa sus pruebas de convenciones.

## 2. Envío y `notify()`

**Hecho (2026-11-09).** `platform/notifications/deliver.ts` reparte un aviso entre los destinos que lo quieren, con los canales inyectados (pruebas con canales falsos en `deliver.test.ts`), y decide qué borrar y qué fallas sumar. `server.ts` pone los canales reales (`web-push`, ya instalado, y `sendMessage` de Telegram, cada uno con 5 segundos de límite), lee los destinos con `panelTable` (nuevo en `platform/db`, solo para tablas `panel_*`) y expone `notify()`, que corre después de la respuesta con `after()`, y `sendNotice()`, para el botón de prueba del punto 3. Sin claves VAPID o sin el token del bot, ese canal queda apagado y sus destinos esperan sin sumar fallas. Antes de correr `schema.sql`, cada aviso solo deja una línea en el log. Llamadas: reserva pública (`postReservation`), plan (`postPlanReservation`), primera elección de transferencia (reserva y plan), pago de Mercado Pago desde el webhook o la vuelta del checkout (nunca con `duplicate`; la búsqueda de la reserva también corre después de la respuesta) y comentario nuevo de recetas. Lo que registra quien atiende en el panel no avisa. **No probado:** ningún envío real (faltan las claves, el bot y la migración). El texto de abajo es el pedido original.

`platform/notifications/server.ts` (con `server-only`). Las tablas no son de un sitio, así que `platform/db` necesita un acceso a tablas del panel además de `siteTable`.  `notify(evento)` lee los destinos que quieren ese evento y manda a todos en paralelo, con tiempo límite.
- **Push:** `web-push` con las claves VAPID. Una respuesta 404 o 410 borra la suscripción; otro error suma `failures`.
- **Telegram:** `sendMessage` de la Bot API, con un botón "Abrir en el panel". Una respuesta 403 (bot bloqueado) borra el chat.
- Los errores se registran en el log sin datos personales y no se propagan.

Se llama con `after()` desde: reserva pública, reserva de plan, elección de transferencia, pago de Mercado Pago (webhook y vuelta del checkout) y comentario nuevo de recetas. El enlace al panel se arma con el primer host de `PANEL_HOSTS`.

**Hecho cuando.** Las pruebas con los envíos simulados muestran que un fallo de envío no cambia la respuesta de la reserva, que un pago repetido (`duplicate`) no avisa dos veces y que un destino sin ese sitio no recibe nada.

## 3. Push en el celular 1

**Implementado (2026-11-09), sin probar en un celular.** `public/panel-sw.js` muestra el aviso (`push`) y abre su página al tocarlo (`notificationclick`), en una ventana del panel si hay una abierta. La pantalla **Avisos** (`/<sitio>/avisos`, enlace "Avisos al celular" al pie del menú de cualquier sitio; código en `modules/notifications/ui/`) activa este celular con nombre y sitios, lo reconoce si ya está activado, lista todos los destinos con su último aviso, deja editar nombre y sitios o quitarlos, y manda una prueba (evento `panel.test`, que llega a todos). Rutas en `app/api/panel/notifications/` (`setup`, `push`, `destinations`, `test`), con sesión y mismo origen para escribir; la lógica está en `platform/notifications/manage.ts`. El worker solo se registra en producción, así que en el servidor local la pantalla lo dice. El texto de abajo es el pedido original.

- `panel-sw.js` escucha `push` (muestra título, texto, ícono del sitio y etiqueta por evento para no apilar repetidos) y `notificationclick` (enfoca el panel si está abierto o abre la URL del aviso).
- Pantalla **Avisos** en el panel (fuera de los sitios, o en el menú de cada sitio apuntando a la misma pantalla): botón **"Activar en este celular"**, que pide permiso, se suscribe con la clave pública VAPID y guarda la suscripción con un nombre y los sitios elegidos. También: **"Probar"**, que manda un aviso de prueba, y **"Desactivar"**.
- Rutas: `POST/DELETE /api/panel/notifications/push` y `POST /api/panel/notifications/test`, con sesión de administrador y mismo origen.
- En la pantalla, un texto corto para Android: instalar el panel con "Agregar a la pantalla principal" y quitarle la optimización de batería.

**Hecho cuando.** En un Android real, con el panel cerrado y la pantalla apagada, llega el aviso de prueba y una reserva real, y al tocarlo se abre la sección correcta.

## 4. Telegram en el celular 2

**Implementado (2026-11-09), sin probar con un bot real.** En Avisos, "Conectar Telegram" crea el código y abre `t.me/<bot>?start=<código>`; "Conectar el bot a este panel" llama a `setWebhook` con `TELEGRAM_WEBHOOK_SECRET` (solo con el panel en https). `POST /api/telegram/webhook` compara el secreto en tiempo constante, marca el código como usado en la misma consulta que comprueba que no se usó y no venció, y guarda el chat con el nombre y los sitios elegidos. Grupos y cualquier otro mensaje reciben una respuesta fija. El texto de abajo es el pedido original.

- En **Avisos**, el botón **"Conectar Telegram"** crea un código y abre `https://t.me/<bot>?start=<código>`. La persona toca "Iniciar" en Telegram.
- `POST /api/telegram/webhook` comprueba el encabezado `X-Telegram-Bot-Api-Secret-Token`, toma `/start <código>`, lo valida (hash, vencimiento, un solo uso), guarda el `chat_id` y contesta "Listo, vas a recibir los avisos de …". Cualquier otro mensaje recibe una respuesta fija, sin datos.
- Lista de chats conectados, con sus sitios, y botón para desconectar.
- Solo chats privados: el bot rechaza grupos.

**Hecho cuando.** El celular 2 recibe el aviso de prueba y una reserva real en Telegram, el botón abre el panel, y un código usado o vencido no conecta nada.

## 5. Revisión y salida

- Probar los cinco eventos de punta a punta con los dos celulares a la vez.
- Revisar la pantalla Avisos a 390 px y con teclado.
- Escribir en [SAUNA.md](SAUNA.md) y en [ARCHITECTURE.md](ARCHITECTURE.md) dónde viven los avisos, y cerrar la fase en [ROADMAP.md](ROADMAP.md).

## Lo que tiene que hacer el dueño del proyecto

Nada de esto se puede hacer desde el código. Va en este orden, antes del punto 3:

1. **Claves VAPID:** correr `npx web-push generate-vapid-keys` y cargar en Vercel (Production y Preview) `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (`mailto:` con un correo de contacto).
2. **Bot de Telegram:** en Telegram, hablarle a @BotFather, enviar `/newbot`, elegir nombre y usuario, y cargar en Vercel `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` y `TELEGRAM_WEBHOOK_SECRET` (una cadena larga al azar).
3. **Base:** correr `supabase/schema.sql` cuando el punto 1 esté hecho.
4. **Webhook de Telegram:** después del primer despliegue con el punto 4, registrar el webhook con el botón que tendrá la pantalla Avisos (o con `setWebhook` de la Bot API).
5. **Celulares:** en el celular 1, instalar el panel desde Chrome y activar los avisos. En el celular 2, tener Telegram y tocar "Conectar Telegram" desde el panel abierto en ese celular o en otro.

## Riesgos

- **Ahorro de batería en Android** (Xiaomi, Samsung, Motorola): puede demorar o cortar el push. Se mitiga con el texto de ayuda del punto 3. Telegram suele estar exceptuado.
- **Un solo administrador compartido:** hasta P1–P5, cualquiera con la contraseña del panel ve y cambia los destinos.
- **Sin base de pruebas** ([ROADMAP.md](ROADMAP.md) §5): el SQL se prueba en la base real. Las tablas nuevas no tocan datos existentes.
- **Telegram guarda los mensajes:** por eso solo van el primer nombre, el día y la hora.
