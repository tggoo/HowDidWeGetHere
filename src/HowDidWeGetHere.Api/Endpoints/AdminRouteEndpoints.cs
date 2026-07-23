using System.Security.Claims;
using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Domain.Places;
using HowDidWeGetHere.Domain.Routes;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Geometries;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminRouteEndpoints
{
    private const int Wgs84Srid = 4326;
    private static readonly GeometryFactory GeometryFactory =
        NtsGeometryServices.Instance.CreateGeometryFactory(srid: Wgs84Srid);

    public static RouteGroupBuilder MapAdminRouteEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapPost("/entries/{entryId:guid}/routes", AddEntryRouteAsync)
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        return admin;
    }

    private static async Task<IResult> AddEntryRouteAsync(
        Guid entryId,
        AdminEntryRouteRequest request,
        HistoryDbContext dbContext,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.BadRequest(new { error = "Route name is required." });
        }

        if (request.Points.Count < 2)
        {
            return Results.BadRequest(new { error = "Route requires at least two points." });
        }

        foreach (var point in request.Points)
        {
            if (string.IsNullOrWhiteSpace(point.Name))
            {
                return Results.BadRequest(new { error = "Every route point requires a place name." });
            }

            if (point.Longitude is < -180 or > 180 || point.Latitude is < -90 or > 90)
            {
                return Results.BadRequest(new { error = "Longitude must be between -180 and 180 and latitude between -90 and 90." });
            }
        }

        var entryExists = await dbContext.Entries.AnyAsync(entry => entry.Id == entryId, cancellationToken);
        if (!entryExists)
        {
            return Results.NotFound();
        }

        var language = EndpointHelpers.NormalizeLanguage(request.LanguageCode);
        var createdByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        var route = new EntryRoute
        {
            EntryId = entryId,
            Name = request.Name.Trim(),
            RouteType = request.RouteType,
            SpatialConfidence = request.SpatialConfidence,
            SourceNote = request.SourceNote,
            CreatedByUserId = createdByUserId
        };

        var orderedPoints = request.Points
            .OrderBy(point => point.SortOrder)
            .ThenBy(point => point.Name)
            .ToList();

        foreach (var point in orderedPoints)
        {
            var place = await UpsertPlaceAsync(point, language, createdByUserId, dbContext, cancellationToken);
            route.Points.Add(new RoutePoint
            {
                Route = route,
                Place = place,
                SortOrder = point.SortOrder,
                Role = point.Role,
                DateLabel = point.DateLabel,
                Note = point.Note
            });

            var entryPlaceRole = ToEntryPlaceRole(point.Role);
            var entryPlace = await dbContext.EntryPlaces.FirstOrDefaultAsync(
                item => item.EntryId == entryId &&
                    item.PlaceId == place.Id &&
                    item.Role == entryPlaceRole,
                cancellationToken);

            if (entryPlace is null)
            {
                dbContext.EntryPlaces.Add(new EntryPlace
                {
                    EntryId = entryId,
                    Place = place,
                    Role = entryPlaceRole,
                    SortOrder = point.SortOrder,
                    Note = point.Note
                });
            }
            else
            {
                entryPlace.SortOrder = point.SortOrder;
                entryPlace.Note = point.Note;
            }
        }

        route.Geometry = GeometryFactory.CreateLineString(
            orderedPoints
                .Select(point => new Coordinate(point.Longitude, point.Latitude))
                .ToArray());

        dbContext.EntryRoutes.Add(route);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/admin/entries/{entryId}/routes/{route.Id}", new ResourceCreatedResponse(route.Id, null));
    }

    private static async Task<Place> UpsertPlaceAsync(
        AdminEntryRoutePointRequest point,
        string language,
        string? userId,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var requestedSlug = EndpointHelpers.Slugify(point.Slug ?? point.Name);
        var place = await dbContext.Places
            .Include(item => item.Translations)
            .FirstOrDefaultAsync(item => item.Slug == requestedSlug, cancellationToken);

        if (place is null)
        {
            place = new Place
            {
                Slug = MakeUniquePlaceSlug(requestedSlug, dbContext),
                DefaultName = point.Name.Trim(),
                PlaceType = point.PlaceType,
                SpatialConfidence = point.SpatialConfidence,
                Geometry = GeometryFactory.CreatePoint(new Coordinate(point.Longitude, point.Latitude)),
                ModernCountryCode = string.IsNullOrWhiteSpace(point.ModernCountryCode)
                    ? null
                    : point.ModernCountryCode.Trim().ToUpperInvariant(),
                WikidataId = string.IsNullOrWhiteSpace(point.WikidataId) ? null : point.WikidataId.Trim(),
                GeoNamesId = point.GeoNamesId,
                CreatedByUserId = userId,
                Translations =
                [
                    new PlaceTranslation
                    {
                        LanguageCode = language,
                        Name = point.Name.Trim()
                    }
                ]
            };

            dbContext.Places.Add(place);
            return place;
        }

        place.DefaultName = point.Name.Trim();
        place.PlaceType = point.PlaceType;
        place.SpatialConfidence = point.SpatialConfidence;
        place.Geometry = GeometryFactory.CreatePoint(new Coordinate(point.Longitude, point.Latitude));
        place.ModernCountryCode = string.IsNullOrWhiteSpace(point.ModernCountryCode)
            ? null
            : point.ModernCountryCode.Trim().ToUpperInvariant();
        place.WikidataId = string.IsNullOrWhiteSpace(point.WikidataId) ? null : point.WikidataId.Trim();
        place.GeoNamesId = point.GeoNamesId;
        place.UpdatedAt = DateTimeOffset.UtcNow;
        place.UpdatedByUserId = userId;

        var translation = place.Translations.FirstOrDefault(item => item.LanguageCode == language);
        if (translation is null)
        {
            place.Translations.Add(new PlaceTranslation
            {
                LanguageCode = language,
                Name = point.Name.Trim()
            });
        }
        else
        {
            translation.Name = point.Name.Trim();
        }

        return place;
    }

    private static EntryPlaceRole ToEntryPlaceRole(RoutePointRole role) =>
        role switch
        {
            RoutePointRole.Start => EntryPlaceRole.Origin,
            RoutePointRole.End => EntryPlaceRole.Destination,
            RoutePointRole.Summit => EntryPlaceRole.Destination,
            RoutePointRole.BaseCamp => EntryPlaceRole.Stop,
            RoutePointRole.Stop => EntryPlaceRole.Stop,
            RoutePointRole.Approximate => EntryPlaceRole.MainSite,
            _ => EntryPlaceRole.Other
        };

    private static string MakeUniquePlaceSlug(string baseSlug, HistoryDbContext dbContext)
    {
        var slug = string.IsNullOrWhiteSpace(baseSlug) ? Guid.NewGuid().ToString("n") : baseSlug;
        var uniqueSlug = slug;
        var suffix = 2;

        while (dbContext.Places.Any(place => place.Slug == uniqueSlug))
        {
            uniqueSlug = $"{slug}-{suffix}";
            suffix++;
        }

        return uniqueSlug;
    }
}
