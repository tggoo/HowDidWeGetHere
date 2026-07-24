using System.Security.Claims;
using System.Security.Cryptography;
using System.IO.Compression;
using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Domain.Media;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminMediaEndpoints
{
    private const long DefaultMaxImageBytes = 10 * 1024 * 1024;
    private const long DefaultMaxAudioBytes = 50 * 1024 * 1024;
    private const long DefaultMaxAudioZipBytes = 512 * 1024 * 1024;

    private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".gif",
        ".avif"
    };

    private static readonly HashSet<string> AllowedAudioExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp3",
        ".m4a",
        ".mp4",
        ".ogg",
        ".opus",
        ".wav",
        ".webm"
    };

    public static RouteGroupBuilder MapAdminMediaEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapPost("/entries/{entryId:guid}/images", AddImageAsync)
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        admin.MapPost("/entries/{entryId:guid}/images/upload", UploadImageAsync)
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .DisableAntiforgery()
            .ExcludeFromDescription();

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

        admin.MapPost("/entries/{entryId:guid}/audio-tracks/upload", UploadAudioTrackAsync)
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .DisableAntiforgery()
            .ExcludeFromDescription();

        admin.MapPost("/audio-tracks/bulk-upload/preview", PreviewBulkAudioTracksAsync)
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<BulkAudioUploadPreviewResult>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .DisableAntiforgery()
            .ExcludeFromDescription();

        admin.MapPost("/audio-tracks/bulk-upload", BulkUploadAudioTracksAsync)
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<BulkAudioUploadResult>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .DisableAntiforgery()
            .ExcludeFromDescription();

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

    private static async Task<IResult> UploadImageAsync(
        Guid entryId,
        [FromForm] IFormFile file,
        [FromForm] string? languageCode,
        [FromForm] string? altText,
        [FromForm] string? caption,
        [FromForm] string? attribution,
        [FromForm] string? license,
        [FromForm] string? sourceUrl,
        HistoryDbContext dbContext,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        HttpRequest httpRequest,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var exists = await dbContext.Entries.AnyAsync(entry => entry.Id == entryId, cancellationToken);
        if (!exists)
        {
            return Results.NotFound();
        }

        var validationError = ValidateUpload(file, AllowedImageExtensions, "image/", GetMaxImageBytes(configuration));
        if (validationError is not null)
        {
            return Results.BadRequest(new { error = validationError });
        }

        var storedFile = await SaveUploadAsync(file, "images", dbContext, environment, configuration, httpRequest, cancellationToken);
        var image = new EntryImage
        {
            EntryId = entryId,
            Kind = ImageKind.Primary,
            StorageProvider = StorageProvider.Local,
            StorageKey = storedFile.StorageKey,
            PublicUrl = storedFile.PublicUrl,
            MediaType = storedFile.MediaType,
            IsPrimary = true,
            Attribution = attribution,
            License = license,
            SourceUrl = sourceUrl,
            CreatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        };

        image.Translations.Add(new EntryImageTranslation
        {
            LanguageCode = EndpointHelpers.NormalizeLanguage(languageCode),
            AltText = altText,
            Caption = caption
        });

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
        IWebHostEnvironment environment,
        IConfiguration configuration,
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
        TryDeleteLocalFile(image.StorageProvider, image.StorageKey, environment, configuration);
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

    private static async Task<IResult> UploadAudioTrackAsync(
        Guid entryId,
        [FromForm] IFormFile file,
        [FromForm] string? languageCode,
        [FromForm] string? title,
        [FromForm] string? transcript,
        [FromForm] string? attribution,
        [FromForm] string? license,
        [FromForm] string? sourceUrl,
        HistoryDbContext dbContext,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        HttpRequest httpRequest,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var exists = await dbContext.Entries.AnyAsync(entry => entry.Id == entryId, cancellationToken);
        if (!exists)
        {
            return Results.NotFound();
        }

        var validationError = ValidateUpload(file, AllowedAudioExtensions, "audio/", GetMaxAudioBytes(configuration));
        if (validationError is not null)
        {
            return Results.BadRequest(new { error = validationError });
        }

        var storedFile = await SaveUploadAsync(file, "audio", dbContext, environment, configuration, httpRequest, cancellationToken);
        var audioTrack = new EntryAudioTrack
        {
            EntryId = entryId,
            LanguageCode = EndpointHelpers.NormalizeLanguage(languageCode),
            Kind = AudioKind.Narration,
            StorageProvider = StorageProvider.Local,
            StorageKey = storedFile.StorageKey,
            PublicUrl = storedFile.PublicUrl,
            MediaType = storedFile.MediaType,
            SortOrder = 0,
            IsPrimary = true,
            Title = title,
            Transcript = transcript,
            Attribution = attribution,
            License = license,
            SourceUrl = sourceUrl,
            CreatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        };

        dbContext.EntryAudioTracks.Add(audioTrack);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/admin/entries/{entryId}/audio-tracks/{audioTrack.Id}", new ResourceCreatedResponse(audioTrack.Id, null));
    }

    private static async Task<IResult> PreviewBulkAudioTracksAsync(
        [FromForm] IFormFile file,
        [FromForm] string? languageCode,
        HistoryDbContext dbContext,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var validationError = ValidateAudioZipUpload(file, configuration);
        if (validationError is not null)
        {
            return Results.BadRequest(new { error = validationError });
        }

        var fallbackLanguage = EndpointHelpers.NormalizeLanguage(languageCode);
        var entrySlugs = await dbContext.Entries
            .Select(entry => entry.Slug)
            .ToHashSetAsync(StringComparer.OrdinalIgnoreCase, cancellationToken);
        var warnings = new List<string>();
        var rows = new List<BulkAudioUploadPreviewRow>();
        var filesRead = 0;
        var filesSupported = 0;
        var entriesMatched = 0;
        var entriesMissing = 0;

        await using var uploadStream = file.OpenReadStream();
        using var archive = new ZipArchive(uploadStream, ZipArchiveMode.Read, leaveOpen: false);
        foreach (var archiveEntry in archive.Entries)
        {
            if (string.IsNullOrWhiteSpace(archiveEntry.Name))
            {
                continue;
            }

            filesRead++;
            var extension = Path.GetExtension(archiveEntry.Name);
            var audioName = ParseBulkAudioFileName(archiveEntry.Name, fallbackLanguage);
            var warning = ValidateBulkAudioArchiveEntry(archiveEntry, extension, configuration);
            var isSupported = warning is null;
            var entryExists = isSupported && entrySlugs.Contains(audioName.EntrySlug);

            if (isSupported)
            {
                filesSupported++;
                if (entryExists)
                {
                    entriesMatched++;
                }
                else
                {
                    entriesMissing++;
                    warning = $"Entry slug '{audioName.EntrySlug}' was not found.";
                }
            }

            if (warning is not null)
            {
                warnings.Add($"{archiveEntry.FullName}: {warning}");
            }

            rows.Add(new BulkAudioUploadPreviewRow(
                archiveEntry.FullName,
                audioName.EntrySlug,
                EndpointHelpers.NormalizeLanguage(audioName.LanguageCode),
                isSupported,
                entryExists,
                warning));
        }

        return Results.Ok(new BulkAudioUploadPreviewResult(
            filesRead,
            filesSupported,
            entriesMatched,
            entriesMissing,
            rows,
            warnings));
    }

    private static async Task<IResult> BulkUploadAudioTracksAsync(
        [FromForm] IFormFile file,
        [FromForm] string? languageCode,
        HistoryDbContext dbContext,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        HttpRequest httpRequest,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var validationError = ValidateAudioZipUpload(file, configuration);
        if (validationError is not null)
        {
            return Results.BadRequest(new { error = validationError });
        }

        var fallbackLanguage = EndpointHelpers.NormalizeLanguage(languageCode);
        var entriesBySlug = await dbContext.Entries
            .Include(entry => entry.AudioTracks)
            .ToDictionaryAsync(entry => entry.Slug, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var warnings = new List<string>();
        var filesRead = 0;
        var tracksCreated = 0;
        var tracksUpdated = 0;
        var entriesMatched = 0;
        var entriesMissing = 0;

        await using var uploadStream = file.OpenReadStream();
        using var archive = new ZipArchive(uploadStream, ZipArchiveMode.Read, leaveOpen: false);
        foreach (var archiveEntry in archive.Entries)
        {
            if (string.IsNullOrWhiteSpace(archiveEntry.Name))
            {
                continue;
            }

            filesRead++;
            var extension = Path.GetExtension(archiveEntry.Name);
            var archiveEntryError = ValidateBulkAudioArchiveEntry(archiveEntry, extension, configuration);
            if (archiveEntryError is not null)
            {
                warnings.Add($"{archiveEntry.FullName}: {archiveEntryError}");
                continue;
            }

            var audioName = ParseBulkAudioFileName(archiveEntry.Name, fallbackLanguage);
            if (!entriesBySlug.TryGetValue(audioName.EntrySlug, out var entry))
            {
                entriesMissing++;
                warnings.Add($"{archiveEntry.FullName}: entry slug '{audioName.EntrySlug}' was not found.");
                continue;
            }

            entriesMatched++;
            var language = EndpointHelpers.NormalizeLanguage(audioName.LanguageCode);
            var existingPrimary = entry.AudioTracks
                .Where(track => track.LanguageCode == language)
                .OrderByDescending(track => track.IsPrimary)
                .ThenBy(track => track.SortOrder)
                .FirstOrDefault();
            foreach (var track in entry.AudioTracks.Where(track => track.LanguageCode == language))
            {
                track.IsPrimary = false;
            }

            await using var entryStream = archiveEntry.Open();
            var storedFile = await SaveUploadStreamAsync(
                entryStream,
                archiveEntry.Name,
                ResolveAudioMediaType(extension),
                "audio",
                dbContext,
                environment,
                configuration,
                httpRequest,
                cancellationToken);

            if (existingPrimary is null)
            {
                entry.AudioTracks.Add(new EntryAudioTrack
                {
                    Entry = entry,
                    LanguageCode = language,
                    Kind = AudioKind.Narration,
                    StorageProvider = StorageProvider.Local,
                    StorageKey = storedFile.StorageKey,
                    PublicUrl = storedFile.PublicUrl,
                    MediaType = storedFile.MediaType,
                    SortOrder = 0,
                    IsPrimary = true,
                    Title = $"{entry.DefaultTitle} narration",
                    CreatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier)
                });
                tracksCreated++;
            }
            else
            {
                TryDeleteLocalFile(existingPrimary.StorageProvider, existingPrimary.StorageKey, environment, configuration);
                existingPrimary.Kind = AudioKind.Narration;
                existingPrimary.StorageProvider = StorageProvider.Local;
                existingPrimary.StorageKey = storedFile.StorageKey;
                existingPrimary.PublicUrl = storedFile.PublicUrl;
                existingPrimary.MediaType = storedFile.MediaType;
                existingPrimary.SortOrder = 0;
                existingPrimary.IsPrimary = true;
                existingPrimary.Title = string.IsNullOrWhiteSpace(existingPrimary.Title)
                    ? $"{entry.DefaultTitle} narration"
                    : existingPrimary.Title;
                existingPrimary.UpdatedAt = DateTimeOffset.UtcNow;
                existingPrimary.UpdatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
                tracksUpdated++;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new BulkAudioUploadResult(
            filesRead,
            tracksCreated,
            tracksUpdated,
            entriesMatched,
            entriesMissing,
            warnings));
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
        IWebHostEnvironment environment,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var audioTrack = await dbContext.EntryAudioTracks
            .FirstOrDefaultAsync(item => item.Id == audioTrackId && item.EntryId == entryId, cancellationToken);
        if (audioTrack is null)
        {
            return Results.NotFound();
        }

        TryDeleteLocalFile(audioTrack.StorageProvider, audioTrack.StorageKey, environment, configuration);
        dbContext.EntryAudioTracks.Remove(audioTrack);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }

    private static string? ValidateMediaRequest(string? storageKey, string? publicUrl) =>
        string.IsNullOrWhiteSpace(storageKey) && string.IsNullOrWhiteSpace(publicUrl)
            ? "StorageKey or PublicUrl is required."
            : null;

    private static string? ValidateUpload(IFormFile file, HashSet<string> allowedExtensions, string mediaTypePrefix, long maxBytes)
    {
        if (file.Length == 0)
        {
            return "Uploaded file is empty.";
        }

        if (file.Length > maxBytes)
        {
            return $"Uploaded file is too large. Maximum size is {maxBytes / 1024 / 1024} MB.";
        }

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(extension) || !allowedExtensions.Contains(extension))
        {
            return $"Unsupported file extension '{extension}'.";
        }

        if (!string.IsNullOrWhiteSpace(file.ContentType)
            && !file.ContentType.StartsWith(mediaTypePrefix, StringComparison.OrdinalIgnoreCase))
        {
            return $"Unsupported media type '{file.ContentType}'.";
        }

        return null;
    }

    private static string? ValidateAudioZipUpload(IFormFile file, IConfiguration configuration)
    {
        if (file.Length == 0)
        {
            return "Uploaded zip file is empty.";
        }

        if (file.Length > GetMaxAudioZipBytes(configuration))
        {
            return $"Uploaded zip file is too large. Maximum size is {GetMaxAudioZipBytes(configuration) / 1024 / 1024} MB.";
        }

        var extension = Path.GetExtension(file.FileName);
        if (!extension.Equals(".zip", StringComparison.OrdinalIgnoreCase))
        {
            return "Bulk audio upload must be a .zip file.";
        }

        return null;
    }

    private static string? ValidateBulkAudioArchiveEntry(ZipArchiveEntry archiveEntry, string extension, IConfiguration configuration)
    {
        if (string.IsNullOrWhiteSpace(extension) || !AllowedAudioExtensions.Contains(extension))
        {
            return $"Unsupported audio extension '{extension}'.";
        }

        if (archiveEntry.Length == 0)
        {
            return "File is empty.";
        }

        return archiveEntry.Length > GetMaxAudioBytes(configuration)
            ? "File exceeds maximum audio size."
            : null;
    }

    private static async Task<StoredMediaFile> SaveUploadAsync(
        IFormFile file,
        string mediaFolder,
        HistoryDbContext dbContext,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        HttpRequest httpRequest,
        CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        return await SaveUploadStreamAsync(
            stream,
            file.FileName,
            file.ContentType,
            mediaFolder,
            dbContext,
            environment,
            configuration,
            httpRequest,
            cancellationToken);
    }

    private static async Task<StoredMediaFile> SaveUploadStreamAsync(
        Stream sourceStream,
        string fileName,
        string? contentType,
        string mediaFolder,
        HistoryDbContext dbContext,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        HttpRequest httpRequest,
        CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        var storageKey = Path.Combine(
                "media",
                mediaFolder,
                DateTimeOffset.UtcNow.ToString("yyyy"),
                DateTimeOffset.UtcNow.ToString("MM"),
                $"{Guid.NewGuid():N}{extension}")
            .Replace('\\', '/');

        var staticRoot = GetStaticRoot(environment, configuration);
        var fullPath = Path.GetFullPath(Path.Combine(staticRoot, storageKey.Replace('/', Path.DirectorySeparatorChar)));
        EnsurePathIsInsideRoot(staticRoot, fullPath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        byte[] content;
        await using (var memory = new MemoryStream())
        {
            await sourceStream.CopyToAsync(memory, cancellationToken);
            content = memory.ToArray();
        }

        await File.WriteAllBytesAsync(fullPath, content, cancellationToken);
        UpsertMediaBlob(dbContext, storageKey, contentType ?? "application/octet-stream", content);

        var publicPath = "/" + storageKey;
        return new StoredMediaFile(storageKey, BuildPublicUrl(publicPath, configuration, httpRequest), contentType);
    }

    private static void UpsertMediaBlob(
        HistoryDbContext dbContext,
        string storageKey,
        string contentType,
        byte[] content)
    {
        var hash = Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant();
        var existing = dbContext.MediaBlobs.Local.FirstOrDefault(blob => blob.StorageKey == storageKey);
        if (existing is null)
        {
            dbContext.MediaBlobs.Add(new MediaBlob
            {
                StorageKey = storageKey,
                ContentType = contentType,
                Content = content,
                ContentLength = content.LongLength,
                ContentHash = hash
            });
            return;
        }

        existing.ContentType = contentType;
        existing.Content = content;
        existing.ContentLength = content.LongLength;
        existing.ContentHash = hash;
        existing.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static string GetStaticRoot(IWebHostEnvironment environment, IConfiguration configuration)
    {
        var configuredRoot = configuration["Media:StorageRootPath"];
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

    private static string BuildPublicUrl(string publicPath, IConfiguration configuration, HttpRequest httpRequest)
    {
        var configuredBaseUrl = configuration["Media:PublicBaseUrl"];
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

    private static long GetMaxImageBytes(IConfiguration configuration) =>
        configuration.GetValue<long?>("Media:MaxImageBytes") ?? DefaultMaxImageBytes;

    private static long GetMaxAudioBytes(IConfiguration configuration) =>
        configuration.GetValue<long?>("Media:MaxAudioBytes") ?? DefaultMaxAudioBytes;

    private static long GetMaxAudioZipBytes(IConfiguration configuration) =>
        configuration.GetValue<long?>("Media:MaxAudioZipBytes") ?? DefaultMaxAudioZipBytes;

    private static BulkAudioFileName ParseBulkAudioFileName(string fileName, string fallbackLanguage)
    {
        var baseName = Path.GetFileNameWithoutExtension(fileName);
        var language = fallbackLanguage;
        foreach (var supportedLanguage in new[] { "en", "cs", "es" })
        {
            foreach (var separator in new[] { ".", "_", "-" })
            {
                var suffix = $"{separator}{supportedLanguage}";
                if (!baseName.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                return new BulkAudioFileName(
                    baseName[..^suffix.Length],
                    supportedLanguage);
            }
        }

        return new BulkAudioFileName(baseName, language);
    }

    private static string ResolveAudioMediaType(string extension) =>
        extension.ToLowerInvariant() switch
        {
            ".mp3" => "audio/mpeg",
            ".m4a" or ".mp4" => "audio/mp4",
            ".ogg" or ".opus" => "audio/ogg",
            ".wav" => "audio/wav",
            ".webm" => "audio/webm",
            _ => "application/octet-stream"
        };

    private static void TryDeleteLocalFile(
        StorageProvider storageProvider,
        string storageKey,
        IWebHostEnvironment environment,
        IConfiguration configuration)
    {
        if (storageProvider != StorageProvider.Local || string.IsNullOrWhiteSpace(storageKey))
        {
            return;
        }

        var staticRoot = GetStaticRoot(environment, configuration);
        var fullPath = Path.GetFullPath(Path.Combine(staticRoot, storageKey.Replace('/', Path.DirectorySeparatorChar)));
        EnsurePathIsInsideRoot(staticRoot, fullPath);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
    }

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

    private sealed record StoredMediaFile(string StorageKey, string PublicUrl, string? MediaType);

    private sealed record BulkAudioFileName(string EntrySlug, string LanguageCode);
}
