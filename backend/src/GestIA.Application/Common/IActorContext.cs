namespace GestIA.Application.Common;

public interface IActorContext
{
    Guid ActorId { get; }
    string ActorName { get; }
}
