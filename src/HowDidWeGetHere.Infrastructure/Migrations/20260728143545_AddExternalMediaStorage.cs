using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HowDidWeGetHere.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalMediaStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<byte[]>(
                name: "Content",
                table: "media_blobs",
                type: "bytea",
                nullable: true,
                oldClrType: typeof(byte[]),
                oldType: "bytea");

            migrationBuilder.AddColumn<string>(
                name: "ExternalETag",
                table: "media_blobs",
                type: "character varying(240)",
                maxLength: 240,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalId",
                table: "media_blobs",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalUrl",
                table: "media_blobs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StorageProvider",
                table: "media_blobs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_media_blobs_StorageProvider_ContentHash_ContentLength",
                table: "media_blobs",
                columns: new[] { "StorageProvider", "ContentHash", "ContentLength" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_media_blobs_StorageProvider_ContentHash_ContentLength",
                table: "media_blobs");

            migrationBuilder.DropColumn(
                name: "ExternalETag",
                table: "media_blobs");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "media_blobs");

            migrationBuilder.DropColumn(
                name: "ExternalUrl",
                table: "media_blobs");

            migrationBuilder.DropColumn(
                name: "StorageProvider",
                table: "media_blobs");

            migrationBuilder.AlterColumn<byte[]>(
                name: "Content",
                table: "media_blobs",
                type: "bytea",
                nullable: false,
                defaultValue: new byte[0],
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldNullable: true);
        }
    }
}
