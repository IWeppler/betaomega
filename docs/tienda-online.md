# Tienda online de Ñekurel: objetivo, decisiones y plan por modelo

Este documento es el traspaso entre sesiones y modelos. Quien tome una fase debe leerlo entero, hacer solo su fase, y al terminar marcar el avance en la sección "Estado" y dejar notas en "Registro de decisiones".

**Antes de escribir código:** `AGENTS.md` avisa que esta versión de Next (16.3.8) difiere de lo conocido. Leer la guía correspondiente en `node_modules/next/dist/docs/01-app/` antes de crear rutas, páginas o metadata.

## 1. Objetivo

Convertir el catálogo público (`/catalogo`) en una tienda online simple para una herboristería, administrada por la dueña desde la app, sin cuentas de clientes ni pagos online.

La dueña debe poder, desde el administrador:

1. Cargar los datos de la tienda: WhatsApp de consultas, redes sociales, ubicación y horarios.
2. Cambiar precios de muchos productos a la vez, de forma simple.
3. Ocultar productos o categorías de la tienda sin borrarlos.
4. Armar promociones (precio de oferta) y combos (varios productos a un precio fijo).

La clienta debe poder, desde `/catalogo`:

5. Agregar productos y combos a un carrito.
6. Hacer el pedido por WhatsApp: el mensaje llega al número de la tienda con el detalle y el total.

### Fuera de alcance (por ahora)

- Pagos online, cuentas de clientes, envíos calculados.
- Guardar los pedidos en la base de datos: **los pedidos solo salen por WhatsApp**.
- **Stock.** No hay control de stock. Todo se ofrece siempre y la dueña oculta lo que no tenga. El stock es **el próximo paso** después de esta etapa; no diseñar nada que lo impida (por ejemplo, el carrito no debe asumir disponibilidad infinita en su modelo de datos, solo no consultarla todavía).

## 2. Decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Pedidos | Solo salen por WhatsApp. No se guardan. |
| Datos del pedido | Nombre, retiro o envío, dirección si es envío, nota opcional. |
| Promo y combo | **No se combinan.** Un producto dentro de un combo se vende al precio del combo. La promo de un producto aplica solo a compras sueltas. |
| Stock | No hay. Es el próximo paso. |
| Número de WhatsApp | Pasa de la variable `NEXT_PUBLIC_WHATSAPP_NUMBER` a un dato editable en el administrador. La variable se elimina de `.env.example` y del README al terminar la fase 2. |
| Precios | En pesos argentinos. `price` es el precio de venta; `priceUnit` es texto libre ("100 g", "bolsita"). La cantidad del carrito son unidades de ese precio. |

## 3. Estado de partida (qué existe hoy)

Ya implementado y commiteado hasta `c6b8b9d`:

- Precio de venta opcional en tónicos y hierbas (`price`, `priceUnit`), `formatPrice` en `lib/catalog.ts`, columnas de precio en el CSV, precio en WhatsApp y en la vista del vendedor.
- Campos opcionales en los formularios, etiqueta **Obligatorio**, botón Guardar con confirmación, logs `[catalog PUT]`.

Implementado y **sin commitear** al escribir este documento (revisar `git status`):

- `/catalogo` con formato tienda: `app/catalogo/page.tsx`, `app/catalogo/storefront.tsx` (buscador, chips de categoría, grilla), `app/catalogo/share-button.tsx`.
- Ficha por producto `/catalogo/[slug]` (`app/catalogo/[slug]/page.tsx`), con `slugify` y `assignSlugs` en `lib/catalog.ts`.
- `lib/shop.ts`: `loadShop()` arma los productos públicos (publicados, con categoría, slug y resumen).
- `app/whatsapp-icon.tsx`: icono de WhatsApp propio, usado en toda la app.
- Los productos sin precio muestran "Consultar".

### Cómo está armado el sistema (leer antes de tocar)

