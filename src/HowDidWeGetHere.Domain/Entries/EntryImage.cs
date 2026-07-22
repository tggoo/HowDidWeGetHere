using HowDidWeGetHere.Domain.Common;
using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Domain.Entries;

public sealed class EntryImage : AuditableEntity
{
    public Guid EntryId { get; set; }
    public Entry Entry { get; set; } = null!;

    public ImageKind Kind { get; set; } = ImageKind.Primary;
    public StorageProvider StorageProvider { get; set; } = StorageProvider.ExternalUrl;
    public string StorageKey { get; set; } = string.Empty;
    public string? PublicUrl { get; set; }
    public string? MediaType { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public int SortOrder { get; set; }
    public bool IsPrimary { get; set; }

    public string? Attribution { get; set; }
    public string? License { get; set; }
    public string? SourceUrl { get; set; }

    public ICollection<EntryImageTranslation> Translations { get; set; } = [];
}

