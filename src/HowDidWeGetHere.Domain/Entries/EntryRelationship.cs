using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Domain.Entries;

public sealed class EntryRelationship
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid FromEntryId { get; set; }
    public Entry FromEntry { get; set; } = null!;

    public Guid ToEntryId { get; set; }
    public Entry ToEntry { get; set; } = null!;

    public EntryRelationshipType RelationshipType { get; set; } = EntryRelationshipType.RelatedTo;
    public decimal? Confidence { get; set; }
    public string? Note { get; set; }
}

