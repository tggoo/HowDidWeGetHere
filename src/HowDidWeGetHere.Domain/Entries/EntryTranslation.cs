namespace HowDidWeGetHere.Domain.Entries;

public sealed class EntryTranslation
{
    public Guid EntryId { get; set; }
    public Entry Entry { get; set; } = null!;

    public string LanguageCode { get; set; } = "en";
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? Description { get; set; }
    public string? WhyItMatters { get; set; }
    public string? DatingNote { get; set; }
}

