using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Domain.Places;

namespace HowDidWeGetHere.Domain.Routes;

public sealed class RoutePoint
{
    public Guid RouteId { get; set; }
    public EntryRoute Route { get; set; } = null!;

    public Guid PlaceId { get; set; }
    public Place Place { get; set; } = null!;

    public int SortOrder { get; set; }
    public RoutePointRole Role { get; set; } = RoutePointRole.Stop;
    public string? DateLabel { get; set; }
    public string? Note { get; set; }
}

