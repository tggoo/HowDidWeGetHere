using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Application.Imports;
using HowDidWeGetHere.Application.Time;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Infrastructure;
using HowDidWeGetHere.Infrastructure.Identity;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(
        Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", ".aspnet", "data-protection-keys"))));

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
    var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? ["http://localhost:5173"];

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

app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapGroup("/api/auth")
    .MapIdentityApi<ApplicationUser>();

var api = app.MapGroup("/api");

api.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    service = "HowDidWeGetHere.Api",
    utc = DateTimeOffset.UtcNow
}));

api.MapGet("/entries", async (
    HistoryDbContext dbContext,
    string? language,
    long? fromYear,
    long? toYear,
    string[]? tag,
    CancellationToken cancellationToken) =>
{
    var lang = NormalizeLanguage(language);
    var query = dbContext.Entries
        .AsNoTracking()
        .Where(entry => entry.Status == ContentStatus.Published);

    if (fromYear.HasValue)
    {
        query = query.Where(entry => entry.EndYear == null || entry.EndYear >= fromYear.Value);
    }

    if (toYear.HasValue)
    {
        query = query.Where(entry => entry.StartYear == null || entry.StartYear <= toYear.Value);
    }

    foreach (var tagSlug in tag?.Where(value => !string.IsNullOrWhiteSpace(value)) ?? [])
    {
        query = query.Where(entry => entry.Tags.Any(entryTag => entryTag.Tag.Slug == tagSlug));
    }

    var entries = await query
        .OrderBy(entry => entry.StartYear ?? long.MaxValue)
        .ThenBy(entry => entry.DefaultTitle)
        .Select(entry => new EntryListItemResponse(
            entry.Id,
            entry.Slug,
            entry.Kind.ToString(),
            entry.Translations
                .Where(translation => translation.LanguageCode == lang)
                .Select(translation => translation.Title)
                .FirstOrDefault() ?? entry.DefaultTitle,
            entry.DateLabel,
            entry.StartYear,
            entry.EndYear,
            entry.PrimaryTimePeriodId,
            entry.Images
                .OrderByDescending(image => image.IsPrimary)
                .ThenBy(image => image.SortOrder)
                .Select(image => image.PublicUrl ?? image.StorageKey)
                .FirstOrDefault()))
        .Take(500)
        .ToListAsync(cancellationToken);

    return Results.Ok(entries);
})
.Produces<List<EntryListItemResponse>>(StatusCodes.Status200OK);

api.MapGet("/time-periods", async (
    HistoryDbContext dbContext,
    string? language,
    CancellationToken cancellationToken) =>
{
    var lang = NormalizeLanguage(language);

    var periods = await dbContext.TimePeriods
        .AsNoTracking()
        .OrderBy(period => period.SortOrder)
        .ThenBy(period => period.StartYear ?? long.MaxValue)
        .Select(period => new TimePeriodListItemResponse(
            period.Id,
            period.Slug,
            period.ParentPeriodId,
            period.PeriodType.ToString(),
            period.Translations
                .Where(translation => translation.LanguageCode == lang)
                .Select(translation => translation.Name)
                .FirstOrDefault() ?? period.Slug,
            period.Translations
                .Where(translation => translation.LanguageCode == lang)
                .Select(translation => translation.ShortDescription)
                .FirstOrDefault(),
            period.StartYear,
            period.EndYear))
        .ToListAsync(cancellationToken);

    return Results.Ok(periods);
})
.Produces<List<TimePeriodListItemResponse>>(StatusCodes.Status200OK);

var admin = api.MapGroup("/admin")
    .RequireAuthorization("AdminOnly");

admin.MapGet("/entries", async (
    HistoryDbContext dbContext,
    string? language,
    CancellationToken cancellationToken) =>
{
    var lang = NormalizeLanguage(language);
    var entries = await dbContext.Entries
        .AsNoTracking()
        .OrderByDescending(entry => entry.CreatedAt)
        .Select(entry => new AdminEntryListItemResponse(
            entry.Id,
            entry.Slug,
            entry.Status.ToString(),
            entry.Kind.ToString(),
            entry.Translations
                .Where(translation => translation.LanguageCode == lang)
                .Select(translation => translation.Title)
                .FirstOrDefault() ?? entry.DefaultTitle,
            entry.SourceSheet,
            entry.SourceRow))
        .Take(500)
        .ToListAsync(cancellationToken);

    return Results.Ok(entries);
})
.Produces<List<AdminEntryListItemResponse>>(StatusCodes.Status200OK);

