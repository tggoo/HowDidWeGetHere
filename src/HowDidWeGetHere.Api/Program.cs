using System.Text.Json.Serialization;
using HowDidWeGetHere.Api.Caching;
using HowDidWeGetHere.Api.Endpoints;
using HowDidWeGetHere.Api.Media;
using HowDidWeGetHere.Infrastructure;
using HowDidWeGetHere.Infrastructure.Identity;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.FileProviders;
using Npgsql;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Host.UseSerilog((context, services, loggerConfiguration) =>
{
    loggerConfiguration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext();
});

var dataProtectionPath = builder.Configuration["DataProtection:KeysPath"];
if (string.IsNullOrWhiteSpace(dataProtectionPath))
{
    dataProtectionPath = Path.Combine(Path.GetTempPath(), "howdidwegethere-data-protection-keys");
}

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionPath));

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.Configure<MediaStorageOptions>(builder.Configuration.GetSection("Media"));
builder.Services.AddHttpClient();
builder.Services.AddSingleton<S3ObjectStorageClient>();
builder.Services.AddSingleton<GitHubReleaseStorageClient>();
builder.Services.AddScoped<IMediaStorageService, MediaStorageService>();
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));

builder.Services.AddCors(options =>
{
    var configuredOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? [];
    var environmentOrigins = (Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS") ?? string.Empty)
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    var origins = configuredOrigins
        .Concat(environmentOrigins)
        .Concat([
            "http://localhost:5173",
            "https://howdidwegethere-web.onrender.com"
        ])
        .Where(origin => !string.IsNullOrWhiteSpace(origin))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseSerilogRequestLogging();
app.UseCors("Frontend");
app.UseExceptionHandler(exceptionApp =>
{
    exceptionApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        var logger = context.RequestServices
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("GlobalExceptionHandler");
        var renderRequestId = context.Request.Headers["Rndr-Id"].ToString();
        var isDatabaseStorageUnavailable = IsDatabaseStorageUnavailable(exception);
        var isGitHubMediaRateLimited = IsGitHubMediaRateLimited(exception);

        logger.LogError(
            exception,
            "Unhandled request exception. TraceId={TraceId} RenderRequestId={RenderRequestId} Method={Method} Path={Path}",
            context.TraceIdentifier,
            renderRequestId,
            context.Request.Method,
            context.Request.Path);

        context.Response.StatusCode = isDatabaseStorageUnavailable
            ? StatusCodes.Status503ServiceUnavailable
            : isGitHubMediaRateLimited
                ? StatusCodes.Status503ServiceUnavailable
                : StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new
        {
            error = isDatabaseStorageUnavailable
                ? "Database storage is unavailable. The PostgreSQL server could not write internal files; check database disk usage or quota before retrying."
                : isGitHubMediaRateLimited
                    ? "GitHub media storage is rate-limited. Wait for GitHub's API rate limit reset, then retry the import."
                    : "An unexpected server error occurred.",
            traceId = context.TraceIdentifier,
            renderRequestId = string.IsNullOrWhiteSpace(renderRequestId) ? null : renderRequestId
        });
    });
});
app.UseMiddleware<PublicApiCacheMiddleware>();
app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(GetMediaRoot(app.Environment, app.Configuration)),
    RequestPath = "/media",
    OnPrepareResponse = context =>
    {
        context.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
    }
});
app.UseAuthentication();
app.UseAuthorization();

app.MapApiEndpoints();

await app.ApplyDatabaseMigrationsAsync(app.Configuration);
await app.Services.SeedAdminUserAsync(app.Configuration);
await app.RunAsync();

static string GetMediaRoot(IWebHostEnvironment environment, IConfiguration configuration)
{
    var configuredRoot = configuration["Media:StorageRootPath"];
    var staticRoot = string.IsNullOrWhiteSpace(configuredRoot)
        ? environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot")
        : configuredRoot;
    var mediaRoot = Path.Combine(staticRoot, "media");

    Directory.CreateDirectory(mediaRoot);
    return Path.GetFullPath(mediaRoot);
}

static bool IsDatabaseStorageUnavailable(Exception? exception)
{
    while (exception is not null)
    {
        if (exception is PostgresException postgresException &&
            string.Equals(postgresException.SqlState, "XX000", StringComparison.Ordinal) &&
            postgresException.MessageText.Contains("could not write init file", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        exception = exception.InnerException;
    }

    return false;
}

static bool IsGitHubMediaRateLimited(Exception? exception)
{
    while (exception is not null)
    {
        if (exception is GitHubReleaseStorageException { IsRateLimited: true })
        {
            return true;
        }

        exception = exception.InnerException;
    }

    return false;
}
