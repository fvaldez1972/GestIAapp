using GestIA.Application.Clients;
using GestIA.Domain.Clients;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class ClientContactRepository(GestIaDbContext dbContext) : IClientContactRepository
{
    public async Task<IReadOnlyList<ClientContact>> ListAsync(
        Guid idClient,
        CancellationToken cancellationToken) =>
        await dbContext.ClientContacts
            .AsNoTracking()
            .Include(contact => contact.ClientSite)
            .Where(contact => contact.IdClient == idClient)
            .OrderByDescending(contact => contact.IsPrimary)
            .ThenBy(contact => contact.FullName)
            .ToArrayAsync(cancellationToken);

    public Task<ClientContact?> GetAsync(
        Guid idClient,
        Guid idClientContact,
        CancellationToken cancellationToken) =>
        dbContext.ClientContacts
            .Include(contact => contact.ClientSite)
            .SingleOrDefaultAsync(
                contact => contact.IdClient == idClient && contact.IdClientContact == idClientContact,
                cancellationToken);

    public Task AddAsync(ClientContact contact, CancellationToken cancellationToken) =>
        dbContext.ClientContacts.AddAsync(contact, cancellationToken).AsTask();
}