- Todo el catálogo es **un solo documento JSON** en Supabase (`app_data`, clave `catalog`). Tipos y validación en `lib/catalog.ts` (`Plant`, `Preparation`, `Catalog`, `validateCatalog`). Agregar campos **opcionales** no rompe catálogos ya guardados y no requiere migración SQL.
- Guardado con control de versión: `lib/store.ts` (`saveCatalog`, `ConflictError`) y `app/api/catalog/route.ts` (PUT solo para administrador y mismo origen).
- Lectura pública: `GET /api/catalog?scope=public` devuelve solo lo publicado y es lo que lee la **vista del vendedor**. Lo oculto en la tienda **sí** viaja ahí, con su marca `hidden` (ver el registro de la fase 1). Las páginas de la tienda no usan este API: leen en el servidor con `lib/shop.ts`.
- Administrador: `app/page.tsx` (cliente, ~1300 líneas), pestañas `search | tonics | herbs`. Formularios de edición: `app/save-form.tsx` (guardan con el botón Guardar; al salir con cambios preguntan). Campo de precio: `PriceFields` en `app/page.tsx`.
- Categorías: `getCategories`, `itemCategories` en `lib/catalog.ts`. Cada producto se muestra bajo la primera categoría que lo incluye.
- Estilos: `app/globals.css`, una sola hoja. Radios: pastillas para controles, `--radius-card` para tarjetas. Un solo acento verde. Sin modo oscuro.
- Código: estilo denso de una línea por sentencia, comentarios solo cuando explican el porqué, textos de interfaz en español rioplatense, sin guiones largos en textos visibles.
- Tests: `node --experimental-strip-types --test tests/catalog.test.mjs tests/features.test.mjs tests/store.test.mjs`. Los módulos que importan los tests deben importar con extensión `.ts` (por eso `lib/shop.ts` carga `store.ts` con un import dinámico). Verificar también `npx tsc --noEmit` y `npx eslint app lib`.
- Service worker `public/sw.js`: subir `VERSION` cuando cambie algo que deba llegar a dispositivos con la app instalada.

## 4. Modelo de datos propuesto (lo define la fase 1)

Todos los campos nuevos son opcionales.

```ts
type StoreSettings = {
  whatsapp?: string;   // solo dígitos con código de país, 8 a 15 dígitos
  instagram?: string;  // usuario o URL
  facebook?: string;   // usuario o URL
  address?: string;    // texto
  mapsUrl?: string;    // URL https
  hours?: string;      // texto libre multilínea
};
// En Plant y Preparation:
//   hidden?: boolean        oculto en la tienda (no afecta la vista del vendedor)
//   promoPrice?: number     precio de oferta
//   promoUntil?: string     fecha límite "YYYY-MM-DD", inclusive, hora de Argentina
// En Category: hidden?: boolean
type Combo = {
  id: string; name: string; description: string; image?: string;
  items: { productId: string; qty: number }[]; // qty entero 1 a 99
  price: number; active: boolean;
};
// En Catalog: store?: StoreSettings; combos?: Combo[];
```

Reglas:

- **Precio vigente** (una sola función en `lib/`, usada por tienda, carrito y mensaje): devuelve `{ price, regular, onPromo, unit }`. La promo aplica solo si hay `price`, `promoPrice < price` y (`promoUntil` vacío o hoy ≤ `promoUntil`).
- Un producto oculto, o en una categoría oculta, no aparece en la tienda, ni en su ficha por link (404), ni en el carrito. Sigue viajando en `GET /api/catalog?scope=public` porque lo usa el vendedor (ver registro de la fase 1).
- Un combo activo cuyo producto está oculto o fue borrado **no se muestra** (y la administración debe avisar cuál combo quedó roto).
- El ahorro de un combo se calcula contra la suma de precios regulares por cantidad, solo si todos los productos tienen precio.
- Borrar una hierba usada en un combo debe estar bloqueado, igual que hoy con los tónicos.

## 5. Carrito y pedido (lo define la fase 6)

- Vive en el navegador (`localStorage`, clave versionada). **Guarda solo ids y cantidades**; los precios se recalculan siempre desde el catálogo actual. Si un producto desapareció o se ocultó, se quita del carrito con un aviso.
- Líneas: producto suelto (`p:<id>`) o combo (`c:<id>`). Cantidad entera de 1 a 99, máximo 50 líneas.
- Un producto en "Consultar" se puede agregar. En el mensaje queda "precio a confirmar" y no suma al total. El total debe decir si hay líneas a confirmar.
- Datos del pedido: nombre (obligatorio), retiro o envío, dirección (obligatoria si es envío), nota opcional.
- Botón **Pedir por WhatsApp**: abre `https://wa.me/<número de la tienda>?text=...`. Si la tienda no cargó número, el botón no se ofrece y se explica por qué.
- El mensaje es texto plano con una línea por ítem, cantidad, unidad, subtotal y total. El largo de la URL tiene un límite práctico: si el mensaje es muy largo, advertir antes de abrir WhatsApp.
- El mensaje nunca incluye notas internas ni datos que no sean del pedido.

