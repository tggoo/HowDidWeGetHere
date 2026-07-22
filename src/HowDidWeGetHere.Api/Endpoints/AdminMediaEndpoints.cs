using System.Security.Claims;
using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminMediaEndpoints
{
    public static RouteGroupBuilder MapAdminMediaEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapPost("/entries/{entryId:guid}/images", AddImageAsync)
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        admin.MapPost("/entries/{entryId:guid}/audio-tracks", AddAudioTrackAsync)
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        return admin;
    }

    private static async Task<IResult> AddImageAsync(
        Guid entryId,
        AdminEntryImageRequest request,
        HistoryDbContext dbContext,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var exists = await dbContext.Entries.AnyAsync(entry => entry.Id == entryId, cancellationToken);
        if (!exists)
        {
            return Results.NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.StorageKey) && string.IsNullOrWhiteSpace(request.PublicUrl))
        {
            return Results.BadRequest(new { error = "StorageKey or PublicUrl is required." });
        }

        var image = new EntryImage
        {
            EntryId = entryId,
            Kind = request.Kind,
            StorageProvider = request.StorageProvider,
            StorageKey = request.StorageKey ?? request.PublicUrl!,
            PublicUrl = request.PublicUrl,
            MediaType = request.MediaType,
            Width = request.Width,
            Height = request.Height,
            SortOrder = request.SortOrder,
            IsPrimary = request.IsPrimary,
            Attribution = request.Attribution,
            License = request.License,
            SourceUrl = request.SourceUrl,
            CreatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier),
            Translations =
            [
                new EntryImageTranslation
                {
                    LanguageCode = EndpointHelpers.NormalizeLanguage(request.LanguageCode),
                    AltText = request.AltText,
                    Caption = request.Caption
                }
            ]
        };

        dbContext.EntryImages.Add(image);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/admin/entries/{entryId}/images/{image.Id}", new ResourceCreatedResponse(image.Id, null));
    }

    private static async Task<IResult> AddAudioTrackAsync(
        Guid entryId,
        AdminEntryAudioTrackRequest request,
        HistoryDbContext dbContext,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var exists = await dbContext.Entries.AnyAsync(entry => entry.Id == entryId, cancellationToken);
        if (!exists)
        {
            return Results.NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.StorageKey) && string.IsNullOrWhiteSpace(request.PublicUrl))
        {
            return Results.BadRequest(new { error = "StorageKey or PublicUrl is required." });
        }

        var audioTrack = new EntryAudioTrack
        {
            EntryId = entryId,
            LanguageCode = EndpointHelpers.NormalizeLanguage(request.LanguageCode),
            Kind = request.Kind,
            StorageProvider = request.StorageProvider,
            StorageKey = request.StorageKey ?? request.PublicUrl!,
            PublicUrl = request.PublicUrl,
            MediaType = request.MediaType,
            DurationSeconds = request.DurationSeconds,
            SortOrder = request.SortOrder,
            IsPrimary = request.IsPrimary,
            Title = request.Title,
            Transcript = request.Transcript,
            Attribution = request.Attribution,
            License = request.License,
            SourceUrl = request.SourceUrl,
            CreatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        };

        dbContext.EntryAudioTracks.Add(audioTrack);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/admin/entries/{entryId}/audio-tracks/{audioTrack.Id}", new ResourceCreatedResponse(audioTrack.Id, null));
    }
}

