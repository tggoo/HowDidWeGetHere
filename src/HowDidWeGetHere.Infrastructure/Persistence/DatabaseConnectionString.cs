using Npgsql;

namespace HowDidWeGetHere.Infrastructure.Persistence;

public static class DatabaseConnectionString
{
    public static string Resolve(string? configuredConnectionString)
    {
        var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? Environment.GetEnvironmentVariable("HWDWGH_CONNECTION_STRING")
            ?? configuredConnectionString
            ?? "Host=localhost;Port=5432;Database=howdidwegethere;Username=postgres;Password=postgres";

        return connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
               connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
            ? ConvertPostgresUrl(connectionString)
            : connectionString;
    }

    private static string ConvertPostgresUrl(string databaseUrl)
    {
        var uri = new Uri(databaseUrl);
        var credentials = uri.UserInfo.Split(':', 2);

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = Uri.UnescapeDataString(credentials[0]),
            Password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : string.Empty,
            SslMode = SslMode.Require,
            GssEncryptionMode = GssEncryptionMode.Disable
        };

        return builder.ConnectionString;
    }
}
