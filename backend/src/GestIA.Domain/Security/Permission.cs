namespace GestIA.Domain.Security;

#pragma warning disable CA1711
public sealed class Permission
#pragma warning restore CA1711
{
    private Permission()
    {
    }

    public Guid IdPermission { get; private set; }
    public string CodePermission { get; private set; } = string.Empty;
    public string Module { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;

    public static Permission Create(string codePermission, string module, string description)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(codePermission);
        ArgumentException.ThrowIfNullOrWhiteSpace(module);
        ArgumentException.ThrowIfNullOrWhiteSpace(description);

        return new Permission
        {
            IdPermission = Guid.NewGuid(),
            CodePermission = codePermission.Trim().ToUpperInvariant(),
            Module = module.Trim(),
            Description = description.Trim()
        };
    }
}
