namespace HowDidWeGetHere.Domain.Places;

public sealed class PlaceTranslation
{
    public Guid PlaceId { get; set; }
    public Place Place { get; set; } = null!;

    public string LanguageCode { get; set; } = "en";
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

