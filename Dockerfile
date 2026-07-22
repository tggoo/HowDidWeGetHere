FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY HowDidWeGetHere.slnx ./
COPY src/HowDidWeGetHere.Api/HowDidWeGetHere.Api.csproj src/HowDidWeGetHere.Api/
COPY src/HowDidWeGetHere.Application/HowDidWeGetHere.Application.csproj src/HowDidWeGetHere.Application/
COPY src/HowDidWeGetHere.Domain/HowDidWeGetHere.Domain.csproj src/HowDidWeGetHere.Domain/
COPY src/HowDidWeGetHere.Infrastructure/HowDidWeGetHere.Infrastructure.csproj src/HowDidWeGetHere.Infrastructure/

RUN dotnet restore HowDidWeGetHere.slnx

COPY . .
RUN dotnet publish src/HowDidWeGetHere.Api/HowDidWeGetHere.Api.csproj \
    -c Release \
    --no-restore \
    -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_ENVIRONMENT=Production
ENV DOTNET_hostBuilder__reloadConfigOnChange=false
COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "HowDidWeGetHere.Api.dll"]
