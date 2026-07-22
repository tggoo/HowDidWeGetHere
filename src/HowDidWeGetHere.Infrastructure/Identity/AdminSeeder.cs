using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

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
                throw new InvalidOperationException(string.Join("; ", created.Errors.Select(error => error.Description)));
            }
        }

        if (!await userManager.IsInRoleAsync(user, "Admin"))
        {
            await userManager.AddToRoleAsync(user, "Admin");
        }
    }
}
