namespace HowDidWeGetHere.Application.Imports;

public sealed record WorkbookImportResult(
    Guid ImportBatchId,
    int RowsRead,
    int EntriesCreated,
    int EntriesUpdated,
    int PlacesCreated,
    int PlacesAttached,
    IReadOnlyList<string> Warnings);

public sealed record WorkbookImportPreviewResult(
    int RowsRead,
    int EntriesToCreate,
    int EntriesToUpdate,
    int PlacesToAttach,
    IReadOnlyList<WorkbookImportPreviewRow> Rows,
    IReadOnlyList<string> Warnings,
    WorkbookImportValidationSummary ValidationSummary,
    IReadOnlyList<WorkbookImportValidationIssue> ValidationIssues);

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
    IReadOnlyList<string> Places,
    IReadOnlyList<string> Warnings,
    IReadOnlyList<WorkbookImportValidationIssue> ValidationIssues);

public sealed record WorkbookImportValidationSummary(
    int Errors,
    int Warnings,
    int Info);

public sealed record WorkbookImportValidationIssue(
    string Severity,
    string Code,
    string Message,
    string? SheetName,
    int? RowNumber);
