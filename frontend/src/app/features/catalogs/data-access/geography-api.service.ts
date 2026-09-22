import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

/**
 * Un lugar de la geografía compartida: su clave y su nombre.
 *
 * <p>Las dos cosas viajan porque se usan para cosas distintas. El país se guarda por
 * <b>clave</b> —la columna `CountryCode` es de dos caracteres y ahí va «MX»—, mientras que el
 * estado y el municipio se guardan por <b>nombre</b>, que es lo que esas columnas contienen desde
 * siempre.</p>
 */
export interface GeoPlace {
  readonly code: string;
  readonly name: string;
}

export interface PostalCodeNeighborhood {
  readonly name: string;
  readonly settlementType: string | null;
}

export interface PostalCodeLookup {
  readonly postalCode: string;
  readonly countryCode: string;
  readonly state: GeoPlace;
  readonly municipality: GeoPlace;
  readonly neighborhoods: readonly PostalCodeNeighborhood[];
}

/**
 * La geografía, que desde el 22 de septiembre de 2026 <b>no es un catálogo de la organización</b>.
 *
 * <p>Ningún método recibe `organizationId`, y ésa es la diferencia con
 * {@link CatalogApiService}: países, estados y municipios son los mismos para todas las empresas.
 * Antes se pedían con el resto del catálogo de la organización, repetidos una vez por empresa.</p>
 */
@Injectable({ providedIn: 'root' })
export class GeographyApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/geography';

  listCountries() {
    return this.http.get<readonly GeoPlace[]>(`${this.baseUrl}/countries`);
  }

  /** @param country Clave ISO o nombre; se acepta lo que la pantalla tenga a mano. */
  listStates(country: string) {
    const params = new HttpParams().set('country', country);
    return this.http.get<readonly GeoPlace[]>(`${this.baseUrl}/states`, { params });
  }

  listMunicipalities(country: string, state: string) {
    const params = new HttpParams().set('country', country).set('state', state);
    return this.http.get<readonly GeoPlace[]>(`${this.baseUrl}/municipalities`, { params });
  }

  /**
   * Qué hay en un código postal.
   *
   * <p>Responde 404 cuando el código no está en el padrón, que no es lo mismo que decir que no
   * existe: el catálogo se publica cada tanto y los fraccionamientos nuevos tardan en entrar. Por
   * eso la pantalla conserva los desplegables en vez de impedir la captura.</p>
   */
  lookupPostalCode(postalCode: string) {
    return this.http.get<PostalCodeLookup>(`${this.baseUrl}/postal-codes/${postalCode}`);
  }
}
