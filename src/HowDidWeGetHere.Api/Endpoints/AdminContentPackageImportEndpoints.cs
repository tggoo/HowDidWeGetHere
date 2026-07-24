using System.IO.Compression;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Application.Time;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Domain.Imports;
using HowDidWeGetHere.Domain.Places;
using HowDidWeGetHere.Domain.Sources;
using HowDidWeGetHere.Domain.Tags;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminContentPackageImportEndpoints
{
    private const int Wgs84Srid = 4326;
    private const long DefaultMaxContentPackageBytes = 1024L * 1024 * 1024;

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

    public static RouteGroupBuilder MapAdminContentPackageImportEndpoints(this RouteGroupBuilder admin)
    {
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

    private static async Task<IResult> PreviewContentPackageAsync(
        [FromForm] IFormFile file,
        [FromForm] bool? publishImportedEntries,
        [FromForm] bool? updateExistingRows,
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
        var existingEntries = await dbContext.Entries
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

            tagsToAttach += entry.Tags.Count;
            periodsToAttach += entry.TimePeriods.Count;
            placesToAttach += entry.Places.Count;
            sourcesToAttach += entry.Sources.Count;
            audioToAttach += entry.Audio.Count(audio => PackageEntryExists(archive, audio.Path));
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
                entry.Places.Count,
                entry.Sources.Count,
                entry.Audio.Count,
                entry.Images.Count,
                rowWarnings));
        }

        return Results.Ok(new ContentPackageImportPreviewResult(
            document.PackageSlug ?? Path.GetFileNameWithoutExtension(file.FileName),
            document.Title ?? document.PackageSlug ?? file.FileName,
            document.Entries.Count,
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
        HistoryDbContext dbContext,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        HttpRequest httpRequest,
        ClaimsPrincipal user,
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
        var warnings = new List<string>();
        foreach (var entry in document.Entries)
        {
            warnings.AddRange(ValidatePackageEntry(entry, archive).Select(warning => $"{ResolveSlug(entry)}: {warning}"));
        }

        var existingEntries = updateExistingRows == false
            ? []
            : await dbContext.Entries
                .Include(entry => entry.Translations)
                .Include(entry => entry.Tags)
                .Include(entry => entry.TimePeriods)
                .Include(entry => entry.Places)
                .Include(entry => entry.Sources)
                .Include(entry => entry.AudioTracks)
                .Include(entry => entry.Images)
                    .ThenInclude(image => image.Translations)
                .OrderBy(entry => entry.CreatedAt)
                .ToListAsync(cancellationToken);
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

        var entriesCreated = 0;
        var entriesUpdated = 0;
        var tagsAttached = 0;
        var timePeriodsAttached = 0;
        var placesAttached = 0;
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
            var importedRow = new ImportedRow
            {
                ImportBatch = batch,
                SheetName = packageEntry.SourceSheet ?? document.PackageSlug ?? "content-package",
                RowNumber = packageEntry.SourceRow ?? index + 1,
                RawJson = JsonSerializer.Serialize(packageEntry, JsonOptions)
            };
            batch.Rows.Add(importedRow);

            var importedEntry = CreateEntry(packageEntry, publishImportedEntries ?? true);
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

            foreach (var audio in packageEntry.Audio)
            {
                var stored = await StorePackageMediaAsync(
                    archive,
                    audio.Path,
                    "audio",
                    environment,
                    configuration,
                    httpRequest,
                    cancellationToken);
                if (stored is null)
                {
                    continue;
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

            foreach (var image in packageEntry.Images)
            {
                var stored = await StorePackageMediaAsync(
                    archive,
                    image.Path,
                    "images",
                    environment,
                    configuration,
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

        batch.CompletedAt = DateTimeOffset.UtcNow;
        batch.Status = warnings.Count == 0 ? ImportStatus.Imported : ImportStatus.PartiallyImported;
        batch.SummaryJson = JsonSerializer.Serialize(new
        {
            entriesRead = document.Entries.Count,
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
            warnings
        }, JsonOptions);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new ContentPackageImportResult(
            batch.Id,
            document.Entries.Count,
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

    private static Entry CreateEntry(ContentPackageEntry packageEntry, bool publishImportedEntries)
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
            Translations = CreateTranslations(packageEntry, title)
        };
    }

    private static List<EntryTranslation> CreateTranslations(ContentPackageEntry packageEntry, string title)
    {
        if (packageEntry.Translations.Count == 0)
        {
            return
            [
                new EntryTranslation
                {
                    LanguageCode = "en",
                    Title = title
                }
            ];
        }

        return packageEntry.Translations
            .Select(translation => new EntryTranslation
            {
                LanguageCode = NormalizeLanguage(translation.Key),
                Title = string.IsNullOrWhiteSpace(translation.Value.Title) ? title : translation.Value.Title!,
                Summary = EmptyToNull(translation.Value.Summary),
                Description = EmptyToNull(translation.Value.Description),
                WhyItMatters = EmptyToNull(translation.Value.WhyItMatters),
                DatingNote = EmptyToNull(translation.Value.DatingNote)
            })
            .ToList();
    }

    private static void ApplyEntryUpdate(Entry target, Entry imported)
    {
        target.Kind = imported.Kind;
        target.Status = imported.Status;
        target.RealityStatus = imported.RealityStatus;
        target.DefaultTitle = imported.DefaultTitle;
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
        var name = EmptyToNull(packageTag.Name) ?? EmptyToNull(packageTag.Slug) ?? "Imported tag";
        var slug = EndpointHelpers.Slugify(EmptyToNull(packageTag.Slug) ?? $"{packageTag.Group}-{name}");
        var group = EmptyToNull(packageTag.Group) ?? "import";
        if (!tagCache.TryGetValue(slug, out var tag))
        {
            tag = new Tag
            {
                Slug = slug,
                TagGroup = group,
                Translations = CreateTagTranslations(packageTag, name)
            };
            tagCache[slug] = tag;
            dbContext.Tags.Add(tag);
        }
        else
        {
            UpsertTagTranslations(tag, packageTag, name);
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

    private static List<TagTranslation> CreateTagTranslations(ContentPackageTag packageTag, string fallbackName)
    {
        var translations = packageTag.Translations.Count > 0
            ? packageTag.Translations
            : new Dictionary<string, string> { [NormalizeLanguage(packageTag.LanguageCode)] = fallbackName };

        return translations
            .Where(translation => !string.IsNullOrWhiteSpace(translation.Value))
            .GroupBy(translation => NormalizeLanguage(translation.Key))
            .Select(group => new TagTranslation
            {
                LanguageCode = group.Key,
                Name = group.First().Value.Trim()
            })
            .ToList();
    }

    private static void UpsertTagTranslations(Tag tag, ContentPackageTag packageTag, string fallbackName)
    {
        foreach (var importedTranslation in CreateTagTranslations(packageTag, fallbackName))
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
        var name = EmptyToNull(packagePeriod.Name) ?? EmptyToNull(packagePeriod.Slug);
        if (name is null)
        {
            return 0;
        }

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
                Translations = CreateTimePeriodTranslations(packagePeriod, name)
            };
            periodCache[slug] = period;
            dbContext.TimePeriods.Add(period);
        }
        else
        {
            period.PeriodType = ParseEnum(packagePeriod.PeriodType, period.PeriodType);
            period.StartYear ??= startYear;
            period.EndYear ??= endYear;
            UpsertTimePeriodTranslations(period, packagePeriod, name);
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

    private static List<TimePeriodTranslation> CreateTimePeriodTranslations(ContentPackageTimePeriod packagePeriod, string fallbackName)
    {
        var translations = packagePeriod.Translations.Count > 0
            ? packagePeriod.Translations
            : new Dictionary<string, string> { [NormalizeLanguage(packagePeriod.LanguageCode)] = fallbackName };

        return translations
            .Where(translation => !string.IsNullOrWhiteSpace(translation.Value))
            .GroupBy(translation => NormalizeLanguage(translation.Key))
            .Select(group => new TimePeriodTranslation
            {
                LanguageCode = group.Key,
                Name = group.First().Value.Trim()
            })
            .ToList();
    }

    private static void UpsertTimePeriodTranslations(TimePeriod period, ContentPackageTimePeriod packagePeriod, string fallbackName)
    {
        foreach (var importedTranslation in CreateTimePeriodTranslations(packagePeriod, fallbackName))
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
        var name = EmptyToNull(packagePlace.Name) ?? EmptyToNull(packagePlace.Slug);
        if (name is null || packagePlace.Longitude is null || packagePlace.Latitude is null)
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
                Translations = CreatePlaceTranslations(packagePlace, name)
            };
            placeCache[slug] = place;
            dbContext.Places.Add(place);
        }
        else
        {
            UpsertPlaceTranslations(place, packagePlace, name);
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

    private static List<PlaceTranslation> CreatePlaceTranslations(ContentPackagePlace packagePlace, string fallbackName)
    {
        var translations = packagePlace.Translations.Count > 0
            ? packagePlace.Translations
            : new Dictionary<string, string> { [NormalizeLanguage(packagePlace.LanguageCode)] = fallbackName };
        var description = EmptyToNull(packagePlace.Note);

        return translations
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

    private static void UpsertPlaceTranslations(Place place, ContentPackagePlace packagePlace, string fallbackName)
    {
        foreach (var importedTranslation in CreatePlaceTranslations(packagePlace, fallbackName))
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

    private static bool UpsertAudio(
        Entry entry,
        ContentPackageAudio audio,
        StoredMediaFile stored,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        string? userId)
    {
        var language = NormalizeLanguage(audio.LanguageCode);
        var existing = entry.AudioTracks
            .Where(track => track.LanguageCode == language)
            .OrderByDescending(track => track.IsPrimary)
            .ThenBy(track => track.SortOrder)
            .FirstOrDefault();
        foreach (var track in entry.AudioTracks.Where(track => track.LanguageCode == language))
        {
            track.IsPrimary = false;
        }

        if (existing is null)
        {
            entry.AudioTracks.Add(new EntryAudioTrack
            {
                Entry = entry,
                LanguageCode = language,
                Kind = ParseEnum(audio.Kind, AudioKind.Narration),
                StorageProvider = StorageProvider.Local,
                StorageKey = stored.StorageKey,
                PublicUrl = stored.PublicUrl,
                MediaType = stored.MediaType,
                DurationSeconds = audio.DurationSeconds,
                SortOrder = audio.SortOrder ?? 0,
                IsPrimary = audio.IsPrimary ?? true,
                Title = EmptyToNull(audio.Title) ?? $"{entry.DefaultTitle} narration",
                Transcript = EmptyToNull(audio.Transcript),
                Attribution = EmptyToNull(audio.Attribution),
                License = EmptyToNull(audio.License),
                SourceUrl = EmptyToNull(audio.SourceUrl),
                CreatedByUserId = userId
            });
            return false;
        }

        TryDeleteLocalFile(existing.StorageProvider, existing.StorageKey, environment, configuration);
        existing.Kind = ParseEnum(audio.Kind, AudioKind.Narration);
        existing.StorageProvider = StorageProvider.Local;
        existing.StorageKey = stored.StorageKey;
        existing.PublicUrl = stored.PublicUrl;
        existing.MediaType = stored.MediaType;
        existing.DurationSeconds = audio.DurationSeconds;
        existing.SortOrder = audio.SortOrder ?? 0;
        existing.IsPrimary = audio.IsPrimary ?? true;
        existing.Title = EmptyToNull(audio.Title) ?? existing.Title ?? $"{entry.DefaultTitle} narration";
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
        var existing = isPrimary
            ? entry.Images
                .Where(item => item.IsPrimary)
                .OrderBy(item => item.SortOrder)
                .FirstOrDefault()
            : null;
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
                StorageProvider = StorageProvider.Local,
                StorageKey = stored.StorageKey,
                PublicUrl = stored.PublicUrl,
                MediaType = stored.MediaType,
                Width = image.Width,
                Height = image.Height,
                SortOrder = image.SortOrder ?? 0,
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
        existing.StorageProvider = StorageProvider.Local;
        existing.StorageKey = stored.StorageKey;
        existing.PublicUrl = stored.PublicUrl;
        existing.MediaType = stored.MediaType;
        existing.Width = image.Width;
        existing.Height = image.Height;
        existing.SortOrder = image.SortOrder ?? 0;
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

        if (document.Entries.Count == 0)
        {
            return new PackageReadResult(null, "Content package contains no entries.");
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

    private static async Task<StoredMediaFile?> StorePackageMediaAsync(
        ZipArchive archive,
        string? packagePath,
        string mediaFolder,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        HttpRequest httpRequest,
        CancellationToken cancellationToken)
    {
        var archiveEntry = GetPackageEntry(archive, packagePath);
        if (archiveEntry is null)
        {
            return null;
        }

        var extension = Path.GetExtension(archiveEntry.Name).ToLowerInvariant();
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

        await using (var source = archiveEntry.Open())
        await using (var target = File.Create(fullPath))
        {
            await source.CopyToAsync(target, cancellationToken);
        }

        var publicPath = "/" + storageKey;
        return new StoredMediaFile(storageKey, BuildPublicUrl(publicPath, configuration, httpRequest), ResolveMediaType(extension));
    }

    private static ZipArchiveEntry? GetPackageEntry(ZipArchive archive, string? packagePath)
    {
        if (string.IsNullOrWhiteSpace(packagePath))
        {
            return null;
        }

        var normalized = packagePath.Replace('\\', '/').TrimStart('/');
        if (normalized.Contains("../", StringComparison.Ordinal) || normalized.Contains("/..", StringComparison.Ordinal))
        {
            return null;
        }

        return archive.GetEntry(normalized);
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

    private sealed record ExistingPackageEntry(Guid Id, string Slug, string? SourceSheet, int? SourceRow);

    private sealed record PackageReadResult(ContentPackageDocument? Document, string? Error);

    private sealed record StoredMediaFile(string StorageKey, string PublicUrl, string MediaType);

    private sealed class ContentPackageDocument
    {
        public int SchemaVersion { get; set; }
        public string? PackageSlug { get; set; }
        public string? Title { get; set; }
        public string? DefaultLanguage { get; set; }
        public List<ContentPackageEntry> Entries { get; set; } = [];
    }

    private sealed class ContentPackageEntry
    {
        public string? Slug { get; set; }
        public string? SourceSheet { get; set; }
        public int? SourceRow { get; set; }
        public string? Kind { get; set; }
        public string? Status { get; set; }
        public string? RealityStatus { get; set; }
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
        public string? Name { get; set; }
        public string? Group { get; set; }
        public string? LanguageCode { get; set; }
        public Dictionary<string, string> Translations { get; set; } = [];
    }

    private sealed class ContentPackageTimePeriod
    {
        public string? Slug { get; set; }
        public string? Name { get; set; }
        public string? LanguageCode { get; set; }
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
        public string? Name { get; set; }
        public string? LanguageCode { get; set; }
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
