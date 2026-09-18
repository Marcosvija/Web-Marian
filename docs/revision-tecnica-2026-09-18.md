# Revisión técnica de PR #3 — entrega a C4

Fecha: 18-09-2026. Ejecución: Codex. Propietario y receptor: **Código y arquitectura • 4**. Este documento entrega un candidato para revisión técnica; no cierra bugs ni sustituye la validación perceptual de QA.

## Trazabilidad y alcance

- Repositorio verificado: `Marcosvija/Web-Marian`, PR [#3](https://github.com/Marcosvija/Web-Marian/pull/3), rama `feat/album-page-navigation`.
- HEAD remoto de partida confirmado: `6e73de46a924c83d1916b39e47b666bb7f510ee0`.
- Base real y merge-base: `main`, `e4b1930fcf85987543f8a8975dcaa5848759c267`.
- El checkout local estaba limpio y separado en `aa3fe515d8d29caab94179748e23749cf333e9de`; se actualizó al HEAD real de la rama antes de editar. El worktree de QA no se modificó.
- Revisados los 42 commits y el diff acumulado de 24 archivos de la PR de partida, además del diff de esta entrega. La PR se conserva abierta, draft y sin merge.
- El SHA final y los enlaces de CI se registran en el handoff canónico después del push; el commit que contiene este informe identifica el candidato.

Fuentes reconstruidas sin conversaciones antiguas, en el orden solicitado:

1. [Hub](https://www.notion.so/3dc1d702fa4a81e9b32ae01128b421a0).
2. [Producto y arquitectura](https://www.notion.so/3dc1d702fa4a8140b634dcd5ec5833eb).
3. [Mapa de áreas y reglas](https://www.notion.so/3dc1d702fa4a81c19519e593e9389f02).
4. [Código y arquitectura • 4](https://www.notion.so/3df1d702fa4a812da1d4dcf0569946d7).
5. [Handoff activo en Coordinación](https://www.notion.so/3df1d702fa4a816d846aef16193dfeb8) y vista de asuntos activos.
6. [UX y diseño](https://www.notion.so/3dc1d702fa4a81dd8337f702d59324f7).
7. [Arquitectura técnica](https://www.notion.so/3dc1d702fa4a811582a2d3ee22efb35c).
8. Repositorio, implementación y metadatos reales de PR #3.
9. [QA](https://www.notion.so/3dc1d702fa4a8169835aebea8ffad2e1), [QA-21](https://www.notion.so/3df1d702fa4a817f8cb7e2741a06a8d6) y BUG-10/11/12/13/14/15.

## Cambios del candidato

| Área | Problema y corrección | Evidencia |
| --- | --- | --- |
| BUG-15, ambos cierres | La página estática seguía pintando bajo el placeholder transparente. Se resta de esa superficie el polígono revelado calculado por `page-flip`, en espejo según el extremo. Se oculta la sombra exterior de cierre que no tiene papel receptor. | Hit testing del navegador contra el polígono real, a dos avances y con movimiento vertical, en ambos cierres. La misma sonda sin la máscara detecta papel, evitando una prueba vacía. Capturas adjuntas. |
| BUG-13 protegido | Se conserva la fórmula de traslación ligada al progreso, el recorte exterior, el centrado cerrado y la escala de una página. | Pruebas existentes de geometría, cuatro sentidos, cancelación/commit y continuidad del layout de destino. |
| BUG-12 | La escritura vertical cambiaba los ejes de los insets y ocultaba parte de «Índice». Se separan cinta visible de 40 px y superficie operable de 44 px, se colocan las letras en ejes físicos y se ajustan oclusión/canto. El foco queda fuera del recorte decorativo. | Texto expuesto a ambos lados, 44 px, borde de seguridad de 8 px, extracción cuando cabe, panel hacia dentro, Escape y foco. Fallback sin JS también en Contraportada. |
| Índice | Una pestaña decorativa del panel sobresalía de su contenedor con `overflow:auto`, generando una barra horizontal interna. Se mantiene dentro del borde. | Comprobación de `scrollWidth/clientWidth` del panel, además del documento; axe con índice abierto. |
| Responsive | La escala limitada por altura estrechaba el reflow en horizontal bajo; una altura mínima heredada hacía el pliego mayor que la cubierta a 1024 px. | Anchura completa en reflow y `min-height:0` en el pliego físico. Matriz 280×568, 320×568, 844×390, 1024×768, 1024×1366, 1440×900 y 2560×1080. |
| Mosaico | Reglas antiguas de la imagen destacada añadían filas implícitas a las composiciones actuales. | Reset local de colocación, conservando las reglas específicas de cada cantidad. Fixture aislado de 18 fotos: 5+5 y 4+4, rutas, recarga y vuelta al primer pliego. |
| Renderer | Previews fallidos podían quedar cacheados; los preparados no se invalidaban con cambios de geometría. | Reintento, límite de carga de HTML y recursos, rechazo de imágenes no decodificables, retirada de hosts fallidos/obsoletos y cancelación tras resize o cambio de reduced motion. |
| Interacción | `sessionStorage` bloqueado interrumpía la mejora; clics modificados se interceptaban; un arrastre cancelado podía anular el próximo clic tras salir del modo físico. | Storage opcional, Ctrl/Meta/Shift/Alt nativos, revisión de gesto y reinicio de supresión de clic. |
| Traspaso de frame | El módulo diferido podía habilitar el snapshot después de la primera pintura del destino: `ViewTransition opt-in disabled`. | Una sola preparación síncrona en la cabecera, con media query para modo físico y sin animación añadida. No-JS/reflow/reduced motion siguen directos. Regresión repetida tres veces. |
| PhotoViewer | Un deep link no conservaba elemento de retorno al cerrar; se interceptaban clics modificados. | Foco en la foto solicitada, Escape, URL, atrás/adelante y axe del diálogo. |

No hay nuevas dependencias, cambios de contenido editorial real, categorías de producción, branding ni arquitectura de información.

## Archivos de esta entrega

- `src/components/BookmarkIndex.astro`
- `src/components/PageNavigation.astro`
- `src/components/PhotoViewer.astro`
- `src/layouts/BaseLayout.astro`
- `src/styles/album-spread.css`
- `src/styles/global.css`
- `src/types/page-flip.d.ts`
- `tests/e2e/portfolio.spec.ts`
- `tests/e2e/polish.spec.ts`
- `tests/fixtures/categories/categoria-extensa-de-prueba.json`
- `docs/revision-tecnica-2026-09-18.md`

## Validación

Entorno local: Windows, Node 24.19.0, npm 11.17.0. `npm ci` reproducible: 287 paquetes instalados, 0 vulnerabilidades reportadas. Aviso informativo de npm sobre el script de instalación de esbuild; no impidió check ni build.

- `npm run check`: 0 errores, 0 warnings y 0 hints de Astro/TypeScript.
- `npm run test:unit`: 11/11, tres archivos.
- `npm run build`: cinco rutas estáticas de producción. Los avisos sobre colección vacía corresponden al contenido real pendiente; las categorías de prueba no se publican.
- `npm run test:e2e -- --workers=2 --reporter=list,json`: **73 correctas, 9 omisiones previstas, 0 fallidas, 0 flaky**, en 49,3 s; Chromium + Pixel 7 emulado, sin reintentos locales.
- Regresión de snapshots/storage, resize y cubiertas repetida tres veces: 12 ejecuciones correctas, seis omisiones previstas por perfil.
- `git diff --check`: sin errores.
- Axe: rutas críticas, diálogo abierto e índice abierto. Overflow global y del panel; no-JS, reduced motion, foco, teclado, navegación bidireccional, touch del visor, deep links, historial y paginación.

`tests/e2e/polish.spec.ts` genera PNG de mosaicos y cierres en `test-results/`; el workflow existente los incluye en su artefacto de evidencia junto al manifiesto y reportes. Los skips son condiciones explícitas de perfil, no casos fallidos silenciados. El reporte JSON local queda en `test-results/review-report.json`.

La revisión interactiva recorrió portada, Quién soy, índice abierto, mosaicos 5+5 y 4+4, visor con teclado y retorno de foco, móvil, Contacto y Contraportada. Los hallazgos del panel horizontal y del canto se incorporaron al diff. Esta inspección del ejecutor **no es PASS perceptual independiente**.

No ejecutar `astro check/build` y el servidor de fixtures sobre el mismo directorio simultáneamente: comparten `.astro` y pueden sustituir el almacén de contenido del servidor. La pasada final utiliza servidor nuevo después de check/build. La prueba de geometría espera la red para evitar medir durante la recarga inicial de dependencias de Vite.

## Hallazgos abiertos para los propietarios

1. **C4 — ciclo de vida de `page-flip` 2.0.7.** Inspección del paquete fijado: `Render.start()` programa RAF indefinidamente; `PageFlip.destroy()` retira UI/DOM pero no cancela ese bucle. `UI.destroy()` solo retira handlers si `useMouseEvents` es true, aunque registra resize también cuando es false. Es un riesgo preexistente de callbacks y referencias retenidas tras muchas cancelaciones en una misma ruta. La nueva limpieza evita hosts activos obsoletos, pero no corrige internamente la dependencia. C4 debe decidir parche mantenido, fork o mecanismo soportado de disposición antes de dar por cerrado rendimiento; no se ha modificado `node_modules` ni introducido un monkey patch de métodos privados.
2. **C4 con UX — visor entre pliegos de una categoría.** El visor enumera los triggers del documento actual: con el fixture nuevo anuncia 1 de 10 en el primer pliego y 1 de 8 en el segundo. UX describe anterior/siguiente de la misma categoría. La continuidad entre pliegos requiere fijar URL, cierre y retorno del foco cuando la foto pertenece a otra ruta, además de evitar precargar el álbum entero. Se documenta la diferencia, sin inventar una nueva política de navegación del visor.
3. **Producto/Contenido y UX/Branding.** No hay selección real, nombres finales, biografía ni canal de contacto; los fixtures no permiten validar peso/calidad de fotografías reales. Títulos extensos ocupan más del objetivo orientativo de 15–18 % de la página. Revisar composición con contenido aprobado sin decidir aquí otra tipografía ni inventar textos.
4. **QA/UX — margen lateral limitado.** Cuando el pliego deja 24 px de margen, la seguridad de 8 px limita la cinta expuesta a 16 px y puede eliminar recorrido adicional de extracción. El texto permanece expuesto y el panel entra en el libro; la materialidad y jerarquía requieren juicio manual.

## Revisión manual pendiente

C4 revisa diff completo, hallazgos, resultados locales y CI del SHA exacto. Solo después podrá reactivar la entrega independiente a QA. Revisar especialmente:

- BUG-15: texto, bordes y sombras de las superficies auxiliares durante cierre lento y rápido, ambos extremos y distintos movimientos en Y.
- BUG-12: lectura de «Índice», inserción física, canto, material, extracción y panel, con y sin foco y en anchuras ajustadas.
- BUG-13: centrado y escala, giro/traslación simultáneos, último frame → DOM estable sin snap; preservar también el curl interior aceptado.
- BUG-10/11/14: opacidad/flexibilidad, cuatro sentidos y ausencia de overflow durante la animación, además de los estados estables.
- Safari/Firefox, dispositivos reales, lector de pantalla y rendimiento tras secuencias largas: no cubiertos por Chromium/Pixel 7 emulado.

BUG-10/11/12/14/15 siguen bajo propiedad de QA. BUG-13 no se reabre ni se vuelve a cerrar desde esta ejecución. No se ha hecho merge ni se ha declarado PASS perceptual.
