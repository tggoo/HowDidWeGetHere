using HowDidWeGetHere.Domain.Common;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Domain.Routes;
using NetTopologySuite.Geometries;

namespace HowDidWeGetHere.Domain.Places;

public sealed class Place : AuditableEntity
{
    public string Slug { get; set; } = string.Empty;
    public PlaceType PlaceType { get; set; } = PlaceType.Region;
    public string DefaultName { get; set; } = string.Empty;
    public Geometry? Geometry { get; set; }
    public string? ModernCountryCode { get; set; }
    public string? WikidataId { get; set; }
    public int? GeoNamesId { get; set; }
    public SpatialConfidence SpatialConfidence { get; set; } = SpatialConfidence.Unknown;

    public ICollection<PlaceTranslation> Translations { get; set; } = [];
    public ICollection<EntryPlace> Entries { get; set; } = [];
    public ICollection<RoutePoint> RoutePoints { get; set; } = [];
    public ICollection<TimePeriod> ScopedTimePeriods { get; set; } = [];
}

