using HowDidWeGetHere.Domain.Actors;
using HowDidWeGetHere.Domain.Entries;
using HowDidWeGetHere.Domain.Imports;
using HowDidWeGetHere.Domain.Places;
using HowDidWeGetHere.Domain.Routes;
using HowDidWeGetHere.Domain.Sources;
using HowDidWeGetHere.Domain.Tags;
using HowDidWeGetHere.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace HowDidWeGetHere.Infrastructure.Persistence;

public sealed class HistoryDbContext(DbContextOptions<HistoryDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Actor> Actors => Set<Actor>();
    public DbSet<ActorTranslation> ActorTranslations => Set<ActorTranslation>();
    public DbSet<EntryActor> EntryActors => Set<EntryActor>();
    public DbSet<Entry> Entries => Set<Entry>();
    public DbSet<EntryImage> EntryImages => Set<EntryImage>();
    public DbSet<EntryImageTranslation> EntryImageTranslations => Set<EntryImageTranslation>();
    public DbSet<EntryPlace> EntryPlaces => Set<EntryPlace>();
    public DbSet<EntryRelationship> EntryRelationships => Set<EntryRelationship>();
    public DbSet<EntryRoute> EntryRoutes => Set<EntryRoute>();
    public DbSet<EntrySource> EntrySources => Set<EntrySource>();
    public DbSet<EntryTag> EntryTags => Set<EntryTag>();
    public DbSet<EntryTimePeriod> EntryTimePeriods => Set<EntryTimePeriod>();
    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
    public DbSet<ImportedRow> ImportedRows => Set<ImportedRow>();
    public DbSet<Place> Places => Set<Place>();
    public DbSet<PlaceTranslation> PlaceTranslations => Set<PlaceTranslation>();
    public DbSet<RoutePoint> RoutePoints => Set<RoutePoint>();
    public DbSet<Source> Sources => Set<Source>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<TagTranslation> TagTranslations => Set<TagTranslation>();
    public DbSet<TimePeriod> TimePeriods => Set<TimePeriod>();
    public DbSet<TimePeriodTranslation> TimePeriodTranslations => Set<TimePeriodTranslation>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        ConfigureActors(builder);
        ConfigureEntries(builder);
        ConfigureImports(builder);
        ConfigurePlaces(builder);
        ConfigureRoutes(builder);
        ConfigureSources(builder);
        ConfigureTags(builder);
        ConfigureTimePeriods(builder);
    }

    private static void ConfigureActors(ModelBuilder builder)
    {
        builder.Entity<Actor>(entity =>
        {
            entity.ToTable("actors");
            entity.HasIndex(actor => actor.Slug).IsUnique();
            entity.Property(actor => actor.Slug).HasMaxLength(160);
            entity.Property(actor => actor.DefaultName).HasMaxLength(240);
            entity.Property(actor => actor.WikidataId).HasMaxLength(32);
        });

        builder.Entity<ActorTranslation>(entity =>
        {
            entity.ToTable("actor_translations");
            entity.HasKey(translation => new { translation.ActorId, translation.LanguageCode });
            entity.Property(translation => translation.LanguageCode).HasMaxLength(8);
            entity.Property(translation => translation.Name).HasMaxLength(240);
        });

        builder.Entity<EntryActor>(entity =>
        {
            entity.ToTable("entry_actors");
            entity.HasKey(entryActor => new { entryActor.EntryId, entryActor.ActorId, entryActor.Role });
        });
    }

    private static void ConfigureEntries(ModelBuilder builder)
    {
        builder.Entity<Entry>(entity =>
        {
            entity.ToTable("entries");
            entity.HasIndex(entry => entry.Slug).IsUnique();
            entity.HasIndex(entry => new { entry.Status, entry.StartYear, entry.EndYear });
            entity.Property(entry => entry.Slug).HasMaxLength(180);
            entity.Property(entry => entry.DefaultTitle).HasMaxLength(300);
            entity.Property(entry => entry.SourceSheet).HasMaxLength(120);
            entity.Property(entry => entry.TimeConfidence).HasMaxLength(300);
            entity.HasOne(entry => entry.PrimaryTimePeriod)
                .WithMany()
                .HasForeignKey(entry => entry.PrimaryTimePeriodId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<EntryTranslation>(entity =>
        {
            entity.ToTable("entry_translations");
            entity.HasKey(translation => new { translation.EntryId, translation.LanguageCode });
            entity.Property(translation => translation.LanguageCode).HasMaxLength(8);
            entity.Property(translation => translation.Title).HasMaxLength(300);
        });

        builder.Entity<EntryImage>(entity =>
        {
            entity.ToTable("entry_images");
            entity.HasIndex(image => new { image.EntryId, image.IsPrimary });
            entity.Property(image => image.StorageKey).HasMaxLength(600);
            entity.Property(image => image.PublicUrl).HasMaxLength(1000);
            entity.Property(image => image.MediaType).HasMaxLength(120);
            entity.Property(image => image.Attribution).HasMaxLength(500);
            entity.Property(image => image.License).HasMaxLength(120);
            entity.Property(image => image.SourceUrl).HasMaxLength(1000);
        });

        builder.Entity<EntryImageTranslation>(entity =>
        {
            entity.ToTable("entry_image_translations");
            entity.HasKey(translation => new { translation.EntryImageId, translation.LanguageCode });
            entity.Property(translation => translation.LanguageCode).HasMaxLength(8);
            entity.Property(translation => translation.AltText).HasMaxLength(300);
            entity.Property(translation => translation.Caption).HasMaxLength(600);
        });

        builder.Entity<EntryRelationship>(entity =>
        {
            entity.ToTable("entry_relationships");
            entity.HasOne(relationship => relationship.FromEntry)
                .WithMany(entry => entry.OutgoingRelationships)
                .HasForeignKey(relationship => relationship.FromEntryId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(relationship => relationship.ToEntry)
                .WithMany(entry => entry.IncomingRelationships)
                .HasForeignKey(relationship => relationship.ToEntryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<EntrySource>(entity =>
        {
            entity.ToTable("entry_sources");
            entity.HasKey(entrySource => new { entrySource.EntryId, entrySource.SourceId, entrySource.SupportsField });
        });
    }

    private static void ConfigureImports(ModelBuilder builder)
    {
        builder.Entity<ImportBatch>(entity =>
        {
            entity.ToTable("import_batches");
            entity.Property(batch => batch.FileName).HasMaxLength(260);
            entity.Property(batch => batch.ImportedByUserId).HasMaxLength(450);
            entity.Property(batch => batch.SummaryJson).HasColumnType("jsonb");
        });

        builder.Entity<ImportedRow>(entity =>
        {
            entity.ToTable("imported_rows");
            entity.HasIndex(row => new { row.ImportBatchId, row.SheetName, row.RowNumber }).IsUnique();
            entity.Property(row => row.SheetName).HasMaxLength(120);
            entity.Property(row => row.RawJson).HasColumnType("jsonb");
        });
    }

    private static void ConfigurePlaces(ModelBuilder builder)
    {
        builder.Entity<Place>(entity =>
        {
            entity.ToTable("places");
            entity.HasIndex(place => place.Slug).IsUnique();
            entity.Property(place => place.Slug).HasMaxLength(180);
            entity.Property(place => place.DefaultName).HasMaxLength(260);
            entity.Property(place => place.Geometry).HasColumnType("geometry");
            entity.Property(place => place.ModernCountryCode).HasMaxLength(3);
            entity.Property(place => place.WikidataId).HasMaxLength(32);
        });

        builder.Entity<PlaceTranslation>(entity =>
        {
            entity.ToTable("place_translations");
            entity.HasKey(translation => new { translation.PlaceId, translation.LanguageCode });
            entity.Property(translation => translation.LanguageCode).HasMaxLength(8);
            entity.Property(translation => translation.Name).HasMaxLength(260);
        });

        builder.Entity<EntryPlace>(entity =>
        {
            entity.ToTable("entry_places");
            entity.HasKey(entryPlace => new { entryPlace.EntryId, entryPlace.PlaceId, entryPlace.Role });
        });
    }

    private static void ConfigureRoutes(ModelBuilder builder)
    {
        builder.Entity<EntryRoute>(entity =>
        {
            entity.ToTable("entry_routes");
            entity.Property(route => route.Name).HasMaxLength(260);
            entity.Property(route => route.Geometry).HasColumnType("geometry");
        });

        builder.Entity<RoutePoint>(entity =>
        {
            entity.ToTable("route_points");
            entity.HasKey(point => new { point.RouteId, point.PlaceId, point.SortOrder });
        });
    }

    private static void ConfigureSources(ModelBuilder builder)
    {
        builder.Entity<Source>(entity =>
        {
            entity.ToTable("sources");
            entity.HasIndex(source => source.Url).IsUnique();
            entity.Property(source => source.Url).HasMaxLength(1000);
            entity.Property(source => source.Title).HasMaxLength(400);
            entity.Property(source => source.Publisher).HasMaxLength(240);
            entity.Property(source => source.LanguageCode).HasMaxLength(8);
        });
    }

    private static void ConfigureTags(ModelBuilder builder)
    {
        builder.Entity<Tag>(entity =>
        {
            entity.ToTable("tags");
            entity.HasIndex(tag => tag.Slug).IsUnique();
            entity.Property(tag => tag.Slug).HasMaxLength(160);
            entity.Property(tag => tag.TagGroup).HasMaxLength(80);
            entity.HasOne(tag => tag.ParentTag)
                .WithMany(tag => tag.Children)
                .HasForeignKey(tag => tag.ParentTagId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<TagTranslation>(entity =>
        {
            entity.ToTable("tag_translations");
            entity.HasKey(translation => new { translation.TagId, translation.LanguageCode });
            entity.Property(translation => translation.LanguageCode).HasMaxLength(8);
            entity.Property(translation => translation.Name).HasMaxLength(180);
        });

        builder.Entity<EntryTag>(entity =>
        {
            entity.ToTable("entry_tags");
            entity.HasKey(entryTag => new { entryTag.EntryId, entryTag.TagId });
        });
    }

    private static void ConfigureTimePeriods(ModelBuilder builder)
    {
        builder.Entity<TimePeriod>(entity =>
        {
            entity.ToTable("time_periods");
            entity.HasIndex(period => period.Slug).IsUnique();
            entity.Property(period => period.Slug).HasMaxLength(180);
            entity.HasOne(period => period.ParentPeriod)
                .WithMany(period => period.Children)
                .HasForeignKey(period => period.ParentPeriodId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(period => period.ScopePlace)
                .WithMany(place => place.ScopedTimePeriods)
                .HasForeignKey(period => period.ScopePlaceId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(period => period.Entry)
                .WithOne()
                .HasForeignKey<TimePeriod>(period => period.EntryId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<TimePeriodTranslation>(entity =>
        {
            entity.ToTable("time_period_translations");
            entity.HasKey(translation => new { translation.TimePeriodId, translation.LanguageCode });
            entity.Property(translation => translation.LanguageCode).HasMaxLength(8);
            entity.Property(translation => translation.Name).HasMaxLength(220);
        });

        builder.Entity<EntryTimePeriod>(entity =>
        {
            entity.ToTable("entry_time_periods");
            entity.HasKey(entryPeriod => new { entryPeriod.EntryId, entryPeriod.TimePeriodId, entryPeriod.RelationType });
        });
    }
}

