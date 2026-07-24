using HowDidWeGetHere.Domain.Actors;
using HowDidWeGetHere.Domain.Common;
using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Domain.Places;
using HowDidWeGetHere.Domain.Routes;

namespace HowDidWeGetHere.Domain.Entries;

public sealed class Entry : AuditableEntity
{
    public string Slug { get; set; } = string.Empty;
    public EntryKind Kind { get; set; } = EntryKind.Event;
    public ContentStatus Status { get; set; } = ContentStatus.Draft;
    public RealityStatus RealityStatus { get; set; } = RealityStatus.Historical;

    public string DefaultTitle { get; set; } = string.Empty;
    public string? IconKey { get; set; }
    public string? DateLabel { get; set; }
    public long? StartYear { get; set; }
    public byte? StartMonth { get; set; }
    public byte? StartDay { get; set; }
    public long? EndYear { get; set; }
    public byte? EndMonth { get; set; }
    public byte? EndDay { get; set; }
    public TimePrecision TimePrecision { get; set; } = TimePrecision.Unknown;
    public string? TimeConfidence { get; set; }

    public Guid? PrimaryTimePeriodId { get; set; }
    public TimePeriod? PrimaryTimePeriod { get; set; }

    public string? SourceSheet { get; set; }
    public int? SourceRow { get; set; }

    public ICollection<EntryTranslation> Translations { get; set; } = [];
    public ICollection<EntryTag> Tags { get; set; } = [];
    public ICollection<EntryTimePeriod> TimePeriods { get; set; } = [];
    public ICollection<EntryPlace> Places { get; set; } = [];
    public ICollection<EntryRoute> Routes { get; set; } = [];
    public ICollection<EntryActor> Actors { get; set; } = [];
    public ICollection<EntryRelationship> OutgoingRelationships { get; set; } = [];
    public ICollection<EntryRelationship> IncomingRelationships { get; set; } = [];
    public ICollection<EntrySource> Sources { get; set; } = [];
    public ICollection<EntryImage> Images { get; set; } = [];
    public ICollection<EntryAudioTrack> AudioTracks { get; set; } = [];
}
