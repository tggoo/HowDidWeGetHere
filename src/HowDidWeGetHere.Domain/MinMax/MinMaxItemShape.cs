using HowDidWeGetHere.Domain.Common;
using NetTopologySuite.Geometries;

namespace HowDidWeGetHere.Domain.MinMax;

public sealed class MinMaxItemShape : Entity
{
    public Guid MinMaxItemId { get; set; }
    public MinMaxItem MinMaxItem { get; set; } = null!;

    public string Kind { get; set; } = "Point";
    public Geometry Geometry { get; set; } = null!;
    public int SortOrder { get; set; }
}
