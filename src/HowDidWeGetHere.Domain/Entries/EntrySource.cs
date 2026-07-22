using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Domain.Sources;

namespace HowDidWeGetHere.Domain.Entries;

public sealed class EntrySource
{
    public Guid EntryId { get; set; }
    public Entry Entry { get; set; } = null!;

    public Guid SourceId { get; set; }
    public Source Source { get; set; } = null!;

    public SourceSupportKind SupportsField { get; set; } = SourceSupportKind.General;
    public string? Note { get; set; }
}

