using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using HowDidWeGetHere.Application.Imports;
using HowDidWeGetHere.Application.Time;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Enums;
using HowDidWeGetHere.Domain.Imports;
using HowDidWeGetHere.Domain.Places;
using HowDidWeGetHere.Domain.Sources;
using HowDidWeGetHere.Domain.Tags;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace HowDidWeGetHere.Infrastructure.Imports;

public sealed partial class WorkbookImportService(HistoryDbContext dbContext) : IWorkbookImportService
{
    private const int Wgs84Srid = 4326;

    private static readonly IReadOnlyDictionary<string, ImportedPlaceSeed> ImportedPlaceSeeds =
        new Dictionary<string, ImportedPlaceSeed>(StringComparer.OrdinalIgnoreCase)
        {
            ["africa"] = Region("africa", "Africa", 20.0, 0.0),
            ["america"] = Region("americas", "Americas", -75.0, 10.0),
            ["americas"] = Region("americas", "Americas", -75.0, 10.0),
            ["anatolia"] = Region("anatolia", "Anatolia", 35.0, 39.0),
            ["andes"] = Region("andes", "Andes", -72.0, -13.0),
            ["antarctica"] = Region("antarctica", "Antarctica", 0.0, -82.0, PlaceType.Continent),
            ["arabia"] = Region("arabia", "Arabia", 45.0, 24.0),
            ["asia"] = Region("asia", "Asia", 100.0, 34.0, PlaceType.Continent),
            ["atlantic"] = Region("atlantic-ocean", "Atlantic Ocean", -30.0, 25.0, PlaceType.Ocean),
            ["australia"] = Region("australia", "Australia", 134.0, -25.0),
            ["britain"] = Region("britain", "Britain", -2.0, 54.0),
            ["celtic"] = Region("celtic-europe", "Celtic Europe", -4.0, 53.0, confidence: SpatialConfidence.Mythic),
            ["central-and-western-europe"] = Region("central-and-western-europe", "Central and Western Europe", 7.0, 48.0),
            ["china"] = Region("china", "China", 104.0, 35.0, PlaceType.Country),
            ["chinese"] = Region("china", "China", 104.0, 35.0, PlaceType.Country, SpatialConfidence.Mythic),
            ["eastern-mediterranean"] = Region("eastern-mediterranean", "Eastern Mediterranean", 32.0, 35.0),
            ["egypt"] = Region("egypt", "Egypt", 30.0, 26.0, PlaceType.Country),
            ["egyptian"] = Region("egypt", "Egypt", 30.0, 26.0, PlaceType.Country, SpatialConfidence.Mythic),
            ["england"] = Region("england", "England", -1.5, 52.4, PlaceType.Country),
            ["eurasia"] = Region("eurasia", "Eurasia", 60.0, 50.0),
            ["europe"] = Region("europe", "Europe", 10.0, 50.0, PlaceType.Continent),
            ["france"] = Region("france", "France", 2.0, 46.0, PlaceType.Country),
            ["greek"] = Region("greece", "Greece", 22.0, 39.0, PlaceType.Country, SpatialConfidence.Mythic),
            ["greece"] = Region("greece", "Greece", 22.0, 39.0, PlaceType.Country),
            ["iceland"] = Region("iceland", "Iceland", -19.0, 65.0, PlaceType.Country),
            ["india"] = Region("india", "India", 78.0, 22.0, PlaceType.Country),
            ["ireland"] = Region("ireland", "Ireland", -8.0, 53.0, PlaceType.Country),
            ["italy"] = Region("italy", "Italy", 12.5, 42.5, PlaceType.Country),
            ["japan"] = Region("japan", "Japan", 138.0, 37.0, PlaceType.Country),
            ["japanese"] = Region("japan", "Japan", 138.0, 37.0, PlaceType.Country, SpatialConfidence.Mythic),
            ["levant"] = Region("levant", "Levant", 36.0, 33.0),
            ["mediterranean"] = Region("mediterranean", "Mediterranean", 18.0, 37.0),
            ["mesopotamia"] = Region("mesopotamia", "Mesopotamia", 44.0, 33.0),
            ["mexico"] = Region("mexico", "Mexico", -102.0, 23.0, PlaceType.Country),
            ["middle-east"] = Region("middle-east", "Middle East", 45.0, 29.0),
            ["north-africa"] = Region("north-africa", "North Africa", 10.0, 28.0),
            ["north-america"] = Region("north-america", "North America", -100.0, 45.0, PlaceType.Continent),
            ["norse"] = Region("northern-europe", "Northern Europe", 15.0, 60.0, confidence: SpatialConfidence.Mythic),
            ["northern-europe"] = Region("northern-europe", "Northern Europe", 15.0, 60.0),
            ["pacific"] = Region("pacific-ocean", "Pacific Ocean", -150.0, 0.0, PlaceType.Ocean),
            ["persia"] = Region("persia", "Persia", 53.0, 32.0),
            ["roman-empire"] = Region("roman-empire", "Roman Empire", 12.5, 42.0),
            ["roman-judea"] = Region("roman-judea", "Roman Judea", 35.0, 32.0),
            ["rome"] = Region("rome", "Rome", 12.496, 41.902, PlaceType.City),
            ["russia"] = Region("russia", "Russia", 90.0, 60.0, PlaceType.Country),
            ["slavic"] = Region("slavic-europe", "Slavic Europe", 25.0, 52.0, confidence: SpatialConfidence.Mythic),
            ["slavic-europe"] = Region("slavic-europe", "Slavic Europe", 25.0, 52.0),
            ["south-asia"] = Region("south-asia", "South Asia", 78.0, 22.0),
            ["southwest-asia"] = Region("southwest-asia", "Southwest Asia", 45.0, 29.0),
            ["ukraine"] = Region("ukraine", "Ukraine", 31.0, 49.0, PlaceType.Country),
            ["united-states"] = Region("united-states", "United States", -98.0, 39.0, PlaceType.Country),
            ["wales"] = Region("wales", "Wales", -3.8, 52.3, PlaceType.Country),
            ["western-europe"] = Region("western-europe", "Western Europe", 2.0, 48.0)
        };

