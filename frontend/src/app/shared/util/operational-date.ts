/**
 * El único formato de fecha de la aplicación: `04 sep 2026`.
 *
 * Existe porque ninguna herramienta de la plataforma lo produce. Sin `LOCALE_ID`, `DatePipe`
 * escribe en inglés (`Sep 4, 2026`); con `es-MX`, el formato medio es `4 sept 2026`, con el día
 * sin cero y el mes de cuatro letras. Y `toLocaleDateString('es-MX')` da `04/09/2026`, que en un
 * producto que también se lee en formato estadounidense es ambiguo justo donde no debe serlo.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Lo que se muestra cuando no hay fecha o no se entiende. Nunca una fecha inventada. */
export const SIN_FECHA = 'Sin fecha';

/**
 * Formatea un día de negocio que viene del servidor como `yyyy-MM-dd`.
 *
 * **Se analiza el texto a mano, sin `new Date(...)`, y ésa es toda la razón de esta función.**
 * `new Date('2026-09-05')` interpreta la cadena como medianoche UTC; leerla después con los
 * métodos locales devuelve el 4 de septiembre en México. Sería el mismo corrimiento de día que el
 * reloj operativo cerró en el servidor, reintroducido en el navegador y sin que nadie lo note.
 *
 * Un día de negocio no tiene hora ni huso: es una etiqueta, y así se trata.
 */
export function formatOperationalDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return SIN_FECHA;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());

  if (!match) {
    return SIN_FECHA;
  }

  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;

  if (monthIndex < 0 || monthIndex > 11 || Number(day) < 1 || Number(day) > 31) {
    return SIN_FECHA;
  }

  return `${day} ${MESES[monthIndex]} ${year}`;
}

/**
 * Formatea un instante que sí tiene hora —lo que el servidor guarda en UTC— en la zona del
 * navegador. Se usa para marcas de tiempo, no para días de negocio: la distinción es la misma que
 * el backend hace entre columnas `At` y columnas `Date`.
 */
export function formatOperationalInstant(isoInstant: string | null | undefined): string {
  if (!isoInstant) {
    return SIN_FECHA;
  }

  const instant = new Date(isoInstant);

  if (Number.isNaN(instant.getTime())) {
    return SIN_FECHA;
  }

  const day = String(instant.getDate()).padStart(2, '0');
  const hours = String(instant.getHours()).padStart(2, '0');
  const minutes = String(instant.getMinutes()).padStart(2, '0');

  return `${day} ${MESES[instant.getMonth()]} ${instant.getFullYear()} ${hours}:${minutes}`;
}
