using GestIA.Domain.Catalogs;
using GestIA.Domain.History;
using GestIA.Domain.Clients;
using GestIA.Domain.Documents;
using GestIA.Domain.Operations;
using GestIA.Domain.Planning;
using GestIA.Domain.Requests;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Catalogs;

public sealed record CatalogDefinitionValue(string Code, string Label);

/// <summary>
/// Un catálogo del sistema, editable o fijo.
///
/// <para>Perdió el grupo el 7 de septiembre de 2026, junto con la columna <c>CatalogGroup</c> de la
/// tabla: nadie lo leía, y agrupar catorce catálogos en tres cajones no ayudaba a encontrarlos.</para>
/// </summary>
public sealed record CatalogDefinition(string Key, string Name, string Module,
    bool Editable, BusinessCatalogItemType? Type, IReadOnlyList<CatalogDefinitionValue> Values);

public static class CatalogDefinitions
{
    public static IReadOnlyList<CatalogDefinition> All { get; } =
    [
        Editable(BusinessCatalogItemType.Skill, "Habilidades", "Personal"),
        Editable(BusinessCatalogItemType.JobPosition, "Puestos", "Personal"),
        Editable(BusinessCatalogItemType.Country, "Paises", "Domicilios"),
        Editable(BusinessCatalogItemType.State, "Estados", "Domicilios"),
        Editable(BusinessCatalogItemType.City, "Ciudades y municipios", "Domicilios"),
        Editable(BusinessCatalogItemType.Nationality, "Nacionalidades", "Clientes"),
        Editable(BusinessCatalogItemType.IncidentReason, "Motivos de incidencia", "Operacion"),
        Editable(BusinessCatalogItemType.CoverageReason, "Motivos de cobertura", "Operacion"),
        Fixed<OperationalRequestType>("Tipos de solicitud", "Solicitudes"),
        Fixed<OperationalRequestStatus>("Estados de solicitud", "Solicitudes"),
        Fixed<OperationalRequestPriority>("Prioridades de solicitud", "Solicitudes"),
        Fixed<EmployeeDocumentType>("Tipos de documento del personal", "Personal"),
        Fixed<EmployeeDocumentStatus>("Estados del documento del personal", "Personal"),
        Fixed<EmployeeEvaluationType>("Tipos de evaluacion", "Personal"),
        Fixed<EmployeeEvaluationResult>("Resultados de evaluacion", "Personal"),
        Fixed<EmployeeStatus>("Estados del personal", "Personal"),
        Fixed<ServiceAssignmentType>("Tipos de asignacion", "Servicios"),
        Fixed<ServiceContractStatus>("Estados del contrato", "Clientes"),
        Fixed<BusinessDocumentOwnerType>("Propietarios documentales", "Documentos"),
        Fixed<BusinessDocumentStatus>("Estados documentales", "Documentos"),
        Fixed<AttendanceStatus>("Estados de asistencia", "Operacion"),
        Fixed<IncidentStatus>("Estados de incidencia", "Operacion"),
        Fixed<IncidentSeverity>("Severidades de incidencia", "Operacion"),
        Fixed<ClientContactPurpose>("Propositos de contacto", "Clientes"),
        Fixed<CoverageStatus>("Estados de cobertura", "Operacion"),
        Fixed<OperationEvidenceType>("Tipos de evidencia", "Operacion"),
        Fixed<OperationDayClosureStatus>("Estados del cierre diario", "Operacion"),
        Fixed<ApprovalRequestType>("Tipos de autorizacion", "Operacion"),
        Fixed<ApprovalRequestStatus>("Estados de autorizacion", "Operacion"),
        Fixed<ScheduleVersionStatus>("Estados de planeacion", "Planeacion"),
        Fixed<EligibilityRequirementType>("Tipos de regla", "Catalogos"),
        Fixed<EligibilityRequirementTargetType>("Alcances de regla", "Catalogos"),
        Fixed<OperationalEntityType>("Registros con historial", "Auditoria")
    ];

    private static CatalogDefinition Editable(BusinessCatalogItemType type, string name, string module) =>
        new(type.ToString(), name, module, true, type, []);

