using GestIA.Application.Common;
using GestIA.Application.Documents;
using GestIA.Domain.Documents;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class BusinessDocumentRepository(GestIaDbContext dbContext, IClock clock) : IBusinessDocumentRepository
{
    public async Task<BusinessDocumentSearchResult> SearchAsync(
        BusinessDocumentSearchCriteria criteria,
        CancellationToken cancellationToken)
    {
        var query = IncludeOwner(dbContext.BusinessDocuments.AsNoTracking())
            .Where(document => document.IdOrganization == criteria.IdOrganization);

        if (!criteria.IncludeSensitive)
        {
            query = query.Where(document => !document.IsSensitive &&
                !dbContext.BusinessDocuments.IgnoreQueryFilters(QueryFilterNames.ActiveOnly).Any(other => other.IsSensitive &&
                    EF.Functions.Collate(other.StorageReference.Replace("\\", "/"), "Latin1_General_100_CI_AS") == document.StorageReference.Replace("\\", "/")) &&
                !dbContext.EmployeeDocuments.IgnoreQueryFilters(QueryFilterNames.ActiveOnly).Any(other => other.StorageReference != null &&
                    EF.Functions.Collate(other.StorageReference.Replace("\\", "/"), "Latin1_General_100_CI_AS") == document.StorageReference.Replace("\\", "/")) &&
                !dbContext.EmployeeEvaluations.IgnoreQueryFilters(QueryFilterNames.ActiveOnly).Any(other => other.StorageReference != null &&
                    EF.Functions.Collate(other.StorageReference.Replace("\\", "/"), "Latin1_General_100_CI_AS") == document.StorageReference.Replace("\\", "/")));
        }

        if (criteria.OwnerType is not null)
        {
            query = query.Where(document => document.OwnerType == criteria.OwnerType);
        }

        if (criteria.OwnerId is not null)
        {
            query = query.Where(document => document.OwnerId == criteria.OwnerId);
        }

        if (criteria.Status is not null)
        {
            query = query.Where(document => document.Status == criteria.Status);
        }

        if (!string.IsNullOrWhiteSpace(criteria.Search))
        {
            var search = criteria.Search.Trim();
            query = query.Where(document =>
                document.Category.Contains(search) ||
                document.Title.Contains(search) ||
                document.StorageReference.Contains(search) ||
                (document.Notes != null && document.Notes.Contains(search)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(document => document.Status)
            .ThenBy(document => document.ExpiresDate ?? DateOnly.MaxValue)
            .ThenBy(document => document.Title)
            .Skip(criteria.Skip)
            .Take(criteria.Take)
            .ToArrayAsync(cancellationToken);

        return new BusinessDocumentSearchResult(
            items.Select(Map).ToArray(),
            totalCount,
            criteria.Skip / criteria.Take + 1,
            criteria.Take);
    }

    public Task<BusinessDocument?> GetAsync(
        Guid idOrganization,
        Guid idBusinessDocument,
        CancellationToken cancellationToken) =>
        IncludeOwner(dbContext.BusinessDocuments)
            .SingleOrDefaultAsync(
                document =>
                    document.IdOrganization == idOrganization &&
                    document.IdBusinessDocument == idBusinessDocument,
                cancellationToken);

    public Task<bool> OwnerExistsAsync(
        Guid idOrganization,
        BusinessDocumentOwnerType ownerType,
        Guid ownerId,
        CancellationToken cancellationToken) =>
        ownerType switch
        {
            BusinessDocumentOwnerType.Client => dbContext.Clients.AnyAsync(
                item => item.IdOrganization == idOrganization && item.IdClient == ownerId,
                cancellationToken),
            BusinessDocumentOwnerType.ServiceContract => dbContext.ServiceContracts.AnyAsync(
                item => item.IdServiceContract == ownerId && item.IdOrganization == idOrganization,
                cancellationToken),
            BusinessDocumentOwnerType.Service => dbContext.Services.AnyAsync(
                item => item.IdService == ownerId && item.IdOrganization == idOrganization,
                cancellationToken),
            BusinessDocumentOwnerType.Employee => dbContext.Employees.AnyAsync(
                item => item.IdEmployee == ownerId && item.IdOrganization == idOrganization,
                cancellationToken),
            BusinessDocumentOwnerType.EmployeeEvaluation => dbContext.EmployeeEvaluations.AnyAsync(
                item => item.IdEmployeeEvaluation == ownerId && item.Employee.IdOrganization == idOrganization,
                cancellationToken),
            BusinessDocumentOwnerType.OperationalRequest => dbContext.OperationalRequests.AnyAsync(
                item => item.IdOperationalRequest == ownerId && item.IdOrganization == idOrganization,
                cancellationToken),
            _ => Task.FromResult(false)
        };

    public Task AddAsync(BusinessDocument document, CancellationToken cancellationToken) =>
        dbContext.BusinessDocuments.AddAsync(document, cancellationToken).AsTask();

    public async Task<bool> IsSensitiveStorageReferenceAsync(string storageReference, CancellationToken cancellationToken) =>
        await dbContext.BusinessDocuments.IgnoreQueryFilters(["Active"]).AnyAsync(document => document.IsSensitive &&
            EF.Functions.Collate(document.StorageReference.Replace("\\", "/"), "Latin1_General_100_CI_AS") == storageReference.Replace("\\", "/"), cancellationToken) ||
        await IsLegacyStorageReferenceAsync(storageReference, cancellationToken);

    public async Task<bool> IsDocumentStorageReferenceAsync(string storageReference, CancellationToken cancellationToken) =>
        await dbContext.BusinessDocuments.IgnoreQueryFilters(["Active"]).AnyAsync(document =>
            EF.Functions.Collate(document.StorageReference.Replace("\\", "/"), "Latin1_General_100_CI_AS") == storageReference.Replace("\\", "/"), cancellationToken) ||
        await IsLegacyStorageReferenceAsync(storageReference, cancellationToken);

    private async Task<bool> IsLegacyStorageReferenceAsync(string storageReference, CancellationToken cancellationToken) =>
        await dbContext.EmployeeDocuments.IgnoreQueryFilters(["Active"]).AnyAsync(document => document.StorageReference != null &&
            EF.Functions.Collate(document.StorageReference.Replace("\\", "/"), "Latin1_General_100_CI_AS") == storageReference.Replace("\\", "/"), cancellationToken) ||
        await dbContext.EmployeeEvaluations.IgnoreQueryFilters(["Active"]).AnyAsync(document => document.StorageReference != null &&
            EF.Functions.Collate(document.StorageReference.Replace("\\", "/"), "Latin1_General_100_CI_AS") == storageReference.Replace("\\", "/"), cancellationToken);

    public Task AddEventAsync(BusinessDocumentEvent documentEvent, CancellationToken cancellationToken) =>
        dbContext.BusinessDocumentEvents.AddAsync(documentEvent, cancellationToken).AsTask();

    public async Task<IReadOnlyList<BusinessDocumentEvent>> ListEventsAsync(Guid idOrganization, Guid idBusinessDocument, CancellationToken cancellationToken) =>
        await dbContext.BusinessDocumentEvents.AsNoTracking()
            .Where(item => item.IdOrganization == idOrganization && item.IdBusinessDocument == idBusinessDocument)
            .OrderByDescending(item => item.OccurredAt).ThenByDescending(item => item.IdBusinessDocumentEvent)
            .Take(100).ToArrayAsync(cancellationToken);

    private static IQueryable<BusinessDocument> IncludeOwner(IQueryable<BusinessDocument> query) =>
        query
            .Include(document => document.Client)
            .Include(document => document.ServiceContract)
            .Include(document => document.Service)
            .Include(document => document.Employee)
            .Include(document => document.EmployeeEvaluation)
            .Include(document => document.OperationalRequest);

    private BusinessDocumentResponse Map(BusinessDocument document) =>
        new(
            document.IdBusinessDocument,
            document.IdOrganization,
            document.OwnerType,
            document.OwnerId,
            ResolveOwnerLabel(document),
            document.Category,
            document.Title,
            document.Status,
            document.IssuedDate,
            document.ExpiresDate,
            // El dia operativo, no el dia UTC: un documento no esta vencido siete horas antes.
            document.ExpiresDate.HasValue && document.ExpiresDate.Value < clock.Today,
            document.StorageReference,
            document.IsSensitive,
            document.Notes,
            document.ReviewNotes,
            document.ReviewedAt,
            document.ReviewedByName,
            document.Active,
            document.CreatedAt,
            document.UpdatedAt);

    private static string ResolveOwnerLabel(BusinessDocument document) =>
        document.OwnerType switch
        {
            BusinessDocumentOwnerType.Client => document.Client?.TradeName ?? document.Client?.LegalName ?? "Cliente",
            BusinessDocumentOwnerType.ServiceContract => document.ServiceContract?.CodeServiceContract ?? "Contrato",
            BusinessDocumentOwnerType.Service => document.Service?.Name ?? "Servicio",
            BusinessDocumentOwnerType.Employee => document.Employee?.FullName ?? "Empleado",
            BusinessDocumentOwnerType.EmployeeEvaluation => document.EmployeeEvaluation?.EvaluationType.ToString() ?? "Evaluación",
            BusinessDocumentOwnerType.OperationalRequest => document.OperationalRequest?.CodeOperationalRequest ?? "Solicitud",
            _ => "Registro"
        };
}
