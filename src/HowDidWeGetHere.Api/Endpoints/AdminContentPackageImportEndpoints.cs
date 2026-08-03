using System.IO.Compression;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Api.Media;
using HowDidWeGetHere.Application.Time;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Domain.Imports;
using HowDidWeGetHere.Domain.Places;
using HowDidWeGetHere.Domain.Routes;
using HowDidWeGetHere.Domain.Sources;
using HowDidWeGetHere.Domain.Tags;
using HowDidWeGetHere.Domain.WorldDivisions;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminContentPackageImportEndpoints
{
    private const int Wgs84Srid = 4326;
    private const long DefaultMaxContentPackageBytes = 1024L * 1024 * 1024;
    private static readonly GeometryFactory GeometryFactory = new(new PrecisionModel(), Wgs84Srid);

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

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

    private static readonly Dictionary<string, AudioAttributeDefinition> PackageAudioAttributes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["description"] = new(AudioKind.Description, true, 0),
        ["title"] = new(AudioKind.Title, false, 10),
        ["summary"] = new(AudioKind.Summary, false, 20),
        ["whyItMatters"] = new(AudioKind.WhyItMatters, false, 30),
        ["why-it-matters"] = new(AudioKind.WhyItMatters, false, 30),
        ["why_it_matters"] = new(AudioKind.WhyItMatters, false, 30)
    };

    private static readonly Dictionary<string, AudioAttributeDefinition> WorldDivisionAudioAttributes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["summary"] = new(AudioKind.Summary, true, 0),
        ["title"] = new(AudioKind.Title, false, 10),
        ["facts"] = new(AudioKind.WhyItMatters, false, 20),
        ["mapNote"] = new(AudioKind.Description, false, 30),
        ["map-note"] = new(AudioKind.Description, false, 30),
        ["map_note"] = new(AudioKind.Description, false, 30)
    };

    private static readonly HashSet<string> PackageAudioLanguages = new(StringComparer.OrdinalIgnoreCase)
    {
        "en",
        "cs",
        "es"
    };

    public static RouteGroupBuilder MapAdminContentPackageImportEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGet("/imports/content-package/history", GetContentPackageImportHistoryAsync)
            .Produces<ContentPackageImportHistoryResult>(StatusCodes.Status200OK)
            .ExcludeFromDescription();

        admin.MapPost("/imports/content-package/preview", PreviewContentPackageAsync)
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<ContentPackageImportPreviewResult>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .DisableAntiforgery()
            .ExcludeFromDescription();

        admin.MapPost("/imports/content-package", ImportContentPackageAsync)
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<ContentPackageImportResult>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .DisableAntiforgery()
            .ExcludeFromDescription();

        return admin;
    }

    private static async Task<IResult> GetContentPackageImportHistoryAsync(
        [FromQuery] int? take,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(take ?? 25, 1, 100);
        var batches = await dbContext.ImportBatches
            .AsNoTracking()
            .Where(batch => batch.FileName.ToLower().EndsWith(".zip"))
            .OrderByDescending(batch => batch.StartedAt)
            .Take(limit)
            .Select(batch => new
            {
                batch.Id,
                batch.FileName,
                batch.Status,
                batch.StartedAt,
                batch.CompletedAt,
                batch.SummaryJson,
                ImportedRows = batch.Rows.Count
            })
            .ToListAsync(cancellationToken);

        return Results.Ok(new ContentPackageImportHistoryResult(
            batches
                .Select(batch =>
                {
                    var summary = ParseContentPackageImportSummary(batch.SummaryJson);
                    return new ContentPackageImportHistoryItem(
                        batch.Id,
                        batch.FileName,
                        summary.PackageSlug,
                        summary.Title,
                        batch.Status,
                        batch.StartedAt,
                        batch.CompletedAt,
                        batch.ImportedRows,
                        summary.EntriesRead,
                        summary.EntriesCreated,
                        summary.EntriesUpdated,
                        summary.AudioTracksCreated,
                        summary.AudioTracksUpdated,
                        summary.ImagesCreated,
                        summary.ImagesUpdated,
                        summary.WarningCount);
                })
                .ToList()));
    }

    private static async Task<IResult> PreviewContentPackageAsync(
        [FromForm] IFormFile file,
        [FromForm] bool? publishImportedEntries,
        [FromForm] bool? updateExistingRows,
        [FromForm] bool? clearExistingData,
        HistoryDbContext dbContext,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var uploadError = ValidatePackageUpload(file, configuration);
        if (uploadError is not null)
        {
            return Results.BadRequest(new { error = uploadError });
        }

        await using var stream = file.OpenReadStream();
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: false);
        var package = await ReadPackageDocumentAsync(archive, cancellationToken);
        if (package.Error is not null || package.Document is null)
        {
            return Results.BadRequest(new { error = package.Error ?? "Package could not be read." });
        }

        var document = package.Document;
        var shouldClearExistingData = clearExistingData == true;
        var existingEntriesToDelete = shouldClearExistingData
            ? await dbContext.Entries.CountAsync(cancellationToken)
            : 0;
        List<ExistingPackageEntry> existingEntries = shouldClearExistingData
            ? []
            : await dbContext.Entries
                .AsNoTracking()
                .Select(entry => new ExistingPackageEntry(entry.Id, entry.Slug, entry.SourceSheet, entry.SourceRow))
                .ToListAsync(cancellationToken);

        var rows = new List<ContentPackageImportPreviewRow>();
        var warnings = new List<string>();
        var entriesToCreate = 0;
        var entriesToUpdate = 0;
        var tagsToAttach = 0;
        var periodsToAttach = 0;
        var placesToAttach = 0;
        var sourcesToAttach = 0;
        var audioToAttach = 0;
        var imagesToAttach = 0;

        foreach (var entry in document.Entries)
        {
            var rowWarnings = ValidatePackageEntry(entry, archive);
            var resolvedAudio = ResolvePackageAudioFiles(entry, archive);
            warnings.AddRange(rowWarnings.Select(warning => $"{ResolveSlug(entry)}: {warning}"));

            var existing = ResolveExistingEntry(entry, existingEntries, updateExistingRows ?? true);
            if (existing is null)
            {
                entriesToCreate++;
            }
            else
            {
                entriesToUpdate++;
            }

            var routePointCount = entry.Routes.Sum(route => route.Points.Count);
            tagsToAttach += entry.Tags.Count;
            periodsToAttach += entry.TimePeriods.Count;
            placesToAttach += entry.Places.Count + routePointCount;
            sourcesToAttach += entry.Sources.Count;
            audioToAttach += resolvedAudio.Count;
            imagesToAttach += entry.Images.Count(image => PackageEntryExists(archive, image.Path));

            rows.Add(new ContentPackageImportPreviewRow(
                ResolveSlug(entry),
                ResolveTitle(entry),
                entry.SourceSheet,
                entry.SourceRow,
                existing is not null,
                existing?.Id,
                entry.Tags.Count,
                entry.TimePeriods.Count,
                entry.Places.Count + routePointCount,
                entry.Sources.Count,
                resolvedAudio.Count,
                entry.Images.Count,
                rowWarnings));
        }

        foreach (var division in document.WorldDivisions)
        {
            var divisionWarnings = ValidatePackageWorldDivision(division, archive);
            var resolvedAudio = ResolveWorldDivisionAudioFiles(division, archive);
            warnings.AddRange(divisionWarnings.Select(warning => $"world division {ResolveWorldDivisionId(division)}: {warning}"));
            audioToAttach += resolvedAudio.Count;
        }

        return Results.Ok(new ContentPackageImportPreviewResult(
            document.PackageSlug ?? Path.GetFileNameWithoutExtension(file.FileName),
            document.Title ?? document.PackageSlug ?? file.FileName,
            document.Entries.Count,
            shouldClearExistingData,
            existingEntriesToDelete,
            entriesToCreate,
            entriesToUpdate,
            tagsToAttach,
            periodsToAttach,
            placesToAttach,
            sourcesToAttach,
            audioToAttach,
            imagesToAttach,
            rows,
            warnings));
    }

    private static async Task<IResult> ImportContentPackageAsync(
        [FromForm] IFormFile file,
        [FromForm] bool? publishImportedEntries,
        [FromForm] bool? updateExistingRows,
        [FromForm] bool? clearExistingData,
        HistoryDbContext dbContext,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        HttpRequest httpRequest,
        ClaimsPrincipal user,
        ILoggerFactory loggerFactory,
        IMediaStorageService mediaStorage,
        CancellationToken cancellationToken)
    {
        var uploadError = ValidatePackageUpload(file, configuration);
        if (uploadError is not null)
        {
            return Results.BadRequest(new { error = uploadError });
        }

        var logger = loggerFactory.CreateLogger("ContentPackageImport");
        logger.LogInformation(
            "Starting content package import. FileName={FileName} FileLength={FileLength} PublishImportedEntries={PublishImportedEntries} UpdateExistingRows={UpdateExistingRows} ClearExistingData={ClearExistingData}",
            file.FileName,
            file.Length,
            publishImportedEntries,
            updateExistingRows,
            clearExistingData);

        await using var stream = file.OpenReadStream();
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: false);
        var package = await ReadPackageDocumentAsync(archive, cancellationToken);
        if (package.Error is not null || package.Document is null)
        {
            return Results.BadRequest(new { error = package.Error ?? "Package could not be read." });
        }

        var document = package.Document;
        logger.LogInformation(
            "Read content package document. FileName={FileName} PackageSlug={PackageSlug} EntryCount={EntryCount}",
            file.FileName,
            document.PackageSlug,
            document.Entries.Count);

        var shouldClearExistingData = clearExistingData == true;
        var warnings = new List<string>();
        foreach (var entry in document.Entries)
        {
            warnings.AddRange(ValidatePackageEntry(entry, archive).Select(warning => $"{ResolveSlug(entry)}: {warning}"));
        }

        foreach (var division in document.WorldDivisions)
        {
            warnings.AddRange(
                ValidatePackageWorldDivision(division, archive)
                    .Select(warning => $"world division {ResolveWorldDivisionId(division)}: {warning}"));
        }

        await using var transaction = shouldClearExistingData
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;
        var clearResult = shouldClearExistingData
            ? await ClearContentDataAsync(dbContext, cancellationToken)
            : ContentDataClearResult.Empty;

        var packageSlugs = document.Entries
            .Select(ResolveSlug)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var packageSourceSheets = document.Entries
            .Select(entry => EmptyToNull(entry.SourceSheet))
            .OfType<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var packageSourceRows = document.Entries
            .Where(entry => entry.SourceRow is not null)
            .Select(entry => entry.SourceRow!.Value)
            .Distinct()
            .ToArray();

        List<Entry> existingEntries = shouldClearExistingData || updateExistingRows == false
            ? []
            : await dbContext.Entries
                .Where(entry =>
                    packageSlugs.Contains(entry.Slug) ||
                    (entry.SourceSheet != null &&
                        entry.SourceRow != null &&
                        packageSourceSheets.Contains(entry.SourceSheet) &&
                        packageSourceRows.Contains(entry.SourceRow.Value)))
                .Include(entry => entry.Translations)
                .Include(entry => entry.Tags)
                .Include(entry => entry.TimePeriods)
                .Include(entry => entry.Places)
                .Include(entry => entry.Routes)
                .Include(entry => entry.Sources)
                .Include(entry => entry.AudioTracks)
                .Include(entry => entry.Images)
                    .ThenInclude(image => image.Translations)
                .AsSplitQuery()
                .OrderBy(entry => entry.CreatedAt)
                .ToListAsync(cancellationToken);
        logger.LogInformation(
            "Loaded existing entry candidates. FileName={FileName} PackageSlug={PackageSlug} CandidateSlugCount={CandidateSlugCount} CandidateSourceSheetCount={CandidateSourceSheetCount} CandidateSourceRowCount={CandidateSourceRowCount} ExistingEntryCount={ExistingEntryCount}",
            file.FileName,
            document.PackageSlug,
            packageSlugs.Length,
            packageSourceSheets.Length,
            packageSourceRows.Length,
            existingEntries.Count);

        var existingBySourceRow = existingEntries
            .Where(entry => !string.IsNullOrWhiteSpace(entry.SourceSheet) && entry.SourceRow is not null)
            .GroupBy(entry => $"{entry.SourceSheet}|{entry.SourceRow}", StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
        var existingBySlug = existingEntries
            .GroupBy(entry => entry.Slug, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
        var usedSlugs = await dbContext.Entries
            .Select(entry => entry.Slug)
            .ToHashSetAsync(StringComparer.OrdinalIgnoreCase, cancellationToken);
        var tagCache = await dbContext.Tags
            .Include(tag => tag.Translations)
            .ToDictionaryAsync(tag => tag.Slug, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var periodCache = await dbContext.TimePeriods
            .Include(period => period.Translations)
            .ToDictionaryAsync(period => period.Slug, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var placeCache = await dbContext.Places
            .Include(place => place.Translations)
            .ToDictionaryAsync(place => place.Slug, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var sourceCache = await dbContext.Sources
            .ToDictionaryAsync(source => source.Url, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var packageWorldDivisionIds = document.WorldDivisions
            .Select(ResolveWorldDivisionId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        List<WorldDivisionAudioTrack> worldDivisionAudioTracks = packageWorldDivisionIds.Length == 0
            ? []
            : await dbContext.WorldDivisionAudioTracks
                .Where(audio => packageWorldDivisionIds.Contains(audio.WorldDivisionId))
                .OrderBy(audio => audio.CreatedAt)
                .ToListAsync(cancellationToken);

        var entriesCreated = 0;
        var entriesUpdated = 0;
        var tagsAttached = 0;
        var timePeriodsAttached = 0;
        var placesAttached = 0;
        var routesAttached = 0;
        var sourcesAttached = 0;
        var audioTracksCreated = 0;
        var audioTracksUpdated = 0;
        var imagesCreated = 0;
        var imagesUpdated = 0;
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);

        var batch = new ImportBatch
        {
            FileName = file.FileName,
            ImportedByUserId = userId,
            Status = ImportStatus.Pending
        };
        dbContext.ImportBatches.Add(batch);

        for (var index = 0; index < document.Entries.Count; index++)
        {
            var packageEntry = document.Entries[index];
            var packageEntrySlug = ResolveSlug(packageEntry);
            logger.LogInformation(
                "Importing content package entry {EntryIndex}/{EntryCount}. FileName={FileName} PackageSlug={PackageSlug} EntrySlug={EntrySlug} AudioRefs={AudioRefs} ImageRefs={ImageRefs}",
                index + 1,
                document.Entries.Count,
                file.FileName,
                document.PackageSlug,
                packageEntrySlug,
                packageEntry.Audio.Count,
                packageEntry.Images.Count);

            var importedRow = new ImportedRow
            {
                ImportBatch = batch,
                SheetName = packageEntry.SourceSheet ?? document.PackageSlug ?? "content-package",
                RowNumber = packageEntry.SourceRow ?? index + 1,
                RawJson = JsonSerializer.Serialize(packageEntry, JsonOptions)
            };
            batch.Rows.Add(importedRow);

            var packageAudioFiles = ResolvePackageAudioFiles(packageEntry, archive);
            var importedEntry = CreateEntry(packageEntry, packageAudioFiles, publishImportedEntries ?? true);
            var matchedEntry = ResolveExistingEntry(packageEntry, existingBySourceRow, existingBySlug);
            if (matchedEntry is null)
            {
                importedEntry.Slug = MakeUniqueSlug(importedEntry.Slug, usedSlugs);
                importedEntry.CreatedByUserId = userId;
                dbContext.Entries.Add(importedEntry);
                importedRow.Entry = importedEntry;
                matchedEntry = importedEntry;
                entriesCreated++;
            }
            else
            {
                ApplyEntryUpdate(matchedEntry, importedEntry);
                matchedEntry.UpdatedAt = DateTimeOffset.UtcNow;
                matchedEntry.UpdatedByUserId = userId;
                importedRow.Entry = matchedEntry;
                entriesUpdated++;
            }

            foreach (var tag in packageEntry.Tags)
            {
                tagsAttached += AttachTag(matchedEntry, tag, tagCache, dbContext);
            }

            foreach (var period in packageEntry.TimePeriods)
            {
                timePeriodsAttached += AttachTimePeriod(matchedEntry, period, periodCache, dbContext);
            }

            foreach (var source in packageEntry.Sources)
            {
                sourcesAttached += AttachSource(matchedEntry, source, sourceCache, dbContext);
            }

            foreach (var place in packageEntry.Places)
            {
                placesAttached += AttachPlace(matchedEntry, place, placeCache, dbContext);
            }

            foreach (var route in packageEntry.Routes)
            {
                var routeCounts = await AttachRouteAsync(
                    matchedEntry,
                    route,
                    placeCache,
                    userId,
                    dbContext,
                    cancellationToken);
                routesAttached += routeCounts.RoutesAttached;
                placesAttached += routeCounts.PlacesAttached;
            }

            var importedAudioKeys = new HashSet<AudioTrackImportKey>();
            var authoritativeAudioLanguages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var audio in packageAudioFiles)
            {
                var stored = await StorePackageMediaAsync(
                    archive,
                    audio.Path,
                    "audio",
                    mediaStorage,
                    httpRequest,
                    cancellationToken);
                if (stored is null)
                {
                    continue;
                }

                var audioKey = ResolveAudioTrackImportKey(audio);
                importedAudioKeys.Add(audioKey);
                if (audioKey.Kind == AudioKind.Description || audio.IsPrimary == true)
                {
                    authoritativeAudioLanguages.Add(audioKey.LanguageCode);
                }

                var wasUpdate = UpsertAudio(matchedEntry, audio, stored, environment, configuration, userId);
                if (wasUpdate)
                {
                    audioTracksUpdated++;
                }
                else
                {
                    audioTracksCreated++;
                }
            }
            RemoveStaleAudioTracks(
                matchedEntry,
                importedAudioKeys,
                authoritativeAudioLanguages,
                dbContext,
                environment,
                configuration);

            foreach (var image in packageEntry.Images)
            {
                var stored = await StorePackageMediaAsync(
                    archive,
                    image.Path,
                    "images",
                    mediaStorage,
                    httpRequest,
                    cancellationToken);
                if (stored is null)
                {
                    continue;
                }

                var wasUpdate = UpsertImage(matchedEntry, image, stored, environment, configuration, userId);
                if (wasUpdate)
                {
                    imagesUpdated++;
                }
                else
                {
                    imagesCreated++;
                }
            }
        }

        for (var index = 0; index < document.WorldDivisions.Count; index++)
        {
            var packageWorldDivision = document.WorldDivisions[index];
            var worldDivisionId = ResolveWorldDivisionId(packageWorldDivision);
            var packageAudioFiles = ResolveWorldDivisionAudioFiles(packageWorldDivision, archive);
            logger.LogInformation(
                "Importing content package world division {DivisionIndex}/{DivisionCount}. FileName={FileName} PackageSlug={PackageSlug} WorldDivisionId={WorldDivisionId} AudioRefs={AudioRefs}",
                index + 1,
                document.WorldDivisions.Count,
                file.FileName,
                document.PackageSlug,
                worldDivisionId,
                packageAudioFiles.Count);

            var importedRow = new ImportedRow
            {
                ImportBatch = batch,
                SheetName = "world-divisions",
                RowNumber = document.Entries.Count + index + 1,
                RawJson = JsonSerializer.Serialize(packageWorldDivision, JsonOptions)
            };
            batch.Rows.Add(importedRow);

            var divisionTracks = worldDivisionAudioTracks
                .Where(track => track.WorldDivisionId.Equals(worldDivisionId, StringComparison.OrdinalIgnoreCase))
                .ToList();
            foreach (var audio in packageAudioFiles)
            {
                var stored = await StorePackageMediaAsync(
                    archive,
                    audio.Path,
                    "audio/world-divisions",
                    mediaStorage,
                    httpRequest,
                    cancellationToken);
                if (stored is null)
                {
                    continue;
                }

                var wasUpdate = UpsertWorldDivisionAudio(
                    worldDivisionId,
                    packageWorldDivision,
                    divisionTracks,
                    audio,
                    stored,
                    dbContext,
                    environment,
                    configuration,
                    userId);
                if (wasUpdate)
                {
                    audioTracksUpdated++;
                }
                else
                {
                    audioTracksCreated++;
                }
            }
        }

        batch.CompletedAt = DateTimeOffset.UtcNow;
        batch.Status = warnings.Count == 0 ? ImportStatus.Imported : ImportStatus.PartiallyImported;
        batch.SummaryJson = JsonSerializer.Serialize(new
        {
            fileName = file.FileName,
            packageSlug = document.PackageSlug ?? string.Empty,
            title = document.Title ?? document.PackageSlug ?? file.FileName,
            entriesRead = document.Entries.Count,
            clearedExistingData = shouldClearExistingData,
            contentDataDeleted = shouldClearExistingData ? clearResult : null,
            entriesCreated,
            entriesUpdated,
            tagsAttached,
            timePeriodsAttached,
            placesAttached,
            routesAttached,
            sourcesAttached,
            audioTracksCreated,
            audioTracksUpdated,
            imagesCreated,
            imagesUpdated,
            warnings
        }, JsonOptions);

        await dbContext.SaveChangesAsync(cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        logger.LogInformation(
            "Finished content package import. FileName={FileName} PackageSlug={PackageSlug} EntriesCreated={EntriesCreated} EntriesUpdated={EntriesUpdated} AudioTracksCreated={AudioTracksCreated} AudioTracksUpdated={AudioTracksUpdated} ImagesCreated={ImagesCreated} ImagesUpdated={ImagesUpdated} WarningCount={WarningCount}",
            file.FileName,
            document.PackageSlug,
            entriesCreated,
            entriesUpdated,
            audioTracksCreated,
            audioTracksUpdated,
            imagesCreated,
            imagesUpdated,
            warnings.Count);

        return Results.Ok(new ContentPackageImportResult(
            batch.Id,
            file.FileName,
            document.PackageSlug ?? string.Empty,
            document.Title ?? document.PackageSlug ?? file.FileName,
            document.Entries.Count,
            shouldClearExistingData,
            clearResult.EntriesDeleted,
            entriesCreated,
            entriesUpdated,
            tagsAttached,
            timePeriodsAttached,
            placesAttached,
            sourcesAttached,
            audioTracksCreated,
            audioTracksUpdated,
            imagesCreated,
            imagesUpdated,
            warnings));
    }

    private static async Task<ContentDataClearResult> ClearContentDataAsync(
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        await dbContext.EntryRelationships.ExecuteDeleteAsync(cancellationToken);
        await dbContext.RoutePoints.ExecuteDeleteAsync(cancellationToken);
        await dbContext.EntryRoutes.ExecuteDeleteAsync(cancellationToken);
        await dbContext.EntryActors.ExecuteDeleteAsync(cancellationToken);
        await dbContext.EntryAudioTracks.ExecuteDeleteAsync(cancellationToken);
        await dbContext.WorldDivisionAudioTracks.ExecuteDeleteAsync(cancellationToken);
        await dbContext.EntryImageTranslations.ExecuteDeleteAsync(cancellationToken);
        await dbContext.EntryImages.ExecuteDeleteAsync(cancellationToken);
        await dbContext.EntryPlaces.ExecuteDeleteAsync(cancellationToken);
        await dbContext.EntrySources.ExecuteDeleteAsync(cancellationToken);
        await dbContext.EntryTags.ExecuteDeleteAsync(cancellationToken);
        await dbContext.EntryTimePeriods.ExecuteDeleteAsync(cancellationToken);
        await dbContext.Set<EntryTranslation>().ExecuteDeleteAsync(cancellationToken);
        await dbContext.ImportedRows.ExecuteDeleteAsync(cancellationToken);

        await dbContext.TimePeriods.ExecuteUpdateAsync(
            setters => setters
                .SetProperty(period => period.ParentPeriodId, (Guid?)null)
                .SetProperty(period => period.ScopePlaceId, (Guid?)null)
                .SetProperty(period => period.EntryId, (Guid?)null),
            cancellationToken);
        await dbContext.Tags.ExecuteUpdateAsync(
            setters => setters.SetProperty(tag => tag.ParentTagId, (Guid?)null),
            cancellationToken);

        var entriesDeleted = await dbContext.Entries.ExecuteDeleteAsync(cancellationToken);
        await dbContext.TimePeriodTranslations.ExecuteDeleteAsync(cancellationToken);
        var timePeriodsDeleted = await dbContext.TimePeriods.ExecuteDeleteAsync(cancellationToken);
        await dbContext.PlaceTranslations.ExecuteDeleteAsync(cancellationToken);
        var placesDeleted = await dbContext.Places.ExecuteDeleteAsync(cancellationToken);
        await dbContext.TagTranslations.ExecuteDeleteAsync(cancellationToken);
        var tagsDeleted = await dbContext.Tags.ExecuteDeleteAsync(cancellationToken);
        await dbContext.ActorTranslations.ExecuteDeleteAsync(cancellationToken);
        var actorsDeleted = await dbContext.Actors.ExecuteDeleteAsync(cancellationToken);
        var sourcesDeleted = await dbContext.Sources.ExecuteDeleteAsync(cancellationToken);
        var mediaBlobsDeleted = await dbContext.MediaBlobs.ExecuteDeleteAsync(cancellationToken);
        var importBatchesDeleted = await dbContext.ImportBatches.ExecuteDeleteAsync(cancellationToken);

        dbContext.ChangeTracker.Clear();
        return new ContentDataClearResult(
            entriesDeleted,
            tagsDeleted,
            timePeriodsDeleted,
            placesDeleted,
            sourcesDeleted,
            actorsDeleted,
            mediaBlobsDeleted,
            importBatchesDeleted);
    }

    private static Entry CreateEntry(
        ContentPackageEntry packageEntry,
        IReadOnlyCollection<ContentPackageAudio> packageAudioFiles,
        bool publishImportedEntries)
    {
        var parsedDate = HistoricalDateParser.Parse(packageEntry.DateLabel);
        var timePrecision = packageEntry.TimePrecision ?? parsedDate.Precision;
        var title = ResolveTitle(packageEntry);

        return new Entry
        {
            Slug = ResolveSlug(packageEntry),
            Kind = ParseEnum(packageEntry.Kind, EntryKind.Event),
            Status = publishImportedEntries
                ? ContentStatus.Published
                : ParseEnum(packageEntry.Status, ContentStatus.Draft),
            RealityStatus = ParseEnum(packageEntry.RealityStatus, RealityStatus.Historical),
            DefaultTitle = title,
            IconKey = EmptyToNull(packageEntry.IconKey),
            DateLabel = packageEntry.DateLabel,
            StartYear = packageEntry.StartYear ?? parsedDate.StartYear,
            StartMonth = packageEntry.StartMonth ?? parsedDate.StartMonth,
            StartDay = packageEntry.StartDay ?? parsedDate.StartDay,
            EndYear = packageEntry.EndYear ?? parsedDate.EndYear,
            EndMonth = packageEntry.EndMonth ?? parsedDate.EndMonth,
            EndDay = packageEntry.EndDay ?? parsedDate.EndDay,
            TimePrecision = timePrecision,
            TimeConfidence = packageEntry.TimeConfidence,
            SourceSheet = packageEntry.SourceSheet,
            SourceRow = packageEntry.SourceRow,
            Translations = CreateTranslations(packageEntry, packageAudioFiles, title)
        };
    }

    private static List<EntryTranslation> CreateTranslations(
        ContentPackageEntry packageEntry,
        IReadOnlyCollection<ContentPackageAudio> packageAudioFiles,
        string title)
    {
        var translationsByLanguage = new Dictionary<string, EntryTranslation>(StringComparer.OrdinalIgnoreCase);
        foreach (var packageTranslation in packageEntry.Translations)
        {
            var language = NormalizeLanguage(packageTranslation.Key);
            var translation = GetOrCreateTranslation(translationsByLanguage, language, title);
            ApplyPackageTranslation(translation, packageTranslation.Value, title);
        }

        foreach (var audio in packageAudioFiles)
        {
            var transcript = EmptyToNull(audio.Transcript);
            if (transcript is null)
            {
                continue;
            }

            var language = NormalizeLanguage(audio.LanguageCode);
            var translation = GetOrCreateTranslation(translationsByLanguage, language, title);
            ApplyAudioTranscriptFallback(translation, ParseEnum(audio.Kind, AudioKind.Narration), transcript, title);
        }

        if (translationsByLanguage.Count == 0)
        {
            translationsByLanguage["en"] = new EntryTranslation
            {
                LanguageCode = "en",
                Title = title
            };
        }

        foreach (var translation in translationsByLanguage.Values)
        {
            if (string.IsNullOrWhiteSpace(translation.Title))
            {
                translation.Title = title;
            }
        }

        return translationsByLanguage.Values
            .OrderBy(translation => translation.LanguageCode == "en" ? 0 : 1)
            .ThenBy(translation => translation.LanguageCode)
            .ToList();
    }

    private static EntryTranslation GetOrCreateTranslation(
        IDictionary<string, EntryTranslation> translationsByLanguage,
        string language,
        string title)
    {
        if (translationsByLanguage.TryGetValue(language, out var translation))
        {
            return translation;
        }

        translation = new EntryTranslation
        {
            LanguageCode = language,
            Title = title
        };
        translationsByLanguage[language] = translation;
        return translation;
    }

    private static void ApplyPackageTranslation(
        EntryTranslation translation,
        ContentPackageTranslation packageTranslation,
        string title)
    {
        translation.Title = string.IsNullOrWhiteSpace(packageTranslation.Title)
            ? translation.Title
            : packageTranslation.Title!.Trim();
        translation.Summary = EmptyToNull(packageTranslation.Summary) ?? translation.Summary;
        translation.Description = EmptyToNull(packageTranslation.Description) ?? translation.Description;
        translation.WhyItMatters = EmptyToNull(packageTranslation.WhyItMatters) ?? translation.WhyItMatters;
        translation.DatingNote = EmptyToNull(packageTranslation.DatingNote) ?? translation.DatingNote;

        if (string.IsNullOrWhiteSpace(translation.Title))
        {
            translation.Title = title;
        }
    }

    private static void ApplyAudioTranscriptFallback(
        EntryTranslation translation,
        AudioKind audioKind,
        string transcript,
        string defaultTitle)
    {
        switch (audioKind)
        {
            case AudioKind.Title:
                if (string.IsNullOrWhiteSpace(translation.Title) ||
                    string.Equals(translation.Title, defaultTitle, StringComparison.Ordinal))
                {
                    translation.Title = transcript;
                }

                break;
            case AudioKind.Summary:
                translation.Summary ??= transcript;
                break;
            case AudioKind.Description:
            case AudioKind.Narration:
                translation.Description ??= transcript;
                break;
            case AudioKind.WhyItMatters:
                translation.WhyItMatters ??= transcript;
                break;
        }
    }

    private static void ApplyEntryUpdate(Entry target, Entry imported)
    {
        target.Kind = imported.Kind;
        target.Status = imported.Status;
        target.RealityStatus = imported.RealityStatus;
        target.DefaultTitle = imported.DefaultTitle;
        target.IconKey = imported.IconKey;
        target.DateLabel = imported.DateLabel;
        target.StartYear = imported.StartYear;
        target.StartMonth = imported.StartMonth;
        target.StartDay = imported.StartDay;
        target.EndYear = imported.EndYear;
        target.EndMonth = imported.EndMonth;
        target.EndDay = imported.EndDay;
        target.TimePrecision = imported.TimePrecision;
        target.TimeConfidence = imported.TimeConfidence;
        target.SourceSheet = imported.SourceSheet;
        target.SourceRow = imported.SourceRow;

        foreach (var importedTranslation in imported.Translations)
        {
            var translation = target.Translations.FirstOrDefault(item => item.LanguageCode == importedTranslation.LanguageCode);
            if (translation is null)
            {
                target.Translations.Add(importedTranslation);
            }
            else
            {
                translation.Title = importedTranslation.Title;
                translation.Summary = importedTranslation.Summary;
                translation.Description = importedTranslation.Description;
                translation.WhyItMatters = importedTranslation.WhyItMatters;
                translation.DatingNote = importedTranslation.DatingNote;
            }
        }
    }

    private static int AttachTag(
        Entry entry,
        ContentPackageTag packageTag,
        IDictionary<string, Tag> tagCache,
        HistoryDbContext dbContext)
    {
        var name = ResolvePackageLabel(packageTag.Translations, packageTag.Slug, "Imported tag");
        var slug = EndpointHelpers.Slugify(EmptyToNull(packageTag.Slug) ?? $"{packageTag.Group}-{name}");
        var group = EmptyToNull(packageTag.Group) ?? "import";
        if (!tagCache.TryGetValue(slug, out var tag))
        {
            tag = new Tag
            {
                Slug = slug,
                TagGroup = group,
                Translations = CreateTagTranslations(packageTag)
            };
            tagCache[slug] = tag;
            dbContext.Tags.Add(tag);
        }
        else
        {
            UpsertTagTranslations(tag, packageTag);
        }

        if (entry.Tags.Any(entryTag => entryTag.Tag == tag || entryTag.TagId == tag.Id))
        {
            return 0;
        }

        entry.Tags.Add(new EntryTag
        {
            Entry = entry,
            Tag = tag
        });
        return 1;
    }

    private static List<TagTranslation> CreateTagTranslations(ContentPackageTag packageTag)
    {
        return packageTag.Translations
            .Where(translation => !string.IsNullOrWhiteSpace(translation.Value))
            .GroupBy(translation => NormalizeLanguage(translation.Key))
            .Select(group => new TagTranslation
            {
                LanguageCode = group.Key,
                Name = group.First().Value.Trim()
            })
            .ToList();
    }

    private static void UpsertTagTranslations(Tag tag, ContentPackageTag packageTag)
    {
        foreach (var importedTranslation in CreateTagTranslations(packageTag))
        {
            var translation = tag.Translations.FirstOrDefault(item => item.LanguageCode == importedTranslation.LanguageCode);
            if (translation is null)
            {
                tag.Translations.Add(importedTranslation);
            }
            else
            {
                translation.Name = importedTranslation.Name;
            }
        }
    }

    private static int AttachTimePeriod(
        Entry entry,
        ContentPackageTimePeriod packagePeriod,
        IDictionary<string, TimePeriod> periodCache,
        HistoryDbContext dbContext)
    {
        var name = ResolvePackageLabel(packagePeriod.Translations, packagePeriod.Slug, "Imported period");

        var slug = EndpointHelpers.Slugify(EmptyToNull(packagePeriod.Slug) ?? name);
        var range = ResolveKnownPeriodRange(slug);
        var startYear = packagePeriod.StartYear ?? range.StartYear;
        var endYear = packagePeriod.EndYear ?? range.EndYear;
        if (!periodCache.TryGetValue(slug, out var period))
        {
            period = new TimePeriod
            {
                Slug = slug,
                PeriodType = ParseEnum(packagePeriod.PeriodType, TimePeriodType.Era),
                StartYear = startYear,
                EndYear = endYear,
                Translations = CreateTimePeriodTranslations(packagePeriod)
            };
            periodCache[slug] = period;
            dbContext.TimePeriods.Add(period);
        }
        else
        {
            period.PeriodType = ParseEnum(packagePeriod.PeriodType, period.PeriodType);
            period.StartYear ??= startYear;
            period.EndYear ??= endYear;
            UpsertTimePeriodTranslations(period, packagePeriod);
        }

        var relationType = ParseEnum(packagePeriod.RelationType, PeriodMembershipType.Primary);
        if (relationType == PeriodMembershipType.Primary)
        {
            entry.PrimaryTimePeriod = period;
        }

        if (entry.TimePeriods.Any(entryPeriod =>
                (entryPeriod.TimePeriod == period || entryPeriod.TimePeriodId == period.Id) &&
                entryPeriod.RelationType == relationType))
        {
            return 0;
        }

        entry.TimePeriods.Add(new EntryTimePeriod
        {
            Entry = entry,
            TimePeriod = period,
            RelationType = relationType
        });
        return 1;
    }

    private static List<TimePeriodTranslation> CreateTimePeriodTranslations(ContentPackageTimePeriod packagePeriod)
    {
        return packagePeriod.Translations
            .Where(translation => !string.IsNullOrWhiteSpace(translation.Value))
            .GroupBy(translation => NormalizeLanguage(translation.Key))
            .Select(group => new TimePeriodTranslation
            {
                LanguageCode = group.Key,
                Name = group.First().Value.Trim()
            })
            .ToList();
    }

    private static void UpsertTimePeriodTranslations(TimePeriod period, ContentPackageTimePeriod packagePeriod)
    {
        foreach (var importedTranslation in CreateTimePeriodTranslations(packagePeriod))
        {
            var translation = period.Translations.FirstOrDefault(item => item.LanguageCode == importedTranslation.LanguageCode);
            if (translation is null)
            {
                period.Translations.Add(importedTranslation);
            }
            else
            {
                translation.Name = importedTranslation.Name;
            }
        }
    }

    private static (long? StartYear, long? EndYear) ResolveKnownPeriodRange(string slug) =>
        slug.ToLowerInvariant() switch
        {
            "prehistory" => (-3000000, -3000),
            "neolithic" => (-10000, -3300),
            "ancient" => (-3300, 500),
            "late-antiquity" => (250, 750),
            "middle-ages" => (500, 1500),
            "early-modern" => (1500, 1800),
            "industrial-age" => (1760, 1914),
            "modern" => (1800, 1945),
            "contemporary" => (1945, 2026),
            _ => (null, null)
        };

    private static int AttachSource(
        Entry entry,
        ContentPackageSource packageSource,
        IDictionary<string, Source> sourceCache,
        HistoryDbContext dbContext)
    {
        var url = EmptyToNull(packageSource.Url);
        if (url is null)
        {
            return 0;
        }

        if (!sourceCache.TryGetValue(url, out var source))
        {
            source = new Source
            {
                Url = url,
                Title = EmptyToNull(packageSource.Title),
                Publisher = EmptyToNull(packageSource.Publisher),
                LanguageCode = EmptyToNull(packageSource.LanguageCode),
                AccessedAt = DateTimeOffset.UtcNow
            };
            sourceCache[url] = source;
            dbContext.Sources.Add(source);
        }

        var support = ParseEnum(packageSource.SupportsField, SourceSupportKind.General);
        if (entry.Sources.Any(entrySource =>
                (entrySource.Source == source || entrySource.SourceId == source.Id) &&
                entrySource.SupportsField == support))
        {
            return 0;
        }

        entry.Sources.Add(new EntrySource
        {
            Entry = entry,
            Source = source,
            SupportsField = support,
            Note = EmptyToNull(packageSource.Note)
        });
        return 1;
    }

    private static int AttachPlace(
        Entry entry,
        ContentPackagePlace packagePlace,
        IDictionary<string, Place> placeCache,
        HistoryDbContext dbContext)
    {
        var name = ResolvePackageLabel(packagePlace.Translations, packagePlace.Slug, "Imported place");
        if (packagePlace.Longitude is null || packagePlace.Latitude is null)
        {
            return 0;
        }

        var slug = EndpointHelpers.Slugify(EmptyToNull(packagePlace.Slug) ?? name);
        if (!placeCache.TryGetValue(slug, out var place))
        {
            place = new Place
            {
                Slug = slug,
                DefaultName = name,
                PlaceType = ParseEnum(packagePlace.PlaceType, PlaceType.Region),
                SpatialConfidence = ParseEnum(packagePlace.SpatialConfidence, SpatialConfidence.Regional),
                ModernCountryCode = EmptyToNull(packagePlace.ModernCountryCode),
                WikidataId = EmptyToNull(packagePlace.WikidataId),
                GeoNamesId = packagePlace.GeoNamesId,
                Geometry = new Point(packagePlace.Longitude.Value, packagePlace.Latitude.Value) { SRID = Wgs84Srid },
                Translations = CreatePlaceTranslations(packagePlace)
            };
            placeCache[slug] = place;
            dbContext.Places.Add(place);
        }
        else
        {
            UpsertPlaceTranslations(place, packagePlace);
        }

        var role = ParseEnum(packagePlace.Role, EntryPlaceRole.Region);
        if (entry.Places.Any(entryPlace =>
                (entryPlace.Place == place || entryPlace.PlaceId == place.Id) &&
                entryPlace.Role == role))
        {
            return 0;
        }

        entry.Places.Add(new EntryPlace
        {
            Entry = entry,
            Place = place,
            Role = role,
            SortOrder = packagePlace.SortOrder ?? entry.Places.Count,
            Note = EmptyToNull(packagePlace.Note)
        });
        return 1;
    }

    private static List<PlaceTranslation> CreatePlaceTranslations(ContentPackagePlace packagePlace)
    {
        var description = EmptyToNull(packagePlace.Note);

        return packagePlace.Translations
            .Where(translation => !string.IsNullOrWhiteSpace(translation.Value))
            .GroupBy(translation => NormalizeLanguage(translation.Key))
            .Select(group => new PlaceTranslation
            {
                LanguageCode = group.Key,
                Name = group.First().Value.Trim(),
                Description = description
            })
            .ToList();
    }

    private static void UpsertPlaceTranslations(Place place, ContentPackagePlace packagePlace)
    {
        foreach (var importedTranslation in CreatePlaceTranslations(packagePlace))
        {
            var translation = place.Translations.FirstOrDefault(item => item.LanguageCode == importedTranslation.LanguageCode);
            if (translation is null)
            {
                place.Translations.Add(importedTranslation);
            }
            else
            {
                translation.Name = importedTranslation.Name;
                translation.Description = importedTranslation.Description;
            }
        }
    }

    private static async Task<ContentPackageRouteAttachCounts> AttachRouteAsync(
        Entry entry,
        ContentPackageRoute packageRoute,
        IDictionary<string, Place> placeCache,
        string? userId,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var orderedPoints = packageRoute.Points
            .Select((point, index) => new
            {
                Point = point,
                SortOrder = point.SortOrder ?? index,
                Name = ResolveRoutePointName(point)
            })
            .Where(item =>
                item.Point.Longitude is not null &&
                item.Point.Latitude is not null &&
                !string.IsNullOrWhiteSpace(item.Name))
            .OrderBy(item => item.SortOrder)
            .ThenBy(item => item.Name)
            .ToList();

        if (orderedPoints.Count < 2)
        {
            return new ContentPackageRouteAttachCounts(0, 0);
        }

        var routeName = EmptyToNull(packageRoute.Name) ?? $"{entry.DefaultTitle} route";
        var routeType = ParseEnum(packageRoute.RouteType, RouteType.Journey);
        var route = entry.Routes.FirstOrDefault(item =>
            string.Equals(item.Name, routeName, StringComparison.OrdinalIgnoreCase) &&
            item.RouteType == routeType);
        var isNewRoute = route is null;

        if (route is null)
        {
            route = new EntryRoute
            {
                EntryId = entry.Id,
                Entry = entry,
                Name = routeName,
                RouteType = routeType,
                CreatedByUserId = userId
            };
            entry.Routes.Add(route);
            dbContext.EntryRoutes.Add(route);
        }
        else
        {
            await dbContext.RoutePoints
                .Where(point => point.RouteId == route.Id)
                .ExecuteDeleteAsync(cancellationToken);
            route.Points.Clear();
            route.UpdatedAt = DateTimeOffset.UtcNow;
            route.UpdatedByUserId = userId;
        }

        route.Name = routeName;
        route.RouteType = routeType;
        route.SpatialConfidence = ParseEnum(packageRoute.SpatialConfidence, SpatialConfidence.Approximate);
        route.SourceNote = EmptyToNull(packageRoute.SourceNote);

        var placesAttached = 0;
        var coordinates = new List<Coordinate>();
        foreach (var orderedPoint in orderedPoints)
        {
            var point = orderedPoint.Point;
            var place = UpsertRoutePointPlace(point, orderedPoint.Name, placeCache, dbContext);
            var role = ParseEnum(point.Role, RoutePointRole.Stop);

            var routePoint = new RoutePoint
            {
                RouteId = route.Id,
                Route = route,
                PlaceId = place.Id,
                Place = place,
                SortOrder = orderedPoint.SortOrder,
                Role = role,
                DateLabel = EmptyToNull(point.DateLabel),
                Note = EmptyToNull(point.Note)
            };
            route.Points.Add(routePoint);
            dbContext.RoutePoints.Add(routePoint);

            placesAttached += AttachEntryPlaceForRoutePoint(entry, place, role, orderedPoint.SortOrder, point.Note);
            coordinates.Add(new Coordinate(point.Longitude!.Value, point.Latitude!.Value));
        }

        route.Geometry = GeometryFactory.CreateLineString(coordinates.ToArray());
        return new ContentPackageRouteAttachCounts(isNewRoute ? 1 : 0, placesAttached);
    }

    private static Place UpsertRoutePointPlace(
        ContentPackageRoutePoint point,
        string name,
        IDictionary<string, Place> placeCache,
        HistoryDbContext dbContext)
    {
        var slug = EndpointHelpers.Slugify(EmptyToNull(point.Slug) ?? name);
        if (!placeCache.TryGetValue(slug, out var place))
        {
            place = new Place
            {
                Slug = slug,
                DefaultName = name,
                PlaceType = ParseEnum(point.PlaceType, PlaceType.RouteStop),
                SpatialConfidence = ParseEnum(point.SpatialConfidence, SpatialConfidence.Approximate),
                ModernCountryCode = EmptyToNull(point.ModernCountryCode),
                WikidataId = EmptyToNull(point.WikidataId),
                GeoNamesId = point.GeoNamesId,
                Geometry = GeometryFactory.CreatePoint(new Coordinate(point.Longitude!.Value, point.Latitude!.Value)),
                Translations = CreateRoutePointPlaceTranslations(point, name)
            };
            placeCache[slug] = place;
            dbContext.Places.Add(place);
            return place;
        }

        place.DefaultName = name;
        place.PlaceType = ParseEnum(point.PlaceType, place.PlaceType);
        place.SpatialConfidence = ParseEnum(point.SpatialConfidence, place.SpatialConfidence);
        place.ModernCountryCode = EmptyToNull(point.ModernCountryCode);
        place.WikidataId = EmptyToNull(point.WikidataId);
        place.GeoNamesId = point.GeoNamesId;
        place.Geometry = GeometryFactory.CreatePoint(new Coordinate(point.Longitude!.Value, point.Latitude!.Value));
        UpsertRoutePointPlaceTranslations(place, point, name);
        return place;
    }

    private static List<PlaceTranslation> CreateRoutePointPlaceTranslations(ContentPackageRoutePoint point, string name)
    {
        var description = EmptyToNull(point.Note);
        var translations = point.Translations
            .Where(translation => !string.IsNullOrWhiteSpace(translation.Value))
            .GroupBy(translation => NormalizeLanguage(translation.Key))
            .Select(group => new PlaceTranslation
            {
                LanguageCode = group.Key,
                Name = group.First().Value.Trim(),
                Description = description
            })
            .ToList();

        if (translations.Count == 0)
        {
            translations.Add(new PlaceTranslation
            {
                LanguageCode = "en",
                Name = name,
                Description = description
            });
        }

        return translations;
    }

    private static void UpsertRoutePointPlaceTranslations(Place place, ContentPackageRoutePoint point, string name)
    {
        foreach (var importedTranslation in CreateRoutePointPlaceTranslations(point, name))
        {
            var translation = place.Translations.FirstOrDefault(item => item.LanguageCode == importedTranslation.LanguageCode);
            if (translation is null)
            {
                place.Translations.Add(importedTranslation);
            }
            else
            {
                translation.Name = importedTranslation.Name;
                translation.Description = importedTranslation.Description;
            }
        }
    }

    private static int AttachEntryPlaceForRoutePoint(
        Entry entry,
        Place place,
        RoutePointRole routePointRole,
        int sortOrder,
        string? note)
    {
        var entryPlaceRole = ToEntryPlaceRole(routePointRole);
        var entryPlace = entry.Places.FirstOrDefault(entryPlace =>
                (entryPlace.Place == place || entryPlace.PlaceId == place.Id) &&
                entryPlace.Role == entryPlaceRole);
        if (entryPlace is not null)
        {
            entryPlace.SortOrder = sortOrder;
            entryPlace.Note = EmptyToNull(note);
            return 0;
        }

        entry.Places.Add(new EntryPlace
        {
            EntryId = entry.Id,
            Entry = entry,
            PlaceId = place.Id,
            Place = place,
            Role = entryPlaceRole,
            SortOrder = sortOrder,
            Note = EmptyToNull(note)
        });
        return 1;
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

    private static string ResolveRoutePointName(ContentPackageRoutePoint point)
    {
        var name = EmptyToNull(point.Name);
        return name ?? ResolvePackageLabel(point.Translations, point.Slug, "Route point");
    }

    private static string ResolvePackageLabel(
        IReadOnlyDictionary<string, string> translations,
        string? slug,
        string fallback)
    {
        var englishName = translations
            .Where(translation => NormalizeLanguage(translation.Key) == "en")
            .Select(translation => EmptyToNull(translation.Value))
            .FirstOrDefault(value => value is not null);
        if (englishName is not null)
        {
            return englishName;
        }

        var firstTranslatedName = translations
            .Select(translation => EmptyToNull(translation.Value))
            .FirstOrDefault(value => value is not null);
        if (firstTranslatedName is not null)
        {
            return firstTranslatedName;
        }

        return EmptyToNull(slug) ?? fallback;
    }

    private static bool UpsertAudio(
        Entry entry,
        ContentPackageAudio audio,
        StoredMediaFile stored,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        string? userId)
    {
        var audioKey = ResolveAudioTrackImportKey(audio);
        var language = audioKey.LanguageCode;
        var kind = audioKey.Kind;
        var sortOrder = audioKey.SortOrder;
        var title = EmptyToNull(audio.Title);
        var existing = entry.AudioTracks
            .Where(track => track.LanguageCode == language && track.Kind == kind)
            .OrderBy(track => track.SortOrder)
            .FirstOrDefault(track =>
                track.SortOrder == sortOrder ||
                (title is not null && string.Equals(track.Title, title, StringComparison.OrdinalIgnoreCase)));
        var isPrimary = audio.IsPrimary ?? existing?.IsPrimary ?? !entry.AudioTracks.Any(track => track.LanguageCode == language);
        if (isPrimary)
        {
            foreach (var track in entry.AudioTracks.Where(track => track.LanguageCode == language))
            {
                track.IsPrimary = false;
            }
        }

        if (existing is null)
        {
            entry.AudioTracks.Add(new EntryAudioTrack
            {
                Entry = entry,
                LanguageCode = language,
                Kind = kind,
                StorageProvider = stored.StorageProvider,
                StorageKey = stored.StorageKey,
                PublicUrl = stored.PublicUrl,
                MediaType = stored.MediaType,
                DurationSeconds = audio.DurationSeconds,
                SortOrder = sortOrder,
                IsPrimary = isPrimary,
                Title = title ?? $"{entry.DefaultTitle} narration",
                Transcript = EmptyToNull(audio.Transcript),
                Attribution = EmptyToNull(audio.Attribution),
                License = EmptyToNull(audio.License),
                SourceUrl = EmptyToNull(audio.SourceUrl),
                CreatedByUserId = userId
            });
            return false;
        }

        TryDeleteLocalFile(existing.StorageProvider, existing.StorageKey, environment, configuration);
        existing.Kind = kind;
        existing.StorageProvider = stored.StorageProvider;
        existing.StorageKey = stored.StorageKey;
        existing.PublicUrl = stored.PublicUrl;
        existing.MediaType = stored.MediaType;
        existing.DurationSeconds = audio.DurationSeconds;
        existing.SortOrder = sortOrder;
        existing.IsPrimary = isPrimary;
        existing.Title = title ?? existing.Title ?? $"{entry.DefaultTitle} narration";
        existing.Transcript = EmptyToNull(audio.Transcript);
        existing.Attribution = EmptyToNull(audio.Attribution);
        existing.License = EmptyToNull(audio.License);
        existing.SourceUrl = EmptyToNull(audio.SourceUrl);
        existing.UpdatedAt = DateTimeOffset.UtcNow;
        existing.UpdatedByUserId = userId;
        return true;
    }

    private static void RemoveStaleAudioTracks(
        Entry entry,
        ISet<AudioTrackImportKey> importedAudioKeys,
        ISet<string> authoritativeAudioLanguages,
        HistoryDbContext dbContext,
        IWebHostEnvironment environment,
        IConfiguration configuration)
    {
        if (importedAudioKeys.Count == 0 || authoritativeAudioLanguages.Count == 0)
        {
            return;
        }

        var staleTracks = entry.AudioTracks
            .Where(track =>
                authoritativeAudioLanguages.Contains(track.LanguageCode) &&
                !importedAudioKeys.Contains(new AudioTrackImportKey(track.LanguageCode, track.Kind, track.SortOrder)))
            .ToList();
        foreach (var staleTrack in staleTracks)
        {
            TryDeleteLocalFile(staleTrack.StorageProvider, staleTrack.StorageKey, environment, configuration);
            dbContext.EntryAudioTracks.Remove(staleTrack);
        }
    }

    private static AudioTrackImportKey ResolveAudioTrackImportKey(ContentPackageAudio audio) =>
        new(
            NormalizeLanguage(audio.LanguageCode),
            ParseEnum(audio.Kind, AudioKind.Narration),
            audio.SortOrder ?? 0);

    private static bool UpsertWorldDivisionAudio(
        string worldDivisionId,
        ContentPackageWorldDivision division,
        ICollection<WorldDivisionAudioTrack> existingTracks,
        ContentPackageAudio audio,
        StoredMediaFile stored,
        HistoryDbContext dbContext,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        string? userId)
    {
        var audioKey = ResolveAudioTrackImportKey(audio);
        var language = audioKey.LanguageCode;
        var kind = audioKey.Kind;
        var sortOrder = audioKey.SortOrder;
        var title = EmptyToNull(audio.Title);
        var existing = existingTracks
            .Where(track => track.LanguageCode == language && track.Kind == kind)
            .OrderBy(track => track.SortOrder)
            .FirstOrDefault(track =>
                track.SortOrder == sortOrder ||
                (title is not null && string.Equals(track.Title, title, StringComparison.OrdinalIgnoreCase)));
        var isPrimary = audio.IsPrimary ?? existing?.IsPrimary ?? !existingTracks.Any(track => track.LanguageCode == language);
        if (isPrimary)
        {
            foreach (var track in existingTracks.Where(track => track.LanguageCode == language))
            {
                track.IsPrimary = false;
            }
        }

        if (existing is null)
        {
            var newTrack = new WorldDivisionAudioTrack
            {
                WorldDivisionId = worldDivisionId,
                LanguageCode = language,
                Kind = kind,
                StorageProvider = stored.StorageProvider,
                StorageKey = stored.StorageKey,
                PublicUrl = stored.PublicUrl,
                MediaType = stored.MediaType,
                DurationSeconds = audio.DurationSeconds,
                SortOrder = sortOrder,
                IsPrimary = isPrimary,
                Title = title ?? $"{ResolveWorldDivisionTitle(division)} narration",
                Transcript = EmptyToNull(audio.Transcript),
                Attribution = EmptyToNull(audio.Attribution),
                License = EmptyToNull(audio.License),
                SourceUrl = EmptyToNull(audio.SourceUrl),
                CreatedByUserId = userId
            };
            dbContext.WorldDivisionAudioTracks.Add(newTrack);
            existingTracks.Add(newTrack);
            return false;
        }

        TryDeleteLocalFile(existing.StorageProvider, existing.StorageKey, environment, configuration);
        existing.Kind = kind;
        existing.StorageProvider = stored.StorageProvider;
        existing.StorageKey = stored.StorageKey;
        existing.PublicUrl = stored.PublicUrl;
        existing.MediaType = stored.MediaType;
        existing.DurationSeconds = audio.DurationSeconds;
        existing.SortOrder = sortOrder;
        existing.IsPrimary = isPrimary;
        existing.Title = title ?? existing.Title ?? $"{ResolveWorldDivisionTitle(division)} narration";
        existing.Transcript = EmptyToNull(audio.Transcript);
        existing.Attribution = EmptyToNull(audio.Attribution);
        existing.License = EmptyToNull(audio.License);
        existing.SourceUrl = EmptyToNull(audio.SourceUrl);
        existing.UpdatedAt = DateTimeOffset.UtcNow;
        existing.UpdatedByUserId = userId;
        return true;
    }

    private static bool UpsertImage(
        Entry entry,
        ContentPackageImage image,
        StoredMediaFile stored,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        string? userId)
    {
        var isPrimary = image.IsPrimary ?? true;
        var kind = ParseEnum(image.Kind, ImageKind.Primary);
        var sortOrder = image.SortOrder ?? 0;
        var existing = isPrimary
            ? entry.Images
                .Where(item => item.IsPrimary)
                .OrderBy(item => item.SortOrder)
                .FirstOrDefault()
            : entry.Images
                .FirstOrDefault(item => !item.IsPrimary && item.Kind == kind && item.SortOrder == sortOrder);
        if (isPrimary)
        {
            foreach (var entryImage in entry.Images)
            {
                entryImage.IsPrimary = false;
            }
        }

        if (existing is null)
        {
            var entryImage = new EntryImage
            {
                Entry = entry,
                Kind = kind,
                StorageProvider = stored.StorageProvider,
                StorageKey = stored.StorageKey,
                PublicUrl = stored.PublicUrl,
                MediaType = stored.MediaType,
                Width = image.Width,
                Height = image.Height,
                SortOrder = sortOrder,
                IsPrimary = isPrimary,
                Attribution = EmptyToNull(image.Attribution),
                License = EmptyToNull(image.License),
                SourceUrl = EmptyToNull(image.SourceUrl),
                CreatedByUserId = userId
            };
            UpsertImageTranslation(entryImage, image);
            entry.Images.Add(entryImage);
            return false;
        }

        TryDeleteLocalFile(existing.StorageProvider, existing.StorageKey, environment, configuration);
        existing.Kind = kind;
        existing.StorageProvider = stored.StorageProvider;
        existing.StorageKey = stored.StorageKey;
        existing.PublicUrl = stored.PublicUrl;
        existing.MediaType = stored.MediaType;
        existing.Width = image.Width;
        existing.Height = image.Height;
        existing.SortOrder = sortOrder;
        existing.IsPrimary = isPrimary;
        existing.Attribution = EmptyToNull(image.Attribution);
        existing.License = EmptyToNull(image.License);
        existing.SourceUrl = EmptyToNull(image.SourceUrl);
        existing.UpdatedAt = DateTimeOffset.UtcNow;
        existing.UpdatedByUserId = userId;
        UpsertImageTranslation(existing, image);
        return true;
    }

    private static void UpsertImageTranslation(EntryImage entryImage, ContentPackageImage image)
    {
        var language = NormalizeLanguage(image.LanguageCode);
        var translation = entryImage.Translations.FirstOrDefault(item => item.LanguageCode == language);
        if (translation is null)
        {
            entryImage.Translations.Add(new EntryImageTranslation
            {
                LanguageCode = language,
                AltText = EmptyToNull(image.AltText),
                Caption = EmptyToNull(image.Caption)
            });
            return;
        }

        translation.AltText = EmptyToNull(image.AltText);
        translation.Caption = EmptyToNull(image.Caption);
    }

    private static ExistingPackageEntry? ResolveExistingEntry(
        ContentPackageEntry entry,
        IEnumerable<ExistingPackageEntry> existingEntries,
        bool updateExistingRows)
    {
        if (!updateExistingRows)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(entry.SourceSheet) && entry.SourceRow is not null)
        {
            var bySourceRow = existingEntries.FirstOrDefault(existing =>
                string.Equals(existing.SourceSheet, entry.SourceSheet, StringComparison.OrdinalIgnoreCase) &&
                existing.SourceRow == entry.SourceRow);
            if (bySourceRow is not null)
            {
                return bySourceRow;
            }
        }

        var slug = ResolveSlug(entry);
        return existingEntries.FirstOrDefault(existing => existing.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
    }

    private static Entry? ResolveExistingEntry(
        ContentPackageEntry entry,
        IReadOnlyDictionary<string, Entry> bySourceRow,
        IReadOnlyDictionary<string, Entry> bySlug)
    {
        if (!string.IsNullOrWhiteSpace(entry.SourceSheet) && entry.SourceRow is not null &&
            bySourceRow.TryGetValue($"{entry.SourceSheet}|{entry.SourceRow}", out var sourceRowEntry))
        {
            return sourceRowEntry;
        }

        var slug = ResolveSlug(entry);
        return bySlug.GetValueOrDefault(slug);
    }

    private static async Task<PackageReadResult> ReadPackageDocumentAsync(
        ZipArchive archive,
        CancellationToken cancellationToken)
    {
        var entry = archive.GetEntry("entries.json");
        if (entry is null)
        {
            return new PackageReadResult(null, "Content package must contain entries.json at the ZIP root.");
        }

        await using var stream = entry.Open();
        var document = await JsonSerializer.DeserializeAsync<ContentPackageDocument>(stream, JsonOptions, cancellationToken);
        if (document is null)
        {
            return new PackageReadResult(null, "entries.json is empty or invalid.");
        }

        if (document.SchemaVersion != 1)
        {
            return new PackageReadResult(null, "Unsupported entries.json schemaVersion. Expected 1.");
        }

        if (document.Entries.Count == 0 && document.WorldDivisions.Count == 0)
        {
            return new PackageReadResult(null, "Content package contains no entries or world divisions.");
        }

        return new PackageReadResult(document, null);
    }

    private static IReadOnlyList<string> ValidatePackageEntry(ContentPackageEntry entry, ZipArchive archive)
    {
        var warnings = new List<string>();
        if (string.IsNullOrWhiteSpace(entry.Title) && entry.Translations.Count == 0)
        {
            warnings.Add("Entry has no title or translations.");
        }

        foreach (var tag in entry.Tags)
        {
            AddTaxonomyTranslationWarnings(warnings, "Tag", tag.Slug, tag.Translations);
        }

        foreach (var period in entry.TimePeriods)
        {
            AddTaxonomyTranslationWarnings(warnings, "Time period", period.Slug, period.Translations);
        }

        foreach (var place in entry.Places)
        {
            AddTaxonomyTranslationWarnings(warnings, "Place", place.Slug, place.Translations);
        }

        foreach (var route in entry.Routes)
        {
            if (route.Points.Count is > 0 and < 2)
            {
                warnings.Add($"Route '{route.Name ?? "unnamed"}' has fewer than two points.");
            }

            foreach (var point in route.Points)
            {
                AddTaxonomyTranslationWarnings(warnings, "Route point", point.Slug, point.Translations);
                if (point.Longitude is null || point.Latitude is null)
                {
                    warnings.Add($"Route point '{point.Name ?? point.Slug ?? "unnamed"}' has no coordinates.");
                }
                else if (point.Longitude is < -180 or > 180 || point.Latitude is < -90 or > 90)
                {
                    warnings.Add($"Route point '{point.Name ?? point.Slug ?? "unnamed"}' has coordinates outside valid longitude/latitude bounds.");
                }
            }
        }

        foreach (var audio in entry.Audio)
        {
            if (string.IsNullOrWhiteSpace(audio.Path))
            {
                warnings.Add("Audio item has no path.");
            }
            else
            {
                var extension = Path.GetExtension(audio.Path);
                if (!AllowedAudioExtensions.Contains(extension))
                {
                    warnings.Add($"Unsupported audio extension '{extension}' for '{audio.Path}'.");
                }
                else if (!PackageEntryExists(archive, audio.Path))
                {
                    warnings.Add($"Audio file '{audio.Path}' is missing from the ZIP.");
                }
            }
        }

        foreach (var image in entry.Images)
        {
            if (string.IsNullOrWhiteSpace(image.Path))
            {
                warnings.Add("Image item has no path.");
            }
            else
            {
                var extension = Path.GetExtension(image.Path);
                if (!AllowedImageExtensions.Contains(extension))
                {
                    warnings.Add($"Unsupported image extension '{extension}' for '{image.Path}'.");
                }
                else if (!PackageEntryExists(archive, image.Path))
                {
                    warnings.Add($"Image file '{image.Path}' is missing from the ZIP.");
                }
            }
        }

        return warnings;
    }

    private static IReadOnlyList<string> ValidatePackageWorldDivision(ContentPackageWorldDivision division, ZipArchive archive)
    {
        var warnings = new List<string>();
        if (string.IsNullOrWhiteSpace(division.Id))
        {
            warnings.Add("World division has no id.");
        }

        foreach (var audio in division.Audio)
        {
            if (string.IsNullOrWhiteSpace(audio.Path))
            {
                warnings.Add("Audio item has no path.");
            }
            else
            {
                var extension = Path.GetExtension(audio.Path);
                if (!AllowedAudioExtensions.Contains(extension))
                {
                    warnings.Add($"Unsupported audio extension '{extension}' for '{audio.Path}'.");
                }
                else if (!PackageEntryExists(archive, audio.Path))
                {
                    warnings.Add($"Audio file '{audio.Path}' is missing from the ZIP.");
                }
            }
        }

        return warnings;
    }

    private static IReadOnlyList<ContentPackageAudio> ResolvePackageAudioFiles(ContentPackageEntry entry, ZipArchive archive)
    {
        var resolved = new List<ContentPackageAudio>();
        var resolvedKeys = new HashSet<AudioTrackImportKey>();
        var explicitPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var audio in entry.Audio)
        {
            var normalizedPath = NormalizePackagePath(audio.Path);
            if (normalizedPath is null)
            {
                continue;
            }

            explicitPaths.Add(normalizedPath);
            if (!AllowedAudioExtensions.Contains(Path.GetExtension(normalizedPath)) || !PackageEntryExists(archive, normalizedPath))
            {
                continue;
            }

            var resolvedAudio = ResolvePackageAudioMetadata(entry, audio, normalizedPath);
            if (resolvedKeys.Add(ResolveAudioTrackImportKey(resolvedAudio)))
            {
                resolved.Add(resolvedAudio);
            }
        }

        foreach (var audio in DiscoverSlugFirstPackageAudio(entry, archive))
        {
            var normalizedPath = NormalizePackagePath(audio.Path);
            if (normalizedPath is null || explicitPaths.Contains(normalizedPath))
            {
                continue;
            }

            if (resolvedKeys.Add(ResolveAudioTrackImportKey(audio)))
            {
                resolved.Add(audio);
            }
        }

        return resolved;
    }

    private static IReadOnlyList<ContentPackageAudio> ResolveWorldDivisionAudioFiles(
        ContentPackageWorldDivision division,
        ZipArchive archive)
    {
        var resolved = new List<ContentPackageAudio>();
        var resolvedKeys = new HashSet<AudioTrackImportKey>();
        var explicitPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var audio in division.Audio)
        {
            var normalizedPath = NormalizePackagePath(audio.Path);
            if (normalizedPath is null)
            {
                continue;
            }

            explicitPaths.Add(normalizedPath);
            if (!AllowedAudioExtensions.Contains(Path.GetExtension(normalizedPath)) || !PackageEntryExists(archive, normalizedPath))
            {
                continue;
            }

            var resolvedAudio = ResolveWorldDivisionAudioMetadata(division, audio, normalizedPath);
            if (resolvedKeys.Add(ResolveAudioTrackImportKey(resolvedAudio)))
            {
                resolved.Add(resolvedAudio);
            }
        }

        foreach (var audio in DiscoverWorldDivisionAudio(division, archive))
        {
            var normalizedPath = NormalizePackagePath(audio.Path);
            if (normalizedPath is null || explicitPaths.Contains(normalizedPath))
            {
                continue;
            }

            if (resolvedKeys.Add(ResolveAudioTrackImportKey(audio)))
            {
                resolved.Add(audio);
            }
        }

        return resolved;
    }

    private static IEnumerable<ContentPackageAudio> DiscoverSlugFirstPackageAudio(ContentPackageEntry entry, ZipArchive archive)
    {
        var slug = ResolveSlug(entry);
        var prefix = $"audio/{slug}/";
        foreach (var archiveEntry in archive.Entries)
        {
            var packagePath = NormalizePackagePath(archiveEntry.FullName);
            if (archiveEntry.Length <= 0 || packagePath is null || !packagePath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var extension = Path.GetExtension(packagePath);
            if (!AllowedAudioExtensions.Contains(extension))
            {
                continue;
            }

            var relativePath = packagePath[prefix.Length..];
            var segments = relativePath.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (segments.Length != 2)
            {
                continue;
            }

            var language = NormalizeLanguage(segments[0]);
            if (!PackageAudioLanguages.Contains(language))
            {
                continue;
            }

            var attribute = Path.GetFileNameWithoutExtension(segments[1]);
            if (!PackageAudioAttributes.TryGetValue(attribute, out var definition))
            {
                continue;
            }

            yield return new ContentPackageAudio
            {
                Path = packagePath,
                LanguageCode = language,
                Kind = definition.Kind.ToString(),
                IsPrimary = definition.IsPrimary,
                SortOrder = definition.SortOrder,
                Title = $"{ResolveTitle(entry)} {attribute}",
                Transcript = ReadPackageText(archive, $"audio/{slug}/{segments[0]}/{attribute}.txt")
            };
        }
    }

    private static IEnumerable<ContentPackageAudio> DiscoverWorldDivisionAudio(
        ContentPackageWorldDivision division,
        ZipArchive archive)
    {
        var divisionId = ResolveWorldDivisionId(division);
        var prefix = $"audio/world-divisions/{divisionId}/";
        foreach (var archiveEntry in archive.Entries)
        {
            var packagePath = NormalizePackagePath(archiveEntry.FullName);
            if (archiveEntry.Length <= 0 || packagePath is null || !packagePath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var extension = Path.GetExtension(packagePath);
            if (!AllowedAudioExtensions.Contains(extension))
            {
                continue;
            }

            var relativePath = packagePath[prefix.Length..];
            var segments = relativePath.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (segments.Length != 2)
            {
                continue;
            }

            var language = NormalizeLanguage(segments[0]);
            if (!PackageAudioLanguages.Contains(language))
            {
                continue;
            }

            var attribute = Path.GetFileNameWithoutExtension(segments[1]);
            if (!WorldDivisionAudioAttributes.TryGetValue(attribute, out var definition))
            {
                continue;
            }

            yield return new ContentPackageAudio
            {
                Path = packagePath,
                LanguageCode = language,
                Kind = definition.Kind.ToString(),
                IsPrimary = definition.IsPrimary,
                SortOrder = definition.SortOrder,
                Title = $"{ResolveWorldDivisionTitle(division)} {attribute}",
                Transcript = ReadPackageText(archive, $"audio/world-divisions/{divisionId}/{segments[0]}/{attribute}.txt")
            };
        }
    }

    private static ContentPackageAudio ResolvePackageAudioMetadata(
        ContentPackageEntry entry,
        ContentPackageAudio audio,
        string normalizedPath)
    {
        TryResolveSlugFirstAudioPath(entry, normalizedPath, out var inferredLanguage, out var inferredAttribute, out var inferredDefinition);
        return new ContentPackageAudio
        {
            Path = normalizedPath,
            LanguageCode = EmptyToNull(audio.LanguageCode) ?? inferredLanguage,
            Kind = EmptyToNull(audio.Kind) ?? inferredDefinition?.Kind.ToString(),
            IsPrimary = audio.IsPrimary ?? inferredDefinition?.IsPrimary,
            SortOrder = audio.SortOrder ?? inferredDefinition?.SortOrder,
            Title = EmptyToNull(audio.Title) ?? (inferredAttribute is null ? null : $"{ResolveTitle(entry)} {inferredAttribute}"),
            Transcript = EmptyToNull(audio.Transcript),
            DurationSeconds = audio.DurationSeconds,
            Attribution = EmptyToNull(audio.Attribution),
            License = EmptyToNull(audio.License),
            SourceUrl = EmptyToNull(audio.SourceUrl)
        };
    }

    private static ContentPackageAudio ResolveWorldDivisionAudioMetadata(
        ContentPackageWorldDivision division,
        ContentPackageAudio audio,
        string normalizedPath)
    {
        TryResolveWorldDivisionAudioPath(division, normalizedPath, out var inferredLanguage, out var inferredAttribute, out var inferredDefinition);
        return new ContentPackageAudio
        {
            Path = normalizedPath,
            LanguageCode = EmptyToNull(audio.LanguageCode) ?? inferredLanguage,
            Kind = EmptyToNull(audio.Kind) ?? inferredDefinition?.Kind.ToString(),
            IsPrimary = audio.IsPrimary ?? inferredDefinition?.IsPrimary,
            SortOrder = audio.SortOrder ?? inferredDefinition?.SortOrder,
            Title = EmptyToNull(audio.Title) ?? (inferredAttribute is null ? null : $"{ResolveWorldDivisionTitle(division)} {inferredAttribute}"),
            Transcript = EmptyToNull(audio.Transcript),
            DurationSeconds = audio.DurationSeconds,
            Attribution = EmptyToNull(audio.Attribution),
            License = EmptyToNull(audio.License),
            SourceUrl = EmptyToNull(audio.SourceUrl)
        };
    }

    private static bool TryResolveSlugFirstAudioPath(
        ContentPackageEntry entry,
        string packagePath,
        out string? language,
        out string? attribute,
        out AudioAttributeDefinition? definition)
    {
        language = null;
        attribute = null;
        definition = null;

        var slug = ResolveSlug(entry);
        var prefix = $"audio/{slug}/";
        if (!packagePath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var relativePath = packagePath[prefix.Length..];
        var segments = relativePath.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (segments.Length != 2)
        {
            return false;
        }

        var normalizedLanguage = NormalizeLanguage(segments[0]);
        if (!PackageAudioLanguages.Contains(normalizedLanguage))
        {
            return false;
        }

        var fileAttribute = Path.GetFileNameWithoutExtension(segments[1]);
        if (!PackageAudioAttributes.TryGetValue(fileAttribute, out var audioDefinition))
        {
            return false;
        }

        language = normalizedLanguage;
        attribute = fileAttribute;
        definition = audioDefinition;
        return true;
    }

    private static bool TryResolveWorldDivisionAudioPath(
        ContentPackageWorldDivision division,
        string packagePath,
        out string? language,
        out string? attribute,
        out AudioAttributeDefinition? definition)
    {
        language = null;
        attribute = null;
        definition = null;

        var divisionId = ResolveWorldDivisionId(division);
        var prefix = $"audio/world-divisions/{divisionId}/";
        if (!packagePath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var relativePath = packagePath[prefix.Length..];
        var segments = relativePath.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (segments.Length != 2)
        {
            return false;
        }

        var normalizedLanguage = NormalizeLanguage(segments[0]);
        if (!PackageAudioLanguages.Contains(normalizedLanguage))
        {
            return false;
        }

        var fileAttribute = Path.GetFileNameWithoutExtension(segments[1]);
        if (!WorldDivisionAudioAttributes.TryGetValue(fileAttribute, out var audioDefinition))
        {
            return false;
        }

        language = normalizedLanguage;
        attribute = fileAttribute;
        definition = audioDefinition;
        return true;
    }

    private static string? ReadPackageText(ZipArchive archive, string packagePath)
    {
        var entry = GetPackageEntry(archive, packagePath);
        if (entry is not { Length: > 0 })
        {
            return null;
        }

        using var stream = entry.Open();
        using var reader = new StreamReader(stream);
        return EmptyToNull(reader.ReadToEnd());
    }

    private static void AddTaxonomyTranslationWarnings(
        ICollection<string> warnings,
        string itemType,
        string? slug,
        IReadOnlyDictionary<string, string> translations)
    {
        var hasEnglishTranslation = translations.Any(translation =>
            NormalizeLanguage(translation.Key) == "en" &&
            !string.IsNullOrWhiteSpace(translation.Value));

        if (!hasEnglishTranslation)
        {
            warnings.Add($"{itemType} '{slug ?? "unknown"}' must define translations.en.");
        }
    }

    private static async Task<StoredMediaFile?> StorePackageMediaAsync(
        ZipArchive archive,
        string? packagePath,
        string mediaFolder,
        IMediaStorageService mediaStorage,
        HttpRequest httpRequest,
        CancellationToken cancellationToken)
    {
        var archiveEntry = GetPackageEntry(archive, packagePath);
        if (archiveEntry is null)
        {
            return null;
        }

        var extension = Path.GetExtension(archiveEntry.Name).ToLowerInvariant();
        await using var source = archiveEntry.Open();
        return await mediaStorage.StoreAsync(
            source,
            archiveEntry.Name,
            ResolveMediaType(extension),
            mediaFolder,
            httpRequest,
            cancellationToken);
    }

    private static ZipArchiveEntry? GetPackageEntry(ZipArchive archive, string? packagePath)
    {
        var normalized = NormalizePackagePath(packagePath);
        if (normalized is null)
        {
            return null;
        }

        return archive.GetEntry(normalized) ??
            archive.Entries.FirstOrDefault(entry =>
                string.Equals(NormalizePackagePath(entry.FullName), normalized, StringComparison.OrdinalIgnoreCase));
    }

    private static string? NormalizePackagePath(string? packagePath)
    {
        if (string.IsNullOrWhiteSpace(packagePath))
        {
            return null;
        }

        var normalized = packagePath.Replace('\\', '/').TrimStart('/');
        var segments = normalized.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (segments.Length == 0 || segments.Any(segment => segment == ".."))
        {
            return null;
        }

        return string.Join('/', segments);
    }

    private static bool PackageEntryExists(ZipArchive archive, string? packagePath) =>
        GetPackageEntry(archive, packagePath) is { Length: > 0 };

    private static string? ValidatePackageUpload(IFormFile file, IConfiguration configuration)
    {
        if (file.Length == 0)
        {
            return "Uploaded content package is empty.";
        }

        var maxBytes = configuration.GetValue<long?>("Media:MaxContentPackageBytes") ?? DefaultMaxContentPackageBytes;
        if (file.Length > maxBytes)
        {
            return $"Uploaded content package is too large. Maximum size is {maxBytes / 1024 / 1024} MB.";
        }

        return Path.GetExtension(file.FileName).Equals(".zip", StringComparison.OrdinalIgnoreCase)
            ? null
            : "Content package must be a .zip file.";
    }

    private static string MakeUniqueSlug(string slug, ISet<string> usedSlugs)
    {
        var uniqueSlug = string.IsNullOrWhiteSpace(slug) ? Guid.NewGuid().ToString("n") : slug;
        var suffix = 2;
        while (!usedSlugs.Add(uniqueSlug))
        {
            uniqueSlug = $"{slug}-{suffix}";
            suffix++;
        }

        return uniqueSlug;
    }

    private static TEnum ParseEnum<TEnum>(string? value, TEnum fallback)
        where TEnum : struct
    {
        return Enum.TryParse<TEnum>(value, ignoreCase: true, out var parsed) ? parsed : fallback;
    }

    private static string ResolveSlug(ContentPackageEntry entry) =>
        EndpointHelpers.Slugify(EmptyToNull(entry.Slug) ?? ResolveTitle(entry));

    private static string ResolveTitle(ContentPackageEntry entry)
    {
        if (!string.IsNullOrWhiteSpace(entry.Title))
        {
            return entry.Title.Trim();
        }

        var firstTranslationTitle = entry.Translations.Values
            .Select(translation => translation.Title)
            .FirstOrDefault(title => !string.IsNullOrWhiteSpace(title));
        return string.IsNullOrWhiteSpace(firstTranslationTitle)
            ? "Imported entry"
            : firstTranslationTitle!.Trim();
    }

    private static string ResolveWorldDivisionId(ContentPackageWorldDivision division) =>
        EndpointHelpers.Slugify(EmptyToNull(division.Id) ?? ResolveWorldDivisionTitle(division));

    private static string ResolveWorldDivisionTitle(ContentPackageWorldDivision division) =>
        TextFromJsonValue(division.Title) ?? EmptyToNull(division.Id) ?? "World division";

    private static string? TextFromJsonValue(JsonElement? value)
    {
        if (value is null)
        {
            return null;
        }

        if (value.Value.ValueKind == JsonValueKind.String)
        {
            return EmptyToNull(value.Value.GetString());
        }

        if (value.Value.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (value.Value.TryGetProperty("en", out var englishValue) && englishValue.ValueKind == JsonValueKind.String)
        {
            return EmptyToNull(englishValue.GetString());
        }

        foreach (var property in value.Value.EnumerateObject())
        {
            if (property.Value.ValueKind == JsonValueKind.String)
            {
                return EmptyToNull(property.Value.GetString());
            }
        }

        return null;
    }

    private static string NormalizeLanguage(string? language)
    {
        var normalized = EndpointHelpers.NormalizeLanguage(language);
        return normalized is "sp" or "spa" or "spanish" ? "es" : normalized;
    }

    private static string? EmptyToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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

    private static string ResolveMediaType(string extension) =>
        extension.ToLowerInvariant() switch
        {
            ".mp3" => "audio/mpeg",
            ".m4a" or ".mp4" => "audio/mp4",
            ".ogg" or ".opus" => "audio/ogg",
            ".wav" => "audio/wav",
            ".webm" => "audio/webm",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            ".avif" => "image/avif",
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

    private static ContentPackageImportSummary ParseContentPackageImportSummary(string? summaryJson)
    {
        if (string.IsNullOrWhiteSpace(summaryJson))
        {
            return ContentPackageImportSummary.Empty;
        }

        try
        {
            using var document = JsonDocument.Parse(summaryJson);
            var root = document.RootElement;
            return new ContentPackageImportSummary(
                GetString(root, "packageSlug"),
                GetString(root, "title"),
                GetInt32(root, "entriesRead"),
                GetInt32(root, "entriesCreated"),
                GetInt32(root, "entriesUpdated"),
                GetInt32(root, "audioTracksCreated"),
                GetInt32(root, "audioTracksUpdated"),
                GetInt32(root, "imagesCreated"),
                GetInt32(root, "imagesUpdated"),
                GetArrayLength(root, "warnings"));
        }
        catch (JsonException)
        {
            return ContentPackageImportSummary.Empty;
        }
    }

    private static string? GetString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
            ? EmptyToNull(property.GetString())
            : null;

    private static int GetInt32(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property) && property.TryGetInt32(out var value)
            ? value
            : 0;

    private static int GetArrayLength(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.Array
            ? property.GetArrayLength()
            : 0;

    private sealed record ExistingPackageEntry(Guid Id, string Slug, string? SourceSheet, int? SourceRow);

    private sealed record ContentPackageImportSummary(
        string? PackageSlug,
        string? Title,
        int EntriesRead,
        int EntriesCreated,
        int EntriesUpdated,
        int AudioTracksCreated,
        int AudioTracksUpdated,
        int ImagesCreated,
        int ImagesUpdated,
        int WarningCount)
    {
        public static ContentPackageImportSummary Empty { get; } = new(null, null, 0, 0, 0, 0, 0, 0, 0, 0);
    }

    private sealed record ContentDataClearResult(
        int EntriesDeleted,
        int TagsDeleted,
        int TimePeriodsDeleted,
        int PlacesDeleted,
        int SourcesDeleted,
        int ActorsDeleted,
        int MediaBlobsDeleted,
        int ImportBatchesDeleted)
    {
        public static ContentDataClearResult Empty { get; } = new(0, 0, 0, 0, 0, 0, 0, 0);
    }

    private sealed record AudioTrackImportKey(string LanguageCode, AudioKind Kind, int SortOrder);

    private sealed record AudioAttributeDefinition(AudioKind Kind, bool IsPrimary, int SortOrder);

    private sealed record ContentPackageRouteAttachCounts(int RoutesAttached, int PlacesAttached);

    private sealed record PackageReadResult(ContentPackageDocument? Document, string? Error);

    private sealed class ContentPackageDocument
    {
        public int SchemaVersion { get; set; }
        public string? PackageSlug { get; set; }
        public string? Title { get; set; }
        public string? DefaultLanguage { get; set; }
        public List<ContentPackageEntry> Entries { get; set; } = [];
        public List<ContentPackageWorldDivision> WorldDivisions { get; set; } = [];
    }

    private sealed class ContentPackageWorldDivision
    {
        public string? Id { get; set; }
        public JsonElement? Title { get; set; }
        public List<ContentPackageAudio> Audio { get; set; } = [];
    }

    private sealed class ContentPackageEntry
    {
        public string? Slug { get; set; }
        public string? SourceSheet { get; set; }
        public int? SourceRow { get; set; }
        public string? Kind { get; set; }
        public string? Status { get; set; }
        public string? RealityStatus { get; set; }
        public string? IconKey { get; set; }
        public string? Title { get; set; }
        public string? DateLabel { get; set; }
        public long? StartYear { get; set; }
        public byte? StartMonth { get; set; }
        public byte? StartDay { get; set; }
        public long? EndYear { get; set; }
        public byte? EndMonth { get; set; }
        public byte? EndDay { get; set; }
        public TimePrecision? TimePrecision { get; set; }
        public string? TimeConfidence { get; set; }
        public Dictionary<string, ContentPackageTranslation> Translations { get; set; } = [];
        public List<ContentPackageTag> Tags { get; set; } = [];
        public List<ContentPackageTimePeriod> TimePeriods { get; set; } = [];
        public List<ContentPackageSource> Sources { get; set; } = [];
        public List<ContentPackagePlace> Places { get; set; } = [];
        public List<ContentPackageRoute> Routes { get; set; } = [];
        public List<ContentPackageAudio> Audio { get; set; } = [];
        public List<ContentPackageImage> Images { get; set; } = [];
    }

    private sealed class ContentPackageTranslation
    {
        public string? Title { get; set; }
        public string? Summary { get; set; }
        public string? Description { get; set; }
        public string? WhyItMatters { get; set; }
        public string? DatingNote { get; set; }
    }

    private sealed class ContentPackageTag
    {
        public string? Slug { get; set; }
        public string? Group { get; set; }
        public Dictionary<string, string> Translations { get; set; } = [];
    }

    private sealed class ContentPackageTimePeriod
    {
        public string? Slug { get; set; }
        public Dictionary<string, string> Translations { get; set; } = [];
        public string? PeriodType { get; set; }
        public string? RelationType { get; set; }
        public long? StartYear { get; set; }
        public long? EndYear { get; set; }
    }

    private sealed class ContentPackageSource
    {
        public string? Url { get; set; }
        public string? Title { get; set; }
        public string? Publisher { get; set; }
        public string? LanguageCode { get; set; }
        public string? SupportsField { get; set; }
        public string? Note { get; set; }
    }

    private sealed class ContentPackagePlace
    {
        public string? Slug { get; set; }
        public Dictionary<string, string> Translations { get; set; } = [];
        public string? Role { get; set; }
        public string? PlaceType { get; set; }
        public string? SpatialConfidence { get; set; }
        public double? Longitude { get; set; }
        public double? Latitude { get; set; }
        public string? ModernCountryCode { get; set; }
        public string? WikidataId { get; set; }
        public int? GeoNamesId { get; set; }
        public int? SortOrder { get; set; }
        public string? Note { get; set; }
    }

    private sealed class ContentPackageRoute
    {
        public string? Name { get; set; }
        public string? RouteType { get; set; }
        public string? SpatialConfidence { get; set; }
        public string? SourceNote { get; set; }
        public List<ContentPackageRoutePoint> Points { get; set; } = [];
    }

    private sealed class ContentPackageRoutePoint
    {
        public string? Slug { get; set; }
        public string? Name { get; set; }
        public Dictionary<string, string> Translations { get; set; } = [];
        public string? Role { get; set; }
        public string? PlaceType { get; set; }
        public string? SpatialConfidence { get; set; }
        public double? Longitude { get; set; }
        public double? Latitude { get; set; }
        public string? ModernCountryCode { get; set; }
        public string? WikidataId { get; set; }
        public int? GeoNamesId { get; set; }
        public int? SortOrder { get; set; }
        public string? DateLabel { get; set; }
        public string? Note { get; set; }
    }

    private sealed class ContentPackageAudio
    {
        public string? Path { get; set; }
        public string? LanguageCode { get; set; }
        public string? Kind { get; set; }
        public bool? IsPrimary { get; set; }
        public int? SortOrder { get; set; }
        public string? Title { get; set; }
        public string? Transcript { get; set; }
        public int? DurationSeconds { get; set; }
        public string? Attribution { get; set; }
        public string? License { get; set; }
        public string? SourceUrl { get; set; }
    }

    private sealed class ContentPackageImage
    {
        public string? Path { get; set; }
        public string? LanguageCode { get; set; }
        public string? Kind { get; set; }
        public bool? IsPrimary { get; set; }
        public int? SortOrder { get; set; }
        public string? AltText { get; set; }
        public string? Caption { get; set; }
        public int? Width { get; set; }
        public int? Height { get; set; }
        public string? Attribution { get; set; }
        public string? License { get; set; }
        public string? SourceUrl { get; set; }
    }
}
