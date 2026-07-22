using HowDidWeGetHere.Domain.Common;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Enums;
using NetTopologySuite.Geometries;

namespace HowDidWeGetHere.Domain.Routes;

public sealed class EntryRoute : AuditableEntity
{
    public Guid EntryId { get; set; }
    public Entry Entry { get; set; } = null!;

    public RouteType RouteType { get; set; } = RouteType.Journey;
    public string Name { get; set; } = string.Empty;
    public Geometry? Geometry { get; set; }
    public SpatialConfidence SpatialConfidence { get; set; } = SpatialConfidence.Unknown;
    public string? SourceNote { get; set; }

    public ICollection<RoutePoint> Points { get; set; } = [];
}

