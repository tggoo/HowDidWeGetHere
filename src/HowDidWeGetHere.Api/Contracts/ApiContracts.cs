using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Api.Contracts;

public sealed record EntryListItemResponse(
    Guid Id,
    string Slug,
    string Kind,
    string Title,
    string? DateLabel,
    long? StartYear,
    long? EndYear,
    Guid? PrimaryTimePeriodId,
    string? PrimaryImageUrl,
    string? PrimaryAudioUrl);

public sealed record EntryDetailResponse(
    Guid Id,
    string Slug,
    string Kind,
    string RealityStatus,
    string Title,
    string? Summary,
    string? Description,
    string? WhyItMatters,
    string? DatingNote,
    string? DateLabel,
    long? StartYear,
    byte? StartMonth,
    byte? StartDay,
    long? EndYear,
    byte? EndMonth,
    byte? EndDay,
    string TimePrecision,
    string? TimeConfidence,
    Guid? PrimaryTimePeriodId,
    IReadOnlyList<EntryTagResponse> Tags,
    IReadOnlyList<EntryTimePeriodResponse> TimePeriods,
    IReadOnlyList<EntryPlaceResponse> Places,
    IReadOnlyList<EntryRouteResponse> Routes,
    IReadOnlyList<EntryRelationshipResponse> RelatedEntries,
    IReadOnlyList<EntrySourceResponse> Sources,
    IReadOnlyList<EntryImageResponse> Images,
    IReadOnlyList<EntryAudioTrackResponse> AudioTracks);

public sealed record TagListItemResponse(
    Guid Id,
    string Slug,
    string TagGroup,
    string Name,
    Guid? ParentTagId,
    int EntryCount);

public sealed record EntryTagResponse(
    Guid Id,
    string Slug,
    string TagGroup,
    string Name);

public sealed record TimePeriodListItemResponse(
    Guid Id,
    string Slug,
    Guid? ParentPeriodId,
    string PeriodType,
    string Name,
    string? ShortDescription,
    long? StartYear,
    long? EndYear);

public sealed record EntryTimePeriodResponse(
    Guid Id,
    string Slug,
    string Name,
    string RelationType,
    string PeriodType,
    long? StartYear,
    long? EndYear);

public sealed record GeoCoordinateResponse(
    double Longitude,
    double Latitude);

public sealed record EntryPlaceResponse(
    Guid PlaceId,
    string Slug,
    string Name,
    string Role,
    int SortOrder,
    string? Note,
    string PlaceType,
    string SpatialConfidence,
    double? Longitude,
    double? Latitude);

public sealed record EntryRouteResponse(
    Guid Id,
    string Name,
    string RouteType,
    string SpatialConfidence,
    string? SourceNote,
    IReadOnlyList<GeoCoordinateResponse> Geometry,
    IReadOnlyList<RoutePointResponse> Points);

public sealed record RoutePointResponse(
    Guid PlaceId,
    string Slug,
    string Name,
    string Role,
    int SortOrder,
    string? DateLabel,
    string? Note,
    double? Longitude,
    double? Latitude);

public sealed record EntryRelationshipResponse(
    Guid EntryId,
    string Slug,
    string Title,
    string Kind,
    string RelationshipType,
    string Direction,
    decimal? Confidence,
    string? Note);

public sealed record EntrySourceResponse(
    Guid SourceId,
    string Url,
    string? Title,
    string? Publisher,
    string? LanguageCode,
    string SupportsField,
    string? Note);

public sealed record EntryImageResponse(
    Guid Id,
    string Url,
    string Kind,
    bool IsPrimary,
    int SortOrder,
    string? AltText,
    string? Caption,
    string? Attribution,
    string? License,
    string? SourceUrl);

public sealed record EntryAudioTrackResponse(
    Guid Id,
    string Url,
    string Kind,
    string LanguageCode,
    bool IsPrimary,
    int SortOrder,
    string? Title,
    string? Transcript,
    int? DurationSeconds,
    string? Attribution,
    string? License,
    string? SourceUrl);

public sealed record MapEntryResponse(
    Guid EntryId,
    string Slug,
    string Kind,
    string Title,
    string? DateLabel,
    long? StartYear,
    long? EndYear,
    string? PrimaryImageUrl,
    IReadOnlyList<MapPointResponse> Points,
    IReadOnlyList<MapRouteResponse> Routes);

public sealed record MapPointResponse(
    Guid PlaceId,
    string PlaceSlug,
    string PlaceName,
    string Role,
    string SpatialConfidence,
    double Longitude,
    double Latitude);

public sealed record MapRouteResponse(
    Guid RouteId,
    string Name,
    string RouteType,
    string SpatialConfidence,
    IReadOnlyList<GeoCoordinateResponse> Geometry);

public sealed record AdminEntryListItemResponse(
    Guid Id,
    string Slug,
    string Status,
    string Kind,
    string Title,
    string? SourceSheet,
    int? SourceRow);

public sealed record AdminEntryDetailResponse(
    Guid Id,
    string Slug,
    string Status,
    string Kind,
    string RealityStatus,
    string Title,
    string? LanguageCode,
    string? Summary,
    string? Description,
    string? WhyItMatters,
    string? DatingNote,
    string? DateLabel,
    long? StartYear,
    byte? StartMonth,
    byte? StartDay,
    long? EndYear,
    byte? EndMonth,
    byte? EndDay,
    string? TimePrecision,
    string? TimeConfidence,
    Guid? PrimaryTimePeriodId,
    string? SourceSheet,
    int? SourceRow);

public sealed record ResourceCreatedResponse(
    Guid Id,
    string? Slug);

public sealed record AdminEntryUpsertRequest(
    string Title,
    string? Slug,
    string? LanguageCode,
    string? Summary,
    string? Description,
    string? WhyItMatters,
    string? DatingNote,
    EntryKind Kind,
    ContentStatus Status,
    RealityStatus RealityStatus,
    string? DateLabel,
    long? StartYear,
    byte? StartMonth,
    byte? StartDay,
    long? EndYear,
    byte? EndMonth,
    byte? EndDay,
    TimePrecision? TimePrecision,
    string? TimeConfidence,
    Guid? PrimaryTimePeriodId);

public sealed record AdminEntryImageRequest(
    ImageKind Kind,
    StorageProvider StorageProvider,
    string? StorageKey,
    string? PublicUrl,
    string? MediaType,
    int? Width,
    int? Height,
    int SortOrder,
    bool IsPrimary,
    string? Attribution,
    string? License,
    string? SourceUrl,
    string? LanguageCode,
    string? AltText,
    string? Caption);

public sealed record AdminEntryAudioTrackRequest(
    AudioKind Kind,
    StorageProvider StorageProvider,
    string? StorageKey,
    string? PublicUrl,
    string? MediaType,
    int? DurationSeconds,
    int SortOrder,
    bool IsPrimary,
    string? LanguageCode,
    string? Title,
    string? Transcript,
    string? Attribution,
    string? License,
    string? SourceUrl);

public sealed record AdminEntryPlaceRequest(
    string Name,
    string? Slug,
    string? LanguageCode,
    PlaceType PlaceType,
    EntryPlaceRole Role,
    SpatialConfidence SpatialConfidence,
    double Longitude,
    double Latitude,
    string? ModernCountryCode,
    string? WikidataId,
    int? GeoNamesId,
    int SortOrder,
    string? Note);
