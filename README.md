# BetaOmega · plataforma de sitios

Una sola aplicación Next.js que sirve varios sitios públicos independientes (cada uno con su dominio) y un **panel central** para administrarlos todos.

| Sitio | Tipo | Qué es |
|---|---|---|
| Ñekurel | `herboristeria` | Catálogo de hierbas y tónicos, tienda con carrito por WhatsApp. Guía: [docs/herboristeria.md](docs/herboristeria.md). |
| Comidas del cielo | `recetas` | Recetas, comentarios y métricas. |
| Purificación, Yakuchil | `productos` | Listas de productos con buscador. |
| Sauna | `sauna` (en camino) | Reservas con cupos y seña online. Ver [docs/SAUNA.md](docs/SAUNA.md). |
| BetaOmega | panel | Administración de todos los sitios; app instalable. |

## Empezar a trabajar (personas e IA)

Leer, en este orden, antes de tocar código:

1. [`AGENTS.md`](AGENTS.md): reglas de entrada y aviso sobre la versión de Next.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): qué es el sistema y dónde vive cada cosa.
3. [docs/PATTERNS.md](docs/PATTERNS.md): cómo se resuelven los problemas que se repiten.
4. [docs/CONVENTIONS.md](docs/CONVENTIONS.md): dónde va cada cosa, normas de código, pruebas, git y seguridad.
5. [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md): interfaz (Tailwind, tokens, temas). Si la tarea toca pantallas.
6. [docs/ROADMAP.md](docs/ROADMAP.md): qué está hecho y qué sigue. Aquí se elige la fase de trabajo.

## Ejecutar

Requiere Node.js 22.14 o posterior.

```powershell
npm install
copy .env.example .env.local   # completar las variables (ver docs/ARCHITECTURE.md §9)
npm run dev
```

Los sitios se distinguen por el host, así que en local se abren con subdominios de `localhost`:

| Dirección | Qué abre |
|---|---|
| http://nekurel.localhost:3000 | Ñekurel (también `localhost` y la IP de la red: es el sitio por defecto) |
| http://comidasdelcielo.localhost:3000 | Comidas del cielo |
| http://purificacion.localhost:3000, http://yakuchil.localhost:3000 | Sitios de productos |
| http://panel.localhost:3000 | El panel |

Para usarlo desde un celular o una tablet de la misma red: `npm run dev -- --hostname 0.0.0.0` y la IP de la computadora (abre el sitio por defecto).

> **El entorno local usa la base real** (`.env.local` apunta al Supabase de producción). Leer "Probar sin tocar datos" en [docs/CONVENTIONS.md](docs/CONVENTIONS.md) antes de escribir datos de prueba.

## Base de datos

Todo el esquema está en [`supabase/schema.sql`](supabase/schema.sql). Es **idempotente**: se corre entero, a mano, en el SQL Editor de Supabase, y se puede repetir. El código sigue funcionando antes de correrlo cuando es posible (ver [PATTERNS.md](docs/PATTERNS.md), patrón 3).

## Verificar

```powershell
npx tsc --noEmit
npm run lint
npm test
npm run build
```

## Documentación

| Archivo | Contenido |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura, ruteo por host, mapa del código, datos, sesiones, variables de entorno. |
| [docs/PATTERNS.md](docs/PATTERNS.md) | Patrones de diseño del proyecto, con su ejemplo real. |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Reglas de trabajo, dónde va cada cosa, idioma, nombres, base de datos, pruebas, git, seguridad. |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | Sistema de diseño: Tailwind primero, tokens, temas por sitio, componentes, migración del CSS. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Estado, fases pendientes, decisiones y registro. |
| [docs/SAUNA.md](docs/SAUNA.md) | Especificación del sitio de reservas. |
| [docs/herboristeria.md](docs/herboristeria.md) | Guía de uso de Ñekurel (tónicos, hierbas, CSV, tienda). |
| [docs/archivo/](docs/archivo) | Planes ya cumplidos, para consulta histórica. |
