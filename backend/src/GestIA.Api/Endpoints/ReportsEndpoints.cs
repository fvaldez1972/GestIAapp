using GestIA.Api.Security;
using GestIA.Application.Reports;
using GestIA.Application.Security;
using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;

namespace GestIA.Api.Endpoints;

public static class ReportsEndpoints
{
    public static IEndpointRouteBuilder MapReportsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/reports")
            .WithTags("Reports");

        group.MapGet("/operations-summary", async (
            Guid organizationId,
            Guid? clientId,
            Guid? serviceId,
            DateOnly? fromDate,
            DateOnly? toDate,
            IReportsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.GetOperationsSummaryAsync(
                new OperationsSummaryQuery(organizationId, clientId, serviceId, fromDate, toDate),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ReportsRead)
            .WithName("GetOperationsSummary");

        group.MapGet("/operations-by-service", async (
            Guid organizationId,
            Guid? clientId,
            Guid? serviceId,
            DateOnly? fromDate,
            DateOnly? toDate,
            IReportsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.GetOperationsByServiceAsync(
                new OperationsSummaryQuery(organizationId, clientId, serviceId, fromDate, toDate),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ReportsRead)
            .WithName("GetOperationsByService");

        group.MapGet("/workforce-eligibility", async (
            Guid organizationId,
            DateOnly? referenceDate,
            string? search,
            IReportsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.GetWorkforceEligibilityAsync(
                new WorkforceEligibilityQuery(
                    organizationId,
                    referenceDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
                    search),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ReportsRead)
            .WithName("GetWorkforceEligibility");

        group.MapGet("/operations-export", async (
            Guid organizationId,
            Guid? clientId,
            Guid? serviceId,
            DateOnly? fromDate,
            DateOnly? toDate,
            IReportsService service,
            CancellationToken cancellationToken) =>
        {
            var query = new OperationsSummaryQuery(organizationId, clientId, serviceId, fromDate, toDate);
            var summary = await service.GetOperationsSummaryAsync(query, cancellationToken);
            var services = await service.GetOperationsByServiceAsync(query, cancellationToken);
            var workforce = await service.GetWorkforceEligibilityAsync(
                new WorkforceEligibilityQuery(
                    organizationId,
                    toDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
                    null),
                cancellationToken);

            var csv = BuildOperationsExport(summary, services, workforce);
            var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray();
            var fileName = $"gestia-reporte-operativo-{FormatDate(fromDate, "inicio")}-{FormatDate(toDate, "hoy")}.csv";
            return Results.File(bytes, "text/csv; charset=utf-8", fileName);
        })
            .RequirePermission(SecurityPermissions.ReportsRead)
            .WithName("ExportOperationsReport");

        group.MapGet("/operations-export.xlsx", async (
            Guid organizationId,
            Guid? clientId,
            Guid? serviceId,
            DateOnly? fromDate,
            DateOnly? toDate,
            IReportsService service,
            CancellationToken cancellationToken) =>
        {
            var rows = await BuildOperationsRowsAsync(
                service,
                new OperationsSummaryQuery(organizationId, clientId, serviceId, fromDate, toDate),
                toDate,
                cancellationToken);
            var bytes = BuildXlsx(rows);
            var fileName = $"gestia-reporte-operativo-{FormatDate(fromDate, "inicio")}-{FormatDate(toDate, "hoy")}.xlsx";
            return Results.File(
                bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName);
        })
            .RequirePermission(SecurityPermissions.ReportsRead)
            .WithName("ExportOperationsReportExcel");

        group.MapGet("/operations-export.pdf", async (
            Guid organizationId,
            Guid? clientId,
            Guid? serviceId,
            DateOnly? fromDate,
            DateOnly? toDate,
            IReportsService service,
            CancellationToken cancellationToken) =>
        {
            var rows = await BuildOperationsRowsAsync(
                service,
                new OperationsSummaryQuery(organizationId, clientId, serviceId, fromDate, toDate),
                toDate,
                cancellationToken);
            var bytes = BuildPdf(
                "GestIA - Reporte operativo",
                $"Periodo: {FormatDate(fromDate, "inicio")} a {FormatDate(toDate, "hoy")}",
                rows);
            var fileName = $"gestia-reporte-operativo-{FormatDate(fromDate, "inicio")}-{FormatDate(toDate, "hoy")}.pdf";
            return Results.File(bytes, "application/pdf", fileName);
        })
            .RequirePermission(SecurityPermissions.ReportsRead)
            .WithName("ExportOperationsReportPdf");

        return endpoints;
    }

    private static async Task<IReadOnlyList<IReadOnlyList<object?>>> BuildOperationsRowsAsync(
        IReportsService service,
        OperationsSummaryQuery query,
        DateOnly? toDate,
        CancellationToken cancellationToken)
    {
        var summary = await service.GetOperationsSummaryAsync(query, cancellationToken);
        var services = await service.GetOperationsByServiceAsync(query, cancellationToken);
        var workforce = await service.GetWorkforceEligibilityAsync(
            new WorkforceEligibilityQuery(
                query.IdOrganization,
                toDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
                null),
            cancellationToken);

        return BuildOperationsRows(summary, services, workforce);
    }

    private static string BuildOperationsExport(
        OperationsSummaryResponse summary,
        IReadOnlyList<OperationsServiceSummaryResponse> services,
        IReadOnlyList<WorkforceEligibilityResponse> workforce)
    {
        return ToCsv(BuildOperationsRows(summary, services, workforce));
    }

    private static List<IReadOnlyList<object?>> BuildOperationsRows(
        OperationsSummaryResponse summary,
        IReadOnlyList<OperationsServiceSummaryResponse> services,
        IReadOnlyList<WorkforceEligibilityResponse> workforce)
    {
        var rows = new List<IReadOnlyList<object?>>
        {
            new object?[] { "Metrica", "Valor" },
            new object?[] { "Asistencias capturadas", summary.AttendanceRecords },
            new object?[] { "Presentes", summary.PresentAttendance },
            new object?[] { "Retardos", summary.LateAttendance },
            new object?[] { "Faltas", summary.AbsentAttendance },
            new object?[] { "Justificadas", summary.ExcusedAttendance },
            new object?[] { "Incidencias", summary.Incidents },
            new object?[] { "Incidencias abiertas", summary.OpenIncidents },
            new object?[] { "Incidencias criticas", summary.CriticalIncidents },
            new object?[] { "Coberturas", summary.CoverageRecords },
            new object?[] { "Coberturas confirmadas", summary.ConfirmedCoverages },
            new object?[] { "Coberturas completadas", summary.CompletedCoverages },
            new object?[] { "Minutos cubiertos", summary.CoveredMinutes },
            new object?[] { "Autorizaciones pendientes", summary.PendingApprovals },
            new object?[] { "Dias cerrados", summary.ClosedOperationDays },
            new object?[] { "Personal elegible", workforce.Count(employee => employee.IsEligible) },
            new object?[] { "Personal no elegible", workforce.Count(employee => !employee.IsEligible) },
            Array.Empty<object?>(),
            new object?[] { "Servicio", "Cliente", "Asistencias", "Presentes", "Retardos", "Faltas", "Incidencias abiertas", "Criticas", "Coberturas", "Horas cubiertas", "Autorizaciones pendientes", "Dias cerrados" }
        };

        rows.AddRange(services.Select(service => new object?[]
        {
            $"{service.CodeService} - {service.ServiceName}",
            service.ClientName,
            service.AttendanceRecords,
            service.PresentAttendance,
            service.LateAttendance,
            service.AbsentAttendance,
            service.OpenIncidents,
            service.CriticalIncidents,
            service.CoverageRecords,
            Math.Round(service.CoveredMinutes / 60m, 1),
            service.PendingApprovals,
            service.ClosedOperationDays
        }));

        rows.Add(Array.Empty<object?>());
        rows.Add(new object?[] { "Empleado", "Puesto", "Elegible", "Documentos vencidos", "Documentos rechazados", "Evaluaciones invalidas", "Razones" });
        rows.AddRange(workforce.Select(employee => new object?[]
        {
            $"{employee.CodeEmployee} - {employee.FullName}",
            employee.JobTitle,
            employee.IsEligible ? "Si" : "No",
            employee.ExpiredDocuments,
            employee.RejectedDocuments,
            employee.InvalidEvaluations,
            string.Join(" | ", employee.Reasons)
        }));

        return rows;
    }

    private static string ToCsv(IEnumerable<IReadOnlyList<object?>> rows) =>
        string.Join(Environment.NewLine, rows.Select(row => string.Join(",", row.Select(EscapeCsv))));

    private static string EscapeCsv(object? value)
    {
        var text = Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty;
        return $"\"{text.Replace("\"", "\"\"")}\"";
    }

    private static string FormatDate(DateOnly? date, string fallback) =>
        date?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? fallback;

    private static byte[] BuildXlsx(IReadOnlyList<IReadOnlyList<object?>> rows)
    {
        using var stream = new MemoryStream();
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            AddZipEntry(
                archive,
                "[Content_Types].xml",
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                </Types>
                """);
            AddZipEntry(
                archive,
                "_rels/.rels",
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>
                """);
            AddZipEntry(
                archive,
                "xl/workbook.xml",
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <sheets><sheet name="Reporte operativo" sheetId="1" r:id="rId1"/></sheets>
                </workbook>
                """);
            AddZipEntry(
                archive,
                "xl/_rels/workbook.xml.rels",
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>
                """);
            AddZipEntry(
                archive,
                "xl/styles.xml",
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
                  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
                  <borders count="1"><border/></borders>
                  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
                </styleSheet>
                """);
            AddZipEntry(archive, "xl/worksheets/sheet1.xml", BuildWorksheetXml(rows));
        }

        return stream.ToArray();
    }

    private static string BuildWorksheetXml(IReadOnlyList<IReadOnlyList<object?>> rows)
    {
        var xml = new StringBuilder();
        xml.Append("""<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>""");

        for (var rowIndex = 0; rowIndex < rows.Count; rowIndex++)
        {
            xml.Append(CultureInfo.InvariantCulture, $"<row r=\"{rowIndex + 1}\">");

            for (var columnIndex = 0; columnIndex < rows[rowIndex].Count; columnIndex++)
            {
                var reference = $"{ColumnName(columnIndex + 1)}{rowIndex + 1}";
                var value = rows[rowIndex][columnIndex];

                if (value is int or long or decimal or double or float)
                {
                    xml.Append(CultureInfo.InvariantCulture, $"<c r=\"{reference}\"><v>{Convert.ToString(value, CultureInfo.InvariantCulture)}</v></c>");
                }
                else
                {
                    xml.Append(CultureInfo.InvariantCulture, $"<c r=\"{reference}\" t=\"inlineStr\"><is><t>{XmlEscape(Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty)}</t></is></c>");
                }
            }

            xml.Append("</row>");
        }

        xml.Append("</sheetData></worksheet>");
        return xml.ToString();
    }

    private static byte[] BuildPdf(
        string title,
        string subtitle,
        IReadOnlyList<IReadOnlyList<object?>> rows)
    {
        const int pageWidth = 612;
        const int pageHeight = 792;
        const int top = 740;
        const int lineHeight = 14;
        var lines = new List<string> { title, subtitle, string.Empty };
        lines.AddRange(rows.Select(row => string.Join("  |  ", row.Select(value => Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty))));
        var pages = lines
            .Chunk(48)
            .Select(chunk => chunk.ToArray())
            .ToArray();

        var objects = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            $"<< /Type /Pages /Kids [{string.Join(" ", Enumerable.Range(0, pages.Length).Select(index => $"{3 + index * 2} 0 R"))}] /Count {pages.Length} >>"
        };

        for (var index = 0; index < pages.Length; index++)
        {
            var pageObjectNumber = 3 + index * 2;
            var contentObjectNumber = pageObjectNumber + 1;
            var content = BuildPdfContent(pages[index], top, lineHeight);
            objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {pageWidth} {pageHeight}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents {contentObjectNumber} 0 R >>");
            objects.Add($"<< /Length {Encoding.ASCII.GetByteCount(content)} >>\nstream\n{content}\nendstream");
        }

        return BuildPdfDocument(objects);
    }

    private static string BuildPdfContent(IEnumerable<string> lines, int top, int lineHeight)
    {
        var content = new StringBuilder();
        content.Append("BT /F1 10 Tf 40 ");
        content.Append(top);
        content.Append(" Td ");

        foreach (var line in lines)
        {
            content.Append('(');
            content.Append(PdfEscape(Truncate(line, 110)));
            content.Append(") Tj 0 -");
            content.Append(lineHeight);
            content.Append(" Td ");
        }

        content.Append("ET");
        return content.ToString();
    }

    private static byte[] BuildPdfDocument(List<string> objects)
    {
        var document = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int> { 0 };

        for (var index = 0; index < objects.Count; index++)
        {
            offsets.Add(Encoding.ASCII.GetByteCount(document.ToString()));
            document.Append(CultureInfo.InvariantCulture, $"{index + 1} 0 obj\n{objects[index]}\nendobj\n");
        }

        var xrefOffset = Encoding.ASCII.GetByteCount(document.ToString());
        document.Append(CultureInfo.InvariantCulture, $"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");

        foreach (var offset in offsets.Skip(1))
        {
            document.Append(CultureInfo.InvariantCulture, $"{offset.ToString("D10", CultureInfo.InvariantCulture)} 00000 n \n");
        }

        document.Append(CultureInfo.InvariantCulture, $"trailer << /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xrefOffset}\n%%EOF");
        return Encoding.ASCII.GetBytes(document.ToString());
    }

    private static void AddZipEntry(ZipArchive archive, string name, string content)
    {
        var entry = archive.CreateEntry(name, CompressionLevel.Fastest);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write(content);
    }

    private static string ColumnName(int column)
    {
        var name = string.Empty;

        while (column > 0)
        {
            column--;
            name = (char)('A' + column % 26) + name;
            column /= 26;
        }

        return name;
    }

    private static string XmlEscape(string value) => new XText(value).ToString();

    private static string PdfEscape(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("(", "\\(", StringComparison.Ordinal)
            .Replace(")", "\\)", StringComparison.Ordinal);

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : string.Concat(value.AsSpan(0, maxLength - 1), "…");
}
