import { HttpErrorResponse } from '@angular/common/http';

/**
 * Lo que el servidor dice cuando algo sale mal, leído una sola vez y bien.
 *
 * <p><b>El defecto que cierra.</b> El servidor sí manda el detalle por campo: el manejador de
 * errores pone <c>problem.Extensions["errors"]</c> con un diccionario de campo a mensajes. Lo que
 * fallaba era la lectura. Cada pantalla tenía su propio extractor —catorce en total— y todos
 * miraban <c>detail</c>, que en una validación siempre trae el mismo texto genérico: «La solicitud
 * contiene datos inválidos.». Quien lo veía no podía saber qué campo corregir.</p>
 *
 * <p>Una pantalla, Plataforma, sí tenía el código para leer <c>errors</c>… <b>después</b> de leer
 * <c>detail</c>. Como <c>detail</c> nunca viene vacío, esa rama no se alcanzaba nunca. No faltaba
 * código: sobraba una comprobación por delante.</p>
 *
 * <p>Por eso aquí el orden es al revés y es lo único que hay que respetar: <b>lo específico manda
 * sobre lo genérico</b>.</p>
 */
export type ServerProblem = {
  /** Lo que se dice arriba, en una frase. Nunca vacío. */
  readonly message: string;
  /** Qué falló, por campo, con el nombre tal como lo manda el servidor. */
  readonly fieldErrors: Readonly<Record<string, string>>;
};

const GENERICO = 'No se pudo completar la operación.';

/**
 * Traduce un error de HTTP a lo que la pantalla necesita decir.
 *
 * @param fallback Lo que se dice cuando el servidor no explica nada. Cada pantalla sabe mejor que
 *   esta función qué estaba intentando el usuario, así que lo pone ella.
 */
export function readServerProblem(error: unknown, fallback = GENERICO): ServerProblem {
  const cuerpo = error instanceof HttpErrorResponse ? error.error : null;

  if (!cuerpo || typeof cuerpo !== 'object') {
    return { message: fallback, fieldErrors: {} };
  }

  const registro = cuerpo as Record<string, unknown>;
  const fieldErrors = leerCampos(registro['errors']);
  const primero = Object.values(fieldErrors)[0];

  // Lo específico primero. Un «RFC inválido» dice más que «La solicitud contiene datos inválidos».
  const message = primero
    ?? texto(registro['detail'])
    ?? texto(registro['message'])
    ?? texto(registro['title'])
    ?? fallback;

  return { message, fieldErrors };
}

/**
 * El nombre del campo tal como lo manda el servidor, buscado sin distinguir mayúsculas.
 *
 * <p>El servidor nombra los campos como su contrato —<c>Rfc</c>, <c>LegalName</c>— y el formulario
 * los nombra como su control —<c>rfc</c>, <c>legalName</c>—. Comparar en crudo dejaría el mensaje
 * en el aire justo cuando existe.</p>
 */
export function fieldError(problem: ServerProblem, field: string): string {
  const buscado = field.toLowerCase();
  const encontrado = Object.entries(problem.fieldErrors)
    .find(([nombre]) => nombre.toLowerCase() === buscado);

  return encontrado?.[1] ?? '';
}

function leerCampos(valor: unknown): Record<string, string> {
  if (!valor || typeof valor !== 'object') {
    return {};
  }

  const salida: Record<string, string> = {};

  for (const [campo, mensajes] of Object.entries(valor as Record<string, unknown>)) {
    // El servidor manda un arreglo por campo. Se muestra el primero: los demás suelen ser
    // consecuencia del mismo error y apilarlos no ayuda a corregirlo.
    const primero = Array.isArray(mensajes) ? mensajes.find((m) => typeof m === 'string' && m.trim()) : mensajes;

    if (typeof primero === 'string' && primero.trim()) {
      salida[campo] = primero.trim();
    }
  }

  return salida;
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}
