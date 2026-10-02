/**
 * Plus code (Open Location Code) a partir de latitud y longitud.
 *
 * <p>Se deriva aquí y no se guarda: un Plus code es una forma de escribir un par de coordenadas, así
 * que guardarlo sería guardar dos veces el mismo dato con la posibilidad de que uno quede viejo.</p>
 *
 * <p>Implementado localmente —son cuarenta líneas— en vez de traer una dependencia. El algoritmo es
 * el de Google Open Location Code, con los diez primeros caracteres, que dan unos catorce metros.</p>
 */
const ALFABETO = '23456789CFGHJMPQRVWX';
const SEPARADOR = '+';
const POSICION_SEPARADOR = 8;

export function plusCode(latitude: number | null, longitude: number | null): string {
  if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return '';
  }

  // La latitud se recorta al polo para que 90 no se salga de la última celda.
  const lat = Math.min(Math.max(latitude, -90), 90) === 90 ? 89.999999 : Math.min(Math.max(latitude, -90), 90);
  const lon = ((((longitude + 180) % 360) + 360) % 360) - 180;

  let latResto = lat + 90;
  let lonResto = lon + 180;
  let latPaso = 20;
  let lonPaso = 20;
  let codigo = '';

  for (let par = 0; par < 5; par++) {
    latPaso = par === 0 ? 20 : latPaso / 20;
    lonPaso = par === 0 ? 20 : lonPaso / 20;

    const digitoLat = Math.floor(latResto / latPaso);
    latResto -= digitoLat * latPaso;
    const digitoLon = Math.floor(lonResto / lonPaso);
    lonResto -= digitoLon * lonPaso;

    codigo += ALFABETO[Math.min(digitoLat, 19)] + ALFABETO[Math.min(digitoLon, 19)];

    if (codigo.length === POSICION_SEPARADOR) {
      codigo += SEPARADOR;
    }
  }

  return codigo;
}
