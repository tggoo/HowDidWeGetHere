using HowDidWeGetHere.Infrastructure.Identity;

namespace HowDidWeGetHere.Api.Endpoints;

public static class EndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapApiEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGroup("/api/auth")
            .MapIdentityApi<ApplicationUser>();

        var api = endpoints.MapGroup("/api");
        api.MapPublicEndpoints();

        var admin = api.MapGroup("/admin")
            .RequireAuthorization("AdminOnly");

        admin.MapAdminEntryEndpoints();
        admin.MapAdminMediaEndpoints();
        admin.MapAdminPlaceEndpoints();
        admin.MapAdminRouteEndpoints();
        admin.MapAdminRelationshipEndpoints();
        admin.MapAdminSourceEndpoints();
        admin.MapAdminTimePeriodEndpoints();
        admin.MapAdminImportEndpoints();

        return endpoints;
    }
}
