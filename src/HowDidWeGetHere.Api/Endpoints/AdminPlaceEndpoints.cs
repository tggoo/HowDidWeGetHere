using System.Security.Claims;
using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Domain.Places;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminPlaceEndpoints
{
    private const int Wgs84Srid = 4326;

    public static RouteGroupBuilder MapAdminPlaceEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapPost("/entries/{entryId:guid}/places", AddEntryPlaceAsync)
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        return admin;
    }

    private static async Task<IResult> AddEntryPlaceAsync(
        Guid entryId,
        AdminEntryPlaceRequest request,
        HistoryDbContext dbContext,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.BadRequest(new { error = "Place name is required." });
        }

        if (request.Longitude is < -180 or > 180 || request.Latitude is < -90 or > 90)
        {
            return Results.BadRequest(new { error = "Longitude must be between -180 and 180 and latitude between -90 and 90." });
        }

        var entryExists = await dbContext.Entries.AnyAsync(entry => entry.Id == entryId, cancellationToken);
        if (!entryExists)
        {
            return Results.NotFound();
        }

        var requestedSlug = EndpointHelpers.Slugify(request.Slug ?? request.Name);
        var place = await dbContext.Places
            .Include(item => item.Translations)
            .FirstOrDefaultAsync(item => item.Slug == requestedSlug, cancellationToken);

        if (place is null)
        {
            place = new Place
            {
                Slug = MakeUniquePlaceSlug(requestedSlug, dbContext),
                DefaultName = request.Name.Trim(),
                PlaceType = request.PlaceType,
                SpatialConfidence = request.SpatialConfidence,
                Geometry = new Point(request.Longitude, request.Latitude) { SRID = Wgs84Srid },
                ModernCountryCode = string.IsNullOrWhiteSpace(request.ModernCountryCode)
                    ? null
                    : request.ModernCountryCode.Trim().ToUpperInvariant(),
                WikidataId = string.IsNullOrWhiteSpace(request.WikidataId) ? null : request.WikidataId.Trim(),
                GeoNamesId = request.GeoNamesId,
                CreatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier),
                Translations =
                [
                    new PlaceTranslation
                    {
                        LanguageCode = EndpointHelpers.NormalizeLanguage(request.LanguageCode),
                        Name = request.Name.Trim()
                    }
                ]
            };

            dbContext.Places.Add(place);
        }
        else
        {
            place.DefaultName = request.Name.Trim();
            place.PlaceType = request.PlaceType;
            place.SpatialConfidence = request.SpatialConfidence;
            place.Geometry = new Point(request.Longitude, request.Latitude) { SRID = Wgs84Srid };
            place.ModernCountryCode = string.IsNullOrWhiteSpace(request.ModernCountryCode)
                ? null
                : request.ModernCountryCode.Trim().ToUpperInvariant();
            place.WikidataId = string.IsNullOrWhiteSpace(request.WikidataId) ? null : request.WikidataId.Trim();
            place.GeoNamesId = request.GeoNamesId;
            place.UpdatedAt = DateTimeOffset.UtcNow;
            place.UpdatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);

            var language = EndpointHelpers.NormalizeLanguage(request.LanguageCode);
            var translation = place.Translations.FirstOrDefault(item => item.LanguageCode == language);
            if (translation is null)
            {
                place.Translations.Add(new PlaceTranslation
                {
                    LanguageCode = language,
                    Name = request.Name.Trim()
                });
            }
            else
            {
                translation.Name = request.Name.Trim();
            }
        }

        var entryPlace = await dbContext.EntryPlaces
            .FirstOrDefaultAsync(
                item => item.EntryId == entryId &&
                    item.PlaceId == place.Id &&
                    item.Role == request.Role,
                cancellationToken);

        if (entryPlace is null)
        {
            dbContext.EntryPlaces.Add(new EntryPlace
            {
                EntryId = entryId,
                Place = place,
                Role = request.Role,
                SortOrder = request.SortOrder,
                Note = request.Note
            });
        }
        else
        {
            entryPlace.SortOrder = request.SortOrder;
            entryPlace.Note = request.Note;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/admin/entries/{entryId}/places/{place.Id}", new ResourceCreatedResponse(place.Id, place.Slug));
    }

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
