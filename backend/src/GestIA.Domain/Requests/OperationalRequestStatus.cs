namespace GestIA.Domain.Requests;

public enum OperationalRequestStatus
{
    Draft = 0,
    Submitted = 1,
    InReview = 2,
    Approved = 3,
    Rejected = 4,
    Cancelled = 5,
    Completed = 6
}
