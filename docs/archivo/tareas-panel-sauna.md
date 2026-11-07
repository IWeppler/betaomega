# Fase S2c: ajustes de uso del panel

> Cerrada el 2026-11-06. Implementación, verificaciones y límites registrados en [ROADMAP.md](../ROADMAP.md).

Encargo cerrado para quien lo implemente, persona o IA. Sale de una revisión del dueño del proyecto sobre el panel de Fropexio. Estado y registro: [ROADMAP.md](../ROADMAP.md).

**Antes de empezar:** leer `AGENTS.md` y los documentos que indica, en su orden. [DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md) y [SAUNA.md](../SAUNA.md) aplican a toda la fase. Antes de tocar rutas, leer la guía de Next en `node_modules/next/dist/docs/01-app/`.

## Límites

- **Sí:** las cuatro tareas de abajo, sus tests y sus documentos.
- **No:** cambiar `supabase/schema.sql`. `sauna_closures` ya admite cualquier rango y `sauna_is_closed` ya cubre turnos que se tocan en parte.
- **No:** agregar dependencias. No hay `@radix-ui/react-toast` y no hace falta.
- **No:** migrar `panel.css` o `legacy.css`, ni tocar el sitio público ni las reglas de cupo.
- **No:** hacer commit, salvo que se pida.
- **La base local es la de producción** (`.env.local`). Para probar escrituras seguir "Probar sin tocar datos" en [CONVENTIONS.md §8](../CONVENTIONS.md): un proxy que reenvía las lecturas y contesta él mismo las escrituras. Al terminar, recompilar sin variables de prueba.

Orden sugerido: 1 → 2 → 3 → 4. La tarea 1 define cómo se confirma un guardado y las demás la usan.

## Tarea 1. Guardar: un solo lugar para cada mensaje

Hoy `app/save-form.tsx` repite "Guardando…" debajo del botón y escribe "Hay cambios sin guardar." y "Se guardó correctamente." en un texto aparte. Además, `modules/sauna/ui/saved-note.tsx` pone otro aviso debajo del encabezado y el botón "Descartar cambios" queda dentro del contenido del formulario, lejos de Guardar.

`SaveForm` lo usan todos los tipos de sitio y `/equipo` de Ñekurel, así que el cambio alcanza a todos: **es lo buscado**.

**Hacer:**

1. **"Guardando…" solo en el botón.** Quitarlo de `.autosave-status`.
2. **Quitar el texto "Hay cambios sin guardar."** Queda el diálogo que aparece al querer salir con cambios (`leave-dialog`) y el aviso `beforeunload`: eso evita perder trabajo y no es la notificación de la que se habla.
3. **"Se guardó correctamente." pasa a ser un toast.**
   - Tiene que ser toast y no un estado del botón: los formularios del sauna se remontan al guardar (`key={round}`), y el botón perdería el mensaje.
   - Crear `shared/ui/toast.tsx`: una función `showToast(mensaje)` con un almacén de módulo (`useSyncExternalStore`) y un componente `<Toaster />`, con `role="status"`, tokens del tema, unos 3 segundos en pantalla y abajo a la derecha. Sin portal: tiene que quedar dentro del elemento con `data-theme`.
   - Montar `<Toaster />` en `app/panel/layout.tsx` y en `/equipo` de Ñekurel, que también usa `SaveForm`.
   - `SaveForm` llama a `showToast` al guardar bien.
4. **Los errores se quedan como están:** "No se guardaron los cambios." y el detalle, al lado del botón. Un error no debe desaparecer solo.
5. **Descartar al lado de Guardar.** Agregar a `SaveForm` una prop opcional `onDiscard`. Con ella, y solo si hay cambios, aparece "Descartar cambios" junto a Guardar, dentro de `.form-actions`. Para las clases nuevas usar utilidades de Tailwind.
6. **Limpiar:**
   - Borrar `modules/sauna/ui/saved-note.tsx` y sus usos.
   - Quitar el botón propio y el estado `dirty` de `horarios-screen.tsx` y `precios-screen.tsx`, y pasarles `onDiscard`.
   - Corregir el comentario de `ajustes-screen.tsx` que habla del mensaje propio del formulario.
   - Borrar de `legacy.css` y `panel.css` las reglas que queden sin uso. `.autosave-status` sigue en uso para el error.

**Hecho cuando:** al guardar, el botón dice "Guardando…", no aparece ningún otro texto y después sale un toast; con cambios sin guardar no hay ningún texto de aviso; salir con cambios sigue preguntando; Descartar está pegado a Guardar. Comprobarlo en Horarios y precios, Sitio, una receta y un producto.

## Tarea 2. Agenda: barra de arriba

En `modules/sauna/ui/agenda-screen.tsx`:

