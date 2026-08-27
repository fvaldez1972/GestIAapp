namespace GestIA.Application.Common;

public interface IClock
{
    DateTime UtcNow { get; }
}
