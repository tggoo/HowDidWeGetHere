using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Domain.Actors;

public sealed class EntryActor
{
    public Guid EntryId { get; set; }
    public Entry Entry { get; set; } = null!;

    public Guid ActorId { get; set; }
    public Actor Actor { get; set; } = null!;

    public EntryActorRole Role { get; set; } = EntryActorRole.Participant;
    public int SortOrder { get; set; }
    public string? Note { get; set; }
}

