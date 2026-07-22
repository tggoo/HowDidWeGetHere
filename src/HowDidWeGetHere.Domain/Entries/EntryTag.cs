using HowDidWeGetHere.Domain.Tags;

namespace HowDidWeGetHere.Domain.Entries;

public sealed class EntryTag
{
    public Guid EntryId { get; set; }
    public Entry Entry { get; set; } = null!;

    public Guid TagId { get; set; }
    public Tag Tag { get; set; } = null!;

    public decimal? Confidence { get; set; }
}

