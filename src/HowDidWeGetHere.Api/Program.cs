using System.Text.Json.Serialization;
using HowDidWeGetHere.Api.Endpoints;
using HowDidWeGetHere.Infrastructure;
using HowDidWeGetHere.Infrastructure.Identity;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.FileProviders;
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
app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(GetMediaRoot(app.Environment, app.Configuration)),
    RequestPath = "/media"
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
