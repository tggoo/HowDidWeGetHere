using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace HowDidWeGetHere.Infrastructure.Identity;

public static class AdminSeeder
{
    public static async Task SeedAdminUserAsync(this IServiceProvider services, IConfiguration configuration)
    {
        var options = configuration.GetSection("AdminBootstrap").Get<AdminBootstrapOptions>();
        if (string.IsNullOrWhiteSpace(options?.Email) || string.IsNullOrWhiteSpace(options.Password))
        {
            return;
        }

        using var scope = services.CreateScope();
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("AdminSeeder");
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        if (!await roleManager.RoleExistsAsync("Admin"))
        {
            await roleManager.CreateAsync(new IdentityRole("Admin"));
        }

        var user = await userManager.FindByEmailAsync(options.Email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = options.Email,
                Email = options.Email,
                EmailConfirmed = true,
                DisplayName = "Administrator"
            };

            var created = await userManager.CreateAsync(user, options.Password);
            if (!created.Succeeded)
            {
                logger.LogError(
                    "Admin bootstrap user was not created. Fix AdminBootstrap__Password. Errors: {Errors}",
                    string.Join("; ", created.Errors.Select(error => error.Description)));
                return;
            }
        }

        if (!await userManager.IsInRoleAsync(user, "Admin"))
        {
            await userManager.AddToRoleAsync(user, "Admin");
        }
    }
}
