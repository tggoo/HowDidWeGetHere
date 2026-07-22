using HowDidWeGetHere.Domain.Common;
using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Domain.Places;

namespace HowDidWeGetHere.Domain.Entries;

public sealed class TimePeriod : AuditableEntity
{
    public string Slug { get; set; } = string.Empty;
    public TimePeriodType PeriodType { get; set; } = TimePeriodType.Era;

    public Guid? ParentPeriodId { get; set; }
    public TimePeriod? ParentPeriod { get; set; }

    public long? StartYear { get; set; }
    public long? EndYear { get; set; }
    public TimePrecision StartPrecision { get; set; } = TimePrecision.Unknown;
    public TimePrecision EndPrecision { get; set; } = TimePrecision.Unknown;

    public Guid? ScopePlaceId { get; set; }
    public Place? ScopePlace { get; set; }

    public Guid? EntryId { get; set; }
    public Entry? Entry { get; set; }

    public int SortOrder { get; set; }

    public ICollection<TimePeriod> Children { get; set; } = [];
    public ICollection<TimePeriodTranslation> Translations { get; set; } = [];
    public ICollection<EntryTimePeriod> Entries { get; set; } = [];
}

