using GestIA.Domain.Catalogs;

namespace GestIA.Application.Catalogs;

/// <summary>
/// Un valor con el que nace uno de los catálogos de perfil.
/// </summary>
/// <param name="Type">El catálogo al que pertenece.</param>
/// <param name="Name">El nombre visible.</param>
/// <param name="Order">El orden en que se enseña.</param>
/// <param name="IsRequired">
/// La marca de bloqueo, sólo para los catálogos que la admiten. Nula en los demás, y nula también
/// en los que la admiten pero cuya severidad no le toca decidir al sistema.
/// </param>
public sealed record ProfileCatalogSeedValue(
    BusinessCatalogItemType Type,
    string Name,
    int Order,
    bool? IsRequired = null);

/// <summary>
/// Los valores con los que nacen los cinco catálogos de perfil.
///
/// <para><b>Por qué se siembran, si el alta real no inventa configuración.</b> Estos cinco se
/// construyeron entre el 18 y el 19 de septiembre de 2026 y quedaron <b>vacíos en las ocho
/// organizaciones vivas</b>: existían el tipo, la pantalla y los endpoints, y no había ni un valor
/// que elegir. El efecto práctico era que los tres selectores de perfil de la posición y el de
/// equipo salían vacíos, y la pestaña de incidencias administrativas no dejaba registrar nada
/// porque no había ningún motivo. Una función que no se puede usar no está construida.</para>
///
/// <para>Es un punto de partida, no una taxonomía impuesta: cada organización puede renombrar,
/// reordenar o desactivar lo que quiera, igual que con los tipos de documento. Lo que no puede es
/// empezar desde la nada.</para>
///
/// <para><b>Vive aquí y no sólo dentro de la migración</b> porque las dos tienen que sembrar lo
/// mismo: la migración atiende a las organizaciones que ya existían y esto a las que vengan. Si se
/// separaran, una organización creada mañana tendría catálogos distintos de una creada ayer.</para>
/// </summary>
public static class ProfileCatalogSeed
{
    public static IReadOnlyList<ProfileCatalogSeedValue> All { get; } =
    [
        // Sexo. Lleva «Indistinto» porque describe lo que el cliente contrató y no a una persona:
        // una posición que admite a cualquiera tiene que poder decirlo, y dejarla vacía significaría
        // «no se sabe», que es otra cosa.
        new(BusinessCatalogItemType.Sex, "Masculino", 1),
        new(BusinessCatalogItemType.Sex, "Femenino", 2),
        new(BusinessCatalogItemType.Sex, "Indistinto", 3),

        // Rangos de edad, con los tramos del documento de requerimientos. Son nombres, no números:
        // el catálogo no guarda un mínimo ni un máximo, así que hoy sirven para declarar lo que el
        // cliente pide y no para compararlo contra la edad de nadie. Compararlo exigiría dos
        // columnas numéricas, y eso es de la tanda del matching.
        new(BusinessCatalogItemType.AgeRange, "18 a 30 años", 1),
        new(BusinessCatalogItemType.AgeRange, "31 a 50 años", 2),
        new(BusinessCatalogItemType.AgeRange, "51 a 60 años", 3),
        new(BusinessCatalogItemType.AgeRange, "Indistinto", 4),

        // Escolaridad, en el orden del sistema educativo mexicano. El orden importa más que en otros
        // catálogos: cuando se decida si la comparación es «igual a» o «igual o superior a», es esta
        // columna la que dice qué significa «superior».
        new(BusinessCatalogItemType.EducationLevel, "Sin estudios", 1),
        new(BusinessCatalogItemType.EducationLevel, "Primaria", 2),
        new(BusinessCatalogItemType.EducationLevel, "Secundaria", 3),
        new(BusinessCatalogItemType.EducationLevel, "Bachillerato", 4),
        new(BusinessCatalogItemType.EducationLevel, "Carrera técnica", 5),
        new(BusinessCatalogItemType.EducationLevel, "Licenciatura", 6),
        new(BusinessCatalogItemType.EducationLevel, "Posgrado", 7),

        // Equipo requerido por la posición. Lo que el puesto exige, no lo que la empresa entrega:
        // de dónde sale que la persona lo tiene sigue sin definirse, y hasta entonces esto se
        // declara y se muestra, pero no bloquea nada.
        new(BusinessCatalogItemType.RequiredEquipment, "Radio de comunicación", 1),
        new(BusinessCatalogItemType.RequiredEquipment, "Teléfono celular", 2),
        new(BusinessCatalogItemType.RequiredEquipment, "Uniforme completo", 3),
        new(BusinessCatalogItemType.RequiredEquipment, "Calzado de seguridad", 4),
        new(BusinessCatalogItemType.RequiredEquipment, "Lámpara de mano", 5),
        new(BusinessCatalogItemType.RequiredEquipment, "Chaleco reflejante", 6),
        new(BusinessCatalogItemType.RequiredEquipment, "Fornitura", 7),
        new(BusinessCatalogItemType.RequiredEquipment, "Vehículo propio", 8),
        new(BusinessCatalogItemType.RequiredEquipment, "Licencia de conducir vigente", 9),

        // Incidencias administrativas. Son los únicos de los cinco que llevan marca de bloqueo, y
        // sólo dos nacen bloqueando: abandonar el puesto y estar suspendido son hechos que impiden
        // volver a asignar hasta que alguien los retire. Los demás nacen informativos —dejan
        // constancia y no detienen la operación— porque una falta o un retardo no es, por sí mismo,
        // motivo para que nadie pueda cubrir un turno. Quien responda por la operación puede
        // cambiar cualquiera de las dos marcas, y el cambio aplica a la validación siguiente sin
        // tocar ningún expediente.
        new(BusinessCatalogItemType.AdministrativeIncidentType, "Abandono de puesto", 1, IsRequired: true),
        new(BusinessCatalogItemType.AdministrativeIncidentType, "Suspensión vigente", 2, IsRequired: true),
        new(BusinessCatalogItemType.AdministrativeIncidentType, "Falta injustificada", 3, IsRequired: false),
        new(BusinessCatalogItemType.AdministrativeIncidentType, "Retardo", 4, IsRequired: false),
        new(BusinessCatalogItemType.AdministrativeIncidentType, "Incumplimiento del reglamento", 5, IsRequired: false),
        new(BusinessCatalogItemType.AdministrativeIncidentType, "Queja del cliente", 6, IsRequired: false),
        new(BusinessCatalogItemType.AdministrativeIncidentType, "Extravío de equipo", 7, IsRequired: false),
        new(BusinessCatalogItemType.AdministrativeIncidentType, "Acta administrativa", 8, IsRequired: false),

        // ── Los catálogos del Excel de CPPS, 26 de septiembre de 2026 ────────────────────────
        //
        // Vienen de la hoja CATALOGOS del archivo que el cliente entregó. Se siembran con los demás
        // para que una organización nueva no arranque con los selectores vacíos, y la migración del
        // mismo día los carga en las que ya existían.
        //
        // La psicometría NO entra como tipo de evaluación: desde RQ-08 es un registro propio del
        // expediente, con su check y su fecha. Los patrones de turno tampoco: son una entidad aparte
        // con su horario y su ciclo, y les toca su propia tanda.

        new(BusinessCatalogItemType.JobPosition, "Gerencia de operaciones", 20),
        new(BusinessCatalogItemType.JobPosition, "Coordinación de operaciones", 21),
        new(BusinessCatalogItemType.JobPosition, "Supervisor", 22),
        new(BusinessCatalogItemType.JobPosition, "Patrullero", 23),
        new(BusinessCatalogItemType.JobPosition, "Trasladista", 24),
        new(BusinessCatalogItemType.JobPosition, "Jefe de servicio", 25),
        new(BusinessCatalogItemType.JobPosition, "Jefe de turno", 26),

        // Las tareas del puesto y las aptitudes comparten catálogo porque las dos son «experiencia
        // requerida» en el modelo, y el Excel las lista en dos columnas por comodidad de lectura.
        new(BusinessCatalogItemType.Skill, "Llevar controles de entradas y salidas de mercancía", 20, false),
        new(BusinessCatalogItemType.Skill, "Control de entradas y salidas de personas y vehículos", 21, false),
        new(BusinessCatalogItemType.Skill, "Uso y manejo de teléfonos, radios y reportes escritos", 22, false),
        new(BusinessCatalogItemType.Skill, "Manejo de circuito cerrado de televisión", 23, false),
        new(BusinessCatalogItemType.Skill, "Elaboración de reportes y bitácoras de control", 24, false),
        new(BusinessCatalogItemType.Skill, "Detección de condiciones y acciones inseguras", 25, false),
        new(BusinessCatalogItemType.Skill, "Detección de situaciones de riesgo externas", 26, false),
        new(BusinessCatalogItemType.Skill, "Disciplina", 27, false),
        new(BusinessCatalogItemType.Skill, "Honestidad", 28, false),
        new(BusinessCatalogItemType.Skill, "Responsabilidad", 29, false),
        new(BusinessCatalogItemType.Skill, "Pulcritud", 30, false),
        new(BusinessCatalogItemType.Skill, "Seguimiento de instrucciones", 31, false),
        new(BusinessCatalogItemType.Skill, "Puntualidad", 32, false),
        new(BusinessCatalogItemType.Skill, "Comunicación asertiva", 33, false),

        new(BusinessCatalogItemType.EmployeeEvaluationCategory, "Antidoping", 20, true),
        new(BusinessCatalogItemType.EmployeeEvaluationCategory, "Prueba poligráfica a petición del cliente", 21, false),
        new(BusinessCatalogItemType.EmployeeEvaluationCategory, "Antecedentes laborales", 22, false),
        new(BusinessCatalogItemType.EmployeeEvaluationCategory, "Antecedentes penales a petición del cliente", 23, false),

        new(BusinessCatalogItemType.IncidentReason, "Ausentismo", 20),
        new(BusinessCatalogItemType.IncidentReason, "Retardo", 21),
        new(BusinessCatalogItemType.IncidentReason, "Permiso", 22),
        new(BusinessCatalogItemType.IncidentReason, "Incapacidad", 23),
        new(BusinessCatalogItemType.IncidentReason, "Paternidad", 24),
        new(BusinessCatalogItemType.IncidentReason, "Maternidad", 25),
        new(BusinessCatalogItemType.IncidentReason, "Vacaciones", 26),

        new(BusinessCatalogItemType.EmployeeDocumentCategory, "Cartas de recomendación de empleos anteriores", 20, false),
        new(BusinessCatalogItemType.EmployeeDocumentCategory, "Alta de IMSS", 21, false),
        new(BusinessCatalogItemType.EmployeeDocumentCategory, "Currículum", 22, false),

        new(BusinessCatalogItemType.ClientDocumentCategory, "Constancia de situación fiscal", 20),
        new(BusinessCatalogItemType.ClientDocumentCategory, "Acta constitutiva", 21),
        new(BusinessCatalogItemType.ClientDocumentCategory, "Comprobante de domicilio", 22),
    ];
}