Ejemplo de mensaje:

```
Hola, quiero hacer un pedido en Ñekurel.

Nombre: Ana
Entrega: Envío a Calle 123

2 x Manzanilla (100 g): $ 4.000
1 x Combo Digestivo: $ 6.500
1 x Tónico calma: precio a confirmar

Total: $ 10.500 (más los productos a confirmar)
Nota: sin bolsa, por favor.
```

## 6. Fases, modelo asignado y entregables

Orden: 1, luego 2, 3 y 4 (pueden ir en paralelo), luego 5, luego 6, luego 7 y 8.

### Fase 1. Modelo de datos y precio vigente. **Opus 5.5**

**Por qué Opus:** es la decisión de diseño que condiciona todo lo demás. Un error acá se multiplica en cinco fases.

- **Objetivo:** que el catálogo pueda representar datos de tienda, ocultamiento, promociones y combos, con una única fuente de verdad para el precio.
- **Alcance:**
  1. Agregar los tipos y campos de la sección 4 en `lib/catalog.ts`.
  2. Extender `validateCatalog`: formato de `whatsapp`, URLs `https`, `promoPrice` numérico válido, `promoUntil` con formato de fecha, combos (ids existentes, cantidades enteras, precio válido, nombres únicos, límites de tamaño).
  3. Crear la función de precio vigente y la del ahorro de un combo, puras y testeadas (con la fecha como parámetro para poder testear).
  4. Crear el helper que decide si un producto es **visible en la tienda** (oculto propio o por categoría) y usarlo en `lib/shop.ts`. (Hecho: el API público no filtra, ver registro.)
  5. Bloquear borrar una hierba usada en un combo (regla en el administrador, apoyada en una función de `lib/`).
  6. Tests en `tests/catalog.test.mjs`.
- **No hacer:** interfaces de administrador ni cambios visuales en la tienda.
- **Criterios de aceptación:** `tsc`, `eslint` y los tests pasan; un catálogo viejo sin campos nuevos valida y se comporta igual; la función de precio cubre promo vencida, promo mayor al precio, sin precio y combo con producto sin precio.
- **Entrega:** actualizar "Estado" y anotar en el registro cualquier cambio al modelo de la sección 4.

### Fase 2. Pestaña Tienda: datos de contacto. **Sonnet 5.5**

- **Objetivo:** que la dueña cargue WhatsApp, Instagram, Facebook, dirección, mapa y horarios, y que se vean en la tienda.
- **Alcance:**
  1. Nueva pestaña **Tienda** en `app/page.tsx` (o mover su contenido a un componente propio para no crecer más ese archivo) con la sección **Datos**.
  2. Formulario con botón Guardar, siguiendo `SaveForm`. Solo el número de WhatsApp es el dato "importante" y se marca; el resto es opcional.
  3. Mostrar los datos en `/catalogo` (pie con redes, dirección con link al mapa, horarios) y un enlace de contacto en la ficha. Reemplazar el uso de `NEXT_PUBLIC_WHATSAPP_NUMBER` por el dato guardado y quitar la variable de `.env.example` y del README.
  4. Los datos de la tienda viajan en `GET /api/catalog?scope=public`.
- **Criterios de aceptación:** sin número cargado, los botones "Consultar" no aparecen y nada se rompe; con número, abren el chat correcto.

### Fase 3. Edición masiva de precios. **Sonnet 5.5**

- **Objetivo:** cambiar precios de muchos productos sin abrir ficha por ficha.
- **Alcance:** sección **Precios** de la pestaña Tienda:
  1. Tabla con todos los tónicos y hierbas: nombre, categoría, precio y unidad editables en la fila.
  2. Filtro por categoría y por texto; seleccionar varias filas.
  3. Acciones sobre la selección: subir o bajar un porcentaje, redondear a un múltiplo configurable (por ejemplo $50 o $100), fijar un precio.
  4. Los cambios quedan **pendientes** y se ven resaltados; un botón **Guardar cambios** guarda todo en una sola operación y **Descartar** los deshace. Mostrar antes del guardado cuántos productos cambian.
  5. Un solo guardado respeta el control de versión del catálogo (si hay conflicto, mostrar el mensaje existente y no perder lo editado).
