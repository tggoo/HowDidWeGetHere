namespace HowDidWeGetHere.Domain.Entries;

public sealed class EntryImageTranslation
{
    public Guid EntryImageId { get; set; }
    public EntryImage EntryImage { get; set; } = null!;

    public string LanguageCode { get; set; } = "en";
    public string? AltText { get; set; }
    public string? Caption { get; set; }
}

