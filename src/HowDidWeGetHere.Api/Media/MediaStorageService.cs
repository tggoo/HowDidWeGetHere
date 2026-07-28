using System.Security.Cryptography;
using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Domain.Media;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HowDidWeGetHere.Api.Media;

public sealed class MediaStorageService(
    HistoryDbContext dbContext,
    IWebHostEnvironment environment,
    IOptions<MediaStorageOptions> options,
    S3ObjectStorageClient s3Client,
    GitHubReleaseStorageClient gitHubClient) : IMediaStorageService
{
    private const int CopyBufferSize = 81920;

    public async Task<StoredMediaFile> StoreAsync(
        Stream sourceStream,
        string fileName,
        string? contentType,
        string mediaFolder,
        HttpRequest httpRequest,
        CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        var resolvedContentType = string.IsNullOrWhiteSpace(contentType)
            ? "application/octet-stream"
            : contentType;
        await using var tempFile = TempMediaFile.Create();
        var mediaIdentity = await CopyToTempFileAsync(sourceStream, tempFile.Path, cancellationToken);

        if (IsGitHubReleaseMode())
        {
            return await StoreGitHubReleaseAsync(tempFile.Path, extension, resolvedContentType, mediaIdentity, httpRequest, cancellationToken);
        }

        if (IsS3Mode())
        {
            return await StoreS3Async(tempFile.Path, extension, resolvedContentType, mediaIdentity, httpRequest, cancellationToken);
        }

        return await StoreLocalAsync(tempFile.Path, extension, resolvedContentType, mediaFolder, mediaIdentity, httpRequest, cancellationToken);
    }

    public Uri? CreateReadUri(MediaBlob mediaBlob) =>
        mediaBlob.StorageProvider switch
        {
            StorageProvider.S3 => s3Client.CreatePresignedGetUri(mediaBlob.StorageKey),
            StorageProvider.GitHubRelease when !string.IsNullOrWhiteSpace(mediaBlob.ExternalUrl) => new Uri(mediaBlob.ExternalUrl),
            _ => null
        };

    private async Task<StoredMediaFile> StoreS3Async(
        string tempPath,
        string extension,
        string contentType,
        MediaIdentity mediaIdentity,
        HttpRequest httpRequest,
        CancellationToken cancellationToken)
    {
        var existing = await FindExistingByHashAsync(
            StorageProvider.S3,
            mediaIdentity.ContentHash,
            mediaIdentity.ContentLength,
            cancellationToken);
        if (existing is not null)
        {
            return ToStoredMediaFile(existing, httpRequest);
        }

        var storageKey = BuildContentAddressedStorageKey(mediaIdentity.ContentHash, extension);
        var tracked = dbContext.MediaBlobs.Local.FirstOrDefault(blob =>
            blob.StorageProvider == StorageProvider.S3 &&
            blob.StorageKey == storageKey);
        if (tracked is not null)
        {
            return ToStoredMediaFile(tracked, httpRequest);
        }

        var externalETag = await s3Client.PutObjectAsync(
            storageKey,
            tempPath,
            contentType,
            mediaIdentity.ContentHash,
            mediaIdentity.ContentLength,
            cancellationToken);

        var mediaBlob = new MediaBlob
        {
            StorageProvider = StorageProvider.S3,
            StorageKey = storageKey,
            ContentType = contentType,
            Content = null,
            ContentLength = mediaIdentity.ContentLength,
            ContentHash = mediaIdentity.ContentHash,
            ExternalId = null,
            ExternalUrl = null,
            ExternalETag = externalETag
        };
        dbContext.MediaBlobs.Add(mediaBlob);

        return ToStoredMediaFile(mediaBlob, httpRequest);
    }

    private async Task<StoredMediaFile> StoreGitHubReleaseAsync(
        string tempPath,
        string extension,
        string contentType,
        MediaIdentity mediaIdentity,
        HttpRequest httpRequest,
        CancellationToken cancellationToken)
    {
        var existing = await FindExistingByHashAsync(
            StorageProvider.GitHubRelease,
            mediaIdentity.ContentHash,
            mediaIdentity.ContentLength,
            cancellationToken);
        if (existing is not null)
        {
            return ToStoredMediaFile(existing, httpRequest);
        }

        var storageKey = BuildContentAddressedStorageKey(mediaIdentity.ContentHash, extension);
        var tracked = dbContext.MediaBlobs.Local.FirstOrDefault(blob =>
            blob.StorageProvider == StorageProvider.GitHubRelease &&
            blob.StorageKey == storageKey);
        if (tracked is not null)
        {
            return ToStoredMediaFile(tracked, httpRequest);
        }

        var asset = await gitHubClient.UploadAssetAsync(
            BuildGitHubAssetName(mediaIdentity.ContentHash, extension),
            tempPath,
            contentType,
            mediaIdentity.ContentLength,
            cancellationToken);

        var mediaBlob = new MediaBlob
        {
            StorageProvider = StorageProvider.GitHubRelease,
            StorageKey = storageKey,
            ContentType = contentType,
            Content = null,
            ContentLength = mediaIdentity.ContentLength,
            ContentHash = mediaIdentity.ContentHash,
            ExternalId = asset.Id.ToString(),
            ExternalUrl = asset.BrowserDownloadUrl,
            ExternalETag = asset.Digest
        };
        dbContext.MediaBlobs.Add(mediaBlob);

        return ToStoredMediaFile(mediaBlob, httpRequest);
    }

    private async Task<StoredMediaFile> StoreLocalAsync(
        string tempPath,
        string extension,
        string contentType,
        string mediaFolder,
        MediaIdentity mediaIdentity,
        HttpRequest httpRequest,
        CancellationToken cancellationToken)
    {
        var storageKey = Path.Combine(
                "media",
                mediaFolder,
                DateTimeOffset.UtcNow.ToString("yyyy"),
                DateTimeOffset.UtcNow.ToString("MM"),
                $"{Guid.NewGuid():N}{extension}")
            .Replace('\\', '/');

        var staticRoot = GetStaticRoot();
        var fullPath = Path.GetFullPath(Path.Combine(staticRoot, storageKey.Replace('/', Path.DirectorySeparatorChar)));
        EnsurePathIsInsideRoot(staticRoot, fullPath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        await using (var source = File.OpenRead(tempPath))
        await using (var target = File.Create(fullPath))
        {
            await source.CopyToAsync(target, cancellationToken);
        }

        byte[]? content = null;
        if (options.Value.StoreLocalCopiesInDatabase)
        {
            content = await File.ReadAllBytesAsync(tempPath, cancellationToken);
        }

        UpsertMediaMetadata(
            StorageProvider.Local,
            storageKey,
            contentType,
            mediaIdentity.ContentLength,
            mediaIdentity.ContentHash,
            content,
            externalId: null,
            externalUrl: null,
            externalETag: null);

        return new StoredMediaFile(
            StorageProvider.Local,
            storageKey,
            BuildPublicUrl("/" + storageKey, httpRequest),
            contentType,
            mediaIdentity.ContentLength,
            mediaIdentity.ContentHash);
    }

    private void UpsertMediaMetadata(
        StorageProvider provider,
        string storageKey,
        string contentType,
        long contentLength,
        string contentHash,
        byte[]? content,
        string? externalId,
        string? externalUrl,
        string? externalETag)
    {
        var existing = dbContext.MediaBlobs.Local.FirstOrDefault(blob =>
            blob.StorageProvider == provider &&
            blob.StorageKey == storageKey);
        if (existing is null)
        {
            dbContext.MediaBlobs.Add(new MediaBlob
            {
                StorageProvider = provider,
                StorageKey = storageKey,
                ContentType = contentType,
                Content = content,
                ContentLength = contentLength,
                ContentHash = contentHash,
                ExternalId = externalId,
                ExternalUrl = externalUrl,
                ExternalETag = externalETag
            });
            return;
        }

        existing.ContentType = contentType;
        existing.Content = content;
        existing.ContentLength = contentLength;
        existing.ContentHash = contentHash;
        existing.ExternalId = externalId;
        existing.ExternalUrl = externalUrl;
        existing.ExternalETag = externalETag;
        existing.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private async Task<MediaBlob?> FindExistingByHashAsync(
        StorageProvider provider,
        string contentHash,
        long contentLength,
        CancellationToken cancellationToken)
    {
        var tracked = dbContext.MediaBlobs.Local.FirstOrDefault(blob =>
            blob.StorageProvider == provider &&
            blob.ContentHash == contentHash &&
            blob.ContentLength == contentLength);
        if (tracked is not null)
        {
            return tracked;
        }

        return await dbContext.MediaBlobs
            .AsNoTracking()
            .Where(blob =>
                blob.StorageProvider == provider &&
                blob.ContentHash == contentHash &&
                blob.ContentLength == contentLength)
            .OrderBy(blob => blob.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private StoredMediaFile ToStoredMediaFile(MediaBlob mediaBlob, HttpRequest httpRequest) =>
        new(
            mediaBlob.StorageProvider,
            mediaBlob.StorageKey,
            BuildPublicUrl("/" + mediaBlob.StorageKey, httpRequest),
            mediaBlob.ContentType,
            mediaBlob.ContentLength,
            mediaBlob.ContentHash);

    private bool IsS3Mode() =>
        string.Equals(options.Value.StorageMode, "S3", StringComparison.OrdinalIgnoreCase);

    private bool IsGitHubReleaseMode() =>
        string.Equals(options.Value.StorageMode, "GitHubRelease", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(options.Value.StorageMode, "GitHubReleases", StringComparison.OrdinalIgnoreCase);

    private string GetStaticRoot()
    {
        var configuredRoot = options.Value.StorageRootPath;
        var root = string.IsNullOrWhiteSpace(configuredRoot)
            ? environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot")
            : configuredRoot;

        Directory.CreateDirectory(root);
        return Path.GetFullPath(root);
    }

    private static void EnsurePathIsInsideRoot(string root, string fullPath)
    {
        var normalizedRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        if (!fullPath.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Resolved upload path is outside the configured media root.");
        }
    }

    private string BuildPublicUrl(string publicPath, HttpRequest httpRequest)
    {
        var configuredBaseUrl = options.Value.PublicBaseUrl;
        if (!string.IsNullOrWhiteSpace(configuredBaseUrl))
        {
            return configuredBaseUrl.TrimEnd('/') + publicPath;
        }

        var forwardedProto = httpRequest.Headers["X-Forwarded-Proto"].FirstOrDefault();
        var forwardedHost = httpRequest.Headers["X-Forwarded-Host"].FirstOrDefault();
        var scheme = string.IsNullOrWhiteSpace(forwardedProto) ? httpRequest.Scheme : forwardedProto;
        var host = string.IsNullOrWhiteSpace(forwardedHost) ? httpRequest.Host.Value : forwardedHost;

        return $"{scheme}://{host}{publicPath}";
    }

    private static string BuildContentAddressedStorageKey(string contentHash, string extension)
    {
        var safeExtension = string.IsNullOrWhiteSpace(extension)
            ? string.Empty
            : extension.ToLowerInvariant();
        return $"media/sha256/{contentHash[..2]}/{contentHash}{safeExtension}";
    }

    private static string BuildGitHubAssetName(string contentHash, string extension)
    {
        var safeExtension = string.IsNullOrWhiteSpace(extension)
            ? string.Empty
            : extension.ToLowerInvariant();
        return $"{contentHash}{safeExtension}";
    }

    private static async Task<MediaIdentity> CopyToTempFileAsync(
        Stream sourceStream,
        string tempPath,
        CancellationToken cancellationToken)
    {
        await using var target = File.Create(tempPath);
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = new byte[CopyBufferSize];
        long totalBytes = 0;

        while (true)
        {
            var bytesRead = await sourceStream.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken);
            if (bytesRead == 0)
            {
                break;
            }

            await target.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
            hash.AppendData(buffer.AsSpan(0, bytesRead));
            totalBytes += bytesRead;
        }

        var contentHash = Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
        return new MediaIdentity(contentHash, totalBytes);
    }

    private sealed record MediaIdentity(string ContentHash, long ContentLength);

    private sealed class TempMediaFile : IAsyncDisposable
    {
        private TempMediaFile(string path)
        {
            Path = path;
        }

        public string Path { get; }

        public static TempMediaFile Create()
        {
            var root = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "howdidwegethere-media");
            Directory.CreateDirectory(root);
            return new TempMediaFile(System.IO.Path.Combine(root, $"{Guid.NewGuid():N}.tmp"));
        }

        public ValueTask DisposeAsync()
        {
            if (File.Exists(Path))
            {
                File.Delete(Path);
            }

            return ValueTask.CompletedTask;
        }
    }
}