- **Criterios de aceptación:** ajustar +10% a 30 productos y guardar es una sola operación; precios inválidos o negativos se rechazan en pantalla con un mensaje claro; no se pierde lo editado si falla el guardado.

### Fase 4. Ocultar productos y categorías. **Sonnet 5.5**

- **Objetivo:** que la dueña esconda cosas de la tienda sin borrarlas.
- **Alcance:**
  1. Interruptor "Visible en la tienda" en los formularios de tónico y hierba, y en el editor de categorías.
  2. Sección **Visibilidad** en Tienda: lista de lo oculto con opción de mostrar de nuevo.
  3. Aplicar la visibilidad usando el helper de la fase 1 en `/catalogo`, en `/catalogo/[slug]` (404 si está oculto). Esto ya funciona desde la fase 1; falta la interfaz. El API público no se filtra.
  4. La vista del vendedor (app interna) **no cambia**: sigue viendo todo.
- **Criterios de aceptación:** un producto oculto da 404 en su link, no aparece en el listado de la tienda pero el vendedor lo sigue viendo; ocultar una categoría oculta todos sus productos sin tocar sus fichas.

### Fase 5. Promociones y combos. **Opus 5.5 (modelo) y Sonnet 5.5 (interfaz)**

**Por qué dos modelos:** la lógica de precios y la validación de combos es delicada (Opus); armar los formularios y las tarjetas es trabajo de interfaz (Sonnet).

- **Objetivo:** ofertas por producto y combos con precio fijo, visibles en la tienda.
- **Alcance:**
  1. ~~Opus: revisar la función de precio, definir cómo se muestra el ahorro, la regla "promo y combo no se combinan" y los tests.~~ **Hecho.** Ver "Guía para Sonnet: fase 5" abajo.
  2. Sonnet: campo de **precio de oferta** y **válida hasta** en los formularios; sección **Promociones y combos** en Tienda para crear, editar, activar y desactivar combos (nombre, foto, descripción, productos con cantidad, precio).
  3. Sonnet: en la tienda, precio tachado y precio de oferta, etiqueta de oferta, una sección **Combos** con tarjetas propias, y la ficha del combo en **`/catalogo/combos/[slug]`** (ruta decidida; el slug `combos` está reservado y ningún producto puede tomarlo).
  4. Aviso en administración si un combo quedó roto: `brokenCombos(catalog)` (por diseño, un combo solo puede romperse por un producto oculto o en borrador; borrar está bloqueado).

**Guía para Sonnet: fase 5 (todo listo en `lib/`, solo falta interfaz)**

- `loadShop()` (`lib/shop.ts`) devuelve `{ catalog, items, combos, offers, store }`. Todos los precios ya vienen resueltos para hoy con `effectivePrice`. **No calcular precios en la interfaz.**
- Cada `ShopItem` trae `price` (el que se cobra, con unidad: ya es el de oferta si hay promo, o `""` si es "Consultar"), `regularPrice` (solo durante la promo, para mostrar tachado) y `pricing.onPromo` (para la etiqueta "Oferta"). `/catalogo` y `/catalogo/[slug]` ya muestran el precio de oferta como precio; falta mostrar el tachado y la etiqueta.
- Cada `ShopCombo` trae `key`, `slug`, `name`, `description`, `image`, `price`, `priceValue`, `items` (nombre, cantidad y `slug` para enlazar cada producto), y `regularPrice` y `savings` **solo** si todos los productos tienen precio y el combo es más barato. Mostrar "Ahorrás {savings}" solo cuando exista. Solo llegan combos activos y con todos sus productos visibles.
- En el formulario de la oferta, avisar si `promoPrice >= price` o si no hay precio: se guarda igual pero no se aplica (decisión de la fase 1).
- Formatear montos con `formatMoney` de `lib/catalog.ts`.
- Nunca pasar `ShopItem.item` ni `catalog` a un componente cliente: tienen notas internas. Mapear a los campos que se muestran, como ya hace `app/catalogo/page.tsx`.
- Tests de referencia: `tests/store.test.mjs`.
- **Criterios de aceptación:** una promo vencida deja de mostrarse sola; un combo roto no se muestra al público; el ahorro mostrado coincide con el cálculo de la fase 1.

