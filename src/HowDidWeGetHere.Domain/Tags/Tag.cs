using HowDidWeGetHere.Domain.Common;
using HowDidWeGetHere.Domain.Entries;

namespace HowDidWeGetHere.Domain.Tags;

public sealed class Tag : AuditableEntity
{
    public string Slug { get; set; } = string.Empty;
    public string TagGroup { get; set; } = "topic";

    public Guid? ParentTagId { get; set; }
    public Tag? ParentTag { get; set; }

    public ICollection<Tag> Children { get; set; } = [];
    public ICollection<TagTranslation> Translations { get; set; } = [];
    public ICollection<EntryTag> Entries { get; set; } = [];
}

