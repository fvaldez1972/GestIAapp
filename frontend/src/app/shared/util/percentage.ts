/**
 * Un porcentaje entero que no miente en los extremos.
 *
 * <p>Redondear sin más deja decir dos cosas que no son ciertas, y las dos en el borde, que es
 * justo donde alguien las lee como un veredicto. 299 presentes de 300 turnos es 99.67, y
 * <c>Math.round</c> lo enseña como <b>100%</b>: el reporte afirma que no faltó nadie el día que
 * faltó alguien. Al otro lado, 1 falta de 500 turnos es 0.2, y se enseña como <b>0%</b>: el
 * reporte afirma que no faltó nadie el día que faltó una persona.</p>
 *
 * <p>Por eso el 100 y el 0 quedan reservados para cuando de verdad lo son. Todo lo demás se
 * redondea normal, pero se detiene en 99 y en 1 respectivamente. Una diferencia de un punto no le
 * cambia la decisión a nadie; la diferencia entre «nadie faltó» y «faltó alguien», sí.</p>
 *
 * <p>Devuelve <c>null</c> cuando no hay denominador, que es lo que la pantalla enseña como «N/D».
 * N/D no es cero: cero es un dato, y no tenerlo no lo es.</p>
 */
export function wholePercentage(part: number, total: number): number | null {
  if (total <= 0) {
    return null;
  }

  const exacto = (part / total) * 100;
  const redondeado = Math.round(exacto);

  if (redondeado === 100 && part < total) {
    return 99;
  }

  if (redondeado === 0 && part > 0) {
    return 1;
  }

  return redondeado;
}
