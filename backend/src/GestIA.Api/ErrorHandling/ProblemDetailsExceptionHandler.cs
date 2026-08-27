using GestIA.Application.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace GestIA.Api.ErrorHandling;

public sealed class ProblemDetailsExceptionHandler(
    ILogger<ProblemDetailsExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, title, detail) = exception switch
        {
            RequestValidationException => (
                StatusCodes.Status400BadRequest,
                "Solicitud inválida",
                exception.Message),
            ArgumentException => (
                StatusCodes.Status400BadRequest,
                "Solicitud inválida",
                exception.Message),
            ResourceNotFoundException => (
                StatusCodes.Status404NotFound,
                "Recurso no encontrado",
                exception.Message),
            ResourceConflictException => (
                StatusCodes.Status409Conflict,
                "Conflicto de datos",
                exception.Message),
            _ => (
                StatusCodes.Status500InternalServerError,
                "Error interno",
                "Ocurrió un error inesperado al procesar la solicitud.")
        };

        if (status >= StatusCodes.Status500InternalServerError)
        {
            ErrorHandlingLog.UnhandledException(logger, httpContext.Request.Path, exception);
        }
        else
        {
            ErrorHandlingLog.RequestRejected(logger, status, exception.Message);
        }

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Instance = httpContext.Request.Path
        };
        problem.Extensions["traceId"] = httpContext.TraceIdentifier;

        if (exception is RequestValidationException validationException)
        {
            problem.Extensions["errors"] = validationException.Errors;
        }

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }
}

internal static partial class ErrorHandlingLog
{
    [LoggerMessage(
        EventId = 2001,
        Level = LogLevel.Error,
        Message = "Unhandled exception for {Path}.")]
    public static partial void UnhandledException(
        ILogger logger,
        string path,
        Exception exception);

    [LoggerMessage(
        EventId = 2002,
        Level = LogLevel.Information,
        Message = "Request rejected with status {StatusCode}: {Message}")]
    public static partial void RequestRejected(
        ILogger logger,
        int statusCode,
        string message);
}