admin.MapPost("/entries", async (
    AdminEntryUpsertRequest request,
    HistoryDbContext dbContext,
    ClaimsPrincipal user,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Title))
    {
        return Results.BadRequest(new { error = "Title is required." });
    }

    var parsedDate = HistoricalDateParser.Parse(request.DateLabel);
    var slug = MakeUniqueSlug(Slugify(request.Slug ?? request.Title), dbContext);

    var entry = new Entry
    {
        Slug = slug,
        Kind = request.Kind,
        Status = request.Status,
        RealityStatus = request.RealityStatus,
        DefaultTitle = request.Title.Trim(),
        DateLabel = request.DateLabel,
        StartYear = request.StartYear ?? parsedDate.StartYear,
        StartMonth = request.StartMonth ?? parsedDate.StartMonth,
        StartDay = request.StartDay ?? parsedDate.StartDay,
        EndYear = request.EndYear ?? parsedDate.EndYear,
        EndMonth = request.EndMonth ?? parsedDate.EndMonth,
        EndDay = request.EndDay ?? parsedDate.EndDay,
        TimePrecision = request.TimePrecision ?? parsedDate.Precision,
        TimeConfidence = request.TimeConfidence,
        PrimaryTimePeriodId = request.PrimaryTimePeriodId,
        CreatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier),
        Translations =
        [
            new EntryTranslation
            {
                LanguageCode = NormalizeLanguage(request.LanguageCode),
                Title = request.Title.Trim(),
                Summary = request.Summary,
                Description = request.Description,
                WhyItMatters = request.WhyItMatters,
                DatingNote = request.DatingNote
            }
        ]
    };

    dbContext.Entries.Add(entry);
    await dbContext.SaveChangesAsync(cancellationToken);

    return Results.Created($"/api/admin/entries/{entry.Id}", new ResourceCreatedResponse(entry.Id, entry.Slug));
})
.Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
.Produces(StatusCodes.Status400BadRequest);

admin.MapPut("/entries/{entryId:guid}", async (
    Guid entryId,
    AdminEntryUpsertRequest request,
    HistoryDbContext dbContext,
    ClaimsPrincipal user,
    CancellationToken cancellationToken) =>
{
    var entry = await dbContext.Entries
        .Include(item => item.Translations)
        .FirstOrDefaultAsync(item => item.Id == entryId, cancellationToken);

    if (entry is null)
    {
        return Results.NotFound();
    }

    if (string.IsNullOrWhiteSpace(request.Title))
    {
        return Results.BadRequest(new { error = "Title is required." });
    }

    var parsedDate = HistoricalDateParser.Parse(request.DateLabel);
    entry.Kind = request.Kind;
    entry.Status = request.Status;
    entry.RealityStatus = request.RealityStatus;
    entry.DefaultTitle = request.Title.Trim();
    entry.DateLabel = request.DateLabel;
    entry.StartYear = request.StartYear ?? parsedDate.StartYear;
    entry.StartMonth = request.StartMonth ?? parsedDate.StartMonth;
    entry.StartDay = request.StartDay ?? parsedDate.StartDay;
    entry.EndYear = request.EndYear ?? parsedDate.EndYear;
    entry.EndMonth = request.EndMonth ?? parsedDate.EndMonth;
    entry.EndDay = request.EndDay ?? parsedDate.EndDay;
    entry.TimePrecision = request.TimePrecision ?? parsedDate.Precision;
    entry.TimeConfidence = request.TimeConfidence;
    entry.PrimaryTimePeriodId = request.PrimaryTimePeriodId;
    entry.UpdatedAt = DateTimeOffset.UtcNow;
    entry.UpdatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);

    var language = NormalizeLanguage(request.LanguageCode);
    var translation = entry.Translations.FirstOrDefault(item => item.LanguageCode == language);
    if (translation is null)
    {
        entry.Translations.Add(new EntryTranslation
        {
            LanguageCode = language,
            Title = request.Title.Trim(),
            Summary = request.Summary,
            Description = request.Description,
            WhyItMatters = request.WhyItMatters,
            DatingNote = request.DatingNote
        });
    }
    else
    {
        translation.Title = request.Title.Trim();
        translation.Summary = request.Summary;
        translation.Description = request.Description;
        translation.WhyItMatters = request.WhyItMatters;
        translation.DatingNote = request.DatingNote;
    }

    await dbContext.SaveChangesAsync(cancellationToken);
    return Results.NoContent();
})
.Produces(StatusCodes.Status204NoContent)
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status404NotFound);

