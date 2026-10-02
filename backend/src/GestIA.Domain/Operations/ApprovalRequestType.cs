namespace GestIA.Domain.Operations;

public enum ApprovalRequestType
{
    AttendanceCorrection = 1,
    IncidentClosure = 2,
    CoverageCorrection = 3,
    ServiceConfigurationChange = 4,
    DocumentException = 5,
    Other = 99
}
