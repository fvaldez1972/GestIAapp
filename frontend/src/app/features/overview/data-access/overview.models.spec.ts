import { metricPendingAction } from './overview.models';

describe('La etiqueta del indicador sale de su destino', () => {
  /**
   * El defecto que cierra.
   *
   * <p>La etiqueta se calculaba por clave de métrica y la ruta la mandaba el servidor: dos fuentes
   * que nadie mantenía sincronizadas. Dos de las cuatro se separaron, y el caso feo era «Turnos sin
   * cubrir», que decía «Ir a Planeación» y llevaba a Cobertura. El botón siempre navegó bien; lo
   * que mentía era el rótulo, que es peor, porque hace dudar de los otros tres.</p>
   */
  it('nombra el módulo al que de verdad lleva', () => {
    expect(metricPendingAction('/operacion/cobertura')).toBe('Ir a Cobertura');
    expect(metricPendingAction('/servicios')).toBe('Ir a Servicios');
    expect(metricPendingAction('/planeacion')).toBe('Ir a Planeación');
    expect(metricPendingAction('/personal')).toBe('Ir a Personal');
  });

  /**
   * El mismo indicador cambia de destino según su estado, y la etiqueta lo sigue.
   *
   * <p>Sin plan publicado ayer no hay turnos que cubrir: el servidor manda a Planeación. Con plan,
   * a Cobertura. Antes la ruta era fija y en el primer caso llevaba a una pantalla vacía.</p>
   */
  it('sigue al destino cuando el destino cambia con el estado', () => {
    expect(metricPendingAction('/planeacion')).toBe('Ir a Planeación');
    expect(metricPendingAction('/operacion/cobertura')).toBe('Ir a Cobertura');
  });

  /** Sin destino no se ofrece una salida: un botón que no lleva a ninguna parte es peor que nada. */
  it('sin ruta no propone nada', () => {
    expect(metricPendingAction(null)).toBe('');
    expect(metricPendingAction('/una-ruta-que-nadie-conoce')).toBe('');
  });
});
