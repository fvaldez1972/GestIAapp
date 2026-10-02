/**
 * Repone `HTMLDialogElement.showModal()` y `close()`, que jsdom no implementa.
 *
 * <p>El `<dialog>` nativo es lo que da foco atrapado, orden de lectura y cierre con Escape sin
 * ninguna librería, y el navegador real sí lo implementa. Aquí se repone lo mínimo para poder
 * abrir y cerrar. <b>El atrapado del foco no se prueba, porque no es nuestro</b>: se prueba lo que
 * sí decidimos —a quién se enfoca, en qué orden están los botones y qué se lee—.</p>
 *
 * <p><b>Se llama desde cada prueba que use un diálogo, a propósito.</b> El intento natural es
 * ponerlo en `test-setup.ts` y olvidarse, pero `@angular/build:unit-test` inicializa el entorno de
 * pruebas por su cuenta y no lee los `setupFiles` de `vitest.config.ts`: el parche no correría y el
 * fallo diría «showModal is not a function», que no apunta a la causa. Llamarlo explícitamente
 * cuesta una línea y no depende de eso.</p>
 */
export function reponerDialogoDeJsdom(): void {
  const prototipo = HTMLDialogElement.prototype as HTMLDialogElement & { __repuesto?: boolean };

  if (prototipo.__repuesto) {
    return;
  }

  prototipo.__repuesto = true;

  prototipo.showModal = function abrir(this: HTMLDialogElement) {
    this.open = true;
  };

  prototipo.close = function cerrar(this: HTMLDialogElement, returnValue?: string) {
    if (!this.open) {
      return;
    }

    this.open = false;

    if (returnValue !== undefined) {
      this.returnValue = returnValue;
    }

    this.dispatchEvent(new Event('close'));
  };
}