- **Izquierda:** `[←] fecha [→]`, con el `heading()` actual entre las dos flechas.
- **Derecha:** las vistas Día, Semana y Mes, como un solo control segmentado, con `aria-pressed`.
- **En celular** las dos partes pueden ir en filas separadas, sin desborde.
- **Se quitan** los botones Hoy y Mañana, y el botón "Feriados y cierres" (ver tarea 3).
- **La vista inicial sigue siendo Día.**

**Hecho cuando:** la barra se ve así a 1280 y a 390 px y las flechas mueven un día, una semana o un mes según la vista.

## Tarea 3. Agenda: marcar ocupado desde la grilla, con panel lateral

Referencia: la agenda de una inmobiliaria. Se ve la semana o el mes, se hace clic en un horario o un día y al costado aparece qué se puede hacer. **Marcar ocupado es crear un cierre** (`sauna_closures`): impide reservas nuevas y no cancela las hechas. Esa regla no cambia.

### Quitar

- `closures-dialog.tsx` y su botón.
- `CloseToday` del encabezado. **La función se conserva:** pasa al panel lateral, solo cuando lo seleccionado es el día de hoy. Era un pedido del cliente.
- El texto visible "Con cierre" o "Cierre" pasa a ser "Ocupado".

### Vistas

- **Semana:** pasa a ser una grilla de horarios, con una columna por día y una fila por horario.
  - Las filas salen de las franjas de la semana y de `startStepMinutes`, desde el inicio más temprano hasta el fin más tardío.
  - Cada celda es un `button` con `aria-pressed` y un `aria-label` completo, y muestra si está libre, ocupada, reservada (con el nombre de quien reservó) o fuera del horario de atención (día cerrado u hora sin franja).
  - A 390 px, desplazamiento horizontal dentro de la grilla, con la columna de horas fija. La página no debe desbordar.
- **Mes:** como ahora, pero el clic selecciona el día en vez de abrir la vista Día. Distinguir "Ocupado" (todo el día) de "Ocupado en parte".
- **Día:** la lista actual de reservas se mantiene, y el panel lateral arranca con ese día seleccionado.

### Panel lateral

Componente nuevo `modules/sauna/ui/agenda-aside.tsx`. Columna fija a la derecha desde `lg`; más abajo va debajo de la grilla, y al seleccionar se lleva a la vista con `scrollIntoView`. Sin selección muestra una indicación corta: "Elegí un horario o un día".

| Lo seleccionado | Qué muestra |
|---|---|
| Horario libre | "Marcar como ocupado", con motivo opcional. |
| Día | "Marcar el día como ocupado", con motivo opcional; cantidad de reservas; "Ver día", que abre la vista Día. |
| Hoy | Lo de "Día", más "No habilitar más turnos por hoy", con su confirmación actual. |
| Con reservas | Las reservas, con `BookingCard`, y el aviso "Las reservas ya hechas no se cancelan" junto a la acción de ocupar. |
| Ya ocupado | Motivo, el rango completo del cierre y "Liberar". Si el cierre es más amplio que lo seleccionado, avisar: "Este cierre va del X al Y y se libera completo". |
| Horario pasado | Solo lectura. No se ofrece ocupar. |

- La selección se guarda por clave (fecha y hora), no como objeto: `useResource` refresca solo (`live: true`) y no debe perderla.
- Cambiar de vista o de rango la limpia si queda afuera.
- Tras ocupar o liberar: `reload()` y `showToast` (tarea 1). Los errores van dentro del panel, con `Notice`.

### Servidor

- `GET /sauna/agenda` (`modules/sauna/api/bookings.ts`) suma `bands` y `stepMinutes`, porque la grilla los necesita.
- `POST /sauna/closures` (`modules/sauna/api/setup.ts`) suma un tercer caso: `{ startsAt, endsAt, reason }`. Se conservan `{ today: true }` y `{ from, to }`; un día completo usa este último, con `from` igual a `to`.
- `DELETE` no cambia.

### Dominio, con tests en el mismo cambio

- `closureFromRange` en `domain/setup.ts`: fechas válidas, fin posterior al inicio, fin no vencido, motivo de hasta 200 caracteres.
- En `domain/agenda.ts`:
  - Las filas de la grilla a partir de franjas e intervalo.
  - El instante de una celda.
  - El cierre que cubre una celda o un día.
  - Si un cierre cubre el día entero o una parte.
- Calcular siempre con la hora de Buenos Aires y las funciones de `domain/time.ts`, nunca con la zona del navegador.

### Fuera de alcance, y anotarlo en el registro

Liberar una parte de un cierre, y marcar varios días o arrastrar para elegir un rango: un cierre se crea por clic. Antes el diálogo permitía cargar un rango de días, y esa posibilidad se pierde. Los cierres de varios días que ya existen se siguen viendo y liberando.

