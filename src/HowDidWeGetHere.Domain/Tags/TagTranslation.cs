namespace HowDidWeGetHere.Domain.Tags;

public sealed class TagTranslation
{
    public Guid TagId { get; set; }
    public Tag Tag { get; set; } = null!;

    public string LanguageCode { get; set; } = "en";
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

