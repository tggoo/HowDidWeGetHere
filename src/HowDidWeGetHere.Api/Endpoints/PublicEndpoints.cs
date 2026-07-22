using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HowDidWeGetHere.Api.Endpoints;

public static class PublicEndpoints
{
    public static RouteGroupBuilder MapPublicEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/health", () => Results.Ok(new
        {
            status = "ok",
            service = "HowDidWeGetHere.Api",
            utc = DateTimeOffset.UtcNow
        }));

        api.MapGet("/entries", GetEntriesAsync)
            .Produces<List<EntryListItemResponse>>(StatusCodes.Status200OK);

        api.MapGet("/time-periods", GetTimePeriodsAsync)
            .Produces<List<TimePeriodListItemResponse>>(StatusCodes.Status200OK);

        return api;
    }

    private static async Task<IResult> GetEntriesAsync(
        HistoryDbContext dbContext,
        string? language,
        long? fromYear,
        long? toYear,
        string[]? tag,
        CancellationToken cancellationToken)
    {
        var lang = EndpointHelpers.NormalizeLanguage(language);
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
                    .FirstOrDefault(),
                entry.AudioTracks
                    .Where(audio => audio.LanguageCode == lang)
                    .OrderByDescending(audio => audio.IsPrimary)
                    .ThenBy(audio => audio.SortOrder)
                    .Select(audio => audio.PublicUrl ?? audio.StorageKey)
                    .FirstOrDefault()))
            .Take(500)
            .ToListAsync(cancellationToken);

        return Results.Ok(entries);
    }

    private static async Task<IResult> GetTimePeriodsAsync(
        HistoryDbContext dbContext,
        string? language,
        CancellationToken cancellationToken)
    {
        var lang = EndpointHelpers.NormalizeLanguage(language);

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
    }
}

