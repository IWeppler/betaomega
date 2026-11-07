# modules

Una carpeta por funcionalidad. Todo código nuevo vive acá; el existente no se migra. La estructura y las reglas están en [ARCHITECTURE.md §4.1](../docs/ARCHITECTURE.md) y [CONVENTIONS.md §3](../docs/CONVENTIONS.md).

Para crear un módulo, copiá [docs/plantilla-modulo/](../docs/plantilla-modulo/README.md). `eslint` lee esta carpeta, así que las reglas de dependencia alcanzan al módulo nuevo sin tocar su configuración.
