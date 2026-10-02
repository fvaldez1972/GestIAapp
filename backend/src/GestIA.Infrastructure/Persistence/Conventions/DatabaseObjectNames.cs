namespace GestIA.Infrastructure.Persistence.Conventions;

public static class DatabaseObjectNames
{
    private const int SqlServerIdentifierMaxLength = 128;

    public static string PrimaryKey(string table) => EnsureLength($"PK_{table}");

    public static string AlternateKey(string table, IEnumerable<string> columns) =>
        EnsureLength($"AK_{table}_{JoinColumns(columns)}");

    public static string ForeignKey(string sourceTable, string targetTable, IEnumerable<string> columns) =>
        EnsureLength($"FK_{sourceTable}_{targetTable}_{JoinColumns(columns)}");

    public static string Index(string table, IEnumerable<string> columns, bool unique) =>
        EnsureLength($"{(unique ? "UX" : "IX")}_{table}_{JoinColumns(columns)}");

    public static string Check(string table, string column, string condition) =>
        EnsureLength($"CK_{table}_{column}_{condition}");

    public static string Default(string table, string column) =>
        EnsureLength($"DF_{table}_{column}");

    private static string JoinColumns(IEnumerable<string> columns)
    {
        var names = string.Join('_', columns);

        return string.IsNullOrWhiteSpace(names)
            ? throw new ArgumentException("At least one column is required.", nameof(columns))
            : names;
    }

    private static string EnsureLength(string identifier)
    {
        return identifier.Length <= SqlServerIdentifierMaxLength
            ? identifier
            : throw new InvalidOperationException(
                $"Database identifier '{identifier}' exceeds SQL Server's {SqlServerIdentifierMaxLength}-character limit.");
    }
}
