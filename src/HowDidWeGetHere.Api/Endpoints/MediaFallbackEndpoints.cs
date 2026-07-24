using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;

namespace HowDidWeGetHere.Api.Endpoints;

public static class MediaFallbackEndpoints
{
    public static IEndpointRouteBuilder MapMediaFallbackEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/media/{**path}", ServeMediaFromDatabaseAsync)
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .ExcludeFromDescription();

        return endpoints;
    }

    private static async Task<IResult> ServeMediaFromDatabaseAsync(
        string path,
        HistoryDbContext dbContext,
        HttpResponse response,
        CancellationToken cancellationToken)
    {
        var storageKey = NormalizeStorageKey(path);
        if (storageKey is null)
        {
            return Results.NotFound();
        }

        var media = await dbContext.MediaBlobs
            .AsNoTracking()
            .Where(blob => blob.StorageKey == storageKey)
            .Select(blob => new
            {
                blob.Content,
                blob.ContentHash,
                blob.ContentType,
                blob.UpdatedAt,
                blob.CreatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (media is null)
        {
            return Results.NotFound();
        }

        response.Headers.CacheControl = "public, max-age=31536000, immutable";

        return Results.File(
            media.Content,
            media.ContentType,
            lastModified: media.UpdatedAt ?? media.CreatedAt,
            entityTag: new EntityTagHeaderValue($"\"{media.ContentHash}\""),
            enableRangeProcessing: true);
    }

    private static string? NormalizeStorageKey(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return null;
        }

        var normalizedPath = path.Replace('\\', '/').TrimStart('/');
        if (normalizedPath.Contains("../", StringComparison.Ordinal) ||
            normalizedPath.Contains("/..", StringComparison.Ordinal) ||
            normalizedPath.Equals("..", StringComparison.Ordinal))
        {
            return null;
        }

        return $"media/{normalizedPath}";
    }
}
