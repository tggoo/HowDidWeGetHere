using HowDidWeGetHere.Api.Contracts;

namespace HowDidWeGetHere.Api.Endpoints;

public static class AdminDeploymentEndpoints
{
    private static readonly DateTimeOffset StartedAtUtc = DateTimeOffset.UtcNow;

    public static RouteGroupBuilder MapAdminDeploymentEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGet("/deployment-info", GetDeploymentInfo)
            .Produces<DeploymentInfoResponse>(StatusCodes.Status200OK);

        return admin;
    }

    private static IResult GetDeploymentInfo(IConfiguration configuration)
    {
        var commitSha = FirstNonEmpty(
            Environment.GetEnvironmentVariable("RENDER_GIT_COMMIT"),
            Environment.GetEnvironmentVariable("GIT_COMMIT"),
            configuration["Deployment:CommitSha"]);
        var repoSlug = FirstNonEmpty(
            Environment.GetEnvironmentVariable("RENDER_GIT_REPO_SLUG"),
            configuration["Deployment:RepositorySlug"]);
        var repositoryUrl = ResolveRepositoryUrl(configuration, repoSlug);
        var shortCommitSha = commitSha is { Length: >= 7 } ? commitSha[..7] : commitSha;
        var commitUrl = !string.IsNullOrWhiteSpace(commitSha) && !string.IsNullOrWhiteSpace(repositoryUrl)
            ? $"{repositoryUrl.TrimEnd('/')}/commit/{commitSha}"
            : null;

        return Results.Ok(new DeploymentInfoResponse(
            commitSha,
            shortCommitSha,
            commitUrl,
            StartedAtUtc));
    }

    private static string? ResolveRepositoryUrl(IConfiguration configuration, string? repoSlug)
    {
        var configuredUrl = FirstNonEmpty(configuration["Deployment:RepositoryUrl"]);
        if (!string.IsNullOrWhiteSpace(configuredUrl))
        {
            return configuredUrl;
        }

        return string.IsNullOrWhiteSpace(repoSlug)
            ? null
            : $"https://github.com/{repoSlug.Trim().TrimEnd('/')}";
    }

    private static string? FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Trim();
            }
        }

        return null;
    }
}
