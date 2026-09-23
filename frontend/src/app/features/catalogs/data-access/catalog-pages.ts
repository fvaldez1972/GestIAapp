import { BusinessCatalogItemType } from './catalog.models';

/**
 * Una página de catálogo: qué lista administra y cómo se llega a ella.
 *
 * <p><b>El `slug` es parte del contrato con el usuario, no un detalle.</b> Va en la barra de
 * direcciones, se copia y se pega en un mensaje, y se guarda en favoritos. Cambiarlo rompe enlaces
 * que ya existen, así que se elige una vez y se deja: por eso es el nombre en español del catálogo
 * y no el del tipo del dominio, que es interno y puede cambiar sin que nadie se entere.</p>
 */
export type CatalogPage = {
  /** El trozo de ruta que va después de `/catalogos/`. */
  readonly slug: string;
  readonly type: BusinessCatalogItemType;
  /** El rótulo del submenú y el título de la página. */
  readonly title: string;
  /** Cómo se nombra un valor suelto, para el botón: «Agregar tipo de evaluación». */
  readonly singular: string;
  /** Un valor de ejemplo, para el estado vacío. */
  readonly example: string;
  /** Si sus valores llevan naturaleza: obligatorio o informativa. */
  readonly hasNature?: boolean;
  /** De qué catálogo cuelgan sus valores, cuando cuelgan de alguno. */
  readonly parentType?: BusinessCatalogItemType;
};

/**
 * Un bloque del submenú, por el módulo que consume esos catálogos.
 *
 * <p>Son dieciocho entradas contando las dos pantallas propias, y dieciocho renglones seguidos se
 * leen uno por uno. Agrupados se encuentran por eliminación: quien busca dónde se configuran los
 * tipos de documento sabe que es cosa de Personal antes de leer la lista.</p>
 */
export type CatalogPageGroup = {
  readonly label: string;
  readonly pages: readonly CatalogPage[];
};

/**
 * Los dieciséis catálogos que son listas simples, agrupados como se dibujan.
 *
 * <p><b>La geografía no está, y es a propósito.</b> Países, estados y ciudades vienen cargados y no
 * se administran: son más de diecisiete mil filas por organización que en realidad son las mismas
 * para todas. Siguen existiendo y siguen siendo consultables; lo que no tienen es una página en la
 * que alguien se ponga a mantenerlas.</p>
 *
 * <p><b>Patrones de turno y Reglas de elegibilidad tampoco están aquí</b>, porque no son listas de
 * nombre y descripción: un patrón tiene ciclo, días y horas, y una regla tiene ámbito, tipo y
 * requisito. Tienen su propia pantalla y entran al submenú por su cuenta.</p>
 *
 * <p><b>Dos que se retiraron el 21 de septiembre de 2026, y por qué.</b></p>
 *
 * <p><i>Categorías de documento del personal</i> (<c>EmployeeDocumentGroup</c>) agrupaba los tipos
 * de documento «para poder leer el expediente por bloques», y esa lectura por bloques <b>nunca se
 * construyó</b>: se buscó quién la consumía y no la consume nadie más que su propio selector. Dos
 * entradas del menú que se llamaban casi igual —categorías y tipos— para una agrupación que no se
 * usaba en ninguna pantalla.</p>
 *
 * <p><i>Incidencias administrativas</i> sale del submenú <b>y nada más</b>: la incidencia del
 * expediente sigue existiendo, sigue atada a la persona y sigue pudiendo impedir una asignación.
 * Lo que se retira es su renglón aquí, porque en el menú de catálogos ya hay «Motivos de
 * incidencia» y tener dos entradas que empiezan por «incidencia» invita a confundirlas. Su
 * catálogo se sigue administrando desde la pantalla anterior.</p>
 */
export const CATALOG_PAGE_GROUPS: readonly CatalogPageGroup[] = [
  {
    label: 'Personal',
    pages: [
      {
        slug: 'puestos',
        type: 'JobPosition',
        title: 'Puestos',
        singular: 'puesto',
        example: 'Ej. Guardia de seguridad',
      },
      {
        slug: 'experiencia',
        type: 'Skill',
        title: 'Experiencia requerida',
        singular: 'experiencia',
        example: 'Ej. Manejo de arma corta',
        hasNature: true,
      },
      {
        slug: 'tipos-de-documento',
        type: 'EmployeeDocumentCategory',
        title: 'Tipos de documento del personal',
        singular: 'tipo de documento',
        example: 'Ej. INE',
        hasNature: true,
      },
      {
        slug: 'tipos-de-evaluacion',
        type: 'EmployeeEvaluationCategory',
        title: 'Tipos de evaluación',
        singular: 'tipo de evaluación',
        example: 'Ej. Polígrafo',
        hasNature: true,
      },
    ],
  },

  {
    label: 'Posiciones',
    pages: [
      {
        slug: 'sexo',
        type: 'Sex',
        title: 'Sexo requerido',
        singular: 'valor',
        example: 'Ej. Indistinto',
      },
      {
        slug: 'rangos-de-edad',
        type: 'AgeRange',
        title: 'Rangos de edad',
        singular: 'rango',
        example: 'Ej. 25 a 40 años',
      },
      {
        slug: 'escolaridad',
        type: 'EducationLevel',
        title: 'Escolaridad',
        singular: 'nivel',
        example: 'Ej. Preparatoria',
      },
      {
        slug: 'equipo-requerido',
        type: 'RequiredEquipment',
        title: 'Equipo requerido',
        singular: 'equipo',
        example: 'Ej. Radio portátil',
      },
    ],
  },

  {
    label: 'Operación',
    pages: [
      {
        slug: 'motivos-de-incidencia',
        type: 'IncidentReason',
        title: 'Motivos de incidencia',
        singular: 'motivo',
        example: 'Ej. Retardo mayor a 30 minutos',
      },
      {
        slug: 'motivos-de-cobertura',
        type: 'CoverageReason',
        title: 'Motivos de cobertura',
        singular: 'motivo',
        example: 'Ej. Incapacidad médica',
      },
    ],
  },

  {
    label: 'Clientes',
    pages: [
      {
        slug: 'categorias-de-documento-del-cliente',
        type: 'ClientDocumentCategory',
        title: 'Categorías de documento del cliente',
        singular: 'categoría',
        example: 'Ej. Acta constitutiva',
      },
      {
        slug: 'puestos-de-contacto',
        type: 'ContactJobPosition',
        title: 'Puestos de contacto',
        singular: 'puesto',
        example: 'Ej. Gerente de compras',
      },
      {
        slug: 'propositos-de-contacto',
        type: 'ContactPurpose',
        title: 'Propósitos de contacto',
        singular: 'propósito',
        example: 'Ej. Facturación',
      },
      {
        slug: 'nacionalidades',
        type: 'Nationality',
        title: 'Nacionalidades',
        singular: 'nacionalidad',
        example: 'Ej. Mexicana',
      },
    ],
  },
];

/** Todas las páginas sin sus bloques, para lo que necesita buscarlas y no dibujarlas. */
export const CATALOG_PAGES: readonly CatalogPage[] =
  CATALOG_PAGE_GROUPS.flatMap((group) => group.pages);

export function catalogPageBySlug(slug: string): CatalogPage | undefined {
  return CATALOG_PAGES.find((page) => page.slug === slug);
}
