# syntax=docker/dockerfile:1
# One image that serves the whole game: ASP.NET Core hosts the SignalR hub, the REST API
# and the compiled React/Phaser client (from wwwroot) on a single port.

# ---------- 1. Build the React + Phaser client
FROM node:22-alpine AS client
WORKDIR /src/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

# ---------- 2. Publish the ASP.NET Core server
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS server
WORKDIR /src
COPY server/GameServer/GameServer.csproj server/GameServer/
RUN dotnet restore server/GameServer/GameServer.csproj
COPY server/GameServer/ server/GameServer/
RUN dotnet publish server/GameServer/GameServer.csproj -c Release -o /app --no-restore

# ---------- 3. Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=server /app ./
COPY --from=client /src/client/dist ./wwwroot
ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    PORT=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "GameServer.dll"]
