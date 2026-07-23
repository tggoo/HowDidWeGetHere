namespace HowDidWeGetHere.Application.Imports;

public sealed record WorkbookImportResult(
    Guid ImportBatchId,
    int RowsRead,
    int EntriesCreated,
    int EntriesUpdated,
    IReadOnlyList<string> Warnings);

public sealed record WorkbookImportPreviewResult(
    int RowsRead,
    int EntriesToCreate,
    int EntriesToUpdate,
    IReadOnlyList<WorkbookImportPreviewRow> Rows,
    IReadOnlyList<string> Warnings);

public sealed record WorkbookImportPreviewRow(
    string SheetName,
    int RowNumber,
    string Title,
    string? DateLabel,
    string Kind,
    string Status,
    bool WillUpdateExistingEntry,
    Guid? ExistingEntryId,
    string? ExistingEntrySlug,
    string? SourceUrl,
    IReadOnlyList<string> Tags,
    IReadOnlyList<string> Warnings);
