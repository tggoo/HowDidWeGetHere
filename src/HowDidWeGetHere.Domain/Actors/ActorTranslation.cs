namespace HowDidWeGetHere.Domain.Actors;

public sealed class ActorTranslation
{
    public Guid ActorId { get; set; }
    public Actor Actor { get; set; } = null!;

    public string LanguageCode { get; set; } = "en";
    public string Name { get; set; } = string.Empty;
    public string? ShortDescription { get; set; }
}

