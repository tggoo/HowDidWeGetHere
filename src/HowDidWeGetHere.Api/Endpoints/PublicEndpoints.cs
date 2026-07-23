using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

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

        api.MapGet("/entries/{slug}", GetEntryAsync)
            .Produces<EntryDetailResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        api.MapGet("/tags", GetTagsAsync)
            .Produces<List<TagListItemResponse>>(StatusCodes.Status200OK);

        api.MapGet("/map/entries", GetMapEntriesAsync)
            .Produces<List<MapEntryResponse>>(StatusCodes.Status200OK);

        api.MapGet("/time-periods", GetTimePeriodsAsync)
            .Produces<List<TimePeriodListItemResponse>>(StatusCodes.Status200OK);

        return api;
    }

    private static async Task<IResult> GetEntriesAsync(
        HistoryDbContext dbContext,
        string? language,
        string? search,
        long? fromYear,
        long? toYear,
        string[]? tag,
        CancellationToken cancellationToken)
    {
        var lang = EndpointHelpers.NormalizeLanguage(language);
        var query = dbContext.Entries
            .AsNoTracking()
            .Where(entry => entry.Status == ContentStatus.Published);

        query = ApplySearch(query, search);

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

    private static async Task<IResult> GetMapEntriesAsync(
        HistoryDbContext dbContext,
        string? language,
        string? search,
        long? fromYear,
        long? toYear,
        string[]? tag,
        CancellationToken cancellationToken)
    {
        var lang = EndpointHelpers.NormalizeLanguage(language);
        var query = PublishedEntriesQuery(dbContext, search, fromYear, toYear, tag);

        var entries = await query
            .Include(entry => entry.Translations)
            .Include(entry => entry.Images)
            .Include(entry => entry.Places)
                .ThenInclude(entryPlace => entryPlace.Place)
                    .ThenInclude(place => place.Translations)
            .Include(entry => entry.Routes)
                .ThenInclude(route => route.Points)
                    .ThenInclude(point => point.Place)
                        .ThenInclude(place => place.Translations)
            .OrderBy(entry => entry.StartYear ?? long.MaxValue)
            .ThenBy(entry => entry.DefaultTitle)
            .Take(500)
            .ToListAsync(cancellationToken);

        var response = entries
            .Select(entry => new MapEntryResponse(
                entry.Id,
                entry.Slug,
                entry.Kind.ToString(),
                LocalizedEntryTitle(entry, lang),
                entry.DateLabel,
                entry.StartYear,
                entry.EndYear,
                entry.Images
                    .OrderByDescending(image => image.IsPrimary)
                    .ThenBy(image => image.SortOrder)
                    .Select(image => image.PublicUrl ?? image.StorageKey)
                    .FirstOrDefault(),
                entry.Places
                    .Where(entryPlace => entryPlace.Place.Geometry is Point)
                    .OrderBy(entryPlace => entryPlace.SortOrder)
                    .Select(entryPlace => new MapPointResponse(
                        entryPlace.PlaceId,
                        entryPlace.Place.Slug,
                        LocalizedPlaceName(entryPlace.Place, lang),
                        entryPlace.Role.ToString(),
                        entryPlace.Place.SpatialConfidence.ToString(),
                        Longitude(entryPlace.Place.Geometry)!.Value,
                        Latitude(entryPlace.Place.Geometry)!.Value))
                    .ToList(),
                entry.Routes
                    .OrderBy(route => route.Name)
                    .Select(route => new MapRouteResponse(
                        route.Id,
                        route.Name,
                        route.RouteType.ToString(),
                        route.SpatialConfidence.ToString(),
                        Coordinates(route.Geometry).Count > 0
                            ? Coordinates(route.Geometry)
                            : route.Points
                                .Where(point => point.Place.Geometry is Point)
                                .OrderBy(point => point.SortOrder)
                                .Select(point => new GeoCoordinateResponse(
                                    Longitude(point.Place.Geometry)!.Value,
                                    Latitude(point.Place.Geometry)!.Value))
                                .ToList()))
                    .Where(route => route.Geometry.Count > 0)
                    .ToList()))
            .Where(entry => entry.Points.Count > 0 || entry.Routes.Count > 0)
            .ToList();

        return Results.Ok(response);
    }

    private static async Task<IResult> GetEntryAsync(
        string slug,
        HistoryDbContext dbContext,
        string? language,
        CancellationToken cancellationToken)
    {
        var lang = EndpointHelpers.NormalizeLanguage(language);
        var entry = await dbContext.Entries
            .AsNoTracking()
            .Include(item => item.Translations)
            .Include(item => item.Tags)
                .ThenInclude(entryTag => entryTag.Tag)
                    .ThenInclude(tag => tag.Translations)
            .Include(item => item.TimePeriods)
                .ThenInclude(entryPeriod => entryPeriod.TimePeriod)
                    .ThenInclude(period => period.Translations)
            .Include(item => item.Places)
                .ThenInclude(entryPlace => entryPlace.Place)
                    .ThenInclude(place => place.Translations)
            .Include(item => item.Routes)
                .ThenInclude(route => route.Points)
                    .ThenInclude(point => point.Place)
                        .ThenInclude(place => place.Translations)
            .Include(item => item.OutgoingRelationships)
                .ThenInclude(relationship => relationship.ToEntry)
                    .ThenInclude(relatedEntry => relatedEntry.Translations)
            .Include(item => item.IncomingRelationships)
                .ThenInclude(relationship => relationship.FromEntry)
                    .ThenInclude(relatedEntry => relatedEntry.Translations)
            .Include(item => item.Sources)
                .ThenInclude(entrySource => entrySource.Source)
            .Include(item => item.Images)
                .ThenInclude(image => image.Translations)
            .Include(item => item.AudioTracks)
            .FirstOrDefaultAsync(
                item => item.Status == ContentStatus.Published && item.Slug == slug,
                cancellationToken);

        if (entry is null)
        {
            return Results.NotFound();
        }

        var translation = entry.Translations.FirstOrDefault(item => item.LanguageCode == lang)
            ?? entry.Translations.FirstOrDefault();

        var response = new EntryDetailResponse(
            entry.Id,
            entry.Slug,
            entry.Kind.ToString(),
            entry.RealityStatus.ToString(),
            translation?.Title ?? entry.DefaultTitle,
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
            entry.Tags
                .OrderBy(entryTag => entryTag.Tag.TagGroup)
                .ThenBy(entryTag => LocalizedTagName(entryTag.Tag, lang))
                .Select(entryTag => new EntryTagResponse(
                    entryTag.Tag.Id,
                    entryTag.Tag.Slug,
                    entryTag.Tag.TagGroup,
                    LocalizedTagName(entryTag.Tag, lang)))
                .ToList(),
            entry.TimePeriods
                .OrderBy(entryPeriod => entryPeriod.TimePeriod.StartYear ?? long.MaxValue)
                .ThenBy(entryPeriod => LocalizedPeriodName(entryPeriod.TimePeriod, lang))
                .Select(entryPeriod => new EntryTimePeriodResponse(
                    entryPeriod.TimePeriod.Id,
                    entryPeriod.TimePeriod.Slug,
                    LocalizedPeriodName(entryPeriod.TimePeriod, lang),
                    entryPeriod.RelationType.ToString(),
                    entryPeriod.TimePeriod.PeriodType.ToString(),
                    entryPeriod.TimePeriod.StartYear,
                    entryPeriod.TimePeriod.EndYear))
                .ToList(),
            entry.Places
                .OrderBy(entryPlace => entryPlace.SortOrder)
                .Select(entryPlace => new EntryPlaceResponse(
                    entryPlace.PlaceId,
                    entryPlace.Place.Slug,
                    LocalizedPlaceName(entryPlace.Place, lang),
                    entryPlace.Role.ToString(),
                    entryPlace.SortOrder,
                    entryPlace.Note,
                    entryPlace.Place.PlaceType.ToString(),
                    entryPlace.Place.SpatialConfidence.ToString(),
                    Longitude(entryPlace.Place.Geometry),
                    Latitude(entryPlace.Place.Geometry)))
                .ToList(),
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
                            LocalizedPlaceName(point.Place, lang),
                            point.Role.ToString(),
                            point.SortOrder,
                            point.DateLabel,
                            point.Note,
                            Longitude(point.Place.Geometry),
                            Latitude(point.Place.Geometry)))
                        .ToList()))
                .ToList(),
            entry.OutgoingRelationships
                .Where(relationship => relationship.ToEntry.Status == ContentStatus.Published)
                .Select(relationship => RelatedEntry(relationship.ToEntry, relationship.RelationshipType.ToString(), "outgoing", relationship.Confidence, relationship.Note, lang))
                .Concat(entry.IncomingRelationships
                    .Where(relationship => relationship.FromEntry.Status == ContentStatus.Published)
                    .Select(relationship => RelatedEntry(relationship.FromEntry, relationship.RelationshipType.ToString(), "incoming", relationship.Confidence, relationship.Note, lang)))
                .OrderBy(relationship => relationship.Title)
                .ToList(),
            entry.Sources
                .OrderBy(entrySource => entrySource.SupportsField)
                .ThenBy(entrySource => entrySource.Source.Title ?? entrySource.Source.Url)
                .Select(entrySource => new EntrySourceResponse(
                    entrySource.SourceId,
                    entrySource.Source.Url,
                    entrySource.Source.Title,
                    entrySource.Source.Publisher,
                    entrySource.Source.LanguageCode,
                    entrySource.SupportsField.ToString(),
                    entrySource.Note))
                .ToList(),
            entry.Images
                .OrderByDescending(image => image.IsPrimary)
                .ThenBy(image => image.SortOrder)
                .Select(image =>
                {
                    var imageTranslation = image.Translations.FirstOrDefault(item => item.LanguageCode == lang)
                        ?? image.Translations.FirstOrDefault();
                    return new EntryImageResponse(
                        image.Id,
                        image.PublicUrl ?? image.StorageKey,
                        image.Kind.ToString(),
                        image.IsPrimary,
                        image.SortOrder,
                        imageTranslation?.AltText,
                        imageTranslation?.Caption,
                        image.Attribution,
                        image.License,
                        image.SourceUrl);
                })
                .ToList(),
            entry.AudioTracks
                .Where(audio => audio.LanguageCode == lang)
                .OrderByDescending(audio => audio.IsPrimary)
                .ThenBy(audio => audio.SortOrder)
                .Select(audio => new EntryAudioTrackResponse(
                    audio.Id,
                    audio.PublicUrl ?? audio.StorageKey,
                    audio.Kind.ToString(),
                    audio.LanguageCode,
                    audio.IsPrimary,
                    audio.SortOrder,
                    audio.Title,
                    audio.Transcript,
                    audio.DurationSeconds,
                    audio.Attribution,
                    audio.License,
                    audio.SourceUrl))
                .ToList());

        return Results.Ok(response);
    }

    private static async Task<IResult> GetTagsAsync(
        HistoryDbContext dbContext,
        string? language,
        string? group,
        CancellationToken cancellationToken)
    {
        var lang = EndpointHelpers.NormalizeLanguage(language);
        var query = dbContext.Tags
            .AsNoTracking()
            .Include(tag => tag.Translations)
            .Include(tag => tag.Entries)
                .ThenInclude(entryTag => entryTag.Entry)
            .Where(tag => tag.Entries.Any(entryTag => entryTag.Entry.Status == ContentStatus.Published));

        if (!string.IsNullOrWhiteSpace(group))
        {
            query = query.Where(tag => tag.TagGroup == group);
        }

        var tags = await query.ToListAsync(cancellationToken);
        var response = tags
            .Select(tag => new TagListItemResponse(
                tag.Id,
                tag.Slug,
                tag.TagGroup,
                LocalizedTagName(tag, lang),
                tag.ParentTagId,
                tag.Entries.Count(entryTag => entryTag.Entry.Status == ContentStatus.Published)))
            .OrderBy(tag => tag.TagGroup)
            .ThenBy(tag => tag.Name)
            .ToList();

        return Results.Ok(response);
    }

    private static IQueryable<Domain.Entries.Entry> PublishedEntriesQuery(
        HistoryDbContext dbContext,
        string? search,
        long? fromYear,
        long? toYear,
        string[]? tag)
    {
        var query = dbContext.Entries
            .AsNoTracking()
            .Where(entry => entry.Status == ContentStatus.Published);

        query = ApplySearch(query, search);

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

        return query;
    }

    private static IQueryable<Domain.Entries.Entry> ApplySearch(
        IQueryable<Domain.Entries.Entry> query,
        string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
        {
            return query;
        }

        var term = search.Trim().ToLower();
        return query.Where(entry =>
            entry.DefaultTitle.ToLower().Contains(term) ||
            entry.Slug.ToLower().Contains(term) ||
            entry.Translations.Any(translation =>
                translation.Title.ToLower().Contains(term) ||
                (translation.Summary != null && translation.Summary.ToLower().Contains(term)) ||
                (translation.Description != null && translation.Description.ToLower().Contains(term)) ||
                (translation.WhyItMatters != null && translation.WhyItMatters.ToLower().Contains(term))));
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

    private static string LocalizedTagName(Domain.Tags.Tag tag, string language) =>
        tag.Translations
            .Where(translation => translation.LanguageCode == language)
            .Select(translation => translation.Name)
            .FirstOrDefault() ??
        tag.Translations
            .Select(translation => translation.Name)
            .FirstOrDefault() ??
        tag.Slug;

    private static string LocalizedPeriodName(Domain.Entries.TimePeriod period, string language) =>
        period.Translations
            .Where(translation => translation.LanguageCode == language)
            .Select(translation => translation.Name)
            .FirstOrDefault() ??
        period.Translations
            .Select(translation => translation.Name)
            .FirstOrDefault() ??
        period.Slug;

    private static string LocalizedPlaceName(Domain.Places.Place place, string language) =>
        place.Translations
            .Where(translation => translation.LanguageCode == language)
            .Select(translation => translation.Name)
            .FirstOrDefault() ??
        place.Translations
            .Select(translation => translation.Name)
            .FirstOrDefault() ??
        place.DefaultName;

    private static string LocalizedEntryTitle(Domain.Entries.Entry entry, string language) =>
        entry.Translations
            .Where(translation => translation.LanguageCode == language)
            .Select(translation => translation.Title)
            .FirstOrDefault() ??
        entry.Translations
            .Select(translation => translation.Title)
            .FirstOrDefault() ??
        entry.DefaultTitle;

    private static EntryRelationshipResponse RelatedEntry(
        Domain.Entries.Entry entry,
        string relationshipType,
        string direction,
        decimal? confidence,
        string? note,
        string language)
    {
        var title = entry.Translations
            .Where(translation => translation.LanguageCode == language)
            .Select(translation => translation.Title)
            .FirstOrDefault() ??
            entry.Translations
                .Select(translation => translation.Title)
                .FirstOrDefault() ??
            entry.DefaultTitle;

        return new EntryRelationshipResponse(
            entry.Id,
            entry.Slug,
            title,
            entry.Kind.ToString(),
            relationshipType,
            direction,
            confidence,
            note);
    }

    private static double? Longitude(Geometry? geometry) =>
        geometry is Point point ? point.X : null;

    private static double? Latitude(Geometry? geometry) =>
        geometry is Point point ? point.Y : null;

    private static IReadOnlyList<GeoCoordinateResponse> Coordinates(Geometry? geometry) =>
        geometry switch
        {
            LineString lineString => lineString.Coordinates
                .Select(coordinate => new GeoCoordinateResponse(coordinate.X, coordinate.Y))
                .ToList(),
            Point point => [new GeoCoordinateResponse(point.X, point.Y)],
            _ => []
        };
}
