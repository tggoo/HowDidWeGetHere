using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HowDidWeGetHere.Infrastructure.Persistence;

public static class DatabaseMigrationExtensions
{
    public static async Task ApplyDatabaseMigrationsAsync(
        this IHost host,
        IConfiguration configuration,
        CancellationToken cancellationToken = default)
    {
        if (!configuration.GetValue("Database:ApplyMigrationsOnStartup", false))
        {
            return;
        }

        var retryCount = Math.Max(1, configuration.GetValue("Database:MigrationRetryCount", 5));
        var retryDelay = TimeSpan.FromSeconds(Math.Max(1, configuration.GetValue("Database:MigrationRetryDelaySeconds", 5)));
        var failStartup = configuration.GetValue("Database:FailStartupOnMigrationError", false);
        using var scope = host.Services.CreateScope();
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("DatabaseMigration");
        var dbContext = scope.ServiceProvider.GetRequiredService<HistoryDbContext>();

        for (var attempt = 1; attempt <= retryCount; attempt++)
        {
            try
            {
                logger.LogInformation("Applying database migrations. Attempt {Attempt}/{RetryCount}.", attempt, retryCount);
                await dbContext.Database.MigrateAsync(cancellationToken);
                logger.LogInformation("Database migrations applied.");
                return;
            }
            catch (Exception exception) when (IsTransientStartupException(exception) && attempt < retryCount)
            {
                logger.LogWarning(exception, "Database migration failed during startup. Retrying in {RetryDelay}.", retryDelay);
                await Task.Delay(retryDelay, cancellationToken);
            }
            catch (Exception exception) when (!failStartup)
            {
                logger.LogError(exception, "Database migration failed. Startup will continue because FailStartupOnMigrationError is false.");
                return;
            }
        }
    }

    private static bool IsTransientStartupException(Exception exception) =>
        exception is TimeoutException or NpgsqlException ||
        exception.InnerException is TimeoutException or NpgsqlException;
}