    private static CatalogDefinition Fixed<T>(string name, string module) where T : struct, Enum =>
        new(typeof(T).Name, name, module, false, null,
            Enum.GetNames<T>().Select(code => new CatalogDefinitionValue(code, Label(code))).ToArray());

    private static string Label(string code) => code switch
    {
        "NewClient" => "Alta de cliente", "NewService" => "Alta de servicio", "ServiceChange" => "Cambio de servicio",
        "Administrative" => "Administrativo", "Operational" => "Operativo", "Billing" => "Facturacion",
        "Legal" => "Legal", "Emergency" => "Emergencia", "Payments" => "Pagos", "Purchasing" => "Compras", "InternalSecurity" => "Seguridad interna",
        "CoverageSupport" => "Apoyo de cobertura", "StaffChange" => "Cambio de personal", "Other" => "Otro",
        "Draft" => "Borrador", "Submitted" => "Enviada", "InReview" or "UnderReview" => "En revision",
        "Approved" => "Aprobado", "Rejected" => "Rechazado", "Cancelled" => "Cancelado", "Completed" => "Completado",
        "Low" => "Baja", "Medium" => "Media", "High" => "Alta", "Critical" => "Critica",
        "EmploymentApplication" => "Solicitud de empleo", "BirthCertificate" => "Acta de nacimiento",
        "MarriageCertificate" => "Acta de matrimonio", "VoterId" => "INE", "Curp" => "CURP", "SocialSecurityNumber" => "NSS",
        "Rfc" => "RFC", "TaxStatusCertificate" => "Constancia de situacion fiscal", "DriverLicense" => "Licencia de conducir",
        "ProofOfAddress" => "Comprobante de domicilio", "ProofOfStudies" => "Comprobante de estudios",
        "MilitaryServiceCard" => "Cartilla militar", "CriminalRecordCertificate" => "Constancia de antecedentes",
        "Pending" => "Pendiente", "Received" => "Recibido", "Validated" => "Validado", "Expired" => "Vencido",
        "NotApplicable" => "No aplica", "Polygraph" => "Poligrafo", "SocioeconomicStudy" => "Estudio socioeconomico",
        "CriminalRecordReview" => "Revision de antecedentes", "DrugTest" => "Examen toxicologico",
        "ApprovedWithObservations" => "Aprobado con observaciones", "NotApproved" => "No aprobado", "Inconclusive" => "No concluyente",
        "Candidate" => "Candidato", "Active" => "Activo", "OnLeave" => "En licencia", "Inactive" => "Inactivo", "Terminated" => "Baja",
        "Primary" => "Principal", "Support" => "Apoyo", "Relief" => "Relevo", "TemporaryReplacement" => "Reemplazo temporal",
        "AttendanceRecord" => "Asistencia", "ServiceConfiguration" => "Configuracion de servicio",
        "Incident" => "Incidencia", "CoverageRecord" => "Cobertura", "ServiceAssignment" => "Asignacion",
        "Executed" => "Firmado", "Effective" => "Vigente", "PendingReview" => "Pendiente de revision", "Archived" => "Archivado",
        "Client" => "Cliente", "ServiceContract" => "Contrato", "Service" => "Servicio", "Employee" => "Empleado",
        "EmployeeEvaluation" => "Evaluacion del empleado", "OperationalRequest" => "Solicitud", "Organization" => "Organizacion",
        "Position" => "Posicion", "Skill" => "Habilidad", "Document" => "Documento", "Evaluation" => "Evaluacion", "Restriction" => "Restriccion",
        "Expected" => "Esperada", "Present" => "Presente", "Late" => "Retardo", "Absent" => "Falta", "Excused" => "Justificada",
        "Open" => "Abierta", "Resolved" => "Resuelta", "Requested" => "Solicitada", "Confirmed" => "Confirmada",
        "Photo" => "Fotografia", "Report" => "Reporte", "Signature" => "Firma", "Closed" => "Cerrado", "Reopened" => "Reabierto",
        "AttendanceCorrection" => "Correccion de asistencia", "IncidentClosure" => "Cierre de incidencia",
        "CoverageCorrection" => "Correccion de cobertura", "ServiceConfigurationChange" => "Cambio de configuracion",
        "DocumentException" => "Excepcion documental", "Published" => "Publicada", "Superseded" => "Sustituida",
        _ => code
    };
}
