namespace HowDidWeGetHere.Application.Imports;

public interface IWorkbookImportService
{
    Task<WorkbookImportResult> ImportAsync(
        Stream workbookStream,
        string fileName,
        string? importedByUserId,
        CancellationToken cancellationToken = default);
}