**Hecho cuando:** desde Semana se ocupa y se libera un horario; desde Mes, un día; el sitio público deja de ofrecer lo ocupado; no queda el botón ni el diálogo de feriados; "No más turnos por hoy" funciona desde el panel lateral. A 1280 y 390 px, con teclado.

## Tarea 4. Horarios y precios en una sola página, y "Lugares" y "minutos" que se entiendan

### Una página

- Una sección nueva en `modules/sauna/panel.tsx`: `{ path: "horarios-precios", label: "Horarios y precios", icon: Clock, permission: "sauna.horarios-precios" }`, en lugar de las dos actuales.
- Ruta `app/panel/[site]/horarios-precios/page.tsx`. Borrar las rutas `horarios` y `precios`, sin redirecciones: el sitio no está activo y entran dos personas.
- Actualizar los enlaces de `sauna-summary.tsx` y `horarios-screen.tsx`, y las entradas de `modules/sauna/ui/index.ts`.
- La página muestra una sección debajo de la otra: primero **Tipos de turno y precios**, porque los horarios dependen de ellos, y después **Horarios**. Cada una conserva su propio Guardar y su Descartar.
- Si no hay tipos, Horarios muestra "Primero creá un tipo de turno" y queda sin enlace.

**Dos trampas del código actual, que hay que resolver:**

1. **`panel.flushRef` guarda un solo formulario** (`shell.tsx` lo llama antes de cambiar de sección), y `SaveForm` lo pisa al montarse y lo limpia al desmontarse. Con dos en la misma página, solo se protege uno y se pierden cambios sin aviso. Dar a cada formulario su propia referencia y registrar en `panel.flushRef` una función que pregunte por los dos en orden, deteniéndose si alguno devuelve `false`.
2. **Guardar uno no debe borrar lo que se está editando en el otro.** Hoy cada pantalla remonta su formulario al guardar (`key={round}`), con la configuración recargada. Separar un `round` por formulario y compartir un solo `useResource`. El formulario de horarios tiene que leer `config.types` y `settings.revision` de las props en cada render, no del estado inicial: guardar precios cambia `settings.revision`, y una revisión vieja daría error de conflicto al guardar horarios. Lo mismo en sentido contrario para `settings` en el formulario de precios.

Usar un estado de error por formulario en vez de compartir `panel.error`, para que un error no se vea ni se borre desde el otro.

### Textos de la sección Horarios

Un tipo nuevo no aparece para elegir en las franjas hasta guardarlo: decirlo con un texto corto junto a "Agregar tipo".

| Hoy | Pasa a ser |
|---|---|
| Campo "Lugares", con "Cuántas personas entran a la vez, también cuando los turnos se pisan." | **"Personas en el módulo"**, con la ayuda: "Hasta cuántas entran en una reserva grupal. Cada reserva, individual o grupal, ocupa el módulo completo." El valor de respaldo `?? 6` pasa a `?? 2`. |
| "Un turno puede empezar cada" | **"Los turnos empiezan cada"**, con un ejemplo que se actualiza solo: "Con Turno 45 min desde las 10:00: 10:00, 10:45, 11:30…". Usar `turnStarts` con el tipo más corto y la primera franja abierta. |
| (nada) | Si el intervalo es menor que la duración del tipo más largo, sumar: "Los turnos se pisan: reservar uno bloquea los que se le superponen." |
| "Minutos", en cada tipo de turno | **"Duración, en minutos"** |

El armado del ejemplo y la condición de "se pisan" van como funciones puras en `domain/hours.ts`, con tests.

**Hecho cuando:**

- El menú muestra una sola entrada y la página guarda cada parte por separado.
- Con cambios sin guardar en una, guardar la otra no los pierde.
- Salir de la sección con cambios en cualquiera de las dos pregunta, y con cambios en las dos pregunta por ambas.
- Un tipo nuevo guardado aparece enseguida para elegir en las franjas.
- Guardar una parte y después la otra no da conflicto de revisión.
- Sin desborde a 390 px.

## Al terminar

1. Correr `npx tsc --noEmit`, `npx eslint`, `npm test` y `npm run build`.
2. Mirar cada pantalla en Chrome a 1280 y 390 px, y sin errores en la consola.
3. Actualizar:
   - [SAUNA.md](../SAUNA.md) §2 (descripción de las secciones) y la lista de rutas del comienzo de §5.
   - La fila `sauna_closures`, si cambia su descripción.
   - [ROADMAP.md](../ROADMAP.md): estado de S2c y una entrada en el Registro con lo hecho, lo verificado y **lo que no se probó**.
4. Mover este archivo a `docs/archivo/` cuando la fase quede cerrada.

