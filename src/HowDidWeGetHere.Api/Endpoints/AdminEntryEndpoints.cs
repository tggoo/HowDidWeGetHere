using System.Security.Claims;
using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Application.Time;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminEntryEndpoints
{
    public static RouteGroupBuilder MapAdminEntryEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGet("/entries", GetEntriesAsync)
            .Produces<List<AdminEntryListItemResponse>>(StatusCodes.Status200OK);

        admin.MapGet("/entries/{entryId:guid}", GetEntryAsync)
            .Produces<AdminEntryDetailResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        admin.MapPost("/entries", CreateEntryAsync)
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest);

        admin.MapPut("/entries/{entryId:guid}", UpdateEntryAsync)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        return admin;
    }

    private static async Task<IResult> GetEntriesAsync(
        HistoryDbContext dbContext,
        string? language,
        CancellationToken cancellationToken)
    {
        var lang = EndpointHelpers.NormalizeLanguage(language);
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
    }

    private static async Task<IResult> GetEntryAsync(
        Guid entryId,
        HistoryDbContext dbContext,
        string? language,
        CancellationToken cancellationToken)
    {
        var lang = EndpointHelpers.NormalizeLanguage(language);
        var entry = await dbContext.Entries
            .AsNoTracking()
            .Include(item => item.Translations)
            .Include(item => item.Routes)
                .ThenInclude(route => route.Points)
                    .ThenInclude(point => point.Place)
                        .ThenInclude(place => place.Translations)
            .Include(item => item.OutgoingRelationships)
                .ThenInclude(relationship => relationship.ToEntry)
                    .ThenInclude(relatedEntry => relatedEntry.Translations)
            .FirstOrDefaultAsync(item => item.Id == entryId, cancellationToken);

        if (entry is null)
        {
            return Results.NotFound();
        }

        var translation = entry.Translations.FirstOrDefault(item => item.LanguageCode == lang)
            ?? entry.Translations.FirstOrDefault();

        return Results.Ok(new AdminEntryDetailResponse(
            entry.Id,
            entry.Slug,
            entry.Status.ToString(),
            entry.Kind.ToString(),
            entry.RealityStatus.ToString(),
            translation?.Title ?? entry.DefaultTitle,
            translation?.LanguageCode ?? lang,
            translation?.Summary,
            translation?.Description,
            translation?.WhyItMatters,
            translation?.DatingNote,
            entry.DateLabel,
            entry.StartYear,
            entry.StartMonth,
            entry.StartDay,
            entry.EndYear,
            entry.EndMonth,
            entry.EndDay,
            entry.TimePrecision.ToString(),
            entry.TimeConfidence,
            entry.PrimaryTimePeriodId,
            entry.SourceSheet,
            entry.SourceRow,
            entry.Routes
                .OrderBy(route => route.Name)
                .Select(route => new EntryRouteResponse(
                    route.Id,
                    route.Name,
                    route.RouteType.ToString(),
                    route.SpatialConfidence.ToString(),
                    route.SourceNote,
                    Coordinates(route.Geometry),
                    route.Points
                        .OrderBy(point => point.SortOrder)
                        .Select(point => new RoutePointResponse(
                            point.PlaceId,
                            point.Place.Slug,
                            point.Place.Translations
                                .Where(placeTranslation => placeTranslation.LanguageCode == lang)
                                .Select(placeTranslation => placeTranslation.Name)
                                .FirstOrDefault() ?? point.Place.DefaultName,
                            point.Role.ToString(),
                            point.SortOrder,
                            point.DateLabel,
                            point.Note,
                            point.Place.Geometry?.Coordinate.X,
                            point.Place.Geometry?.Coordinate.Y))
                        .ToList()))
                .ToList(),
            entry.OutgoingRelationships
                .OrderBy(relationship => relationship.ToEntry.DefaultTitle)
                .Select(relationship => new AdminEntryRelationshipResponse(
                    relationship.Id,
                    relationship.ToEntryId,
                    relationship.ToEntry.Slug,
                    relationship.ToEntry.Translations
                        .Where(translation => translation.LanguageCode == lang)
                        .Select(translation => translation.Title)
                        .FirstOrDefault() ?? relationship.ToEntry.DefaultTitle,
                    relationship.ToEntry.Kind.ToString(),
                    relationship.RelationshipType.ToString(),
                    relationship.Confidence,
                    relationship.Note))
                .ToList()));
    }

    private static async Task<IResult> CreateEntryAsync(
        AdminEntryUpsertRequest request,
        HistoryDbContext dbContext,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return Results.BadRequest(new { error = "Title is required." });
        }

        var parsedDate = HistoricalDateParser.Parse(request.DateLabel);
        var slug = EndpointHelpers.MakeUniqueEntrySlug(
            EndpointHelpers.Slugify(request.Slug ?? request.Title),
            dbContext);

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
                    LanguageCode = EndpointHelpers.NormalizeLanguage(request.LanguageCode),
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
    }

    private static async Task<IResult> UpdateEntryAsync(
        Guid entryId,
        AdminEntryUpsertRequest request,
        HistoryDbContext dbContext,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
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
        var requestedSlug = EndpointHelpers.Slugify(request.Slug ?? string.Empty);
        if (!string.IsNullOrWhiteSpace(requestedSlug) &&
            !requestedSlug.Equals(entry.Slug, StringComparison.OrdinalIgnoreCase))
        {
            entry.Slug = MakeUniqueEntrySlugForUpdate(requestedSlug, dbContext, entry.Id);
        }

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

        var language = EndpointHelpers.NormalizeLanguage(request.LanguageCode);
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
    }

    private static string MakeUniqueEntrySlugForUpdate(string baseSlug, HistoryDbContext dbContext, Guid currentEntryId)
    {
        var slug = string.IsNullOrWhiteSpace(baseSlug) ? Guid.NewGuid().ToString("n") : baseSlug;
        var uniqueSlug = slug;
        var suffix = 2;

        while (dbContext.Entries.Any(entry => entry.Id != currentEntryId && entry.Slug == uniqueSlug))
        {
            uniqueSlug = $"{slug}-{suffix}";
            suffix++;
        }

        return uniqueSlug;
    }

    private static IReadOnlyList<GeoCoordinateResponse> Coordinates(Geometry? geometry) =>
        geometry?.Coordinates
            .Select(coordinate => new GeoCoordinateResponse(coordinate.X, coordinate.Y))
            .ToList()
        ?? [];
}
