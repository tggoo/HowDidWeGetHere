namespace HowDidWeGetHere.Application.Imports;

public interface IWorkbookImportService
{
    Task<WorkbookImportPreviewResult> PreviewAsync(
        Stream workbookStream,
        bool publishImportedEntries,
        bool updateExistingRows,
        CancellationToken cancellationToken = default);

    Task<WorkbookImportResult> ImportAsync(
        Stream workbookStream,
        string fileName,
        string? importedByUserId,
        bool publishImportedEntries,
        bool updateExistingRows,
        CancellationToken cancellationToken = default);
}
