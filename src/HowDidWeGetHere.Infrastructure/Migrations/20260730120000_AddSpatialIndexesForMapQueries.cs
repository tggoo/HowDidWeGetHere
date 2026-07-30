using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HowDidWeGetHere.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSpatialIndexesForMapQueries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                    name: "IX_entry_routes_Geometry",
                    table: "entry_routes",
                    column: "Geometry")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                    name: "IX_places_Geometry",
                    table: "places",
                    column: "Geometry")
                .Annotation("Npgsql:IndexMethod", "gist");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_entry_routes_Geometry",
                table: "entry_routes");

            migrationBuilder.DropIndex(
                name: "IX_places_Geometry",
                table: "places");
        }
    }
}