### Fase 6. Carrito y pedido por WhatsApp. **Opus 5.5 (lógica) y Sonnet 5.5 (interfaz)**

- **Objetivo:** que la clienta arme un pedido y lo envíe por WhatsApp.
- **Alcance:**
  1. ~~Opus: módulo del carrito y generador del mensaje, puros y con tests.~~ **Hecho** en `lib/cart.ts`. Ver "Guía para Sonnet: fase 6" abajo.
  2. Sonnet: botón **Agregar** en tarjetas, fichas y combos; ícono de carrito con contador en el encabezado; panel o página del carrito con cantidades, quitar, datos del pedido (nombre, retiro o envío, dirección, nota) y botón **Pedir por WhatsApp**.
  3. Persistencia en `localStorage` con manejo seguro de errores (ver las reglas de la sección 5).

**Guía para Sonnet: fase 6 (todo listo en `lib/cart.ts`, solo falta interfaz)**

- **Datos:** la página del servidor pasa `shop.offers` (lista de `Offer`: `key`, `name`, `unit`, `price`) al componente cliente del carrito. Es seguro mandarlo al navegador: no tiene datos internos. La clave de un producto es `ShopItem.key` (`p:<id>`), la de un combo `ShopCombo.key` (`c:<id>`).
- **Guardar y leer:** `parseCart(localStorage.getItem(CART_STORAGE_KEY))` y `localStorage.setItem(CART_STORAGE_KEY, serializeCart(cart))`. Envolver **cada** acceso a `localStorage` en `try/catch` (navegación privada, almacenamiento bloqueado): si falla, el carrito funciona en memoria. Leer en un `useEffect` para no romper la hidratación.
- **Operar:** `addToCart`, `setQty` (0 quita), `removeFromCart`, `cartCount` para el contador. Antes de agregar una línea nueva, `canAdd(cart, key)`: si es `false`, avisar "El carrito llegó al máximo de 50 productos distintos".
- **Mostrar:** `resolveCart(cart, offers)` da `lines` (con `name`, `unit`, `unitPrice`, `subtotal`, sin precio si es "Consultar"), `total`, `pending` (líneas a confirmar) y `removed`. Si `removed.length > 0`, guardar `resolved.cart` y avisar "Quitamos del carrito N productos que ya no están disponibles". Si `pending > 0`, decir que esos precios se confirman por WhatsApp.
- **Pedir:** `validateOrder(details)` devuelve los errores por campo (mostrarlos debajo de cada campo). Con el formulario válido: `orderMessage(resolveCart(cart, offers), details)` y `orderUrl(store.whatsapp, message)`. Si `tooLong`, advertir que el pedido es muy largo y sugerir dividirlo, pero dejar abrir igual. Si la tienda no tiene WhatsApp (`!store.whatsapp`), no ofrecer el botón y explicar que se puede consultar por las redes o en el local.
- **No hacer:** calcular precios o totales en la interfaz, ni guardar precios en el navegador, ni armar el texto del mensaje a mano. Todo eso está en `lib/cart.ts` y tiene tests.
- Después de abrir WhatsApp, **no** vaciar el carrito automáticamente (la persona puede volver sin enviar); ofrecer "Vaciar carrito".
- Tests de referencia: `tests/store.test.mjs`.
- **Criterios de aceptación:** el mensaje coincide con el ejemplo de la sección 5; los precios del mensaje siempre salen del catálogo actual, nunca de lo guardado en el navegador; sin número de WhatsApp en la tienda no se ofrece el botón y se explica.

### Fase 7. Revisión final. **Opus 5.5**

- **Objetivo:** cerrar riesgos antes de publicar.
- **Entrega:** lista de hallazgos corregidos y pendientes en el registro.

**Prerrevisión hecha (Opus 5.5, 2026-10-26)**, sobre lo que existía antes de las fases 2 a 6:

