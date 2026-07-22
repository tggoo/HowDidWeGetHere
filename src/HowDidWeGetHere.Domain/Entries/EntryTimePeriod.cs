using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Domain.Entries;

public sealed class EntryTimePeriod
{
    public Guid EntryId { get; set; }
    public Entry Entry { get; set; } = null!;

    public Guid TimePeriodId { get; set; }
    public TimePeriod TimePeriod { get; set; } = null!;

    public PeriodMembershipType RelationType { get; set; } = PeriodMembershipType.BelongsTo;
    public decimal? Confidence { get; set; }
}

