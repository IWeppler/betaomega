# Adaptación del catálogo de Ñekurel

Aplicada el **2026-11-11** en Supabase, mediante `save_catalog`, con comparación de revisión y lectura posterior. Revisión **21 → 22**.

## Resultado

| Dato | Resultado |
|---|---|
| Hierbas | 27, con los mismos nombres e identificadores |
| Precios anteriores | No había precios cargados; no se convirtieron ni inventaron importes |
| Tónicos | 9, con presentación de **1 kg** confirmada por el usuario y cálculo automático |
| Preparaciones | 8 textos conservados exactamente como primer paso |
| Proporciones reconocidas | 8 fórmulas ya expresadas en partes, sin modificar sus cantidades |
| Pendientes | 27 precios por kg, 1 preparación y 1 fórmula sin proporciones |

Se conservaron todos los demás datos, incluidos IDs, fotos, categorías, nombres, notas, advertencias, vínculos y estados de publicación. No se unificaron nombres parecidos ni se corrigieron nombres automáticamente. Los precios de los tónicos siguen pendientes hasta completar sus hierbas.

## Datos que faltan

**Precios por kg de las 27 hierbas:** Anís, Boldo, Burrito, Cardo mariano, Cedrón, Cola de caballo, Diente de león, Equinácea, Eucalipto, Hinojo, Jengibre, Lavanda, Manzanilla, Melisa, Menta, Pasiflora, Tilo, Tomillo, Valeriana, Palo, Palo az, Palo azul, Cola de Quirquincho, Catuaba, Mirapauma, Gingko bilova y Te Verde. Cargarlos en **Hierbas → Precio por kg**; un dato faltante no se considera cero.

**Dexintoxicante:** completar la preparación y las proporciones de Cardo mariano, Cola de caballo y Te Verde. Se conservó el contenido vacío; no se asignaron partes ni pasos inventados.

## Respaldo y comprobaciones

Los archivos completos están en `data/herbal-h4/`, ignorada por Git:

- Respaldo inmediato anterior: `catalog-before-apply-2026-11-11T19-02-16-913Z.json`.
- Plan aplicado: `plan-2026-11-11T18-59-51-948Z.json`.
- Comprobante: `receipt-2026-11-11T19-02-16-913Z.json`.
- Listado por registro: `pending-2026-11-11T19-03-37-830Z.csv`.
- Verificación repetida: `plan-2026-11-11T19-03-37-830Z.json`, revisión 22, sin cambios adicionales propuestos.

La lectura posterior coincide con el hash del catálogo esperado. Pasaron tipos, ESLint, 464 pruebas y compilación. En Edge con la versión compilada y una copia local del catálogo adaptado, a 1280 y 390 px: presentación de 1000 g, aviso de precio pendiente, preparación conservada como un paso y nuevos tónicos con 1 kg inicial, sin desborde ni excepciones del navegador. La prueba visual no escribió en la base.

No se probaron un celular físico ni el flujo completo de tienda/equipo, que corresponde a H5. El código local no se desplegó ni se hizo commit. La adaptación de datos es compatible con los lectores anteriores: `instructions` se conserva y `steps` es adicional.
