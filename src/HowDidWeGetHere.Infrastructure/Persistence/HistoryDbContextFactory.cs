using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HowDidWeGetHere.Infrastructure.Persistence;

public sealed class HistoryDbContextFactory : IDesignTimeDbContextFactory<HistoryDbContext>
{
    public HistoryDbContext CreateDbContext(string[] args)
    {
        var connectionString = DatabaseConnectionString.Resolve(null);

        var optionsBuilder = new DbContextOptionsBuilder<HistoryDbContext>();
        optionsBuilder.UseNpgsql(connectionString, npgsql => npgsql.UseNetTopologySuite());

        return new HistoryDbContext(optionsBuilder.Options);
    }
}
