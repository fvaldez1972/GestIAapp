import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * La palabra «bloqueante» salió del producto el 23 de septiembre de 2026.
 *
 * <p>La marca del catálogo pasó a llamarse **obligatoria**, con su migración
 * (<c>RenameBlockingMarkToRequired</c>) y el cambio en las cuatro capas. Pero el vocabulario viejo
 * sobrevivió meses en pantallas que nadie relacionaba con el catálogo —el indicador de Inicio decía
 * «Bloquea asignación», y Cobertura contaba «bloqueos»—, y volvió a reportarse como defecto.</p>
 *
 * <p><b>Por eso esto es una prueba y no una nota en un documento.</b> Un vocabulario que sólo vive
 * en la documentación se vuelve a romper en la siguiente pantalla: el que escribe una cadena nueva
 * no lee el glosario, pero sí ve una prueba roja.</p>
 *
 * <p>Se mira únicamente lo que el usuario lee: cadenas entre comillas y texto de plantilla. Los
 * comentarios y los nombres de símbolos —<c>coverageBlockingCount</c>, <c>blocking</c>— se quedan
 * como están: describen el mecanismo para quien programa, y renombrarlos sería otra tanda sin
 * efecto en pantalla.</p>
 */
describe('El vocabulario del producto', () => {
  /** Las palabras retiradas, y con qué se dicen ahora. */
  const RETIRADAS: readonly { readonly palabra: RegExp; readonly enSuLugar: string }[] = [
    { palabra: /bloqueante/i, enSuLugar: '«obligatorio»' },
    { palabra: /bloquea asignaci/i, enSuLugar: '«no se puede asignar»' },
    { palabra: /los bloqueos/i, enSuLugar: '«lo que impide continuar»' },
    { palabra: /bloqueo\(s\)/i, enSuLugar: '«requisitos sin cubrir»' },
  ];

  /**
   * Las features que ya están limpias. La lista **crece**, nunca se acorta: sacar una de aquí es
   * dejar que el vocabulario viejo vuelva por donde ya se echó.
   */
  const CUBIERTO: readonly string[] = [
    'src/app/features/overview',
    'src/app/features/operations',
    'src/app/features/catalogs',
    'src/app/features/workforce',
    'src/app/features/services',
    'src/app/shared/ui',
  ];

  function archivos(directorio: string): readonly string[] {
    const encontrados: string[] = [];

    for (const entrada of readdirSync(directorio)) {
      const ruta = join(directorio, entrada);

      if (statSync(ruta).isDirectory()) {
        encontrados.push(...archivos(ruta));
      } else if (
        (ruta.endsWith('.ts') || ruta.endsWith('.html')) &&
        !ruta.endsWith('.spec.ts')
      ) {
        encontrados.push(ruta);
      }
    }

    return encontrados;
  }

  /**
   * Quita comentarios para no acusar a la prosa del código.
   *
   * <p>Un comentario que explique por qué se retiró la palabra **tiene** que poder nombrarla; si
   * no, no se podría contar la historia en el sitio donde importa.</p>
   */
  function soloLoQueSeLee(contenido: string): string {
    return contenido
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
  }

  it('ninguna pantalla cubierta dice «bloqueante» ni cuenta «bloqueos»', () => {
    const culpables: string[] = [];

    for (const carpeta of CUBIERTO) {
      for (const ruta of archivos(resolve(carpeta))) {
        const leible = soloLoQueSeLee(readFileSync(ruta, 'utf8'));

        for (const { palabra, enSuLugar } of RETIRADAS) {
          if (palabra.test(leible)) {
            culpables.push(`${ruta}: dice ${palabra.source}, y ahora se dice ${enSuLugar}`);
          }
        }
      }
    }

    expect(culpables).toEqual([]);
  });

  /**
   * El control, y sin él la prueba de arriba no valdría nada.
   *
   * <p>Si el filtro de comentarios se rompiera —o si las expresiones dejaran de encontrar nada por
   * un error de escritura— la primera prueba pasaría en verde sobre un producto lleno de la palabra
   * vieja. Aquí se comprueba que las expresiones <b>sí</b> encuentran lo que buscan, y que un
   * comentario que la nombra no cuenta.</p>
   */
  it('las expresiones encuentran la palabra cuando de verdad está', () => {
    const conLaPalabra = soloLoQueSeLee('const rotulo = "Marca bloqueante";');
    const soloEnComentario = soloLoQueSeLee('// la marca bloqueante se retiro\nconst r = "Obligatorio";');

    expect(RETIRADAS[0].palabra.test(conLaPalabra)).toBe(true);
    expect(RETIRADAS[0].palabra.test(soloEnComentario)).toBe(false);
  });
});
