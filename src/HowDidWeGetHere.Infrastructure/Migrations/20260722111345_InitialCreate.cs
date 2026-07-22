using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HowDidWeGetHere.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,");

            migrationBuilder.CreateTable(
                name: "actors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    ActorType = table.Column<int>(type: "integer", nullable: false),
                    DefaultName = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    WikidataId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_actors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetRoles",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUsers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    DisplayName = table.Column<string>(type: "text", nullable: true),
                    UserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: true),
                    SecurityStamp = table.Column<string>(type: "text", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true),
                    PhoneNumber = table.Column<string>(type: "text", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LockoutEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "import_batches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    ImportedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    SummaryJson = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_import_batches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "places",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    PlaceType = table.Column<int>(type: "integer", nullable: false),
                    DefaultName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    Geometry = table.Column<Geometry>(type: "geometry", nullable: true),
                    ModernCountryCode = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: true),
                    WikidataId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    GeoNamesId = table.Column<int>(type: "integer", nullable: true),
                    SpatialConfidence = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_places", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sources",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Title = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Publisher = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    LanguageCode = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: true),
                    AccessedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sources", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tags",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    TagGroup = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ParentTagId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tags", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tags_tags_ParentTagId",
                        column: x => x.ParentTagId,
                        principalTable: "tags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "actor_translations",
                columns: table => new
                {
                    ActorId = table.Column<Guid>(type: "uuid", nullable: false),
                    LanguageCode = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Name = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    ShortDescription = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_actor_translations", x => new { x.ActorId, x.LanguageCode });
                    table.ForeignKey(
                        name: "FK_actor_translations_actors_ActorId",
                        column: x => x.ActorId,
                        principalTable: "actors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetRoleClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RoleId = table.Column<string>(type: "text", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoleClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetRoleClaims_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserLogins",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    ProviderKey = table.Column<string>(type: "text", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserLogins", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserRoles",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    RoleId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserTokens",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserTokens", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "place_translations",
                columns: table => new
                {
                    PlaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    LanguageCode = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Name = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_place_translations", x => new { x.PlaceId, x.LanguageCode });
                    table.ForeignKey(
                        name: "FK_place_translations_places_PlaceId",
                        column: x => x.PlaceId,
                        principalTable: "places",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tag_translations",
                columns: table => new
                {
                    TagId = table.Column<Guid>(type: "uuid", nullable: false),
                    LanguageCode = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tag_translations", x => new { x.TagId, x.LanguageCode });
                    table.ForeignKey(
                        name: "FK_tag_translations_tags_TagId",
                        column: x => x.TagId,
                        principalTable: "tags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RealityStatus = table.Column<int>(type: "integer", nullable: false),
                    DefaultTitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    DateLabel = table.Column<string>(type: "text", nullable: true),
                    StartYear = table.Column<long>(type: "bigint", nullable: true),
                    StartMonth = table.Column<byte>(type: "smallint", nullable: true),
                    StartDay = table.Column<byte>(type: "smallint", nullable: true),
                    EndYear = table.Column<long>(type: "bigint", nullable: true),
                    EndMonth = table.Column<byte>(type: "smallint", nullable: true),
                    EndDay = table.Column<byte>(type: "smallint", nullable: true),
                    TimePrecision = table.Column<int>(type: "integer", nullable: false),
                    TimeConfidence = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    PrimaryTimePeriodId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceSheet = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    SourceRow = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "entry_actors",
                columns: table => new
                {
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_actors", x => new { x.EntryId, x.ActorId, x.Role });
                    table.ForeignKey(
                        name: "FK_entry_actors_actors_ActorId",
                        column: x => x.ActorId,
                        principalTable: "actors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entry_actors_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entry_audio_tracks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    LanguageCode = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    StorageProvider = table.Column<int>(type: "integer", nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false),
                    PublicUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    MediaType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    Title = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Transcript = table.Column<string>(type: "text", nullable: true),
                    Attribution = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    License = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    SourceUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_audio_tracks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_entry_audio_tracks_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entry_images",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    StorageProvider = table.Column<int>(type: "integer", nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false),
                    PublicUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    MediaType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Width = table.Column<int>(type: "integer", nullable: true),
                    Height = table.Column<int>(type: "integer", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    Attribution = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    License = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    SourceUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_images", x => x.Id);
                    table.ForeignKey(
                        name: "FK_entry_images_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entry_places",
                columns: table => new
                {
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_places", x => new { x.EntryId, x.PlaceId, x.Role });
                    table.ForeignKey(
                        name: "FK_entry_places_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entry_places_places_PlaceId",
                        column: x => x.PlaceId,
                        principalTable: "places",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entry_relationships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FromEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    RelationshipType = table.Column<int>(type: "integer", nullable: false),
                    Confidence = table.Column<decimal>(type: "numeric", nullable: true),
                    Note = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_relationships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_entry_relationships_entries_FromEntryId",
                        column: x => x.FromEntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_entry_relationships_entries_ToEntryId",
                        column: x => x.ToEntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "entry_routes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    RouteType = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    Geometry = table.Column<Geometry>(type: "geometry", nullable: true),
                    SpatialConfidence = table.Column<int>(type: "integer", nullable: false),
                    SourceNote = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_routes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_entry_routes_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entry_sources",
                columns: table => new
                {
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceId = table.Column<Guid>(type: "uuid", nullable: false),
                    SupportsField = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_sources", x => new { x.EntryId, x.SourceId, x.SupportsField });
                    table.ForeignKey(
                        name: "FK_entry_sources_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entry_sources_sources_SourceId",
                        column: x => x.SourceId,
                        principalTable: "sources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entry_tags",
                columns: table => new
                {
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    TagId = table.Column<Guid>(type: "uuid", nullable: false),
                    Confidence = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_tags", x => new { x.EntryId, x.TagId });
                    table.ForeignKey(
                        name: "FK_entry_tags_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entry_tags_tags_TagId",
                        column: x => x.TagId,
                        principalTable: "tags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entry_translations",
                columns: table => new
                {
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    LanguageCode = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Summary = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    WhyItMatters = table.Column<string>(type: "text", nullable: true),
                    DatingNote = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_translations", x => new { x.EntryId, x.LanguageCode });
                    table.ForeignKey(
                        name: "FK_entry_translations_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "imported_rows",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ImportBatchId = table.Column<Guid>(type: "uuid", nullable: false),
                    SheetName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    RowNumber = table.Column<int>(type: "integer", nullable: false),
                    RawJson = table.Column<string>(type: "jsonb", nullable: false),
                    Warning = table.Column<string>(type: "text", nullable: true),
                    EntryId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_imported_rows", x => x.Id);
                    table.ForeignKey(
                        name: "FK_imported_rows_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "entries",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_imported_rows_import_batches_ImportBatchId",
                        column: x => x.ImportBatchId,
                        principalTable: "import_batches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "time_periods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    PeriodType = table.Column<int>(type: "integer", nullable: false),
                    ParentPeriodId = table.Column<Guid>(type: "uuid", nullable: true),
                    StartYear = table.Column<long>(type: "bigint", nullable: true),
                    EndYear = table.Column<long>(type: "bigint", nullable: true),
                    StartPrecision = table.Column<int>(type: "integer", nullable: false),
                    EndPrecision = table.Column<int>(type: "integer", nullable: false),
                    ScopePlaceId = table.Column<Guid>(type: "uuid", nullable: true),
                    EntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_time_periods", x => x.Id);
                    table.ForeignKey(
                        name: "FK_time_periods_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_time_periods_places_ScopePlaceId",
                        column: x => x.ScopePlaceId,
                        principalTable: "places",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_time_periods_time_periods_ParentPeriodId",
                        column: x => x.ParentPeriodId,
                        principalTable: "time_periods",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "entry_image_translations",
                columns: table => new
                {
                    EntryImageId = table.Column<Guid>(type: "uuid", nullable: false),
                    LanguageCode = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    AltText = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Caption = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_image_translations", x => new { x.EntryImageId, x.LanguageCode });
                    table.ForeignKey(
                        name: "FK_entry_image_translations_entry_images_EntryImageId",
                        column: x => x.EntryImageId,
                        principalTable: "entry_images",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "route_points",
                columns: table => new
                {
                    RouteId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    DateLabel = table.Column<string>(type: "text", nullable: true),
                    Note = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_route_points", x => new { x.RouteId, x.PlaceId, x.SortOrder });
                    table.ForeignKey(
                        name: "FK_route_points_entry_routes_RouteId",
                        column: x => x.RouteId,
                        principalTable: "entry_routes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_route_points_places_PlaceId",
                        column: x => x.PlaceId,
                        principalTable: "places",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entry_time_periods",
                columns: table => new
                {
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    TimePeriodId = table.Column<Guid>(type: "uuid", nullable: false),
                    RelationType = table.Column<int>(type: "integer", nullable: false),
                    Confidence = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_time_periods", x => new { x.EntryId, x.TimePeriodId, x.RelationType });
                    table.ForeignKey(
                        name: "FK_entry_time_periods_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entry_time_periods_time_periods_TimePeriodId",
                        column: x => x.TimePeriodId,
                        principalTable: "time_periods",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "time_period_translations",
                columns: table => new
                {
                    TimePeriodId = table.Column<Guid>(type: "uuid", nullable: false),
                    LanguageCode = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Name = table.Column<string>(type: "character varying(220)", maxLength: 220, nullable: false),
                    ShortDescription = table.Column<string>(type: "text", nullable: true),
                    LongDescription = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_time_period_translations", x => new { x.TimePeriodId, x.LanguageCode });
                    table.ForeignKey(
                        name: "FK_time_period_translations_time_periods_TimePeriodId",
                        column: x => x.TimePeriodId,
                        principalTable: "time_periods",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_actors_Slug",
                table: "actors",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetRoleClaims_RoleId",
                table: "AspNetRoleClaims",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "AspNetRoles",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserClaims_UserId",
                table: "AspNetUserClaims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserLogins_UserId",
                table: "AspNetUserLogins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserRoles_RoleId",
                table: "AspNetUserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "AspNetUsers",
                column: "NormalizedUserName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_entries_PrimaryTimePeriodId",
                table: "entries",
                column: "PrimaryTimePeriodId");

            migrationBuilder.CreateIndex(
                name: "IX_entries_Slug",
                table: "entries",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_entries_Status_StartYear_EndYear",
                table: "entries",
                columns: new[] { "Status", "StartYear", "EndYear" });

            migrationBuilder.CreateIndex(
                name: "IX_entry_actors_ActorId",
                table: "entry_actors",
                column: "ActorId");

            migrationBuilder.CreateIndex(
                name: "IX_entry_audio_tracks_EntryId_LanguageCode_IsPrimary",
                table: "entry_audio_tracks",
                columns: new[] { "EntryId", "LanguageCode", "IsPrimary" });

            migrationBuilder.CreateIndex(
                name: "IX_entry_images_EntryId_IsPrimary",
                table: "entry_images",
                columns: new[] { "EntryId", "IsPrimary" });

            migrationBuilder.CreateIndex(
                name: "IX_entry_places_PlaceId",
                table: "entry_places",
                column: "PlaceId");

            migrationBuilder.CreateIndex(
                name: "IX_entry_relationships_FromEntryId",
                table: "entry_relationships",
                column: "FromEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_entry_relationships_ToEntryId",
                table: "entry_relationships",
                column: "ToEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_entry_routes_EntryId",
                table: "entry_routes",
                column: "EntryId");

            migrationBuilder.CreateIndex(
                name: "IX_entry_sources_SourceId",
                table: "entry_sources",
                column: "SourceId");

            migrationBuilder.CreateIndex(
                name: "IX_entry_tags_TagId",
                table: "entry_tags",
                column: "TagId");

            migrationBuilder.CreateIndex(
                name: "IX_entry_time_periods_TimePeriodId",
                table: "entry_time_periods",
                column: "TimePeriodId");

            migrationBuilder.CreateIndex(
                name: "IX_imported_rows_EntryId",
                table: "imported_rows",
                column: "EntryId");

            migrationBuilder.CreateIndex(
                name: "IX_imported_rows_ImportBatchId_SheetName_RowNumber",
                table: "imported_rows",
                columns: new[] { "ImportBatchId", "SheetName", "RowNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_places_Slug",
                table: "places",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_route_points_PlaceId",
                table: "route_points",
                column: "PlaceId");

            migrationBuilder.CreateIndex(
                name: "IX_sources_Url",
                table: "sources",
                column: "Url",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tags_ParentTagId",
                table: "tags",
                column: "ParentTagId");

            migrationBuilder.CreateIndex(
                name: "IX_tags_Slug",
                table: "tags",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_time_periods_EntryId",
                table: "time_periods",
                column: "EntryId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_time_periods_ParentPeriodId",
                table: "time_periods",
                column: "ParentPeriodId");

            migrationBuilder.CreateIndex(
                name: "IX_time_periods_ScopePlaceId",
                table: "time_periods",
                column: "ScopePlaceId");

            migrationBuilder.CreateIndex(
                name: "IX_time_periods_Slug",
                table: "time_periods",
                column: "Slug",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_entries_time_periods_PrimaryTimePeriodId",
                table: "entries",
                column: "PrimaryTimePeriodId",
                principalTable: "time_periods",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_entries_time_periods_PrimaryTimePeriodId",
                table: "entries");

            migrationBuilder.DropTable(
                name: "actor_translations");

            migrationBuilder.DropTable(
                name: "AspNetRoleClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserLogins");

            migrationBuilder.DropTable(
                name: "AspNetUserRoles");

            migrationBuilder.DropTable(
                name: "AspNetUserTokens");

            migrationBuilder.DropTable(
                name: "entry_actors");

            migrationBuilder.DropTable(
                name: "entry_audio_tracks");

            migrationBuilder.DropTable(
                name: "entry_image_translations");

            migrationBuilder.DropTable(
                name: "entry_places");

            migrationBuilder.DropTable(
                name: "entry_relationships");

            migrationBuilder.DropTable(
                name: "entry_sources");

            migrationBuilder.DropTable(
                name: "entry_tags");

            migrationBuilder.DropTable(
                name: "entry_time_periods");

            migrationBuilder.DropTable(
                name: "entry_translations");

            migrationBuilder.DropTable(
                name: "imported_rows");

            migrationBuilder.DropTable(
                name: "place_translations");

            migrationBuilder.DropTable(
                name: "route_points");

            migrationBuilder.DropTable(
                name: "tag_translations");

            migrationBuilder.DropTable(
                name: "time_period_translations");

            migrationBuilder.DropTable(
                name: "AspNetRoles");

            migrationBuilder.DropTable(
                name: "AspNetUsers");

            migrationBuilder.DropTable(
                name: "actors");

            migrationBuilder.DropTable(
                name: "entry_images");

            migrationBuilder.DropTable(
                name: "sources");

            migrationBuilder.DropTable(
                name: "import_batches");

            migrationBuilder.DropTable(
                name: "entry_routes");

            migrationBuilder.DropTable(
                name: "tags");

            migrationBuilder.DropTable(
                name: "time_periods");

            migrationBuilder.DropTable(
                name: "entries");

            migrationBuilder.DropTable(
                name: "places");
        }
    }
}
