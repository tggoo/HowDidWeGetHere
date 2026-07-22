namespace HowDidWeGetHere.Application.Imports;

public sealed record WorkbookImportResult(
    Guid ImportBatchId,
    int RowsRead,
    int EntriesCreated,
    IReadOnlyList<string> Warnings);

