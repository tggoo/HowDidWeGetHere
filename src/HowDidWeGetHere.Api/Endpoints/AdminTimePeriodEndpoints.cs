using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminTimePeriodEndpoints
{
    public static RouteGroupBuilder MapAdminTimePeriodEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGet("/time-periods", GetTimePeriodsAsync)
            .Produces<List<TimePeriodListItemResponse>>(StatusCodes.Status200OK);

        admin.MapPost("/time-periods", CreateTimePeriodAsync)
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest);

        admin.MapPut("/time-periods/{timePeriodId:guid}", UpdateTimePeriodAsync)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        return admin;
    }

    private static async Task<IResult> GetTimePeriodsAsync(
        HistoryDbContext dbContext,
        string? language,
        CancellationToken cancellationToken)
    {
        var lang = EndpointHelpers.NormalizeLanguage(language);
        var periods = await dbContext.TimePeriods
            .AsNoTracking()
            .OrderBy(period => period.SortOrder)
            .ThenBy(period => period.StartYear ?? long.MaxValue)
            .Select(period => new TimePeriodListItemResponse(
                period.Id,
                period.Slug,
                period.ParentPeriodId,
                period.PeriodType.ToString(),
                period.Translations
                    .Where(translation => translation.LanguageCode == lang)
                    .Select(translation => translation.Name)
                    .FirstOrDefault() ?? period.Slug,
                period.Translations
                    .Where(translation => translation.LanguageCode == lang)
                    .Select(translation => translation.ShortDescription)
                    .FirstOrDefault(),
                period.StartYear,
                period.EndYear))
            .ToListAsync(cancellationToken);

        return Results.Ok(periods);
    }

    private static async Task<IResult> CreateTimePeriodAsync(
        AdminTimePeriodUpsertRequest request,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.BadRequest(new { error = "Time period name is required." });
        }

        if (request.ParentPeriodId.HasValue)
        {
            var parentExists = await dbContext.TimePeriods.AnyAsync(
                period => period.Id == request.ParentPeriodId.Value,
                cancellationToken);
            if (!parentExists)
            {
                return Results.BadRequest(new { error = "Parent time period was not found." });
            }
        }

        var slug = MakeUniqueTimePeriodSlug(EndpointHelpers.Slugify(request.Slug ?? request.Name), dbContext);

        var period = new TimePeriod
        {
            Slug = slug,
            PeriodType = request.PeriodType,
            ParentPeriodId = request.ParentPeriodId,
            StartYear = request.StartYear,
            EndYear = request.EndYear,
            StartPrecision = request.StartPrecision,
            EndPrecision = request.EndPrecision,
            SortOrder = request.SortOrder,
            Translations =
            [
                new TimePeriodTranslation
                {
                    LanguageCode = EndpointHelpers.NormalizeLanguage(request.LanguageCode),
                    Name = request.Name.Trim(),
                    ShortDescription = request.ShortDescription,
                    LongDescription = request.LongDescription
                }
            ]
        };

        dbContext.TimePeriods.Add(period);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/admin/time-periods/{period.Id}", new ResourceCreatedResponse(period.Id, period.Slug));
    }

    private static async Task<IResult> UpdateTimePeriodAsync(
        Guid timePeriodId,
        AdminTimePeriodUpsertRequest request,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.BadRequest(new { error = "Time period name is required." });
        }

        if (request.ParentPeriodId == timePeriodId)
        {
            return Results.BadRequest(new { error = "Time period cannot be its own parent." });
        }

        var period = await dbContext.TimePeriods
            .Include(item => item.Translations)
            .FirstOrDefaultAsync(item => item.Id == timePeriodId, cancellationToken);
        if (period is null)
        {
            return Results.NotFound();
        }

        if (request.ParentPeriodId.HasValue)
        {
            var parentExists = await dbContext.TimePeriods.AnyAsync(
                item => item.Id == request.ParentPeriodId.Value,
                cancellationToken);
            if (!parentExists)
            {
                return Results.BadRequest(new { error = "Parent time period was not found." });
            }
        }

        var requestedSlug = EndpointHelpers.Slugify(request.Slug ?? string.Empty);
        if (!string.IsNullOrWhiteSpace(requestedSlug) &&
            !requestedSlug.Equals(period.Slug, StringComparison.OrdinalIgnoreCase))
        {
            period.Slug = MakeUniqueTimePeriodSlug(requestedSlug, dbContext, period.Id);
        }

        period.PeriodType = request.PeriodType;
        period.ParentPeriodId = request.ParentPeriodId;
        period.StartYear = request.StartYear;
        period.EndYear = request.EndYear;
        period.StartPrecision = request.StartPrecision;
        period.EndPrecision = request.EndPrecision;
        period.SortOrder = request.SortOrder;
        period.UpdatedAt = DateTimeOffset.UtcNow;

        var language = EndpointHelpers.NormalizeLanguage(request.LanguageCode);
        var translation = period.Translations.FirstOrDefault(item => item.LanguageCode == language);
        if (translation is null)
        {
            period.Translations.Add(new TimePeriodTranslation
            {
                LanguageCode = language,
                Name = request.Name.Trim(),
                ShortDescription = request.ShortDescription,
                LongDescription = request.LongDescription
            });
        }
        else
        {
            translation.Name = request.Name.Trim();
            translation.ShortDescription = request.ShortDescription;
            translation.LongDescription = request.LongDescription;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static string MakeUniqueTimePeriodSlug(
        string baseSlug,
        HistoryDbContext dbContext,
        Guid? currentPeriodId = null)
    {
        var slug = string.IsNullOrWhiteSpace(baseSlug) ? Guid.NewGuid().ToString("n") : baseSlug;
        var uniqueSlug = slug;
        var suffix = 2;

        while (dbContext.TimePeriods.Any(period => period.Id != currentPeriodId && period.Slug == uniqueSlug))
        {
            uniqueSlug = $"{slug}-{suffix}";
            suffix++;
        }

        return uniqueSlug;
    }
}
