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

        admin.MapPut("/entries/{entryId:guid}/images/{imageId:guid}", UpdateImageAsync)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        admin.MapDelete("/entries/{entryId:guid}/images/{imageId:guid}", DeleteImageAsync)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound);

        admin.MapPost("/entries/{entryId:guid}/audio-tracks", AddAudioTrackAsync)
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        admin.MapPut("/entries/{entryId:guid}/audio-tracks/{audioTrackId:guid}", UpdateAudioTrackAsync)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        admin.MapDelete("/entries/{entryId:guid}/audio-tracks/{audioTrackId:guid}", DeleteAudioTrackAsync)
            .Produces(StatusCodes.Status204NoContent)
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

        var validationError = ValidateMediaRequest(request.StorageKey, request.PublicUrl);
        if (validationError is not null)
        {
            return Results.BadRequest(new { error = validationError });
        }

        var image = new EntryImage
        {
            EntryId = entryId,
            CreatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier),
        };
        ApplyImageRequest(image, request);

        dbContext.EntryImages.Add(image);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/admin/entries/{entryId}/images/{image.Id}", new ResourceCreatedResponse(image.Id, null));
    }

    private static async Task<IResult> UpdateImageAsync(
        Guid entryId,
        Guid imageId,
        AdminEntryImageRequest request,
        HistoryDbContext dbContext,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var validationError = ValidateMediaRequest(request.StorageKey, request.PublicUrl);
        if (validationError is not null)
        {
            return Results.BadRequest(new { error = validationError });
        }

        var image = await dbContext.EntryImages
            .Include(item => item.Translations)
            .FirstOrDefaultAsync(item => item.Id == imageId && item.EntryId == entryId, cancellationToken);
        if (image is null)
        {
            return Results.NotFound();
        }

        ApplyImageRequest(image, request);
        image.UpdatedAt = DateTimeOffset.UtcNow;
        image.UpdatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteImageAsync(
        Guid entryId,
        Guid imageId,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var image = await dbContext.EntryImages
            .Include(item => item.Translations)
            .FirstOrDefaultAsync(item => item.Id == imageId && item.EntryId == entryId, cancellationToken);
        if (image is null)
        {
            return Results.NotFound();
        }

        dbContext.EntryImageTranslations.RemoveRange(image.Translations);
        dbContext.EntryImages.Remove(image);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
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

        var validationError = ValidateMediaRequest(request.StorageKey, request.PublicUrl);
        if (validationError is not null)
        {
            return Results.BadRequest(new { error = validationError });
        }

        var audioTrack = new EntryAudioTrack
        {
            EntryId = entryId,
            CreatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        };
        ApplyAudioTrackRequest(audioTrack, request);

        dbContext.EntryAudioTracks.Add(audioTrack);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/admin/entries/{entryId}/audio-tracks/{audioTrack.Id}", new ResourceCreatedResponse(audioTrack.Id, null));
    }

    private static async Task<IResult> UpdateAudioTrackAsync(
        Guid entryId,
        Guid audioTrackId,
        AdminEntryAudioTrackRequest request,
        HistoryDbContext dbContext,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var validationError = ValidateMediaRequest(request.StorageKey, request.PublicUrl);
        if (validationError is not null)
        {
            return Results.BadRequest(new { error = validationError });
        }

        var audioTrack = await dbContext.EntryAudioTracks
            .FirstOrDefaultAsync(item => item.Id == audioTrackId && item.EntryId == entryId, cancellationToken);
        if (audioTrack is null)
        {
            return Results.NotFound();
        }

        ApplyAudioTrackRequest(audioTrack, request);
        audioTrack.UpdatedAt = DateTimeOffset.UtcNow;
        audioTrack.UpdatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteAudioTrackAsync(
        Guid entryId,
        Guid audioTrackId,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var audioTrack = await dbContext.EntryAudioTracks
            .FirstOrDefaultAsync(item => item.Id == audioTrackId && item.EntryId == entryId, cancellationToken);
        if (audioTrack is null)
        {
            return Results.NotFound();
        }

        dbContext.EntryAudioTracks.Remove(audioTrack);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }

    private static string? ValidateMediaRequest(string? storageKey, string? publicUrl) =>
        string.IsNullOrWhiteSpace(storageKey) && string.IsNullOrWhiteSpace(publicUrl)
            ? "StorageKey or PublicUrl is required."
            : null;

    private static void ApplyImageRequest(EntryImage image, AdminEntryImageRequest request)
    {
        image.Kind = request.Kind;
        image.StorageProvider = request.StorageProvider;
        image.StorageKey = request.StorageKey ?? request.PublicUrl!;
        image.PublicUrl = request.PublicUrl;
        image.MediaType = request.MediaType;
        image.Width = request.Width;
        image.Height = request.Height;
        image.SortOrder = request.SortOrder;
        image.IsPrimary = request.IsPrimary;
        image.Attribution = request.Attribution;
        image.License = request.License;
        image.SourceUrl = request.SourceUrl;

        var language = EndpointHelpers.NormalizeLanguage(request.LanguageCode);
        var translation = image.Translations.FirstOrDefault(item => item.LanguageCode == language);
        if (translation is null)
        {
            image.Translations.Add(new EntryImageTranslation
            {
                LanguageCode = language,
                AltText = request.AltText,
                Caption = request.Caption
            });
        }
        else
        {
            translation.AltText = request.AltText;
            translation.Caption = request.Caption;
        }
    }

    private static void ApplyAudioTrackRequest(EntryAudioTrack audioTrack, AdminEntryAudioTrackRequest request)
    {
        audioTrack.LanguageCode = EndpointHelpers.NormalizeLanguage(request.LanguageCode);
        audioTrack.Kind = request.Kind;
        audioTrack.StorageProvider = request.StorageProvider;
        audioTrack.StorageKey = request.StorageKey ?? request.PublicUrl!;
        audioTrack.PublicUrl = request.PublicUrl;
        audioTrack.MediaType = request.MediaType;
        audioTrack.DurationSeconds = request.DurationSeconds;
        audioTrack.SortOrder = request.SortOrder;
        audioTrack.IsPrimary = request.IsPrimary;
        audioTrack.Title = request.Title;
        audioTrack.Transcript = request.Transcript;
        audioTrack.Attribution = request.Attribution;
        audioTrack.License = request.License;
        audioTrack.SourceUrl = request.SourceUrl;
    }
}
