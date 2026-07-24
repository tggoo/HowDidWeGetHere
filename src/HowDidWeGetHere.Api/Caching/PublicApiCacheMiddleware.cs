using System.Security.Cryptography;
using Microsoft.Net.Http.Headers;

namespace HowDidWeGetHere.Api.Caching;

public sealed class PublicApiCacheMiddleware(RequestDelegate next)
{
    private static readonly PathString ApiPrefix = new("/api");
    private static readonly PathString AdminPrefix = new("/api/admin");
    private static readonly PathString AuthPrefix = new("/api/auth");
    private static readonly PathString HealthPath = new("/api/health");
    private const string CacheControlValue = "public, max-age=60, stale-while-revalidate=900";

    public async Task InvokeAsync(HttpContext context)
    {
        if (!ShouldCache(context.Request))
        {
            await next(context);
            return;
        }

        var originalBody = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;

        try
        {
            await next(context);

            if (!IsCacheableResponse(context.Response))
            {
                await CopyResponseAsync(buffer, originalBody, context.RequestAborted);
                return;
            }

            var body = buffer.ToArray();
            var etag = CreateEtag(body);
            context.Response.Headers.ETag = etag;
            context.Response.Headers.CacheControl = CacheControlValue;

            if (RequestMatchesEtag(context.Request, etag))
            {
                context.Response.StatusCode = StatusCodes.Status304NotModified;
                context.Response.ContentLength = null;
                context.Response.Headers.ContentLength = null;
                return;
            }

            if (HttpMethods.IsHead(context.Request.Method))
            {
                return;
            }

            await originalBody.WriteAsync(body, context.RequestAborted);
        }
        finally
        {
            context.Response.Body = originalBody;
        }
    }

    private static bool ShouldCache(HttpRequest request) =>
        (HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method)) &&
        request.Path.StartsWithSegments(ApiPrefix) &&
        !request.Path.StartsWithSegments(AdminPrefix) &&
        !request.Path.StartsWithSegments(AuthPrefix) &&
        !request.Path.Equals(HealthPath);

    private static bool IsCacheableResponse(HttpResponse response) =>
        response.StatusCode == StatusCodes.Status200OK &&
        response.ContentType?.Contains("application/json", StringComparison.OrdinalIgnoreCase) == true;

    private static async Task CopyResponseAsync(MemoryStream buffer, Stream destination, CancellationToken cancellationToken)
    {
        buffer.Position = 0;
        await buffer.CopyToAsync(destination, cancellationToken);
    }

    private static string CreateEtag(byte[] body)
    {
        var hash = SHA256.HashData(body);
        return $"\"{Convert.ToHexString(hash).ToLowerInvariant()}\"";
    }

    private static bool RequestMatchesEtag(HttpRequest request, string etag)
    {
        if (!request.Headers.TryGetValue(HeaderNames.IfNoneMatch, out var values))
        {
            return false;
        }

        return values
            .SelectMany(value => value?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [])
            .Any(value => string.Equals(value, etag, StringComparison.Ordinal) || value == "*");
    }
}
