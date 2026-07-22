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

public sealed record TimePeriodListItemResponse(
    Guid Id,
    string Slug,
    Guid? ParentPeriodId,
    string PeriodType,
    string Name,
    string? ShortDescription,
    long? StartYear,
    long? EndYear);

public sealed record AdminEntryListItemResponse(
    Guid Id,
    string Slug,
    string Status,
    string Kind,
    string Title,
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
