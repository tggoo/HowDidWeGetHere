using HowDidWeGetHere.Domain.Common;

namespace HowDidWeGetHere.Domain.MinMax;

public sealed class MinMaxItem : AuditableEntity
{
    public string Slug { get; set; } = string.Empty;
    public string Category { get; set; } = "general";
    public string DefaultTitle { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    public ICollection<MinMaxItemTranslation> Translations { get; set; } = [];
    public ICollection<MinMaxItemShape> Shapes { get; set; } = [];
}
