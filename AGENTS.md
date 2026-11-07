<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Cómo trabajar en este proyecto

Plataforma multisitio: varios sitios públicos y un panel central, en una sola app Next. Antes de tocar nada, leer en este orden:

1. `docs/ARCHITECTURE.md`: qué es el sistema y dónde vive cada cosa.
2. `docs/PATTERNS.md`: cómo se resuelven los problemas que se repiten.
3. `docs/CONVENTIONS.md`: normas de código, pruebas, git y seguridad.
4. `docs/DESIGN-SYSTEM.md`: interfaz (Tailwind, tokens, temas). Si la tarea toca pantallas.
5. `docs/ROADMAP.md`: qué está hecho, qué sigue y cómo registrar el avance.
6. `docs/SAUNA.md`: solo si la tarea es del sitio de reservas.

Reglas que no se negocian (el detalle está en `docs/CONVENTIONS.md`):

- No hacer commit sin que se pida.
- Probar antes de dar algo por hecho (`tsc`, `eslint`, `npm test`, `npm run build`) y decir qué no se pudo probar.
- Hacer solo la fase pedida y actualizar su estado y su registro en `docs/ROADMAP.md` al terminar.
- Documentación en español, código y comentarios en inglés.
- Código nuevo en `modules/<m>/` (domain, data, api, ui) y solo hacia abajo: `app → modules → platform → shared`. El código existente no se migra por prolijidad.
- Estilos solo con utilidades de Tailwind; no se crean archivos `.css` ni se agrega CSS al legado.
- Toda tabla de un sitio se lee por `siteTable` y lleva `site_id`; montos en centavos enteros; nada que venga del navegador decide un precio o un cupo.
