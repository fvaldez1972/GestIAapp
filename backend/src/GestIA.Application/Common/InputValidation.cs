using System.Text.RegularExpressions;

namespace GestIA.Application.Common;

internal static partial class InputValidation
{
    public static string Required(
        string? value,
        string field,
        int maximumLength,
        IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[field] = ["El campo es obligatorio."];
            return string.Empty;
        }

        var normalized = value.Trim();
        if (normalized.Length > maximumLength)
        {
            errors[field] = [$"No puede exceder {maximumLength} caracteres."];
        }

        return normalized;
    }

    public static string? Optional(
        string? value,
        string field,
        int maximumLength,
        IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        if (normalized.Length > maximumLength)
        {
            errors[field] = [$"No puede exceder {maximumLength} caracteres."];
        }

        return normalized;
    }

    public static string Rfc(
        string? value,
        string field,
        bool required,
        IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            if (required)
            {
                errors[field] = ["El RFC es obligatorio."];
            }

            return string.Empty;
        }

        var normalized = value.Trim().ToUpperInvariant();
        if (!RfcRegex().IsMatch(normalized))
        {
            errors[field] = ["El RFC debe contener 12 o 13 caracteres válidos."];
        }

        return normalized;
    }

    public static void Page(int page, int pageSize, IDictionary<string, string[]> errors)
    {
        if (page < 1)
        {
            errors["page"] = ["La página debe ser mayor o igual a 1."];
        }

        if (pageSize is < 1 or > 100)
        {
            errors["pageSize"] = ["El tamaño de página debe estar entre 1 y 100."];
        }
    }

    public static void ThrowIfInvalid(IDictionary<string, string[]> errors)
    {
        if (errors.Count > 0)
        {
            throw new RequestValidationException(
                new Dictionary<string, string[]>(errors, StringComparer.OrdinalIgnoreCase));
        }
    }

    [GeneratedRegex("^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$", RegexOptions.CultureInvariant)]
    private static partial Regex RfcRegex();
}
