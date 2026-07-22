using HowDidWeGetHere.Domain.Common;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Domain.Actors;

public sealed class Actor : AuditableEntity
{
    public string Slug { get; set; } = string.Empty;
    public ActorType ActorType { get; set; } = ActorType.Person;
    public string DefaultName { get; set; } = string.Empty;
    public string? WikidataId { get; set; }

    public ICollection<ActorTranslation> Translations { get; set; } = [];
    public ICollection<EntryActor> Entries { get; set; } = [];
}

