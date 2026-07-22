namespace HowDidWeGetHere.Domain.Entries;

public sealed class TimePeriodTranslation
{
    public Guid TimePeriodId { get; set; }
    public TimePeriod TimePeriod { get; set; } = null!;

    public string LanguageCode { get; set; } = "en";
    public string Name { get; set; } = string.Empty;
    public string? ShortDescription { get; set; }
    public string? LongDescription { get; set; }
}

