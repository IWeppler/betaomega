# Ñekurel · Biblioteca botánica

MVP para compartir el conocimiento de una herboristería. Buscador para empleados y panel de tónicos. No incluye inventario, ventas, clientes, cuentas de empleados ni generación de recetas con IA.

## Ejecutar

Requiere Node.js 22.14 o posterior. Con las dependencias instaladas:

```powershell
npm run dev -- --hostname 0.0.0.0
```

Abrir http://localhost:3000 (la tienda) o http://localhost:3000/equipo (vendedor y administración). Para una tablet en la misma red, usar la IP de esta computadora y el puerto 3000. El servidor debe permanecer encendido y el firewall debe permitir el acceso.

## Acceso y flujo

El empleado entra al buscador con el **código de vendedor** (`ANKORA_SELLER_CODE`), que se pide una sola vez por dispositivo y dura 30 días. El dueño usa **Administrar** y la contraseña configurada en `.env.local`. No hay cuentas individuales de empleados.

1. Entrar a **Tónicos**. Hay ejemplos iniciales ya habilitados; revisarlos y ajustarlos.
2. Crear o editar un tónico: nombre, usos, sinónimos de búsqueda, hierbas con su proporción, preparación y advertencias. Las etiquetas se separan con comas.
3. Las hierbas se eligen con un combobox: se escribe, se elige una existente y, si no está, se agrega sola. No hay un módulo de plantas. Cada sugerencia muestra en cuántos tónicos se usa.
4. Habilitar el tónico después de revisarlo. Los borradores no los ve el equipo.
5. Buscar como empleado: se listan los tónicos que coinciden con el síntoma o la necesidad.

## Precios y campos obligatorios

- Tónicos y hierbas tienen **Precio de venta ($)** y **El precio es por** (por ejemplo `100 g` o `bolsita`). Ambos son opcionales: sin precio, la ficha no muestra ninguno. El precio aparece en la lista, el detalle y el mensaje de WhatsApp.
- Lo único obligatorio es el nombre y, en los tónicos, al menos una hierba. Se marca con la etiqueta **Obligatorio**. Usos, preparación, proporciones y advertencias se pueden completar después.
- Los formularios se guardan solos y tienen un botón **Guardar** que confirma con "Se guardó correctamente". Si falla, el error se muestra arriba del formulario y en los logs del servidor con el prefijo `[catalog PUT]`.
- El CSV de tónicos tiene las columnas **Precio** y **Unidad del precio**. Un CSV sin esas columnas no borra los precios existentes.

## Funciones

- **Buscar** por síntoma, sinónimo, nombre del tónico o nombre de una hierba. Los tónicos más consultados aparecen primero cuando no se busca nada.
- **Cliente con**: embarazo, lactancia, niños pequeños o toma de medicación. Los tónicos marcados como no recomendados en esa situación pasan al final con un aviso. El dueño los marca en cada tónico, en **No recomendado en**.
- **Calcular cantidades** (opcional): si las proporciones son del tipo `2 partes`, el detalle calcula los gramos para un total elegido.
- **Copiar o imprimir** la receta con sus advertencias.
- **Hierbas**: vista del administrador con la cantidad de tónicos que usa cada una.
- **Importar y exportar CSV** en Tónicos. Columnas: Nombre, Usos, Sinónimos, Hierbas (`Manzanilla:2 partes|Menta:1 parte`), Preparación, Advertencias, Notas, No recomendado en, Habilitado. Los tónicos se identifican por nombre; los incompletos quedan en borrador.
- **App instalable y sin conexión** (PWA): al abrirla desde el navegador se puede agregar a la pantalla de inicio. Funciona sin wifi con la última versión guardada. Requiere `npm run build` y `npm start`; en desarrollo no se activa.
- Las consultas se cuentan en Supabase.

El administrador puede **Previsualizar borradores**, con un aviso explícito. Los ejemplos provienen del brief y no constituyen indicaciones clínicas validadas. El sistema no completa ni infiere propiedades, dosis o contraindicaciones.

## Configuración

Para una nueva instalación, copiar `.env.example` a `.env.local` y definir:

