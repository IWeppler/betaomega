# Integración de precios de Ñekurel (H5)

Implementada y desplegada el 2026-11-11. Completa el flujo del panel hacia la tienda, el equipo y el pedido por WhatsApp. Ñekurel está activo en https://nekurel.vercel.app.

## Fuente del precio

- `modules/herbal/data/shop.ts` lee el catálogo en el servidor y `sales.ts` recalcula los tónicos antes de construir fichas, ofertas, carrito y ahorro de combos. No se reutiliza un precio calculado guardado que haya quedado desactualizado.
- Las hierbas que solo tienen `pricePerKgCents` se ofrecen por kg. Si existe una presentación de venta anterior con precio propio, se conserva su importe y unidad.
- La tienda mantiene ISR de una hora y la etiqueta `public-herb-shop`. Las escrituras del catálogo invalidan esa etiqueta. La clave del dato cacheado pasó a `public-herb-shop-v2` para separar la proyección anterior.
- El equipo recibe una proyección de venta con los precios y promociones vigentes. Su vista muestra un aviso cuando falta precio, los pasos de preparación ordenados y 1 kg como cantidad inicial al calcular las hierbas de una presentación por kg. Una selección parcial de ingredientes muestra «Precio de la selección a confirmar» y no comparte el precio del tónico completo.
- La edición administrativa conserva el catálogo original, sin guardar los precios promocionales o las presentaciones de respaldo de esa proyección. El editor anterior de `/equipo` oculta la edición del precio manual de un tónico automático y toma el resultado del servidor al guardar.

## Pedido por WhatsApp

`POST /api/sites/[site]/herbal/order` recibe identificadores, cantidades y datos de entrega. Es público, exige el mismo origen y un sitio de herboristería activo. Rechaza cantidades inválidas, productos repetidos, exceso de tamaño, datos incompletos y productos que ya no están disponibles.

El servidor vuelve a leer el catálogo **sin ISR**, resuelve precios, promociones, visibilidad y totales, y prepara el enlace de WhatsApp. Ignora cualquier precio, subtotal, total o número de destino que envíe el navegador. Los importes del carrito se multiplican y suman en centavos enteros; los productos sin precio continúan «a confirmar» y no se convierten en gratuitos.

El navegador abre una pestaña durante el clic para permitir el flujo en celulares, elimina su acceso a la ventana de origen y la dirige al enlace recién preparado. El resumen muestra el total verificado. Si no se abrió la pestaña, hay un enlace alternativo. Ante un error no se utiliza el precio anterior. Se conserva la advertencia para enlaces demasiado largos.

La API no guarda pedidos ni datos de contacto, no envía mensajes y no cobra. La persona revisa y envía su mensaje desde WhatsApp. Los precios se confirman con la tienda; no se reserva mercadería ni se congela un importe para una compra futura.

## Capas

La lógica nueva vive en `modules/herbal/`, detrás de sus entradas públicas. `platform/catalog` expone tipos, validación y reglas de visualización; `platform/catalog/store` expone los adaptadores existentes de tienda/carrito para el servidor y las pruebas; `platform/catalog/server` expone la lectura del catálogo y lleva `server-only`.

`get-shop.ts`, la ruta del equipo y la API del catálogo son puntos de composición permitidos por ESLint. Los componentes legados de búsqueda y ficha reciben el componente de precio por props. El formateo de un artículo se mantiene separado de los adaptadores que cargan o construyen la tienda para que estos no lleguen al navegador.

## Verificación

- Tipos, ESLint, 469 pruebas y compilación de producción con el entorno habitual.
- Base HTTP simulada, sin conexión a Supabase real: precios nuevos aunque el valor guardado esté obsoleto, importe adulterado ignorado, precio por kg de hierbas, conservación de presentaciones anteriores, datos faltantes, promociones, vencimientos, ahorro de combos, productos ocultos, origen inválido y sitio de otro tipo rechazados.
- La API del catálogo se usó para cambiar precios en la simulación y verificar la actualización de la tienda cacheada. No se filtraron notas internas en el HTML público ni en el enlace del pedido.
- Edge sin interfaz, a 1280 y 390 px: ficha a $27.500/kg, carrito de dos unidades a $55.000, modificación de una hierba con el carrito abierto y pedido/resumen verificados a $75.000. Equipo con pasos numerados, cantidad inicial de 1000 g y selección parcial a confirmar. Sin desborde ni excepciones del navegador.
- La apertura de WhatsApp se interceptó en la prueba: no se contactó a nadie. No se escribieron datos en Supabase real durante H5.

No se probaron un celular físico, el envío real desde WhatsApp, una compra real ni todos los estados de teclado e impresión. No se hizo commit. Completar los precios que sigan faltando según la revisión H4 es una tarea operativa pendiente.

## Publicación

Se reactivó únicamente `sites.active` para `nekurel`, con respaldo local del registro y lectura de verificación. El bucket `images` ya era público; no se modificó su configuración.

El despliegue de producción es `dpl_2f7DUhc8tNraNpmta6PXHsNRDdFc`, del proyecto Vercel `nekurel` (`prj_woJq4HBUDmj4qQVSGExg7ssYtxRa`), equipo `ignacioweppler-projects`. Se construyó desde una copia local del código probado, excluyendo secretos, datos locales y herramientas. Se verificó que compilara antes de promoverlo a los dominios. La versión anterior era `dpl_H6nHGAtHLmBDPnyUQwjCkbJFHKY2`.

El primer intento de subida omitió carpetas de código `data` por una exclusión sin anclar. Se corrigió `.vercelignore` para excluir solamente `/data/`, se verificó el manifiesto de 513 archivos y se repitió el despliegue correctamente. No se cambió la versión pública durante ese intento fallido.

Después de promover: HTTP 200 para Ñekurel, BetaOmega, Comidas del cielo, Purificación, Yakuchil y Fropexio; `/equipo` responde 200; `/api/catalog` sin sesión responde 401; el endpoint nuevo de pedidos responde 400 ante un carrito vacío, con el mensaje de validación esperado. Esa comprobación no creó pedidos ni envió mensajes. La inspección del dominio canónico confirmó que apunta al despliegue nuevo en estado `Ready`. Respaldos y comprobaciones en `data/nekurel-publication/`.
