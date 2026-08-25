# syntax=docker/dockerfile:1.7

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY Directory.Build.props global.json ./
COPY backend/src/GestIA.Domain/GestIA.Domain.csproj backend/src/GestIA.Domain/
COPY backend/src/GestIA.Application/GestIA.Application.csproj backend/src/GestIA.Application/
COPY backend/src/GestIA.Infrastructure/GestIA.Infrastructure.csproj backend/src/GestIA.Infrastructure/
COPY backend/src/GestIA.Api/GestIA.Api.csproj backend/src/GestIA.Api/

RUN dotnet restore backend/src/GestIA.Api/GestIA.Api.csproj

COPY backend/ backend/

RUN dotnet publish backend/src/GestIA.Api/GestIA.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine-extra AS runtime
WORKDIR /app

ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_EnableDiagnostics=0 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

EXPOSE 8080

COPY --from=build /app/publish ./

USER $APP_UID

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health/ready || exit 1

ENTRYPOINT ["dotnet", "GestIA.Api.dll"]
