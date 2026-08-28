namespace GestIA.Domain.Documents;

public enum BusinessDocumentStatus
{
    PendingReview = 0,
    Validated = 1,
    Rejected = 2,
    Expired = 3,
    Archived = 4
}