```dotenv
ANKORA_ADMIN_PASSWORD=una-contraseña-propia
ANKORA_SESSION_SECRET=un-secreto-aleatorio-de-al-menos-32-caracteres
ANKORA_SELLER_CODE=un-codigo-para-el-equipo
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

En esta instalación se creó una contraseña local inicial: `hola123`. Cambiarla antes de exponer el servidor fuera de una red de confianza. Reiniciar el servidor tras modificar las variables. Cambiar también el secreto invalida sesiones anteriores.

La contraseña se valida en el servidor. La sesión dura 8 horas y usa una cookie HttpOnly, SameSite=Strict y firma HMAC. Las escrituras requieren sesión de administrador y el mismo origen. El acceso tiene un límite global local de 10 intentos fallidos por 15 minutos.

## Supabase

El catálogo, el uso y las fotos se guardan en Supabase, tanto en local como en Vercel.

1. Ejecutar `supabase/schema.sql` en el SQL Editor de Supabase. Crea la tabla `app_data`, las funciones y el bucket privado `images`.
2. Definir `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SECRET_KEY` en Vercel y en `.env.local`. La clave secreta nunca lleva prefijo `NEXT_PUBLIC_`.

## Persistencia y alcance

Si todavía no hay catálogo guardado, la app muestra el catálogo inicial y lo guarda en Supabase al primer cambio. Todos los dispositivos consultan el mismo catálogo. La interfaz lo actualiza cada 30 segundos y al recuperar foco. Hay control de versión: si dos administradores editan a la vez, el segundo debe actualizar antes de guardar.

El catálogo del equipo (con notas internas y preparaciones) solo se entrega con el código de vendedor o la sesión de administrador. La tienda pública (`/`) no muestra notas internas ni preparaciones. Cambiar `ANKORA_SELLER_CODE` cierra todas las sesiones de vendedor (por ejemplo, si alguien deja el equipo); las de administrador siguen abiertas. Eliminar una planta utilizada por una mezcla está bloqueado hasta quitarla de sus preparados.

## Verificar

```powershell
npm run lint
npm run build
node --experimental-strip-types --test tests/catalog.test.mjs tests/features.test.mjs tests/store.test.mjs tests/sites.test.mjs tests/recipes.test.mjs tests/images.test.mjs tests/comments.test.mjs tests/metrics.test.mjs
```

Las pruebas cubren sinónimos, normalización, coincidencias falsas, visibilidad de borradores y validación de combinaciones.

## Imágenes, hierbas independientes y WhatsApp

- Desde **Tónicos > Editar** o **Hierbas > Editar hierba**, subir una foto JPG, PNG o WebP (hasta 5 MB). Guardar la ficha para asociarla. Se puede cambiar o quitar la foto sin afectar la receta. Los archivos se guardan en el bucket `images` de Supabase. Las fotos son accesibles a quienes tienen acceso a la web. Quitar una foto de una ficha no elimina el archivo, para conservar otras referencias.
- **Hierbas > Nueva hierba** permite crear fichas independientes de un tónico. Cargar usos y formas de uso (`mate`, `infusión`, etc.), propiedades, nombre científico y sinónimos. El buscador muestra tónicos y hierbas en dos grupos. Los ejemplos iniciales de Menta, Cedrón y Burrito incluyen `mate`; un catálogo ya guardado conserva sus etiquetas y se puede actualizar desde el panel.
- En el detalle de un tónico, seleccionar las hierbas que se van a incluir. El cálculo de gramos usa únicamente esa selección. Si se omiten ingredientes, completar las indicaciones de preparación para esa selección; no se cambia la receta original del dueño ni se transfieren automáticamente sus usos a la mezcla modificada.
- **Compartir por WhatsApp** pide un número con código de país, permite revisar el mensaje y abre `wa.me` con el texto precargado. El vendedor confirma el envío en WhatsApp. No se guarda el número ni se envían mensajes automáticamente. El mensaje incluye ingredientes, cantidades y advertencias; excluye notas internas. También se puede compartir la ficha de una hierba individual. Las imágenes se muestran en la aplicación; WhatsApp comparte texto, sin adjuntar las fotos.
- La columna opcional **Imagen** del CSV conserva referencias a fotos del mismo servidor. Importar un CSV antiguo sin esa columna mantiene la foto existente. El CSV no contiene los archivos de imagen.

## Entrada por rol y vista del vendedor

Al abrir la aplicación se elige **Vendedor** o **Administrador**. El vendedor entra con el código de vendedor (una vez por dispositivo); el administrador usa la sesión protegida existente y entra a Tónicos. La barra superior flotante se eliminó. El vendedor regresa a la selección con la X junto al buscador; el administrador usa Cambiar rol (cierra su sesión). Al recargar se vuelve a elegir el rol.

La vista del vendedor sigue la referencia móvil: fondo gris, búsqueda grande, categorías fotográficas (Mate, Hierbas, Tónicos), accesos rápidos y catálogo en filas. Hay filtros Todo/Tónicos/Hierbas y las situaciones del cliente se expanden al necesitarlas. Las fotos cargadas se muestran en las filas; si falta una foto se usa un icono. La foto decorativa de categorías está en `public/botanical-categories.png`, generada con la herramienta integrada de ImageGen. Las fotos del catálogo tienen prioridad cuando están disponibles. Las fichas, cantidades y WhatsApp conservan sus funciones.

La consulta `GET /api/catalog?scope=public` devuelve únicamente el catálogo público incluso si el navegador conserva una sesión de administrador. La selección visual de un rol no reemplaza la autorización del servidor.

## Tienda online

La portada del sitio (`/`) es una tienda pública simple: sin cuentas de clientes, sin pagos online y sin stock. Los pedidos **no se guardan**: salen solo por WhatsApp. La dueña la administra desde **Administrar > Tienda**, que tiene cuatro secciones.

- **Datos:** WhatsApp de la tienda (con código de país, solo números; es el que recibe pedidos y consultas), Instagram, Facebook, dirección, link del mapa y horarios. Se muestran al pie de la tienda y en cada ficha. Sin WhatsApp cargado, la tienda no ofrece Consultar ni Pedir por WhatsApp. Ya no se usa la variable `NEXT_PUBLIC_WHATSAPP_NUMBER`.
- **Precios:** tabla con todos los tónicos y hierbas, con buscador y filtro por categoría. Al marcar productos aparece una barra al pie con **Precios masivos**: subir o bajar un porcentaje, redondear a un múltiplo o fijar un precio. Los cambios quedan pendientes y se guardan juntos con **Guardar cambios**. Si otra persona modificó el catálogo, el guardado avisa, conserva lo editado y permite actualizar.
- **Visibilidad:** cada ficha y cada categoría tiene el interruptor **Visible en la tienda**. Lo oculto no aparece en la tienda, su link da 404 y no se puede pedir, pero el equipo lo sigue viendo en el buscador. Esta sección lista lo oculto y permite mostrarlo de nuevo.
- **Promociones y combos:** el **precio de oferta** y **Válida hasta** se cargan en la ficha de cada producto; la oferta vencida deja de mostrarse sola. Un combo junta varios productos a un precio fijo, con foto y descripción, y tiene su propia ficha en `/combos/<nombre>`. Dentro de un combo no se aplican ofertas. Un combo con un producto oculto no se muestra y el administrador lo avisa.

La clienta agrega productos con el botón **+**, ve el carrito con el botón flotante, elige **Seguir comprando** o **Finalizar compra**, completa nombre, retiro o envío (con dirección) y nota, y **Pedir por WhatsApp** abre el chat de la tienda con el pedido armado. Los precios siempre se calculan en el servidor con el catálogo actual; el navegador guarda solo productos y cantidades. Si un producto se oculta, el carrito lo quita y avisa.

El icono de la app (pantalla de inicio) es el logo, generado en `app/herboristeria/[site]/pwa-icon/route.tsx`.

## Vista previa al compartir (Open Graph)

La portada social se genera en `app/herboristeria/[site]/og/route.tsx` (se sirve en `/og`) a 1200 × 630 px con la identidad botánica de Ñekurel. El título, la descripción y las etiquetas de Open Graph y Twitter están en `app/herboristeria/[site]/layout.tsx`.

La URL pública de cada sitio está en `lib/sites.ts` (`url`). Si cambia el dominio, cambiarla ahí, agregar el dominio a `domains` y desplegar.

## Varios sitios en una sola app

La app sirve varios sitios según el dominio (plan y estado en `docs/plataforma-multisitio.md`). Los sitios están en `lib/sites.ts`; `proxy.ts` lee el host y reescribe a `app/<tipo>/<sitio>/...`.

- **Ñekurel:** `/` es la tienda, `/<producto>` y `/combos/<combo>` sus fichas, y `/equipo` el buscador del vendedor y la administración. Los links viejos `/catalogo/...` redirigen solos.
- **Purificación y Yakuchil:** sitios de productos (`app/productos/[site]`): portada con búsqueda por nombre o "para qué sirve" y una página por producto. Se cargan en Panel > Productos. Lo que cambia entre ellos está en `products` de `lib/sites.ts`. En Purificación cada agua publicada debe decir si es bebible o de uso externo. Hay que agregar `purificacion.vercel.app` y `yakuchil.vercel.app` en Vercel; en desarrollo, `http://purificacion.localhost:3000`.
- **Dominio desconocido** (localhost, la IP de la tablet, previews): se muestra `DEFAULT_SITE` (por defecto `nekurel`). En desarrollo, `http://nekurel.localhost:3000` elige el sitio por subdominio.
- **Tablet con la app instalada:** la app abre en `/equipo`. Si una tablet ya instalada abre la tienda, quitar la app y volver a instalarla desde `/equipo`.
- **Agregar un dominio:** sumarlo a `domains` en `lib/sites.ts`, agregarlo al proyecto en Vercel y configurar el DNS.

## Panel central (Betayomega)

La administración de todos los sitios se hace desde el panel, en su propio dominio: `https://betayomega.vercel.app` (en local, `http://panel.localhost:3000`). Se entra con la misma contraseña de administrador. A la izquierda se elige el sitio y su sección: **Resumen** (números y lo que conviene revisar), **Tónicos**, **Hierbas**, **Categorías** y **Tienda**.

- Para usar el dominio gratuito, agregar `betayomega.vercel.app` en Vercel > Settings > Domains de este mismo proyecto. Si se usa otro dominio, definir `PANEL_HOSTS` con la lista de dominios del panel, separados por comas.
- La sesión del panel es propia de su dominio: entrar al panel no abre sesión en `nekurel.com/equipo`, ni al revés.
- Por ahora `/equipo` conserva también su administración, para que se pueda volver a ella mientras se prueba el panel.
