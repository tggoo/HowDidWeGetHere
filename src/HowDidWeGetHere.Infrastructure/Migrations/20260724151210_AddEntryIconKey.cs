using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HowDidWeGetHere.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEntryIconKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IconKey",
                table: "entries",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IconKey",
                table: "entries");
        }
    }
}
