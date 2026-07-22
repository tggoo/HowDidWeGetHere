CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE EXTENSION IF NOT EXISTS postgis;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE actors (
        "Id" uuid NOT NULL,
        "Slug" character varying(160) NOT NULL,
        "ActorType" integer NOT NULL,
        "DefaultName" character varying(240) NOT NULL,
        "WikidataId" character varying(32),
        "CreatedAt" timestamp with time zone NOT NULL,
        "CreatedByUserId" text,
        "UpdatedAt" timestamp with time zone,
        "UpdatedByUserId" text,
        CONSTRAINT "PK_actors" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE "AspNetRoles" (
        "Id" text NOT NULL,
        "Name" character varying(256),
        "NormalizedName" character varying(256),
        "ConcurrencyStamp" text,
        CONSTRAINT "PK_AspNetRoles" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE "AspNetUsers" (
        "Id" text NOT NULL,
        "DisplayName" text,
        "UserName" character varying(256),
        "NormalizedUserName" character varying(256),
        "Email" character varying(256),
        "NormalizedEmail" character varying(256),
        "EmailConfirmed" boolean NOT NULL,
        "PasswordHash" text,
        "SecurityStamp" text,
        "ConcurrencyStamp" text,
        "PhoneNumber" text,
        "PhoneNumberConfirmed" boolean NOT NULL,
        "TwoFactorEnabled" boolean NOT NULL,
        "LockoutEnd" timestamp with time zone,
        "LockoutEnabled" boolean NOT NULL,
        "AccessFailedCount" integer NOT NULL,
        CONSTRAINT "PK_AspNetUsers" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE import_batches (
        "Id" uuid NOT NULL,
        "FileName" character varying(260) NOT NULL,
        "ImportedByUserId" character varying(450),
        "Status" integer NOT NULL,
        "StartedAt" timestamp with time zone NOT NULL,
        "CompletedAt" timestamp with time zone,
        "SummaryJson" jsonb,
        CONSTRAINT "PK_import_batches" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE places (
        "Id" uuid NOT NULL,
        "Slug" character varying(180) NOT NULL,
        "PlaceType" integer NOT NULL,
        "DefaultName" character varying(260) NOT NULL,
        "Geometry" geometry,
        "ModernCountryCode" character varying(3),
        "WikidataId" character varying(32),
        "GeoNamesId" integer,
        "SpatialConfidence" integer NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "CreatedByUserId" text,
        "UpdatedAt" timestamp with time zone,
        "UpdatedByUserId" text,
        CONSTRAINT "PK_places" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE sources (
        "Id" uuid NOT NULL,
        "Url" character varying(1000) NOT NULL,
        "Title" character varying(400),
        "Publisher" character varying(240),
        "LanguageCode" character varying(8),
        "AccessedAt" timestamp with time zone,
        CONSTRAINT "PK_sources" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE tags (
        "Id" uuid NOT NULL,
        "Slug" character varying(160) NOT NULL,
        "TagGroup" character varying(80) NOT NULL,
        "ParentTagId" uuid,
        "CreatedAt" timestamp with time zone NOT NULL,
        "CreatedByUserId" text,
        "UpdatedAt" timestamp with time zone,
        "UpdatedByUserId" text,
        CONSTRAINT "PK_tags" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_tags_tags_ParentTagId" FOREIGN KEY ("ParentTagId") REFERENCES tags ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE actor_translations (
        "ActorId" uuid NOT NULL,
        "LanguageCode" character varying(8) NOT NULL,
        "Name" character varying(240) NOT NULL,
        "ShortDescription" text,
        CONSTRAINT "PK_actor_translations" PRIMARY KEY ("ActorId", "LanguageCode"),
        CONSTRAINT "FK_actor_translations_actors_ActorId" FOREIGN KEY ("ActorId") REFERENCES actors ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE "AspNetRoleClaims" (
        "Id" integer GENERATED BY DEFAULT AS IDENTITY,
        "RoleId" text NOT NULL,
        "ClaimType" text,
        "ClaimValue" text,
        CONSTRAINT "PK_AspNetRoleClaims" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_AspNetRoleClaims_AspNetRoles_RoleId" FOREIGN KEY ("RoleId") REFERENCES "AspNetRoles" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE "AspNetUserClaims" (
        "Id" integer GENERATED BY DEFAULT AS IDENTITY,
        "UserId" text NOT NULL,
        "ClaimType" text,
        "ClaimValue" text,
        CONSTRAINT "PK_AspNetUserClaims" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_AspNetUserClaims_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE "AspNetUserLogins" (
        "LoginProvider" text NOT NULL,
        "ProviderKey" text NOT NULL,
        "ProviderDisplayName" text,
        "UserId" text NOT NULL,
        CONSTRAINT "PK_AspNetUserLogins" PRIMARY KEY ("LoginProvider", "ProviderKey"),
        CONSTRAINT "FK_AspNetUserLogins_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE "AspNetUserRoles" (
        "UserId" text NOT NULL,
        "RoleId" text NOT NULL,
        CONSTRAINT "PK_AspNetUserRoles" PRIMARY KEY ("UserId", "RoleId"),
        CONSTRAINT "FK_AspNetUserRoles_AspNetRoles_RoleId" FOREIGN KEY ("RoleId") REFERENCES "AspNetRoles" ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_AspNetUserRoles_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE "AspNetUserTokens" (
        "UserId" text NOT NULL,
        "LoginProvider" text NOT NULL,
        "Name" text NOT NULL,
        "Value" text,
        CONSTRAINT "PK_AspNetUserTokens" PRIMARY KEY ("UserId", "LoginProvider", "Name"),
        CONSTRAINT "FK_AspNetUserTokens_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE place_translations (
        "PlaceId" uuid NOT NULL,
        "LanguageCode" character varying(8) NOT NULL,
        "Name" character varying(260) NOT NULL,
        "Description" text,
        CONSTRAINT "PK_place_translations" PRIMARY KEY ("PlaceId", "LanguageCode"),
        CONSTRAINT "FK_place_translations_places_PlaceId" FOREIGN KEY ("PlaceId") REFERENCES places ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE tag_translations (
        "TagId" uuid NOT NULL,
        "LanguageCode" character varying(8) NOT NULL,
        "Name" character varying(180) NOT NULL,
        "Description" text,
        CONSTRAINT "PK_tag_translations" PRIMARY KEY ("TagId", "LanguageCode"),
        CONSTRAINT "FK_tag_translations_tags_TagId" FOREIGN KEY ("TagId") REFERENCES tags ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE entries (
        "Id" uuid NOT NULL,
        "Slug" character varying(180) NOT NULL,
        "Kind" integer NOT NULL,
        "Status" integer NOT NULL,
        "RealityStatus" integer NOT NULL,
        "DefaultTitle" character varying(300) NOT NULL,
        "DateLabel" text,
        "StartYear" bigint,
        "StartMonth" smallint,
        "StartDay" smallint,
        "EndYear" bigint,
        "EndMonth" smallint,
        "EndDay" smallint,
        "TimePrecision" integer NOT NULL,
        "TimeConfidence" character varying(300),
        "PrimaryTimePeriodId" uuid,
        "SourceSheet" character varying(120),
        "SourceRow" integer,
        "CreatedAt" timestamp with time zone NOT NULL,
        "CreatedByUserId" text,
        "UpdatedAt" timestamp with time zone,
        "UpdatedByUserId" text,
        CONSTRAINT "PK_entries" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE entry_actors (
        "EntryId" uuid NOT NULL,
        "ActorId" uuid NOT NULL,
        "Role" integer NOT NULL,
        "SortOrder" integer NOT NULL,
        "Note" text,
        CONSTRAINT "PK_entry_actors" PRIMARY KEY ("EntryId", "ActorId", "Role"),
        CONSTRAINT "FK_entry_actors_actors_ActorId" FOREIGN KEY ("ActorId") REFERENCES actors ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_entry_actors_entries_EntryId" FOREIGN KEY ("EntryId") REFERENCES entries ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE entry_audio_tracks (
        "Id" uuid NOT NULL,
        "EntryId" uuid NOT NULL,
        "LanguageCode" character varying(8) NOT NULL,
        "Kind" integer NOT NULL,
        "StorageProvider" integer NOT NULL,
        "StorageKey" character varying(600) NOT NULL,
        "PublicUrl" character varying(1000),
        "MediaType" character varying(120),
        "DurationSeconds" integer,
        "SortOrder" integer NOT NULL,
        "IsPrimary" boolean NOT NULL,
        "Title" character varying(260),
        "Transcript" text,
        "Attribution" character varying(500),
        "License" character varying(120),
        "SourceUrl" character varying(1000),
        "CreatedAt" timestamp with time zone NOT NULL,
        "CreatedByUserId" text,
        "UpdatedAt" timestamp with time zone,
        "UpdatedByUserId" text,
        CONSTRAINT "PK_entry_audio_tracks" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_entry_audio_tracks_entries_EntryId" FOREIGN KEY ("EntryId") REFERENCES entries ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE entry_images (
        "Id" uuid NOT NULL,
        "EntryId" uuid NOT NULL,
        "Kind" integer NOT NULL,
        "StorageProvider" integer NOT NULL,
        "StorageKey" character varying(600) NOT NULL,
        "PublicUrl" character varying(1000),
        "MediaType" character varying(120),
        "Width" integer,
        "Height" integer,
        "SortOrder" integer NOT NULL,
        "IsPrimary" boolean NOT NULL,
        "Attribution" character varying(500),
        "License" character varying(120),
        "SourceUrl" character varying(1000),
        "CreatedAt" timestamp with time zone NOT NULL,
        "CreatedByUserId" text,
        "UpdatedAt" timestamp with time zone,
        "UpdatedByUserId" text,
        CONSTRAINT "PK_entry_images" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_entry_images_entries_EntryId" FOREIGN KEY ("EntryId") REFERENCES entries ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE entry_places (
        "EntryId" uuid NOT NULL,
        "PlaceId" uuid NOT NULL,
        "Role" integer NOT NULL,
        "SortOrder" integer NOT NULL,
        "Note" text,
        CONSTRAINT "PK_entry_places" PRIMARY KEY ("EntryId", "PlaceId", "Role"),
        CONSTRAINT "FK_entry_places_entries_EntryId" FOREIGN KEY ("EntryId") REFERENCES entries ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_entry_places_places_PlaceId" FOREIGN KEY ("PlaceId") REFERENCES places ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE entry_relationships (
        "Id" uuid NOT NULL,
        "FromEntryId" uuid NOT NULL,
        "ToEntryId" uuid NOT NULL,
        "RelationshipType" integer NOT NULL,
        "Confidence" numeric,
        "Note" text,
        CONSTRAINT "PK_entry_relationships" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_entry_relationships_entries_FromEntryId" FOREIGN KEY ("FromEntryId") REFERENCES entries ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_entry_relationships_entries_ToEntryId" FOREIGN KEY ("ToEntryId") REFERENCES entries ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE entry_routes (
        "Id" uuid NOT NULL,
        "EntryId" uuid NOT NULL,
        "RouteType" integer NOT NULL,
        "Name" character varying(260) NOT NULL,
        "Geometry" geometry,
        "SpatialConfidence" integer NOT NULL,
        "SourceNote" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "CreatedByUserId" text,
        "UpdatedAt" timestamp with time zone,
        "UpdatedByUserId" text,
        CONSTRAINT "PK_entry_routes" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_entry_routes_entries_EntryId" FOREIGN KEY ("EntryId") REFERENCES entries ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE entry_sources (
        "EntryId" uuid NOT NULL,
        "SourceId" uuid NOT NULL,
        "SupportsField" integer NOT NULL,
        "Note" text,
        CONSTRAINT "PK_entry_sources" PRIMARY KEY ("EntryId", "SourceId", "SupportsField"),
        CONSTRAINT "FK_entry_sources_entries_EntryId" FOREIGN KEY ("EntryId") REFERENCES entries ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_entry_sources_sources_SourceId" FOREIGN KEY ("SourceId") REFERENCES sources ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE entry_tags (
        "EntryId" uuid NOT NULL,
        "TagId" uuid NOT NULL,
        "Confidence" numeric,
        CONSTRAINT "PK_entry_tags" PRIMARY KEY ("EntryId", "TagId"),
        CONSTRAINT "FK_entry_tags_entries_EntryId" FOREIGN KEY ("EntryId") REFERENCES entries ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_entry_tags_tags_TagId" FOREIGN KEY ("TagId") REFERENCES tags ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE entry_translations (
        "EntryId" uuid NOT NULL,
        "LanguageCode" character varying(8) NOT NULL,
        "Title" character varying(300) NOT NULL,
        "Summary" text,
        "Description" text,
        "WhyItMatters" text,
        "DatingNote" text,
        CONSTRAINT "PK_entry_translations" PRIMARY KEY ("EntryId", "LanguageCode"),
        CONSTRAINT "FK_entry_translations_entries_EntryId" FOREIGN KEY ("EntryId") REFERENCES entries ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE imported_rows (
        "Id" uuid NOT NULL,
        "ImportBatchId" uuid NOT NULL,
        "SheetName" character varying(120) NOT NULL,
        "RowNumber" integer NOT NULL,
        "RawJson" jsonb NOT NULL,
        "Warning" text,
        "EntryId" uuid,
        CONSTRAINT "PK_imported_rows" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_imported_rows_entries_EntryId" FOREIGN KEY ("EntryId") REFERENCES entries ("Id"),
        CONSTRAINT "FK_imported_rows_import_batches_ImportBatchId" FOREIGN KEY ("ImportBatchId") REFERENCES import_batches ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE time_periods (
        "Id" uuid NOT NULL,
        "Slug" character varying(180) NOT NULL,
        "PeriodType" integer NOT NULL,
        "ParentPeriodId" uuid,
        "StartYear" bigint,
        "EndYear" bigint,
        "StartPrecision" integer NOT NULL,
        "EndPrecision" integer NOT NULL,
        "ScopePlaceId" uuid,
        "EntryId" uuid,
        "SortOrder" integer NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "CreatedByUserId" text,
        "UpdatedAt" timestamp with time zone,
        "UpdatedByUserId" text,
        CONSTRAINT "PK_time_periods" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_time_periods_entries_EntryId" FOREIGN KEY ("EntryId") REFERENCES entries ("Id") ON DELETE SET NULL,
        CONSTRAINT "FK_time_periods_places_ScopePlaceId" FOREIGN KEY ("ScopePlaceId") REFERENCES places ("Id") ON DELETE SET NULL,
        CONSTRAINT "FK_time_periods_time_periods_ParentPeriodId" FOREIGN KEY ("ParentPeriodId") REFERENCES time_periods ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE entry_image_translations (
        "EntryImageId" uuid NOT NULL,
        "LanguageCode" character varying(8) NOT NULL,
        "AltText" character varying(300),
        "Caption" character varying(600),
        CONSTRAINT "PK_entry_image_translations" PRIMARY KEY ("EntryImageId", "LanguageCode"),
        CONSTRAINT "FK_entry_image_translations_entry_images_EntryImageId" FOREIGN KEY ("EntryImageId") REFERENCES entry_images ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE route_points (
        "RouteId" uuid NOT NULL,
        "PlaceId" uuid NOT NULL,
        "SortOrder" integer NOT NULL,
        "Role" integer NOT NULL,
        "DateLabel" text,
        "Note" text,
        CONSTRAINT "PK_route_points" PRIMARY KEY ("RouteId", "PlaceId", "SortOrder"),
        CONSTRAINT "FK_route_points_entry_routes_RouteId" FOREIGN KEY ("RouteId") REFERENCES entry_routes ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_route_points_places_PlaceId" FOREIGN KEY ("PlaceId") REFERENCES places ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE entry_time_periods (
        "EntryId" uuid NOT NULL,
        "TimePeriodId" uuid NOT NULL,
        "RelationType" integer NOT NULL,
        "Confidence" numeric,
        CONSTRAINT "PK_entry_time_periods" PRIMARY KEY ("EntryId", "TimePeriodId", "RelationType"),
        CONSTRAINT "FK_entry_time_periods_entries_EntryId" FOREIGN KEY ("EntryId") REFERENCES entries ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_entry_time_periods_time_periods_TimePeriodId" FOREIGN KEY ("TimePeriodId") REFERENCES time_periods ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE TABLE time_period_translations (
        "TimePeriodId" uuid NOT NULL,
        "LanguageCode" character varying(8) NOT NULL,
        "Name" character varying(220) NOT NULL,
        "ShortDescription" text,
        "LongDescription" text,
        CONSTRAINT "PK_time_period_translations" PRIMARY KEY ("TimePeriodId", "LanguageCode"),
        CONSTRAINT "FK_time_period_translations_time_periods_TimePeriodId" FOREIGN KEY ("TimePeriodId") REFERENCES time_periods ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_actors_Slug" ON actors ("Slug");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_AspNetRoleClaims_RoleId" ON "AspNetRoleClaims" ("RoleId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE UNIQUE INDEX "RoleNameIndex" ON "AspNetRoles" ("NormalizedName");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_AspNetUserClaims_UserId" ON "AspNetUserClaims" ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_AspNetUserLogins_UserId" ON "AspNetUserLogins" ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_AspNetUserRoles_RoleId" ON "AspNetUserRoles" ("RoleId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "EmailIndex" ON "AspNetUsers" ("NormalizedEmail");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE UNIQUE INDEX "UserNameIndex" ON "AspNetUsers" ("NormalizedUserName");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_entries_PrimaryTimePeriodId" ON entries ("PrimaryTimePeriodId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_entries_Slug" ON entries ("Slug");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_entries_Status_StartYear_EndYear" ON entries ("Status", "StartYear", "EndYear");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_entry_actors_ActorId" ON entry_actors ("ActorId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_entry_audio_tracks_EntryId_LanguageCode_IsPrimary" ON entry_audio_tracks ("EntryId", "LanguageCode", "IsPrimary");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_entry_images_EntryId_IsPrimary" ON entry_images ("EntryId", "IsPrimary");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_entry_places_PlaceId" ON entry_places ("PlaceId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_entry_relationships_FromEntryId" ON entry_relationships ("FromEntryId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_entry_relationships_ToEntryId" ON entry_relationships ("ToEntryId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_entry_routes_EntryId" ON entry_routes ("EntryId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_entry_sources_SourceId" ON entry_sources ("SourceId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_entry_tags_TagId" ON entry_tags ("TagId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_entry_time_periods_TimePeriodId" ON entry_time_periods ("TimePeriodId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_imported_rows_EntryId" ON imported_rows ("EntryId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_imported_rows_ImportBatchId_SheetName_RowNumber" ON imported_rows ("ImportBatchId", "SheetName", "RowNumber");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_places_Slug" ON places ("Slug");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_route_points_PlaceId" ON route_points ("PlaceId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_sources_Url" ON sources ("Url");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_tags_ParentTagId" ON tags ("ParentTagId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_tags_Slug" ON tags ("Slug");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_time_periods_EntryId" ON time_periods ("EntryId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_time_periods_ParentPeriodId" ON time_periods ("ParentPeriodId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE INDEX "IX_time_periods_ScopePlaceId" ON time_periods ("ScopePlaceId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_time_periods_Slug" ON time_periods ("Slug");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    ALTER TABLE entries ADD CONSTRAINT "FK_entries_time_periods_PrimaryTimePeriodId" FOREIGN KEY ("PrimaryTimePeriodId") REFERENCES time_periods ("Id") ON DELETE SET NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260722111345_InitialCreate') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260722111345_InitialCreate', '10.0.4');
    END IF;
END $EF$;
COMMIT;

