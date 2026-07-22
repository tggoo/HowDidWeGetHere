using HowDidWeGetHere.Domain.Common;
using HowDidWeGetHere.Domain.Entries;

namespace HowDidWeGetHere.Domain.Sources;

public sealed class Source : Entity
{
    public string Url { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? Publisher { get; set; }
    public string? LanguageCode { get; set; }
    public DateTimeOffset? AccessedAt { get; set; }

    public ICollection<EntrySource> Entries { get; set; } = [];
}

