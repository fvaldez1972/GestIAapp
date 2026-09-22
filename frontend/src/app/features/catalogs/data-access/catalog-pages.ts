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
  /** La línea que explica qué es, debajo del título. */
  readonly lead: string;
  /** Un valor de ejemplo, para el estado vacío. */
  readonly example: string;
  /** Si sus valores llevan naturaleza: bloqueante o informativa. */
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
        lead: 'Qué puesto ocupa una persona y qué puesto pide una posición del servicio.',
        example: 'Ej. Guardia de seguridad',
      },
      {
        slug: 'experiencia',
        type: 'Skill',
        title: 'Experiencia requerida',
        singular: 'experiencia',
        lead: 'Competencias que una regla de elegibilidad puede exigir.',
        example: 'Ej. Manejo de arma corta',
        hasNature: true,
      },
      {
        slug: 'categorias-de-documento',
        type: 'EmployeeDocumentGroup',
        title: 'Categorías de documento del personal',
        singular: 'categoría',
        lead: 'Agrupa los tipos de documento para poder leer el expediente por bloques.',
        example: 'Ej. Identidad',
      },
      {
        slug: 'tipos-de-documento',
        type: 'EmployeeDocumentCategory',
        title: 'Tipos de documento del personal',
        singular: 'tipo de documento',
        lead: 'De qué es cada papel del expediente de una persona.',
        example: 'Ej. INE',
        hasNature: true,
        parentType: 'EmployeeDocumentGroup',
      },
      {
        slug: 'tipos-de-evaluacion',
        type: 'EmployeeEvaluationCategory',
        title: 'Tipos de evaluación',
        singular: 'tipo de evaluación',
        lead: 'Qué evaluaciones se le practican al personal.',
        example: 'Ej. Polígrafo',
        hasNature: true,
      },
      {
        slug: 'incidencias-administrativas',
        type: 'AdministrativeIncidentType',
        title: 'Incidencias administrativas',
        singular: 'tipo de incidencia',
        lead: 'De qué es una incidencia del expediente, que no es lo mismo que una de la operación diaria.',
        example: 'Ej. Acta administrativa',
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
        lead: 'Se muestra al comparar el perfil de una posición con una persona. Nunca bloquea.',
        example: 'Ej. Indistinto',
      },
      {
        slug: 'rangos-de-edad',
        type: 'AgeRange',
        title: 'Rangos de edad',
        singular: 'rango',
        lead: 'Se muestra al comparar el perfil de una posición con una persona. Nunca bloquea.',
        example: 'Ej. 25 a 40 años',
      },
      {
        slug: 'escolaridad',
        type: 'EducationLevel',
        title: 'Escolaridad',
        singular: 'nivel',
        lead: 'El orden importa: es lo que permite comparar si una escolaridad alcanza a otra.',
        example: 'Ej. Preparatoria',
      },
      {
        slug: 'equipo-requerido',
        type: 'RequiredEquipment',
        title: 'Equipo requerido',
        singular: 'equipo',
        lead: 'Qué equipo pide una posición para poder cubrirse.',
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
        lead: 'Cómo se clasifica una excepción de la operación diaria.',
        example: 'Ej. Retardo mayor a 30 minutos',
      },
      {
        slug: 'motivos-de-cobertura',
        type: 'CoverageReason',
        title: 'Motivos de cobertura',
        singular: 'motivo',
        lead: 'Por qué se cubre o se sustituye un turno.',
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
        lead: 'De qué es cada documento del expediente de un cliente.',
        example: 'Ej. Acta constitutiva',
      },
      {
        slug: 'puestos-de-contacto',
        type: 'ContactJobPosition',
        title: 'Puestos de contacto',
        singular: 'puesto',
        lead: 'Qué puesto ocupa la persona con la que se trata en el cliente.',
        example: 'Ej. Gerente de compras',
      },
      {
        slug: 'propositos-de-contacto',
        type: 'ContactPurpose',
        title: 'Propósitos de contacto',
        singular: 'propósito',
        lead: 'Para qué sirve ese contacto: a quién se le llama y para qué.',
        example: 'Ej. Facturación',
      },
      {
        slug: 'nacionalidades',
        type: 'Nationality',
        title: 'Nacionalidades',
        singular: 'nacionalidad',
        lead: 'Nacionalidad de un cliente persona física.',
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
