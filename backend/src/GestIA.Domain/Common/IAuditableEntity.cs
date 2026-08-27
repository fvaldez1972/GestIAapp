namespace GestIA.Domain.Common;

/// <summary>
/// Defines the standard traceability fields for mutable GestIA records.
/// Timestamps are always interpreted as UTC.
/// </summary>
public interface IAuditableEntity
{
    DateTime CreatedAt { get; }

    Guid CreatedBy { get; }

    string CreatedByName { get; }

    DateTime? UpdatedAt { get; }

    Guid? UpdatedBy { get; }

    string? UpdatedByName { get; }
}
