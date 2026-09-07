declare const ngDevMode: boolean | undefined;

/**
 * Rompe en desarrollo cuando un componente se usa de una forma que el sistema de diseño prohíbe.
 *
 * <p>Existe porque una regla escrita en un documento se pierde: nadie lo relee al escribir la
 * pantalla número nueve. Una regla que <b>falla</b> se aprende la primera vez, y falla donde está
 * el error y no tres pantallas después.</p>
 *
 * <p>Sólo actúa en desarrollo. En producción no se comprueba nada: si algo se coló, es mejor que
 * la pantalla se dibuje mal a que se caiga delante de quien está trabajando.</p>
 */
export function devAssert(condicion: boolean, mensaje: string): void {
  if (typeof ngDevMode !== 'undefined' && ngDevMode === false) {
    return;
  }

  if (!condicion) {
    throw new Error(mensaje);
  }
}
