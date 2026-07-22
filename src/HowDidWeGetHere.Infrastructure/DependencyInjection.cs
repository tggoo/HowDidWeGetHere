using HowDidWeGetHere.Application.Imports;
using HowDidWeGetHere.Infrastructure.Identity;
using HowDidWeGetHere.Infrastructure.Imports;
using HowDidWeGetHere.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HowDidWeGetHere.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = DatabaseConnectionString.Resolve(configuration.GetConnectionString("HistoryDb"));

        services.AddDbContext<HistoryDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql => npgsql.UseNetTopologySuite()));

        services.AddIdentityApiEndpoints<ApplicationUser>()
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<HistoryDbContext>();

        services.AddScoped<IWorkbookImportService, WorkbookImportService>();

        return services;
    }
}
