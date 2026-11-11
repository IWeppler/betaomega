# Panel de Ñekurel: hierbas y tónicos

## Alcance y estado

1. **Implementado:** precio de referencia por kilogramo de cada hierba, opcional, en centavos enteros (`pricePerKgCents`). Se muestra en el formulario y en la lista. Un valor ausente se indica explícitamente y no equivale a cero.
2. **Implementado:** ingredientes con selector de hierba, partes, porcentaje de la fórmula, aviso de precio por kg faltante y controles para agregar, quitar y ordenar. Preparación por pasos editables y ordenables. Se exige al menos una hierba y un paso al guardar desde el panel.
3. **Implementado:** precio automático del tónico según sus hierbas y el peso de la presentación, con desglose por ingrediente, total por kg y total por presentación. El servidor recalcula todos los tónicos automáticos al leer o guardar el catálogo desde su API.
4. **Aplicado en Supabase el 2026-11-11:** catálogo adaptado de revisión 21 a 22, con respaldo, 8 preparaciones conservadas como pasos y 9 presentaciones de 1 kg confirmadas por el usuario. No había precios para convertir: quedan pendientes los precios por kg de 27 hierbas y la preparación y proporciones de «Dexintoxicante». [Informe](nekurel-adaptacion-datos.md).
5. **Implementado, verificado y desplegado el 2026-11-11:** precios automáticos en tienda, equipo, carrito y pedido por WhatsApp; la preparación del pedido vuelve a verificar los importes en el servidor. Ñekurel está activo en https://nekurel.vercel.app. [Informe](nekurel-integracion-precios.md). Completar los datos que sigan pendientes.

## Compatibilidad y decisiones

- El catálogo sigue siendo el documento JSON actual, con su control de revisión. No requiere migración SQL ni modifica datos hasta que se guarda un formulario.
- El precio por kg es independiente del precio de venta por presentación que ya existía. Desde H4, por indicación del usuario, los 9 tónicos existentes tienen una presentación de **1 kg** y cálculo automático; los nuevos y la activación del cálculo también proponen 1 kg. No se convierten unidades anteriores por inferencia. Una presentación de 1000 g usa `priceUnit: "kg"`.
- `presentationWeightGrams` activa el cálculo automático y acepta gramos enteros entre 1 y 1.000.000. `calculatedPriceCents` guarda el resultado en centavos enteros; `price` y `priceUnit` son su proyección de compatibilidad para los consumidores existentes del catálogo. Las lecturas y escrituras de `/api/catalog` reemplazan esos tres valores con el resultado del servidor y recalculan todos los tónicos cuando cambia una hierba. H5 también recalcula al construir la tienda y al preparar un pedido, sin confiar en importes guardados o enviados por el navegador.
- La fórmula es `suma(precio por kg × partes) / suma(partes)`. El importe de la presentación aplica `gramos / 1000` a la fórmula exacta. Se usa aritmética entera con `BigInt` y se redondea una sola vez al centavo más cercano, con mitad hacia arriba; nunca se reutiliza el total por kg ya redondeado para cobrar la presentación. El desglose por kg distribuye los centavos de redondeo según los mayores restos para coincidir con el total.
- Falta de hierba, precio o proporción válida deja el tónico automático pendiente de calcular y elimina cualquier importe calculado anterior. Un precio de cero es válido. No se suma envase, elaboración ni margen adicional. Los límites del catálogo anterior siguen vigentes: una presentación no supera $100.000.000.
- Los porcentajes se derivan de las partes: 2:1:1 equivale a 50 %, 25 %, 25 %. Una proporción vacía o no reconocible deja toda la fórmula pendiente; no se inventa una cantidad.
- `steps` guarda los pasos y `instructions` conserva su texto unido con dos saltos de línea para los lectores existentes. Una preparación antigua se abre como un único paso sin dividir su contenido arbitrariamente. Se conserva el límite anterior de 10.000 caracteres totales y se permiten hasta 100 pasos.
- La edición antigua de `/equipo` conserva los pasos si no cambia la preparación; si cambia su texto, elimina la estructura anterior para que el panel vuelva a abrir ese texto actualizado como un paso.
- La importación CSV conserva las hierbas existentes, incluido su precio por kg y el peso automático de los tónicos que actualiza por nombre; las preparaciones importadas siguen entrando por el texto compatible y se abren como un paso.
- Los controles nuevos y las reglas de porcentajes y precios viven en `modules/herbal/`. Las rutas de hierbas y tónicos los componen con los editores existentes mediante props. Esas rutas, `/api/catalog`, el cargador público `get-shop.ts` y la ruta del equipo son puntos de composición permitidos por ESLint. Los componentes legados de ficha y búsqueda reciben el componente de precio por props. Las entradas de servidor llevan `server-only`. No se migra el editor completo ni se agrega CSS.

## Verificación

Pruebas de dominio y validación para porcentajes, valores ambiguos, centavos, pasos y catálogos anteriores. El registro de comprobaciones ejecutadas y sus limitaciones está en `ROADMAP.md`.

## Herramienta de adaptación

`scripts/adapt-herbal-catalog.mjs` prepara un plan y un respaldo en `data/herbal-h4/`. Solo `--apply <plan.json>` escribe en la base: verifica el hash y la revisión del documento original, vuelve a generar la transformación, guarda mediante `save_catalog` y compara la lectura posterior con el resultado esperado. Un catálogo inexistente o un conflicto abortan; nunca se sustituye por datos de ejemplo.

```powershell
# Analizar y preparar sin escribir en la base.
node --env-file=.env.local --experimental-strip-types scripts/adapt-herbal-catalog.mjs --presentation-grams 1000
# Aplicar exclusivamente el archivo que se revisó.
node --env-file=.env.local --experimental-strip-types scripts/adapt-herbal-catalog.mjs --apply data/herbal-h4/plan-<fecha>.json
```

La transformación es repetible: conserva precios por kg y presentaciones ya configurados, no duplica pasos y mantiene nombres, IDs, vínculos y publicaciones. Solo convierte un precio anterior si tiene centavos válidos y una unidad métrica inequívoca (por ejemplo, `100 g` o `0,25 kg`); omite bolsitas, volúmenes, fracciones y notaciones ambiguas como `1.000 g`. El precio de venta anterior no se reemplaza al agregar el dato por kg. Los precios automáticos se resuelven con la regla de H3.
