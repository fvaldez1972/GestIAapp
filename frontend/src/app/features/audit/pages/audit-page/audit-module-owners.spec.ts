import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Cada entidad de la bitácora tiene módulo, y la clave es la que manda el servidor.
 *
 * <p><b>Existe por un defecto que se publicó.</b> La columna «Módulo» se agregó con una tabla
 * indexada por el nombre inglés de la tabla del modelo —`BusinessDocuments`, `Clients`—, pero
 * `AuditRepository` no manda eso: manda la etiqueta ya en español, «Documentos», «Clientes»,
 * «Posiciones». No coincidía ninguna, así que las treinta filas de la pantalla decían «Sin módulo»
 * y el defecto volvió en el siguiente reporte de QA.</p>
 *
 * <p>La lista de abajo son las <b>veintisiete etiquetas que el repositorio escribe</b>, copiadas de
 * sus llamadas a <c>Matches(entity, ...)</c>. La prueba lee el servidor de verdad para que la lista
 * no se quede vieja: si alguien agrega una bitácora nueva allá, esto falla aquí hasta que se le
 * asigne su módulo.</p>
 */
describe('El módulo de cada entidad de la bitácora', () => {
  const pagina = readFileSync(resolve('src/app/features/audit/pages/audit-page/audit-page.ts'), 'utf8');
  const repositorio = readFileSync(
    resolve('../backend/src/GestIA.Infrastructure/Persistence/Repositories/AuditRepository.cs'),
    'utf8',
  );

  /** Las etiquetas que el servidor escribe en cada fila de la bitácora. */
  const etiquetasDelServidor = [
    ...new Set(Array.from(repositorio.matchAll(/Matches\(entity, "([^"]+)"\)/g), (m) => m[1])),
  ];

  /** Las claves de la tabla de la pantalla, con o sin comillas. */
  const clavesDeLaPantalla = new Set(
    Array.from(
      pagina.matchAll(/^\s{4}(?:'([^']+)'|([A-Za-zÁÉÍÓÚÑáéíóúñ]+)): \{ module:/gm),
      (m) => m[1] ?? m[2],
    ),
  );

  it('el servidor escribe las etiquetas que esta prueba cree, y no otras', () => {
    // Si esto falla, el repositorio cambió de forma y la lectura de arriba dejó de servir.
    expect(etiquetasDelServidor.length).toBeGreaterThanOrEqual(27);
    expect(etiquetasDelServidor).toContain('Documentos');
    expect(etiquetasDelServidor).toContain('Posiciones');
  });

  it('ninguna entidad de la bitácora se queda sin módulo', () => {
    const sinModulo = etiquetasDelServidor.filter((etiqueta) => !clavesDeLaPantalla.has(etiqueta));

    expect(sinModulo, 'Agrégalas a EntityOwners en audit-page.ts').toEqual([]);
  });

  it('la tabla no clasifica entidades que el servidor no manda', () => {
    const inventadas = [...clavesDeLaPantalla].filter(
      (clave) => !etiquetasDelServidor.includes(clave),
    );

    expect(inventadas, 'Sobran en EntityOwners: el servidor no escribe esas entidades').toEqual([]);
  });
});
