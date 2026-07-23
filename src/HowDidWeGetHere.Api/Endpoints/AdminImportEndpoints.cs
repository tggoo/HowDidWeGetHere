using System.Security.Claims;
using HowDidWeGetHere.Application.Imports;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminImportEndpoints
{
    public static RouteGroupBuilder MapAdminImportEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapPost("/imports/workbook", ImportWorkbookAsync)
            .Produces<WorkbookImportResult>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .DisableAntiforgery();

        return admin;
    }

    private static async Task<IResult> ImportWorkbookAsync(
        IFormFile file,
        bool? publishImportedEntries,
        bool? updateExistingRows,
        IWorkbookImportService importer,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (file.Length == 0)
        {
            return Results.BadRequest(new { error = "Workbook file is empty." });
        }

        await using var stream = file.OpenReadStream();
        var result = await importer.ImportAsync(
            stream,
            file.FileName,
            user.FindFirstValue(ClaimTypes.NameIdentifier),
            publishImportedEntries ?? true,
            updateExistingRows ?? true,
            cancellationToken);

        return Results.Ok(result);
    }
}
