using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace HowDidWeGetHere.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMinMaxItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "min_max_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DefaultTitle = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_min_max_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "min_max_item_shapes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MinMaxItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Geometry = table.Column<Geometry>(type: "geometry", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_min_max_item_shapes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_min_max_item_shapes_min_max_items_MinMaxItemId",
                        column: x => x.MinMaxItemId,
                        principalTable: "min_max_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "min_max_item_translations",
                columns: table => new
                {
                    MinMaxItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    LanguageCode = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Title = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    Subtitle = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    TypeLabel = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    ValueLabel = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    Summary = table.Column<string>(type: "text", nullable: true),
                    MapNote = table.Column<string>(type: "text", nullable: true),
                    FactsJson = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_min_max_item_translations", x => new { x.MinMaxItemId, x.LanguageCode });
                    table.ForeignKey(
                        name: "FK_min_max_item_translations_min_max_items_MinMaxItemId",
                        column: x => x.MinMaxItemId,
                        principalTable: "min_max_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_min_max_item_shapes_Geometry",
                table: "min_max_item_shapes",
                column: "Geometry")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                name: "IX_min_max_item_shapes_MinMaxItemId",
                table: "min_max_item_shapes",
                column: "MinMaxItemId");

            migrationBuilder.CreateIndex(
                name: "IX_min_max_items_Category_SortOrder",
                table: "min_max_items",
                columns: new[] { "Category", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_min_max_items_Slug",
                table: "min_max_items",
                column: "Slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "min_max_item_shapes");

            migrationBuilder.DropTable(
                name: "min_max_item_translations");

            migrationBuilder.DropTable(
                name: "min_max_items");
        }
    }
}
