/**
 * El nombre plegado de un valor de catálogo, igual que lo calcula el servidor.
 *
 * <p><b>Es una copia deliberada de `CatalogName.Normalize` del backend</b>, y existe por una razón
 * concreta: el alta al vuelo tiene que poder decir «eso ya está en el catálogo» <b>antes</b> de
 * mandar la petición. Sin esto, la única forma de saberlo sería intentar crearlo y leer el 409, y
 * el usuario vería un error donde debería ver una elección.</p>
 *
 * <p><b>Quien de verdad impide el duplicado sigue siendo la base</b>, con su índice único sobre esta
 * misma forma. Esto es cortesía, no control: si las dos se separaran, la base gana y el usuario ve
 * el conflicto. Por eso la regla se escribe igual en los dos sitios y se prueba en los dos.</p>
 *
 * <p>Recorta, colapsa los espacios interiores, quita los acentos y sube a mayúsculas. «Guardia de
 * acceso», «guardia  de  acceso» y «GUARDIA DE ACCESO» colapsan al mismo valor.</p>
 */
export function normalizeCatalogName(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .normalize('NFD')
    // Las marcas diacríticas viajan sueltas después de NFD: se descartan, y con ellas la
    // diferencia entre «Recepción» y «Recepcion».
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Cuánto se parecen dos nombres ya plegados, para la franja del medio del alta al vuelo.
 *
 * <p>Distancia de edición acotada: en cuanto pasa del máximo que interesa, deja de contar. No hace
 * falta el número exacto para decidir si vale la pena preguntar «¿querías este otro?».</p>
 */
export function catalogNameDistance(left: string, right: string, max = 2): number {
  if (left === right) {
    return 0;
  }

  if (Math.abs(left.length - right.length) > max) {
    return max + 1;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let mejor = i;

    for (let j = 1; j <= right.length; j += 1) {
      const costo = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + costo);
      mejor = Math.min(mejor, current[j]);
    }

    // Si toda la fila ya se pasó del máximo, ninguna fila posterior va a bajar de ahí.
    if (mejor > max) {
      return max + 1;
    }

    previous = current;
  }

  return previous[right.length];
}
