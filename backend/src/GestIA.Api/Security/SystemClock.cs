using GestIA.Application.Common;

namespace GestIA.Api.Security;

public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
