using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Domain.Places;

public sealed class EntryPlace
{
    public Guid EntryId { get; set; }
    public Entry Entry { get; set; } = null!;

    public Guid PlaceId { get; set; }
    public Place Place { get; set; } = null!;

    public EntryPlaceRole Role { get; set; } = EntryPlaceRole.MainSite;
    public int SortOrder { get; set; }
    public string? Note { get; set; }
}

