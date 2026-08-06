namespace HowDidWeGetHere.Domain.MinMax;

public sealed class MinMaxItemTranslation
{
    public Guid MinMaxItemId { get; set; }
    public MinMaxItem MinMaxItem { get; set; } = null!;

    public string LanguageCode { get; set; } = "en";
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string? TypeLabel { get; set; }
    public string? ValueLabel { get; set; }
    public string? Summary { get; set; }
    public string? MapNote { get; set; }
    public string? FactsJson { get; set; }
}
