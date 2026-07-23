using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Tags;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminTagEndpoints
{
    public static RouteGroupBuilder MapAdminTagEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGet("/tags", GetTagsAsync)
            .Produces<List<TagListItemResponse>>(StatusCodes.Status200OK);

        admin.MapPost("/tags", CreateTagAsync)
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest);

        admin.MapPut("/tags/{tagId:guid}", UpdateTagAsync)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        admin.MapPost("/entries/{entryId:guid}/tags", AddEntryTagAsync)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        return admin;
    }

    private static async Task<IResult> GetTagsAsync(
        HistoryDbContext dbContext,
        string? language,
        CancellationToken cancellationToken)
    {
        var lang = EndpointHelpers.NormalizeLanguage(language);
        var tags = await dbContext.Tags
            .AsNoTracking()
            .Include(tag => tag.Translations)
            .Include(tag => tag.Entries)
            .OrderBy(tag => tag.TagGroup)
            .ThenBy(tag => tag.Slug)
            .ToListAsync(cancellationToken);

        return Results.Ok(tags
            .Select(tag => new TagListItemResponse(
                tag.Id,
                tag.Slug,
                tag.TagGroup,
                LocalizedTagName(tag, lang),
                tag.ParentTagId,
                tag.Entries.Count))
            .OrderBy(tag => tag.TagGroup)
            .ThenBy(tag => tag.Name)
            .ToList());
    }

    private static async Task<IResult> CreateTagAsync(
        AdminTagUpsertRequest request,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.BadRequest(new { error = "Tag name is required." });
        }

        if (string.IsNullOrWhiteSpace(request.TagGroup))
        {
            return Results.BadRequest(new { error = "Tag group is required." });
        }

        if (request.ParentTagId.HasValue)
        {
            var parentExists = await dbContext.Tags.AnyAsync(tag => tag.Id == request.ParentTagId.Value, cancellationToken);
            if (!parentExists)
            {
                return Results.BadRequest(new { error = "Parent tag was not found." });
            }
        }

        var tag = new Tag
        {
            Slug = MakeUniqueTagSlug(EndpointHelpers.Slugify(request.Slug ?? $"{request.TagGroup}-{request.Name}"), dbContext),
            TagGroup = request.TagGroup.Trim(),
            ParentTagId = request.ParentTagId,
            Translations =
            [
                new TagTranslation
                {
                    LanguageCode = EndpointHelpers.NormalizeLanguage(request.LanguageCode),
                    Name = request.Name.Trim()
                }
            ]
        };

        dbContext.Tags.Add(tag);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/admin/tags/{tag.Id}", new ResourceCreatedResponse(tag.Id, tag.Slug));
    }

    private static async Task<IResult> UpdateTagAsync(
        Guid tagId,
        AdminTagUpsertRequest request,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.BadRequest(new { error = "Tag name is required." });
        }

        if (request.ParentTagId == tagId)
        {
            return Results.BadRequest(new { error = "Tag cannot be its own parent." });
        }

        var tag = await dbContext.Tags
            .Include(item => item.Translations)
            .FirstOrDefaultAsync(item => item.Id == tagId, cancellationToken);
        if (tag is null)
        {
            return Results.NotFound();
        }

        if (request.ParentTagId.HasValue)
        {
            var parentExists = await dbContext.Tags.AnyAsync(item => item.Id == request.ParentTagId.Value, cancellationToken);
            if (!parentExists)
            {
                return Results.BadRequest(new { error = "Parent tag was not found." });
            }
        }

        var requestedSlug = EndpointHelpers.Slugify(request.Slug ?? string.Empty);
        if (!string.IsNullOrWhiteSpace(requestedSlug) &&
            !requestedSlug.Equals(tag.Slug, StringComparison.OrdinalIgnoreCase))
        {
            tag.Slug = MakeUniqueTagSlug(requestedSlug, dbContext, tag.Id);
        }

        tag.TagGroup = string.IsNullOrWhiteSpace(request.TagGroup) ? tag.TagGroup : request.TagGroup.Trim();
        tag.ParentTagId = request.ParentTagId;
        tag.UpdatedAt = DateTimeOffset.UtcNow;

        var language = EndpointHelpers.NormalizeLanguage(request.LanguageCode);
        var translation = tag.Translations.FirstOrDefault(item => item.LanguageCode == language);
        if (translation is null)
        {
            tag.Translations.Add(new TagTranslation
            {
                LanguageCode = language,
                Name = request.Name.Trim()
            });
        }
        else
        {
            translation.Name = request.Name.Trim();
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> AddEntryTagAsync(
        Guid entryId,
        AdminEntryTagRequest request,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.TagSlug))
        {
            return Results.BadRequest(new { error = "Tag slug is required." });
        }

        var entryExists = await dbContext.Entries.AnyAsync(entry => entry.Id == entryId, cancellationToken);
        if (!entryExists)
        {
            return Results.NotFound();
        }

        var tag = await dbContext.Tags.FirstOrDefaultAsync(item => item.Slug == request.TagSlug.Trim(), cancellationToken);
        if (tag is null)
        {
            return Results.BadRequest(new { error = "Tag was not found." });
        }

        var alreadyAttached = await dbContext.EntryTags.AnyAsync(
            item => item.EntryId == entryId && item.TagId == tag.Id,
            cancellationToken);
        if (!alreadyAttached)
        {
            dbContext.EntryTags.Add(new EntryTag
            {
                EntryId = entryId,
                TagId = tag.Id
            });
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Results.NoContent();
    }

    private static string LocalizedTagName(Tag tag, string language) =>
        tag.Translations
            .Where(translation => translation.LanguageCode == language)
            .Select(translation => translation.Name)
            .FirstOrDefault() ??
        tag.Translations
            .Select(translation => translation.Name)
            .FirstOrDefault() ??
        tag.Slug;

    private static string MakeUniqueTagSlug(
        string baseSlug,
        HistoryDbContext dbContext,
        Guid? currentTagId = null)
    {
        var slug = string.IsNullOrWhiteSpace(baseSlug) ? Guid.NewGuid().ToString("n") : baseSlug;
        var uniqueSlug = slug;
        var suffix = 2;

        while (dbContext.Tags.Any(tag => tag.Id != currentTagId && tag.Slug == uniqueSlug))
        {
            uniqueSlug = $"{slug}-{suffix}";
            suffix++;
        }

        return uniqueSlug;
    }
}
