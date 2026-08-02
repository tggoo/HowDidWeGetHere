using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HowDidWeGetHere.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorldDivisionAudioTracks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "world_division_audio_tracks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorldDivisionId = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
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
                    table.PrimaryKey("PK_world_division_audio_tracks", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_world_division_audio_tracks_WorldDivisionId_LanguageCode_IsPrimary",
                table: "world_division_audio_tracks",
                columns: new[] { "WorldDivisionId", "LanguageCode", "IsPrimary" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "world_division_audio_tracks");
        }
    }
}
