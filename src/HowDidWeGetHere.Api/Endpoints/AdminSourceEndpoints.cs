using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Sources;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminSourceEndpoints
{
    public static RouteGroupBuilder MapAdminSourceEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapPost("/entries/{entryId:guid}/sources", AddEntrySourceAsync)
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        return admin;
    }

    private static async Task<IResult> AddEntrySourceAsync(
        Guid entryId,
        AdminEntrySourceRequest request,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(request.Url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return Results.BadRequest(new { error = "Valid source URL is required." });
        }

        var entryExists = await dbContext.Entries.AnyAsync(entry => entry.Id == entryId, cancellationToken);
        if (!entryExists)
        {
            return Results.NotFound();
        }

        var sourceUrl = request.Url.Trim();
        var source = await dbContext.Sources.FirstOrDefaultAsync(item => item.Url == sourceUrl, cancellationToken);
        if (source is null)
        {
            source = new Source
            {
                Url = sourceUrl,
                Title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim(),
                Publisher = string.IsNullOrWhiteSpace(request.Publisher) ? null : request.Publisher.Trim(),
                LanguageCode = EndpointHelpers.NormalizeLanguage(request.LanguageCode),
                AccessedAt = DateTimeOffset.UtcNow
            };
            dbContext.Sources.Add(source);
        }
        else
        {
            source.Title = string.IsNullOrWhiteSpace(request.Title) ? source.Title : request.Title.Trim();
            source.Publisher = string.IsNullOrWhiteSpace(request.Publisher) ? source.Publisher : request.Publisher.Trim();
            source.LanguageCode = string.IsNullOrWhiteSpace(request.LanguageCode)
                ? source.LanguageCode
                : EndpointHelpers.NormalizeLanguage(request.LanguageCode);
            source.AccessedAt ??= DateTimeOffset.UtcNow;
        }

        var entrySource = await dbContext.EntrySources.FirstOrDefaultAsync(
            item => item.EntryId == entryId &&
                item.SourceId == source.Id &&
                item.SupportsField == request.SupportsField,
            cancellationToken);

        if (entrySource is null)
        {
            dbContext.EntrySources.Add(new EntrySource
            {
                EntryId = entryId,
                Source = source,
                SupportsField = request.SupportsField,
                Note = request.Note
            });
        }
        else
        {
            entrySource.Note = request.Note;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/admin/entries/{entryId}/sources/{source.Id}", new ResourceCreatedResponse(source.Id, null));
    }
}