    public async Task<WorkbookImportPreviewResult> PreviewAsync(
        Stream workbookStream,
        bool publishImportedEntries,
        bool updateExistingRows,
        CancellationToken cancellationToken = default)
    {
        using var workbook = new XLWorkbook(workbookStream);

        var existingEntrySlugs = await dbContext.Entries
            .AsNoTracking()
            .Select(entry => new ExistingImportEntry(entry.Id, entry.Slug, entry.SourceSheet, entry.SourceRow))
            .ToListAsync(cancellationToken);
        var existingEntriesBySourceRow = updateExistingRows
            ? existingEntrySlugs
                .Where(entry => entry.SourceSheet != null && entry.SourceRow != null)
                .ToList()
            : [];

        var existingEntryLookup = existingEntriesBySourceRow
            .GroupBy(entry => $"{entry.SourceSheet}|{entry.SourceRow}")
            .ToDictionary(group => group.Key, group => group.First());
        var existingEntryLookupBySlug = existingEntrySlugs
            .GroupBy(entry => entry.Slug, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var previewRows = new List<WorkbookImportPreviewRow>();
        var warnings = new List<string>();
        var validationIssues = new List<WorkbookImportValidationIssue>();
        var workbookSlugCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var rowsRead = 0;
        var entriesToCreate = 0;
        var entriesToUpdate = 0;

        foreach (var duplicateGroup in existingEntriesBySourceRow
            .GroupBy(entry => $"{entry.SourceSheet}|{entry.SourceRow}")
            .Where(group => group.Count() > 1))
        {
            AddIssue(
                validationIssues,
                warnings,
                "Warning",
                "DuplicateSourceRow",
                $"Existing duplicate import source row '{duplicateGroup.Key}' found; first entry would be updated.",
                null,
                null);
        }

        foreach (var worksheet in workbook.Worksheets)
        {
            if (!IsImportWorksheet(worksheet.Name))
            {
                continue;
            }

            var headers = ReadHeaders(worksheet);
            var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;

            for (var rowNumber = 2; rowNumber <= lastRow; rowNumber++)
            {
                var rowValues = ReadRow(worksheet.Row(rowNumber), headers);
                if (rowValues.Values.All(string.IsNullOrWhiteSpace))
                {
                    continue;
                }

                rowsRead++;
                var rowWarnings = new List<string>();
                var rowIssues = new List<WorkbookImportValidationIssue>();
                var entry = worksheet.Name.Equals("Master Timeline", StringComparison.OrdinalIgnoreCase)
                    ? CreateMasterTimelineEntry(rowValues, rowNumber, rowWarnings)
                    : CreateMythologyEntry(rowValues, rowNumber);
                entry.Status = publishImportedEntries ? ContentStatus.Published : ContentStatus.Draft;

                var sourceKey = $"{entry.SourceSheet}|{entry.SourceRow}";
                var willUpdate = existingEntryLookup.TryGetValue(sourceKey, out var existingEntry);
                if (!willUpdate && updateExistingRows && existingEntryLookupBySlug.TryGetValue(entry.Slug, out existingEntry))
                {
                    willUpdate = true;
                    AddIssue(
                        validationIssues,
                        warnings,
                        "Info",
                        "MatchedBySlug",
                        $"Existing entry slug '{entry.Slug}' would be updated even though the source row did not match.",
                        worksheet.Name,
                        rowNumber,
                        rowIssues);
                }

                if (willUpdate)
                {
                    entriesToUpdate++;
                }
                else
                {
                    entriesToCreate++;
                }

                foreach (var rowWarning in rowWarnings)
                {
                    AddIssue(
                        validationIssues,
                        warnings,
                        "Warning",
                        "RowShape",
                        rowWarning,
                        worksheet.Name,
                        rowNumber,
                        rowIssues);
                }

                ValidatePreviewRow(
                    worksheet.Name,
                    rowNumber,
                    rowValues,
                    entry,
                    willUpdate,
                    existingEntry?.Id,
                    existingEntrySlugs,
                    workbookSlugCounts,
                    validationIssues,
                    warnings,
                    rowIssues);

                previewRows.Add(new WorkbookImportPreviewRow(
                    worksheet.Name,
                    rowNumber,
                    entry.DefaultTitle,
                    entry.DateLabel,
                    entry.Kind.ToString(),
                    entry.Status.ToString(),
                    willUpdate,
                    existingEntry?.Id,
                    existingEntry?.Slug,
                    ResolveSourceUrl(rowValues),
                    ResolvePreviewTags(rowValues, worksheet.Name),
                    rowWarnings,
                    rowIssues));
            }
        }

        if (rowsRead == 0)
        {
            AddIssue(
                validationIssues,
                warnings,
                "Error",
                "NoRows",
                "Workbook contains no importable rows in supported sheets.",
                null,
                null);
        }

        return new WorkbookImportPreviewResult(
            rowsRead,
            entriesToCreate,
            entriesToUpdate,
            previewRows,
            warnings,
            CreateValidationSummary(validationIssues),
            validationIssues);
    }

    public async Task<WorkbookImportResult> ImportAsync(
        Stream workbookStream,
        string fileName,
        string? importedByUserId,
        bool publishImportedEntries,
        bool updateExistingRows,
        CancellationToken cancellationToken = default)
    {
        using var workbook = new XLWorkbook(workbookStream);

        var tagCache = await dbContext.Tags
            .Include(tag => tag.Translations)
            .ToDictionaryAsync(tag => tag.Slug, cancellationToken);
        var periodCache = await dbContext.TimePeriods
            .Include(period => period.Translations)
            .ToDictionaryAsync(period => period.Slug, cancellationToken);
        var placeCache = await dbContext.Places
            .Include(place => place.Translations)
            .ToDictionaryAsync(place => place.Slug, cancellationToken);
        var sourceCache = await dbContext.Sources
            .ToDictionaryAsync(source => source.Url, cancellationToken);
        var warnings = new List<string>();
        var entrySlugs = await dbContext.Entries
            .Select(entry => entry.Slug)
            .ToHashSetAsync(cancellationToken);
        var existingEntries = updateExistingRows
            ? await dbContext.Entries
                .Include(entry => entry.Translations)
                .Include(entry => entry.Tags)
                .Include(entry => entry.Sources)
                .Include(entry => entry.TimePeriods)
                .Include(entry => entry.Places)
                .OrderBy(entry => entry.CreatedAt)
                .ToListAsync(cancellationToken)
            : [];
        Dictionary<string, Entry> existingEntriesBySourceRow = existingEntries
            .Where(entry => entry.SourceSheet != null && entry.SourceRow != null)
            .GroupBy(entry => $"{entry.SourceSheet}|{entry.SourceRow}")
            .ToDictionary(group => group.Key, group => group.First());
        Dictionary<string, Entry> existingEntriesBySlug = existingEntries
            .GroupBy(entry => entry.Slug, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
        foreach (var duplicateGroup in existingEntries
            .Where(entry => entry.SourceSheet != null && entry.SourceRow != null)
            .GroupBy(entry => $"{entry.SourceSheet}|{entry.SourceRow}")
            .Where(group => group.Count() > 1))
        {
            warnings.Add($"Existing duplicate import source row '{duplicateGroup.Key}' found; first entry will be updated.");
        }

        var entriesCreated = 0;
        var entriesUpdated = 0;
        var rowsRead = 0;

        var batch = new ImportBatch
        {
            FileName = fileName,
            ImportedByUserId = importedByUserId,
            Status = ImportStatus.Pending
        };
        dbContext.ImportBatches.Add(batch);

        foreach (var worksheet in workbook.Worksheets)
        {
            if (!IsImportWorksheet(worksheet.Name))
            {
                continue;
            }

            var headers = ReadHeaders(worksheet);
            var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;

            for (var rowNumber = 2; rowNumber <= lastRow; rowNumber++)
            {
                var rowValues = ReadRow(worksheet.Row(rowNumber), headers);
                if (rowValues.Values.All(string.IsNullOrWhiteSpace))
                {
                    continue;
                }

                rowsRead++;
                var importedRow = new ImportedRow
                {
                    ImportBatch = batch,
                    SheetName = worksheet.Name,
                    RowNumber = rowNumber,
                    RawJson = JsonSerializer.Serialize(rowValues)
                };
                batch.Rows.Add(importedRow);

                var warningCountBeforeRow = warnings.Count;
                var entry = worksheet.Name.Equals("Master Timeline", StringComparison.OrdinalIgnoreCase)
                    ? CreateMasterTimelineEntry(rowValues, rowNumber, warnings)
                    : CreateMythologyEntry(rowValues, rowNumber);

                entry.Status = publishImportedEntries ? ContentStatus.Published : ContentStatus.Draft;
                if (warnings.Count > warningCountBeforeRow)
                {
                    importedRow.Warning = warnings[^1];
                }

                var matchedBySlug = false;
                Entry? matchedEntry = null;
                if (existingEntriesBySourceRow.TryGetValue($"{entry.SourceSheet}|{entry.SourceRow}", out var sourceRowMatch))
                {
                    matchedEntry = sourceRowMatch;
                }
                else if (existingEntriesBySlug.TryGetValue(entry.Slug, out var slugMatch))
                {
                    matchedEntry = slugMatch;
                    matchedBySlug = true;
                }

                if (matchedEntry is not null)
                {
                    if (matchedBySlug)
                    {
                        warnings.Add(
                            $"{entry.SourceSheet} row {entry.SourceRow}: existing entry '{matchedEntry.Slug}' matched by slug and was updated.");
                    }

                    UpdateExistingEntry(matchedEntry, entry);
                    matchedEntry.UpdatedAt = DateTimeOffset.UtcNow;
                    matchedEntry.UpdatedByUserId = importedByUserId;
                    importedRow.Entry = matchedEntry;
                    entry = matchedEntry;
                    entriesUpdated++;
                }
                else
                {
                    entry.Slug = MakeUniqueSlug(entry.Slug, entrySlugs);
                    entry.CreatedByUserId = importedByUserId;
                    importedRow.Entry = entry;
                    dbContext.Entries.Add(entry);
                    entriesCreated++;
                }

                AttachSource(entry, rowValues, sourceCache);
                AttachImportedTags(entry, rowValues, worksheet.Name, tagCache);
                AttachTimePeriod(entry, rowValues, periodCache);
                AttachImportedPlaces(entry, rowValues, worksheet.Name, placeCache);
            }
        }

        batch.CompletedAt = DateTimeOffset.UtcNow;
        batch.Status = warnings.Count == 0 ? ImportStatus.Imported : ImportStatus.PartiallyImported;
        batch.SummaryJson = JsonSerializer.Serialize(new
        {
            rowsRead,
            entriesCreated,
            entriesUpdated,
            warnings
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return new WorkbookImportResult(batch.Id, rowsRead, entriesCreated, entriesUpdated, warnings);
    }

    private static void UpdateExistingEntry(Entry target, Entry imported)
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
                target.Translations.Add(new EntryTranslation
                {
                    LanguageCode = importedTranslation.LanguageCode,
                    Title = importedTranslation.Title,
                    Summary = importedTranslation.Summary,
                    Description = importedTranslation.Description,
                    WhyItMatters = importedTranslation.WhyItMatters,
                    DatingNote = importedTranslation.DatingNote
                });
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

    private static Entry CreateMasterTimelineEntry(
        IReadOnlyDictionary<string, string?> row,
        int rowNumber,
        ICollection<string> warnings)
    {
        var dateLabel = Value(row, "Approx. date");
        var era = Value(row, "Era");
        var region = Value(row, "Region");
        var category = Value(row, "Category");
        var title = Value(row, "Event / development");
        var whyItMatters = Value(row, "Why it matters");
        var datingConfidence = Value(row, "Dating confidence");
        var sourceUrl = Value(row, "Source URL");

        if (string.IsNullOrWhiteSpace(sourceUrl) && LooksLikeUrl(datingConfidence))
        {
            warnings.Add($"Master Timeline row {rowNumber} appears shifted; imported with best-effort field recovery.");
            sourceUrl = datingConfidence;
            datingConfidence = whyItMatters;
            whyItMatters = title;
            title = category;
            category = region;
            region = null;
        }

        var parsedDate = HistoricalDateParser.Parse(dateLabel);
        var defaultTitle = RequireTitle(title, rowNumber, "Master Timeline");

        return new Entry
        {
            Slug = CreateSlug(defaultTitle),
            Kind = InferEntryKind(category),
            Status = ContentStatus.Draft,
            RealityStatus = category?.Contains("mythology", StringComparison.OrdinalIgnoreCase) == true
                ? RealityStatus.Mythological
                : RealityStatus.Historical,
            DefaultTitle = defaultTitle,
            DateLabel = dateLabel,
            StartYear = parsedDate.StartYear,
            StartMonth = parsedDate.StartMonth,
            StartDay = parsedDate.StartDay,
            EndYear = parsedDate.EndYear,
            EndMonth = parsedDate.EndMonth,
            EndDay = parsedDate.EndDay,
            TimePrecision = parsedDate.Precision,
            TimeConfidence = datingConfidence,
            SourceSheet = "Master Timeline",
            SourceRow = rowNumber,
            Translations =
            [
                new EntryTranslation
                {
                    LanguageCode = "en",
                    Title = defaultTitle,
                    Summary = whyItMatters,
                    WhyItMatters = whyItMatters,
                    DatingNote = datingConfidence
                }
            ]
        };
    }

    private static Entry CreateMythologyEntry(IReadOnlyDictionary<string, string?> row, int rowNumber)
    {
        var title = RequireTitle(Value(row, "Figure / creature"), rowNumber, "Mythology Index");
        var parsedDate = HistoricalDateParser.Parse(Value(row, "Probable tradition age"));

        return new Entry
        {
            Slug = CreateSlug(title),
            Kind = EntryKind.MythologyEntity,
            Status = ContentStatus.Draft,
            RealityStatus = RealityStatus.Mythological,
            DefaultTitle = title,
            DateLabel = Value(row, "Probable tradition age"),
            StartYear = parsedDate.StartYear,
            EndYear = parsedDate.EndYear,
            TimePrecision = parsedDate.Precision,
            TimeConfidence = Value(row, "Dating note"),
            SourceSheet = "Mythology Index",
            SourceRow = rowNumber,
            Translations =
            [
                new EntryTranslation
                {
                    LanguageCode = "en",
                    Title = title,
                    Summary = Value(row, "What it represents / famous story"),
                    Description = Value(row, "Earliest important written evidence"),
                    DatingNote = Value(row, "Dating note")
                }
            ]
        };
    }

    private void AttachSource(
        Entry entry,
        IReadOnlyDictionary<string, string?> row,
        IDictionary<string, Source> sourceCache)
    {
        var sourceUrl = ResolveSourceUrl(row);

        if (string.IsNullOrWhiteSpace(sourceUrl))
        {
            return;
        }

        if (!sourceCache.TryGetValue(sourceUrl, out var source))
        {
            source = new Source
            {
                Url = sourceUrl,
                AccessedAt = DateTimeOffset.UtcNow
            };
            sourceCache[sourceUrl] = source;
            dbContext.Sources.Add(source);
        }

        if (entry.Sources.All(entrySource => entrySource.Source != source && entrySource.SourceId != source.Id))
        {
            entry.Sources.Add(new EntrySource
            {
                Entry = entry,
                Source = source,
                SupportsField = SourceSupportKind.General
            });
        }
    }

    private static bool IsImportWorksheet(string sheetName) =>
        sheetName.Equals("Master Timeline", StringComparison.OrdinalIgnoreCase) ||
        sheetName.Equals("Mythology Index", StringComparison.OrdinalIgnoreCase);

    private static string? ResolveSourceUrl(IReadOnlyDictionary<string, string?> row)
    {
        var sourceUrl = Value(row, "Source URL");
        var shiftedUrl = Value(row, "Dating confidence");
        return string.IsNullOrWhiteSpace(sourceUrl) && LooksLikeUrl(shiftedUrl) ? shiftedUrl : sourceUrl;
    }

    private static IReadOnlyList<string> ResolvePreviewTags(IReadOnlyDictionary<string, string?> row, string sheetName)
    {
        var tags = new List<string>();
        if (sheetName.Equals("Master Timeline", StringComparison.OrdinalIgnoreCase))
        {
            AddPreviewTags(tags, Value(row, "Category"));
            AddPreviewTags(tags, Value(row, "Region"));
        }
        else if (sheetName.Equals("Mythology Index", StringComparison.OrdinalIgnoreCase))
        {
            tags.Add("Mythology");
            AddPreviewTags(tags, Value(row, "Tradition"));
            AddPreviewTags(tags, Value(row, "Type"));
        }

        return tags;
    }

    private static void AddPreviewTags(ICollection<string> tags, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        foreach (var part in value.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            tags.Add(part.Trim());
        }
    }

    private static void ValidatePreviewRow(
        string sheetName,
        int rowNumber,
        IReadOnlyDictionary<string, string?> row,
        Entry entry,
        bool willUpdate,
        Guid? existingEntryId,
        IReadOnlyCollection<ExistingImportEntry> existingEntries,
        IDictionary<string, int> workbookSlugCounts,
        ICollection<WorkbookImportValidationIssue> validationIssues,
        ICollection<string> warnings,
        ICollection<WorkbookImportValidationIssue> rowIssues)
    {
        var sourceUrl = ResolveSourceUrl(row);
        if (string.IsNullOrWhiteSpace(sourceUrl))
        {
            AddIssue(
                validationIssues,
                warnings,
                "Warning",
                "MissingSource",
                "Row has no source URL.",
                sheetName,
                rowNumber,
                rowIssues);
        }

        if (!string.IsNullOrWhiteSpace(entry.DateLabel) && entry.TimePrecision == TimePrecision.Unknown)
        {
            AddIssue(
                validationIssues,
                warnings,
                "Warning",
                "UnparsedDate",
                $"Date label '{entry.DateLabel}' could not be parsed into a normalized year range.",
                sheetName,
                rowNumber,
                rowIssues);
        }

        if (entry.DefaultTitle.Equals($"{sheetName} row {rowNumber}", StringComparison.OrdinalIgnoreCase))
        {
            AddIssue(
                validationIssues,
                warnings,
                "Warning",
                "MissingTitle",
                "Row has no expected title value; a fallback title would be used.",
                sheetName,
                rowNumber,
                rowIssues);
        }

        workbookSlugCounts.TryGetValue(entry.Slug, out var workbookSlugCount);
        workbookSlugCounts[entry.Slug] = workbookSlugCount + 1;
        if (workbookSlugCount > 0)
        {
            AddIssue(
                validationIssues,
                warnings,
                "Warning",
                "DuplicateWorkbookSlug",
                $"Another imported row already proposes slug '{entry.Slug}'. Import would add a numeric suffix.",
                sheetName,
                rowNumber,
                rowIssues);
        }

        var existingSlugMatch = existingEntries.FirstOrDefault(existing => existing.Slug == entry.Slug);
        if (existingSlugMatch is not null && (!willUpdate || existingSlugMatch.Id != existingEntryId))
        {
            AddIssue(
                validationIssues,
                warnings,
                "Warning",
                "DuplicateExistingSlug",
                $"Slug '{entry.Slug}' already exists outside this source row. Import would add a numeric suffix.",
                sheetName,
                rowNumber,
                rowIssues);
        }
    }

    private static void AddIssue(
        ICollection<WorkbookImportValidationIssue> validationIssues,
        ICollection<string> warnings,
        string severity,
        string code,
        string message,
        string? sheetName,
        int? rowNumber,
        ICollection<WorkbookImportValidationIssue>? rowIssues = null)
    {
        var issue = new WorkbookImportValidationIssue(severity, code, message, sheetName, rowNumber);
        validationIssues.Add(issue);
        rowIssues?.Add(issue);
        if (!severity.Equals("Info", StringComparison.OrdinalIgnoreCase))
        {
            warnings.Add(rowNumber is null ? message : $"{sheetName} row {rowNumber}: {message}");
        }
    }

    private static WorkbookImportValidationSummary CreateValidationSummary(
        IEnumerable<WorkbookImportValidationIssue> validationIssues)
    {
        var issues = validationIssues.ToList();
        return new WorkbookImportValidationSummary(
            issues.Count(issue => issue.Severity.Equals("Error", StringComparison.OrdinalIgnoreCase)),
            issues.Count(issue => issue.Severity.Equals("Warning", StringComparison.OrdinalIgnoreCase)),
            issues.Count(issue => issue.Severity.Equals("Info", StringComparison.OrdinalIgnoreCase)));
    }

    private void AttachImportedTags(
        Entry entry,
        IReadOnlyDictionary<string, string?> row,
        string sheetName,
        IDictionary<string, Tag> tagCache)
    {
        if (sheetName.Equals("Master Timeline", StringComparison.OrdinalIgnoreCase))
        {
            AddTag(entry, Value(row, "Category"), "category", tagCache);
            AddTag(entry, Value(row, "Region"), "legacy-region-label", tagCache);
        }
        else if (sheetName.Equals("Mythology Index", StringComparison.OrdinalIgnoreCase))
        {
            AddTag(entry, "Mythology", "category", tagCache);
            AddTag(entry, Value(row, "Tradition"), "tradition", tagCache);
            AddTag(entry, Value(row, "Type"), "mythology-type", tagCache);
        }
    }

    private void AttachTimePeriod(
        Entry entry,
        IReadOnlyDictionary<string, string?> row,
        IDictionary<string, TimePeriod> periodCache)
    {
        var eraName = Value(row, "Era");
        if (string.IsNullOrWhiteSpace(eraName))
        {
            return;
        }

        var slug = CreateSlug(eraName);
        if (!periodCache.TryGetValue(slug, out var period))
        {
            period = new TimePeriod
            {
                Slug = slug,
                PeriodType = TimePeriodType.Era,
                Translations =
                [
                    new TimePeriodTranslation
                    {
                        LanguageCode = "en",
                        Name = eraName
                    }
                ]
            };
            periodCache[slug] = period;
            dbContext.TimePeriods.Add(period);
        }

        entry.PrimaryTimePeriod = period;
        if (entry.TimePeriods.All(entryPeriod => entryPeriod.TimePeriod != period && entryPeriod.TimePeriodId != period.Id))
        {
            entry.TimePeriods.Add(new EntryTimePeriod
            {
                Entry = entry,
                TimePeriod = period,
                RelationType = PeriodMembershipType.Primary
            });
        }
    }

    private void AttachImportedPlaces(
        Entry entry,
        IReadOnlyDictionary<string, string?> row,
        string sheetName,
        IDictionary<string, Place> placeCache)
    {
        var sourceValue = sheetName.Equals("Master Timeline", StringComparison.OrdinalIgnoreCase)
            ? Value(row, "Region")
            : Value(row, "Tradition");
        if (string.IsNullOrWhiteSpace(sourceValue))
        {
            return;
        }

        var sortOrder = entry.Places.Count == 0 ? 0 : entry.Places.Max(place => place.SortOrder) + 1;
        foreach (var importedPlace in ResolveImportedPlaces(sourceValue, sheetName))
        {
            if (!placeCache.TryGetValue(importedPlace.Slug, out var place))
            {
                place = new Place
                {
                    Slug = importedPlace.Slug,
                    DefaultName = importedPlace.Name,
                    PlaceType = importedPlace.PlaceType,
                    SpatialConfidence = importedPlace.SpatialConfidence,
                    Geometry = new Point(importedPlace.Longitude, importedPlace.Latitude) { SRID = Wgs84Srid },
                    Translations =
                    [
                        new PlaceTranslation
                        {
                            LanguageCode = "en",
                            Name = importedPlace.Name,
                            Description = importedPlace.Description
                        }
                    ]
                };
                placeCache[place.Slug] = place;
                dbContext.Places.Add(place);
            }

            if (entry.Places.Any(entryPlace => entryPlace.Place == place || entryPlace.PlaceId == place.Id))
            {
                continue;
            }

            entry.Places.Add(new EntryPlace
            {
                Entry = entry,
                Place = place,
                Role = EntryPlaceRole.Region,
                SortOrder = sortOrder++,
                Note = importedPlace.Description
            });
        }
    }

    private static IEnumerable<ImportedPlaceSeed> ResolveImportedPlaces(string value, string sheetName)
    {
        var seenSlugs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var label in SplitImportedPlaceLabels(value))
        {
            var lookupKey = NormalizeImportedPlaceLabel(label);
            if (string.IsNullOrWhiteSpace(lookupKey) || IsSkippedImportedPlaceLabel(lookupKey))
            {
                continue;
            }

            if (!ImportedPlaceSeeds.TryGetValue(lookupKey, out var seed) || !seenSlugs.Add(seed.Slug))
            {
                continue;
            }

            var sourceType = sheetName.Equals("Mythology Index", StringComparison.OrdinalIgnoreCase)
                ? "tradition"
                : "region";
            yield return seed with
            {
                Description = $"Approximate {sourceType} centroid inferred from workbook value '{value}'."
            };
        }
    }

    private static IEnumerable<string> SplitImportedPlaceLabels(string value) =>
        value.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(label => label.Trim());

    private static string NormalizeImportedPlaceLabel(string value)
    {
        var normalized = value
            .Replace("and other regions", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("other regions", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Trim();
        return string.IsNullOrWhiteSpace(normalized) ? string.Empty : CreateSlug(normalized);
    }

    private static bool IsSkippedImportedPlaceLabel(string normalizedLabel) =>
        normalizedLabel is
            "global" or
            "global-oceans" or
            "moon" or
            "space" or
            "moon-space" or
            "science" or
            "technology" or
            "present-day";

    private static ImportedPlaceSeed Region(
        string slug,
        string name,
        double longitude,
        double latitude,
        PlaceType placeType = PlaceType.Region,
        SpatialConfidence confidence = SpatialConfidence.Regional) =>
        new(
            $"import-region-{slug}",
            name,
            longitude,
            latitude,
            placeType,
            confidence,
            "Approximate region centroid inferred from workbook import.");

    private void AddTag(Entry entry, string? value, string group, IDictionary<string, Tag> tagCache)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        foreach (var part in value.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            var name = part.Trim();
            var slug = CreateSlug($"{group}-{name}");
            if (!tagCache.TryGetValue(slug, out var tag))
            {
                tag = new Tag
                {
                    Slug = slug,
                    TagGroup = group,
                    Translations =
                    [
                        new TagTranslation
                        {
                            LanguageCode = "en",
                            Name = name
                        }
                    ]
                };
                tagCache[slug] = tag;
                dbContext.Tags.Add(tag);
            }

            if (entry.Tags.All(entryTag => entryTag.Tag != tag))
            {
                entry.Tags.Add(new EntryTag
                {
                    Entry = entry,
                    Tag = tag
                });
            }
        }
    }

    private static Dictionary<string, string?> ReadHeaders(IXLWorksheet worksheet)
    {
        var headers = new Dictionary<string, string?>();
        var lastColumn = worksheet.Row(1).LastCellUsed()?.Address.ColumnNumber ?? 0;

        for (var column = 1; column <= lastColumn; column++)
        {
            var header = worksheet.Cell(1, column).GetFormattedString().Trim();
            if (!string.IsNullOrWhiteSpace(header))
            {
                headers[header] = column.ToString(CultureInfo.InvariantCulture);
            }
        }

        return headers;
    }

    private static Dictionary<string, string?> ReadRow(IXLRow row, IReadOnlyDictionary<string, string?> headers)
    {
        var values = new Dictionary<string, string?>();
        foreach (var (header, columnValue) in headers)
        {
            var column = int.Parse(columnValue!, CultureInfo.InvariantCulture);
            var value = row.Cell(column).GetFormattedString().Trim();
            values[header] = string.IsNullOrWhiteSpace(value) ? null : value;
        }

        return values;
    }

    private static string? Value(IReadOnlyDictionary<string, string?> row, string key) =>
        row.TryGetValue(key, out var value) ? value : null;

    private static string RequireTitle(string? title, int rowNumber, string sheetName) =>
        string.IsNullOrWhiteSpace(title)
            ? $"{sheetName} row {rowNumber}"
            : title.Trim();

    private static bool LooksLikeUrl(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    private static EntryKind InferEntryKind(string? category)
    {
        if (string.IsNullOrWhiteSpace(category))
        {
            return EntryKind.Event;
        }

        if (category.Contains("mythology", StringComparison.OrdinalIgnoreCase))
        {
            return EntryKind.MythologyStory;
        }

        if (category.Contains("invention", StringComparison.OrdinalIgnoreCase))
        {
            return EntryKind.Invention;
        }

        if (category.Contains("exploration", StringComparison.OrdinalIgnoreCase))
        {
            return EntryKind.Exploration;
        }

        if (category.Contains("war", StringComparison.OrdinalIgnoreCase))
        {
            return EntryKind.War;
        }

        if (category.Contains("civilization", StringComparison.OrdinalIgnoreCase))
        {
            return EntryKind.Civilization;
        }

        if (category.Contains("science", StringComparison.OrdinalIgnoreCase))
        {
            return EntryKind.ScientificConcept;
        }

        if (category.Contains("technology", StringComparison.OrdinalIgnoreCase))
        {
            return EntryKind.Technology;
        }

        return EntryKind.Event;
    }

    private static string CreateSlug(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);

        foreach (var character in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(character);
            if (category == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(character))
            {
                builder.Append(char.ToLowerInvariant(character));
            }
            else
            {
                builder.Append('-');
            }
        }

        var slug = CollapseDashesRegex().Replace(builder.ToString(), "-").Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? Guid.NewGuid().ToString("n") : slug;
    }

    private static string MakeUniqueSlug(string slug, ISet<string> usedSlugs)
    {
        var uniqueSlug = slug;
        var suffix = 2;
        while (!usedSlugs.Add(uniqueSlug))
        {
            uniqueSlug = $"{slug}-{suffix}";
            suffix++;
        }

        return uniqueSlug;
    }

    [GeneratedRegex("-+")]
    private static partial Regex CollapseDashesRegex();

    private sealed record ExistingImportEntry(Guid Id, string Slug, string? SourceSheet, int? SourceRow);

    private sealed record ImportedPlaceSeed(
        string Slug,
        string Name,
        double Longitude,
        double Latitude,
        PlaceType PlaceType,
        SpatialConfidence SpatialConfidence,
        string Description);
}