admin.MapPost("/entries/{entryId:guid}/images", async (
    Guid entryId,
    AdminEntryImageRequest request,
    HistoryDbContext dbContext,
    ClaimsPrincipal user,
    CancellationToken cancellationToken) =>
{
    var exists = await dbContext.Entries.AnyAsync(entry => entry.Id == entryId, cancellationToken);
    if (!exists)
    {
        return Results.NotFound();
    }

    if (string.IsNullOrWhiteSpace(request.StorageKey) && string.IsNullOrWhiteSpace(request.PublicUrl))
    {
        return Results.BadRequest(new { error = "StorageKey or PublicUrl is required." });
    }

    var image = new EntryImage
    {
        EntryId = entryId,
        Kind = request.Kind,
        StorageProvider = request.StorageProvider,
        StorageKey = request.StorageKey ?? request.PublicUrl!,
        PublicUrl = request.PublicUrl,
        MediaType = request.MediaType,
        Width = request.Width,
        Height = request.Height,
        SortOrder = request.SortOrder,
        IsPrimary = request.IsPrimary,
        Attribution = request.Attribution,
        License = request.License,
        SourceUrl = request.SourceUrl,
        CreatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier),
        Translations =
        [
            new EntryImageTranslation
            {
                LanguageCode = NormalizeLanguage(request.LanguageCode),
                AltText = request.AltText,
                Caption = request.Caption
            }
        ]
    };

    dbContext.EntryImages.Add(image);
    await dbContext.SaveChangesAsync(cancellationToken);

    return Results.Created($"/api/admin/entries/{entryId}/images/{image.Id}", new ResourceCreatedResponse(image.Id, null));
})
.Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status404NotFound);

admin.MapPost("/imports/workbook", async (
    IFormFile file,
    IWorkbookImportService importer,
    ClaimsPrincipal user,
    CancellationToken cancellationToken) =>
{
    if (file.Length == 0)
    {
        return Results.BadRequest(new { error = "Workbook file is empty." });
    }

    await using var stream = file.OpenReadStream();
    var result = await importer.ImportAsync(
        stream,
        file.FileName,
        user.FindFirstValue(ClaimTypes.NameIdentifier),
        cancellationToken);

    return Results.Ok(result);
})
.Produces<WorkbookImportResult>(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest)
.DisableAntiforgery();

await app.Services.SeedAdminUserAsync(app.Configuration);
await app.RunAsync();

static string NormalizeLanguage(string? language) =>
    string.IsNullOrWhiteSpace(language) ? "en" : language.Trim().ToLowerInvariant();

static string MakeUniqueSlug(string baseSlug, HistoryDbContext dbContext)
{
    var slug = string.IsNullOrWhiteSpace(baseSlug) ? Guid.NewGuid().ToString("n") : baseSlug;
    var uniqueSlug = slug;
    var suffix = 2;

    while (dbContext.Entries.Any(entry => entry.Slug == uniqueSlug))
    {
        uniqueSlug = $"{slug}-{suffix}";
        suffix++;
    }

    return uniqueSlug;
}

static string Slugify(string value)
{
    var normalized = value.Normalize(NormalizationForm.FormD);
    var builder = new StringBuilder(normalized.Length);

    foreach (var character in normalized)
    {
        var category = CharUnicodeInfo.GetUnicodeCategory(character);
        if (category == UnicodeCategory.NonSpacingMark)
        {
            continue;
        }

        if (char.IsLetterOrDigit(character))
        {
            builder.Append(char.ToLowerInvariant(character));
        }
        else
        {
            builder.Append('-');
        }
    }

    return Regex.Replace(builder.ToString(), "-+", "-").Trim('-');
}
