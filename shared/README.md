# shared

Lo reutilizable sin negocio. No importa nada de las capas de arriba, y `eslint` lo hace cumplir. Dónde va cada cosa: [CONVENTIONS.md §3](../docs/CONVENTIONS.md).

- `shared/ui/`: componentes visuales usados por dos o más módulos, probados en todos los temas ([DESIGN-SYSTEM.md §5](../docs/DESIGN-SYSTEM.md)). Un componente de un solo módulo se queda en ese módulo.
- `shared/lib/`: utilidades puras, sin dominio. Las cargan los tests, así que usan imports relativos con extensión `.ts`.
