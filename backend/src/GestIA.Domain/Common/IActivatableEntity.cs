namespace GestIA.Domain.Common;

/// <summary>
/// Marks a master record that uses the GestIA logical-deactivation convention.
/// </summary>
public interface IActivatableEntity
{
    bool Active { get; }
}
