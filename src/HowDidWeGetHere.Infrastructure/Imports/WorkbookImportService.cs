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
using HowDidWeGetHere.Domain.Sources;
using HowDidWeGetHere.Domain.Tags;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HowDidWeGetHere.Infrastructure.Imports;

public sealed partial class WorkbookImportService(HistoryDbContext dbContext) : IWorkbookImportService
{
    public async Task<WorkbookImportPreviewResult> PreviewAsync(
        Stream workbookStream,
        bool publishImportedEntries,
        bool updateExistingRows,
        CancellationToken cancellationToken = default)
    {
        using var workbook = new XLWorkbook(workbookStream);

        var existingEntriesBySourceRow = updateExistingRows
            ? await dbContext.Entries
                .AsNoTracking()
                .Where(entry => entry.SourceSheet != null && entry.SourceRow != null)
                .Select(entry => new
                {
                    entry.Id,
                    entry.Slug,
                    entry.SourceSheet,
                    entry.SourceRow
                })
                .ToListAsync(cancellationToken)
            : [];

        var existingEntryLookup = existingEntriesBySourceRow
            .GroupBy(entry => $"{entry.SourceSheet}|{entry.SourceRow}")
            .ToDictionary(group => group.Key, group => group.First());

        var previewRows = new List<WorkbookImportPreviewRow>();
        var warnings = new List<string>();
        var rowsRead = 0;
        var entriesToCreate = 0;
        var entriesToUpdate = 0;

        foreach (var duplicateGroup in existingEntriesBySourceRow
            .GroupBy(entry => $"{entry.SourceSheet}|{entry.SourceRow}")
            .Where(group => group.Count() > 1))
        {
            warnings.Add($"Existing duplicate import source row '{duplicateGroup.Key}' found; first entry would be updated.");
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
                var entry = worksheet.Name.Equals("Master Timeline", StringComparison.OrdinalIgnoreCase)
                    ? CreateMasterTimelineEntry(rowValues, rowNumber, rowWarnings)
                    : CreateMythologyEntry(rowValues, rowNumber);
                entry.Status = publishImportedEntries ? ContentStatus.Published : ContentStatus.Draft;

                var sourceKey = $"{entry.SourceSheet}|{entry.SourceRow}";
                var willUpdate = existingEntryLookup.TryGetValue(sourceKey, out var existingEntry);
                if (willUpdate)
                {
                    entriesToUpdate++;
                }
                else
                {
                    entriesToCreate++;
                }

                warnings.AddRange(rowWarnings);
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
                    rowWarnings));
            }
        }

        return new WorkbookImportPreviewResult(rowsRead, entriesToCreate, entriesToUpdate, previewRows, warnings);
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
                .Where(entry => entry.SourceSheet != null && entry.SourceRow != null)
                .OrderBy(entry => entry.CreatedAt)
                .ToListAsync(cancellationToken)
            : [];
        Dictionary<string, Entry> existingEntriesBySourceRow = existingEntries
            .GroupBy(entry => $"{entry.SourceSheet}|{entry.SourceRow}")
            .ToDictionary(group => group.Key, group => group.First());
        foreach (var duplicateGroup in existingEntries
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

                if (existingEntriesBySourceRow.TryGetValue($"{entry.SourceSheet}|{entry.SourceRow}", out var existingEntry))
                {
                    UpdateExistingEntry(existingEntry, entry);
                    existingEntry.UpdatedAt = DateTimeOffset.UtcNow;
                    existingEntry.UpdatedByUserId = importedByUserId;
                    importedRow.Entry = existingEntry;
                    entry = existingEntry;
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
}
