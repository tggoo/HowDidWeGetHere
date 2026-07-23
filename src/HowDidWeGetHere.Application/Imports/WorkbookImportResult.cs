namespace HowDidWeGetHere.Application.Imports;

public sealed record WorkbookImportResult(
    Guid ImportBatchId,
    int RowsRead,
    int EntriesCreated,
    int EntriesUpdated,
    IReadOnlyList<string> Warnings);
