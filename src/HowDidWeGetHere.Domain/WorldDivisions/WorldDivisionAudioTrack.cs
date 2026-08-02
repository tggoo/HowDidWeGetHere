using HowDidWeGetHere.Domain.Common;
using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Domain.WorldDivisions;

public sealed class WorldDivisionAudioTrack : AuditableEntity
{
    public string WorldDivisionId { get; set; } = string.Empty;
    public string LanguageCode { get; set; } = "en";
    public AudioKind Kind { get; set; } = AudioKind.Narration;
    public StorageProvider StorageProvider { get; set; } = StorageProvider.ExternalUrl;
    public string StorageKey { get; set; } = string.Empty;
    public string? PublicUrl { get; set; }
    public string? MediaType { get; set; }
    public int? DurationSeconds { get; set; }
    public int SortOrder { get; set; }
    public bool IsPrimary { get; set; }

    public string? Title { get; set; }
    public string? Transcript { get; set; }
    public string? Attribution { get; set; }
    public string? License { get; set; }
    public string? SourceUrl { get; set; }
}