- Correcto: las páginas de la tienda no mandan al navegador datos internos (`app/catalogo/page.tsx` mapea a `Product` sin `item`; la ficha usa `item` solo en el servidor). Las `offers` del carrito tampoco (test en `tests/store.test.mjs`).
- Correcto: el mensaje de pedido no permite agregar líneas falsas (saltos de línea y caracteres de control del cliente se aplanan; test con prueba de mutación).
- Correcto: el precio se calcula en un solo lugar (`effectivePrice`), en el servidor; el navegador recibe precios ya resueltos y el carrito nunca guarda precios.
- **Resuelto (opción b): el API ya no expone notas internas ni recetas sin sesión.** Antes, `GET /api/catalog?scope=public` las devolvía a cualquiera porque el vendedor entraba sin contraseña. Ahora:
  - El vendedor entra con un **código de vendedor** (`ANKORA_SELLER_CODE`), una vez por dispositivo; la sesión dura 30 días (cookie `nekurel-seller`, HttpOnly, SameSite=Strict, firmada con `ANKORA_SESSION_SECRET`). La firma incluye el código: **cambiar el código cierra todas las sesiones de vendedor**.
  - `isSeller()` en `lib/auth.ts` (vendedor o administrador). `GET /api/catalog` y `GET`/`POST /api/usage` responden 401 sin sesión. `/api/session` acepta `{ code }` además de `{ password }` y comparte el límite de intentos.
  - La tienda (`/catalogo`) no cambió: sigue siendo pública y lee en el servidor.
  - Probado de punta a punta: sin sesión 401; código incorrecto 401; código correcto abre sesión y devuelve el catálogo con notas; una cookie de vendedor puesta como cookie de administrador no da acceso de administrador; sin cabecera `Origin` 403; cambiar el código cierra la sesión; `/catalogo` responde 200 sin sesión.
  - **Para desplegar:** definir `ANKORA_SELLER_CODE` en Vercel **antes** de publicar. Sin esa variable, el equipo no puede entrar a la vista del vendedor (la pantalla lo explica).

**Lista de chequeo para la revisión final**, a correr cuando terminen las fases 2 a 6 (puede hacerla Sonnet si no se vuelve a Opus):

1. Ninguna página de `app/catalogo/` pasa `ShopItem.item`, `shop.catalog` ni objetos `Plant`/`Preparation`/`Catalog` a un componente `"use client"` (buscar los props de cada componente cliente).
2. Ningún componente calcula precios, totales o ahorros por su cuenta: todo sale de `lib/shop.ts` y `lib/cart.ts` (buscar `* qty`, `price *`, `reduce(` en `app/`).
3. Un producto oculto, un borrador y un producto de una categoría oculta: no aparecen en `/catalogo`, su ficha da 404, no se pueden agregar, y un carrito viejo que los tenía los quita con aviso.
4. Un combo con un producto oculto no aparece, su ficha da 404 y se avisa en el administrador.
5. Sin WhatsApp cargado no se ofrece "Pedir por WhatsApp" ni "Consultar"; con WhatsApp, el link abre el número correcto.
6. Datos de la tienda: los links de Instagram, Facebook y mapa abren con `rel="noopener noreferrer"`; un usuario `@nekurel` se convierte en link correcto.
7. Accesibilidad: todo control de 44 px o más, foco visible, contador del carrito anunciado (`aria-live`), errores del formulario asociados a su campo, contraste del precio tachado.
8. Sin conexión: el service worker guarda las páginas de la tienda (`navigate`, network first). Un pedido armado sin conexión usa los precios de la última página vista; verificar que la página muestre "Precios al <fecha>" y subir `VERSION` en `public/sw.js`.
9. Edición masiva de precios: un conflicto de versión no pierde lo editado.
10. Correr los tres archivos de tests, `tsc` y `eslint`.

### Fase 8. Tests, README y commit. **Haiku 5.5**

- Completar tests faltantes, documentar la tienda en `README.md` (datos de la tienda, precios masivos, ocultar, promociones y combos, carrito), subir la versión del service worker y commitear en commits separados por fase con la atribución habitual. No pushear sin que la persona lo pida.

## 7. Estado

Actualizar esta tabla al terminar cada fase.

| Fase | Modelo | Estado |
|---|---|---|
| 0. Commitear catálogo en grilla, fichas por slug e ícono de WhatsApp | Haiku 5.5 | Hecho (Opus 5.5) |
| 1. Modelo de datos y precio vigente | Opus 5.5 | Hecho |
| 2. Pestaña Tienda: datos de contacto | Sonnet 5.5 | Hecho |
| 3. Edición masiva de precios | Sonnet 5.5 | Hecho |
| 4. Ocultar productos y categorías | Sonnet 5.5 | Hecho |
| 5. Promociones y combos | Opus 5.5 y Sonnet 5.5 | Hecho (modelo e interfaz) |
| 6. Carrito y pedido por WhatsApp | Opus 5.5 y Sonnet 5.5 | Hecho (lógica e interfaz) |
| 7. Revisión final | Opus 5.5 | Lista de chequeo corrida por Sonnet 5.5 (ver registro); falta revisión de Opus si se quiere |
| 8. Tests, README y commit | Haiku 5.5 | Pendiente |

