# Web Marian

Fundación técnica del portfolio fotográfico de Marian.

## Stack

- Astro 7 con salida estática.
- TypeScript estricto.
- Componentes Astro, CSS nativo y JavaScript cliente mínimo.
- Content Collections para categorías y fotografías.
- Vitest, Playwright y axe para la base automatizada de pruebas.

## Desarrollo

Requisitos: Node.js 24 LTS y npm.

```sh
npm ci
npm run dev
```

Comprobaciones disponibles:

```sh
npm run check
npm run test:unit
npm run test:e2e
npm run build
```

## Contenido

Las categorías de producción viven en `src/content/categories/`. La fundación no incluye categorías, fotografías ni copy editorial inventados. El contrato validado está en `src/content.config.ts`.

Los datos usados por las pruebas de navegador están aislados en `tests/fixtures/` y solo se cargan mediante el comando `npm run dev:test`.
