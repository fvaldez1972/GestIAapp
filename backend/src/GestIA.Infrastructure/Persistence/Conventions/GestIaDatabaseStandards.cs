using System.Linq.Expressions;
using System.Text.RegularExpressions;
using GestIA.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace GestIA.Infrastructure.Persistence.Conventions;

public static partial class GestIaDatabaseStandards
{
    private static readonly HashSet<string> ReservedWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "Group",
        "Index",
        "Key",
        "Order",
        "Procedure",
        "Table",
        "Trigger",
        "User",
        "View"
    };

    private static readonly HashSet<string> IrregularPluralTableNames = new(StringComparer.Ordinal)
    {
        "Children",
        "Men",
        "People",
        "Women"
    };

    public static void ApplyGestIaDatabaseStandards(this ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.UseNamedDefaultConstraints();

        foreach (var entityType in modelBuilder.Model.GetEntityTypes().Where(type => !type.IsOwned()))
        {
            ApplyEntityStandards(modelBuilder, entityType);
        }
    }

    private static void ApplyEntityStandards(ModelBuilder modelBuilder, IMutableEntityType entityType)
    {
        var tableName = entityType.GetTableName();

        if (tableName is null)
        {
            ValidateView(entityType);
            return;
        }

        ValidateTable(entityType, tableName);
        ValidateSchema(entityType.GetSchema());

        var storeObject = StoreObjectIdentifier.Table(tableName, entityType.GetSchema());

        ValidateAndConfigureProperties(modelBuilder, entityType, tableName, storeObject);
        ConfigureKeys(entityType, tableName, storeObject);
        ConfigureIndexes(entityType, tableName, storeObject);
        ConfigureForeignKeys(entityType, tableName, storeObject);
        ValidateCheckConstraints(entityType, tableName);
    }

    private static void ValidateAndConfigureProperties(
        ModelBuilder modelBuilder,
        IMutableEntityType entityType,
        string tableName,
        StoreObjectIdentifier storeObject)
    {
        foreach (var property in entityType.GetProperties())
        {
            var columnName = property.GetColumnName(storeObject) ?? property.Name;
            EnsurePascalCase(columnName, "column");

            if (property.ClrType == typeof(bool) &&
                columnName is not "Active" &&
                !columnName.StartsWith("Is", StringComparison.Ordinal) &&
                !columnName.StartsWith("Has", StringComparison.Ordinal) &&
                !columnName.StartsWith("Can", StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    $"Boolean column '{tableName}.{columnName}' must start with Is, Has or Can, or be named Active.");
            }

            var underlyingType = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
            if (underlyingType == typeof(DateTime) &&
                !columnName.EndsWith("At", StringComparison.Ordinal) &&
                !columnName.EndsWith("Date", StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    $"Date column '{tableName}.{columnName}' must end with At or Date.");
            }
        }

        var entityBuilder = modelBuilder.Entity(entityType.ClrType);

        if (typeof(IActivatableEntity).IsAssignableFrom(entityType.ClrType))
        {
            entityBuilder.Property(nameof(IActivatableEntity.Active))
                .HasColumnName("Active")
                .HasDefaultValue(true);

            ApplyActiveQueryFilter(entityType);
        }

        if (typeof(IAuditableEntity).IsAssignableFrom(entityType.ClrType))
        {
            entityBuilder.Property(nameof(IAuditableEntity.CreatedAt))
                .HasColumnType("datetime2(0)")
                .HasDefaultValueSql("SYSUTCDATETIME()");

            entityBuilder.Property(nameof(IAuditableEntity.UpdatedAt))
                .HasColumnType("datetime2(0)");

            entityBuilder.Property(nameof(IAuditableEntity.CreatedByName))
                .HasMaxLength(100);

            entityBuilder.Property(nameof(IAuditableEntity.UpdatedByName))
                .HasMaxLength(100);
        }
    }

    private static void ConfigureKeys(
        IMutableEntityType entityType,
        string tableName,
        StoreObjectIdentifier storeObject)
    {
        var primaryKey = entityType.FindPrimaryKey();

        if (primaryKey is not null)
        {
            if (primaryKey.Properties.Count == 1)
            {
                var primaryKeyColumn = primaryKey.Properties[0].GetColumnName(storeObject)
                    ?? primaryKey.Properties[0].Name;
                var expectedColumn = $"Id{entityType.ClrType.Name}";

                if (!string.Equals(primaryKeyColumn, expectedColumn, StringComparison.Ordinal))
                {
                    throw new InvalidOperationException(
                        $"Primary key for '{tableName}' must be named '{expectedColumn}', not '{primaryKeyColumn}'.");
                }
            }

            primaryKey.SetName(DatabaseObjectNames.PrimaryKey(tableName));
        }

        foreach (var alternateKey in entityType.GetKeys().Where(key => !key.IsPrimaryKey()))
        {
            var columns = alternateKey.Properties.Select(property =>
                property.GetColumnName(storeObject) ?? property.Name);
            alternateKey.SetName(DatabaseObjectNames.AlternateKey(tableName, columns));
        }
    }

    private static void ConfigureIndexes(
        IMutableEntityType entityType,
        string tableName,
        StoreObjectIdentifier storeObject)
    {
        foreach (var index in entityType.GetIndexes())
        {
            var columns = index.Properties.Select(property =>
                property.GetColumnName(storeObject) ?? property.Name);
            index.SetDatabaseName(DatabaseObjectNames.Index(tableName, columns, index.IsUnique));
        }
    }

    private static void ConfigureForeignKeys(
        IMutableEntityType entityType,
        string sourceTable,
        StoreObjectIdentifier sourceStoreObject)
    {
        foreach (var foreignKey in entityType.GetForeignKeys())
        {
            var targetTable = foreignKey.PrincipalEntityType.GetTableName()
                ?? throw new InvalidOperationException(
                    $"Foreign key from '{sourceTable}' cannot target an entity without a table.");
            var columns = foreignKey.Properties.Select(property =>
                property.GetColumnName(sourceStoreObject) ?? property.Name);

            foreignKey.SetConstraintName(
                DatabaseObjectNames.ForeignKey(sourceTable, targetTable, columns));
        }
    }

    private static void ValidateCheckConstraints(IMutableEntityType entityType, string tableName)
    {
        var prefix = $"CK_{tableName}_";

        foreach (var checkConstraint in entityType.GetCheckConstraints())
        {
            var constraintName = checkConstraint.Name;

            if (constraintName is null || !constraintName.StartsWith(prefix, StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    $"Check constraint '{constraintName ?? "<unnamed>"}' must start with '{prefix}'.");
            }
        }
    }

    private static void ApplyActiveQueryFilter(IMutableEntityType entityType)
    {
        if (entityType.BaseType is not null)
        {
            return;
        }

        var parameter = Expression.Parameter(entityType.ClrType, "entity");
        var activeProperty = Expression.Property(parameter, nameof(IActivatableEntity.Active));
        entityType.SetQueryFilter(Expression.Lambda(activeProperty, parameter));
    }

    private static void ValidateTable(IMutableEntityType entityType, string tableName)
    {
        if (entityType.FindAnnotation(RelationalAnnotationNames.TableName) is null)
        {
            throw new InvalidOperationException(
                $"Entity '{entityType.ClrType.Name}' must explicitly map its plural table with ToTable().");
        }

        EnsurePascalCase(tableName, "table");

        if (!tableName.EndsWith('s') && !IrregularPluralTableNames.Contains(tableName))
        {
            throw new InvalidOperationException($"Table '{tableName}' must use a plural name.");
        }
    }

    private static void ValidateSchema(string? schema)
    {
        if (schema is not null && !LowerCaseIdentifierRegex().IsMatch(schema))
        {
            throw new InvalidOperationException(
                $"Schema '{schema}' must use lowercase letters and digits without spaces or special characters.");
        }
    }

    private static void ValidateView(IMutableEntityType entityType)
    {
        var viewName = entityType.GetViewName();

        if (viewName is not null && !ViewNameRegex().IsMatch(viewName))
        {
            throw new InvalidOperationException(
                $"View '{viewName}' mapped by '{entityType.ClrType.Name}' must use the vw_ prefix.");
        }
    }

    private static void EnsurePascalCase(string identifier, string objectType)
    {
        if (!PascalCaseRegex().IsMatch(identifier) || ReservedWords.Contains(identifier))
        {
            throw new InvalidOperationException(
                $"Database {objectType} '{identifier}' must be descriptive PascalCase and not a reserved word.");
        }
    }

    [GeneratedRegex("^[A-Z][A-Za-z0-9]*$", RegexOptions.CultureInvariant)]
    private static partial Regex PascalCaseRegex();

    [GeneratedRegex("^[a-z][a-z0-9]*$", RegexOptions.CultureInvariant)]
    private static partial Regex LowerCaseIdentifierRegex();

    [GeneratedRegex("^vw_[A-Za-z0-9_]+$", RegexOptions.CultureInvariant)]
    private static partial Regex ViewNameRegex();
}
