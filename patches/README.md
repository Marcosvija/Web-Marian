# page-flip 2.0.7: disposición de instancias transitorias

Web Marian crea renderers temporales para previews y giros. En la distribución
npm **`page-flip@2.0.7`**, `Render.start()` encadena RAF sin conservar su ID y
`PageFlip.destroy()` solo elimina la UI/host. Además, `UI` registra `resize`
independientemente de `useMouseEvents`, pero su destructor solo retiraba handlers
cuando esa opción era `true`. Eliminar el DOM dejaba instancias activas.

`page-flip-2.0.7.mjs` es un parche de instalación mantenido en este repositorio.
`npm ci` ejecuta `scripts/patch-page-flip.mjs` desde `postinstall`, también en CI.
No añade dependencias, no requiere editar `node_modules` a mano y no modifica
prototipos en runtime. Parchea los dos artefactos publicados: UMD (`main`/`browser`,
consumido por Astro) y ESM. El TypeScript upstream incluido en npm queda como
referencia; la aplicación consume la distribución, no ese código fuente.

Cada sustitución identifica el método TypeScript original y exige el número
exacto de coincidencias. El instalador verifica la versión y SHA-256 completos
de **ambos** originales antes de escribir; también verifica los hashes de salida.
Una segunda ejecución solo acepta las salidas conocidas. Cualquier discrepancia
hace fallar la instalación, sin continuar con una dependencia sin parchear.

Cambios limitados al ciclo de vida:

- El renderer conserva y cancela el RAF pendiente; su estado destruido impide
  iniciar/reanudar el bucle, dibujar o programar otro frame, incluso si la
  destrucción ocurre dentro del callback de animación.
- Se descarta la animación pendiente sin ejecutar su finalización y se liberan
  referencias a páginas/sombras. No cambian geometría, física, duración o estilos.
- `PageFlip.destroy()` es idempotente; dispone renderer y UI, cancela el timeout
  de `init` y vacía los suscriptores. No permite emitir eventos posteriores ni
  cargar otra vez una instancia destruida.
- La UI retira todos sus handlers también con `useMouseEvents: false`, cancela
  el inicio de toque diferido y descarta el estado de toque.

La regresión `tests/e2e/page-flip-lifecycle.spec.ts` carga los artefactos instalados
en un documento aislado del navegador. Por artefacto y proyecto ejecuta 24 ciclos
con/sin eventos de ratón: destrucción inmediata, durante un giro iniciado y
desde su callback. Cuenta RAF pendientes, timers y handlers de window, y comprueba
ausencia de dibujos, eventos, resize y efectos de toque después de destruir.
Los contadores se adjuntan como JSON al resultado de Playwright/artefacto de CI.
También invoca un RAF capturado antes del teardown para comprobar la guarda de
un callback ya despachado. La instrumentación solo existe en el test.

Para actualizar `page-flip`: revisar primero sus fuentes y ambos bundles,
eliminar este parche si upstream ya dispone todos los recursos, o portar las
sustituciones y recalcular los cuatro hashes tras inspeccionar el delta.
Ejecutar `npm ci`, comprobar idempotencia con `npm run postinstall`, las regresiones
de ciclo de vida y la suite completa antes de aceptar otra versión.