## 8. Registro de decisiones y notas entre fases

(Cada fase agrega acá lo que cambió respecto del plan, con fecha y motivo.)

- 2026-10-26: plan inicial redactado. Pedidos solo por WhatsApp, sin stock (próximo paso), promo y combo no se combinan.
- 2026-10-26, fase 1 (Opus 5.5). Qué quedó en `lib/catalog.ts` y cómo usarlo en las fases siguientes:
  - **Tipos:** `StoreSettings`, `Combo`; campos `hidden`, `promoPrice`, `promoUntil` en tónicos y hierbas (tipo `StoreFields`); `hidden` en `Category`; `store` y `combos` en `Catalog`. Todo opcional; los catálogos guardados siguen validando.
  - **Precio:** `effectivePrice(item, storeToday())` es la única fuente de verdad. Devuelve `{ price, regular, onPromo, unit }`. `storeToday()` da la fecha en hora de Argentina; pasarla como parámetro permite testear. **No calcular precios a mano en ningún otro lado.**
  - **Visibilidad:** `storeCategory(catalog, item)` devuelve la categoría donde se lista el producto en la tienda (primera categoría visible) o `undefined` si no está en la tienda (borrador, oculto, o todas sus categorías ocultas). `isInStore` es el atajo booleano. `lib/shop.ts` ya lo usa, así que `/catalogo` y `/catalogo/[slug]` ya respetan `hidden` (la ficha oculta da 404).
  - **Combos:** `isComboInStore`, `brokenCombos` (activos con un producto fuera de la tienda, para avisar en el administrador), `combosUsing` (bloquea borrar), `comboSavings` (contra precios regulares, nunca contra ofertas; `undefined` si falta algún precio; nunca negativo), `findProduct`.
  - **Cambio de plan: el API público NO filtra lo oculto.** `GET /api/catalog?scope=public` es lo que usa la vista del vendedor (`app/page.tsx`), que no se usa con contraseña. Si filtrara lo oculto, el vendedor dejaría de verlo, contra la regla de la fase 4. Se decidió que "oculto" es una decisión comercial, no un secreto: el API lo sigue devolviendo con su marca `hidden`, y las páginas de la tienda filtran en el servidor con `storeCategory`. Las fases 4 y 7 deben tomar esto como dado.
  - **Cambio de plan: un combo nunca apunta a un producto borrado.** La validación rechaza combos con productos inexistentes, y el administrador bloquea borrar un producto usado en un combo (tónicos y hierbas, no solo hierbas). Por eso "combo roto" solo puede deberse a un producto oculto o en borrador.
  - **Ofertas tolerantes:** una oferta mayor o igual al precio, o sin precio, se guarda igual y simplemente no aplica. Así una baja masiva de precios (fase 3) nunca bloquea el guardado. La fase 5 debe avisarlo en el formulario.
  - **Datos de la tienda:** `whatsapp` solo dígitos (8 a 15, sin 0 inicial); Instagram y Facebook aceptan usuario (`@nekurel`) o link `https://`; `mapsUrl` debe ser `https://`. Strings vacíos significan "sin cargar". Normalizar el usuario a link es trabajo de la fase 2.
  - **Slugs estables:** se asignan sobre todos los productos publicados, no solo los visibles, para que ocultar uno no cambie el link de otro.
  - **CSV:** reimportar tónicos conserva `hidden`, `promoPrice` y `promoUntil`, que no viajan en el CSV.
  - Tests: 11 nuevos en `tests/catalog.test.mjs` (sección "Online store").
