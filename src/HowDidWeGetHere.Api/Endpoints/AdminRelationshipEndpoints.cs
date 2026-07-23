using HowDidWeGetHere.Api.Contracts;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminRelationshipEndpoints
{
    public static RouteGroupBuilder MapAdminRelationshipEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapPost("/entries/{entryId:guid}/relationships", AddRelationshipAsync)
            .Produces<ResourceCreatedResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        admin.MapPut("/entries/{entryId:guid}/relationships/{relationshipId:guid}", UpdateRelationshipAsync)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);

        admin.MapDelete("/entries/{entryId:guid}/relationships/{relationshipId:guid}", DeleteRelationshipAsync)
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound);

        return admin;
    }

    private static async Task<IResult> AddRelationshipAsync(
        Guid entryId,
        AdminEntryRelationshipRequest request,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var validationError = ValidateRelationshipRequest(request);
        if (validationError is not null)
        {
            return Results.BadRequest(new { error = validationError });
        }

        var entry = await dbContext.Entries
            .FirstOrDefaultAsync(item => item.Id == entryId, cancellationToken);
        if (entry is null)
        {
            return Results.NotFound();
        }

        var targetSlug = request.TargetEntrySlug.Trim();
        var targetEntry = await dbContext.Entries
            .FirstOrDefaultAsync(item => item.Slug == targetSlug, cancellationToken);
        if (targetEntry is null)
        {
            return Results.BadRequest(new { error = "Target entry was not found." });
        }

        if (targetEntry.Id == entry.Id)
        {
            return Results.BadRequest(new { error = "Entry cannot be related to itself." });
        }

        var relationship = await dbContext.EntryRelationships.FirstOrDefaultAsync(
            item => item.FromEntryId == entry.Id &&
                item.ToEntryId == targetEntry.Id &&
                item.RelationshipType == request.RelationshipType,
            cancellationToken);

        if (relationship is null)
        {
            relationship = new EntryRelationship
            {
                FromEntryId = entry.Id,
                ToEntryId = targetEntry.Id,
                RelationshipType = request.RelationshipType,
                Confidence = request.Confidence,
                Note = request.Note
            };
            dbContext.EntryRelationships.Add(relationship);
        }
        else
        {
            relationship.Confidence = request.Confidence;
            relationship.Note = request.Note;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Created(
            $"/api/admin/entries/{entryId}/relationships/{relationship.Id}",
            new ResourceCreatedResponse(relationship.Id, null));
    }

    private static async Task<IResult> UpdateRelationshipAsync(
        Guid entryId,
        Guid relationshipId,
        AdminEntryRelationshipRequest request,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var validationError = ValidateRelationshipRequest(request);
        if (validationError is not null)
        {
            return Results.BadRequest(new { error = validationError });
        }

        var relationship = await dbContext.EntryRelationships
            .FirstOrDefaultAsync(
                item => item.Id == relationshipId && item.FromEntryId == entryId,
                cancellationToken);
        if (relationship is null)
        {
            return Results.NotFound();
        }

        var targetSlug = request.TargetEntrySlug.Trim();
        var targetEntry = await dbContext.Entries
            .FirstOrDefaultAsync(item => item.Slug == targetSlug, cancellationToken);
        if (targetEntry is null)
        {
            return Results.BadRequest(new { error = "Target entry was not found." });
        }

        if (targetEntry.Id == entryId)
        {
            return Results.BadRequest(new { error = "Entry cannot be related to itself." });
        }

        var duplicateExists = await dbContext.EntryRelationships.AnyAsync(
            item => item.Id != relationshipId &&
                item.FromEntryId == entryId &&
                item.ToEntryId == targetEntry.Id &&
                item.RelationshipType == request.RelationshipType,
            cancellationToken);
        if (duplicateExists)
        {
            return Results.BadRequest(new { error = "Relationship with the same target and type already exists." });
        }

        relationship.ToEntryId = targetEntry.Id;
        relationship.RelationshipType = request.RelationshipType;
        relationship.Confidence = request.Confidence;
        relationship.Note = request.Note;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteRelationshipAsync(
        Guid entryId,
        Guid relationshipId,
        HistoryDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var relationship = await dbContext.EntryRelationships
            .FirstOrDefaultAsync(
                item => item.Id == relationshipId && item.FromEntryId == entryId,
                cancellationToken);
        if (relationship is null)
        {
            return Results.NotFound();
        }

        dbContext.EntryRelationships.Remove(relationship);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }

    private static string? ValidateRelationshipRequest(AdminEntryRelationshipRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TargetEntrySlug))
        {
            return "Target entry slug is required.";
        }

        if (request.Confidence is < 0 or > 1)
        {
            return "Confidence must be between 0 and 1.";
        }

        return null;
    }
}
