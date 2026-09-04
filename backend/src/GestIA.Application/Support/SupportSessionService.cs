using GestIA.Application.Common;
using GestIA.Application.Organizations;
using GestIA.Domain.Support;

namespace GestIA.Application.Support;

public sealed class SupportSessionService(
    ISupportSessionRepository repository,
    IOrganizationRepository organizationRepository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : ISupportSessionService
{
    public async Task<SupportSessionResponse> StartAsync(
        StartSupportSessionRequest request,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        if (request.IdOrganization == Guid.Empty)
        {
            errors[nameof(request.IdOrganization)] = ["La organización es obligatoria."];
        }

        var reason = InputValidation.Required(request.Reason, nameof(request.Reason), 500, errors);
        if (reason.Length < 10)
        {
            errors[nameof(request.Reason)] = ["Describe el motivo de soporte con al menos 10 caracteres."];
        }
        if (request.DurationMinutes is < 15 or > 240)
        {
            errors[nameof(request.DurationMinutes)] = ["La duración debe estar entre 15 y 240 minutos."];
        }

        InputValidation.ThrowIfInvalid(errors);
        var organization = await organizationRepository.GetAsync(request.IdOrganization, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la organización solicitada.");

        if (!organization.Active)
        {
            throw new ResourceConflictException("No se puede iniciar soporte para una organización inactiva.");
        }

        var now = clock.UtcNow;
        var openSessions = await repository.ListOpenForActorAsync(actorContext.ActorId, cancellationToken);
        foreach (var openSession in openSessions)
        {
            openSession.End(actorContext.ActorId, actorContext.ActorName, now);
        }

        var session = SupportSession.Start(
            request.IdOrganization,
            reason,
            now,
            now.AddMinutes(request.DurationMinutes),
            actorContext.ActorId,
            actorContext.ActorName);
        await repository.AddAsync(session, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(session, organization.LegalName, now);
    }

    public async Task<SupportSessionResponse?> GetCurrentAsync(CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var sessions = await repository.ListOpenForActorAsync(actorContext.ActorId, cancellationToken);
        var current = sessions.FirstOrDefault(session => session.IsValidFor(actorContext.ActorId, now));
        return current is null ? null : Map(current, current.Organization.LegalName, now);
    }

    public async Task<IReadOnlyList<SupportSessionResponse>> ListRecentAsync(CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var sessions = await repository.ListRecentAsync(100, cancellationToken);
        return sessions.Select(session => Map(session, session.Organization.LegalName, now)).ToArray();
    }

    public async Task<SupportSessionResponse?> ValidateAsync(
        Guid idSupportSession,
        CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var session = await repository.GetAsync(idSupportSession, cancellationToken);
        return session is not null && session.Organization.Active && session.IsValidFor(actorContext.ActorId, now)
            ? Map(session, session.Organization.LegalName, now)
            : null;
    }

    public async Task EndAsync(Guid idSupportSession, CancellationToken cancellationToken)
    {
        var session = await repository.GetAsync(idSupportSession, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la sesión de soporte.");

        if (session.CreatedBy != actorContext.ActorId)
        {
            throw new ResourceForbiddenException("Sólo quien inició la sesión puede finalizarla.");
        }

        session.End(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static SupportSessionResponse Map(SupportSession session, string organizationName, DateTime now) =>
        new(
            session.IdSupportSession,
            session.IdOrganization,
            organizationName,
            session.Reason,
            session.StartsAt,
            session.ExpiresAt,
            session.EndedAt,
            session.CreatedByName,
            session.IsValidFor(session.CreatedBy, now));
}
