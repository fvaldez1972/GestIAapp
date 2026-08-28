namespace GestIA.Domain.Requests;

public enum OperationalRequestType
{
    NewClient = 0,
    NewService = 1,
    ServiceChange = 2,
    CoverageSupport = 3,
    StaffChange = 4,
    Other = 99
}