- 2026-10-26, partes de Opus de las fases 5, 6 y 7 (Opus 5.5), adelantadas para que Sonnet haga todo lo demás de corrido:
  - `lib/shop.ts`: `buildShop(catalog, today)` (puro, testeable) y `loadShop()`. Agrega `combos`, `offers` y `store`, y resuelve los precios con `effectivePrice`. `ShopItem.price` ahora es el precio que se cobra (el de oferta si hay promo).
  - `lib/catalog.ts`: `formatMoney`, `comboSlug`, y el slug `combos` reservado (un producto llamado "Combos" toma `combos-producto`).
  - **Decisión: ruta de combos `/catalogo/combos/[slug]`.**
  - **Decisión: el carrito resuelve contra `offers`, no contra el catálogo.** El navegador nunca recibe el catálogo entero (tiene notas y recetas); recibe solo nombre, unidad y precio vigente de lo que se puede comprar.
  - `lib/cart.ts`: carrito, validación del pedido, mensaje y link de WhatsApp. Límites: 99 por línea, 50 líneas, aviso si el link supera 4000 caracteres. Lo que escribe el cliente se aplana a una línea para que no pueda agregar renglones falsos al pedido.
  - Tests: 13 nuevos en `tests/store.test.mjs`.
  - Prerrevisión de la fase 7 y lista de chequeo final: ver la fase 7. **Queda una decisión para la dueña: el API público expone notas internas y recetas.**
- 2026-10-26, fases 2, 3, 4 y las interfaces de 5 y 6 (Sonnet 5.5):
  - **Archivos nuevos:** `app/store-tab.tsx` (pestaña Tienda con Datos, Precios, Visibilidad y Promociones y combos), `lib/store-tools.ts` (links de redes, edición masiva de precios; puro y con tests), `app/catalogo/cart.tsx` y `cart-store.ts` (carrito en el navegador), `app/catalogo/layout.tsx` (reparte `shop.offers` al carrito), `app/catalogo/store-info.tsx`, `app/catalogo/combos/[slug]/page.tsx`, `app/catalogo/get-shop.ts` (una lectura por pedido).
  - `GET /api/catalog?scope=public` ahora incluye `store`. Se quitó `NEXT_PUBLIC_WHATSAPP_NUMBER` de `.env.example` (el README nunca la mencionaba). Service worker en `v20`.
  - Los precios pendientes de la edición masiva viven en `StoreTab` (sobreviven al cambiar de sección o pestaña) y se pausa la actualización automática del catálogo mientras hay cambios sin guardar. Ante un conflicto de versión se conservan y aparece "Actualizar catálogo".
  - Los combos se guardan con un botón propio (sin autoguardado) para no mandar al servidor combos a medio armar.
  - **Resultado de la lista de chequeo (fase 7):**
    1. Correcto: los componentes cliente reciben solo campos mapeados (`Product`, `ComboCardData`, `Offer`); `.item` y `shop.catalog` se usan solo en páginas de servidor.
    2. Correcto: sin cuentas de precios en `app/` (el único `reduce` es el cálculo de gramos de `finder.tsx`).
    3 y 4. Verificado con una base simulada: producto oculto 404, combo visible; ocultar/borrador/categoría oculta cubiertos por tests de `storeCategory` y `buildShop`; el carrito quita líneas que ya no se ofrecen y avisa.
    5. Verificado: sin WhatsApp el panel del carrito lo explica y no hay botón; con número el mensaje sale por `wa.me/<número>` con el formato del ejemplo.
    6. Correcto: `rel="noopener noreferrer"` en redes, mapa y WhatsApp; `@nekurel` pasa a `https://instagram.com/nekurel` (test); un valor tipo `javascript:` no se convierte en link.
    7. Parcial: controles de 44 px o más, errores con `aria-describedby`/`aria-invalid`, contador con `aria-live`, tachado en gris `--muted`. No se midió contraste con herramienta ni se probó con lector de pantalla.
    8. Páginas con "Precios al <fecha>" (catálogo, ficha, combo, carrito) y `VERSION` subida. No se probó sin conexión de verdad.
    9. Verificado de punta a punta: con la versión del catálogo cambiada por otro lado, el guardado falla con el mensaje existente, los cambios siguen y tras actualizar se guardan.
    10. 57 tests, `tsc` y `eslint` sin errores.
  - **Pendientes:** probar los formularios de tónico y hierba (interruptor "Visible en la tienda", oferta) y el editor de categorías en el navegador; verificar `ANKORA_SELLER_CODE` en Vercel. El `.env.local` local tiene la clave escrita `ANKORA_SELLLER_CODE` (tres L), por eso la vista del vendedor no funciona en local. Fase 8 (README, commits) sin hacer.
