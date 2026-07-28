using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace HowDidWeGetHere.Api.Media;

public sealed class GitHubReleaseStorageClient(
    IHttpClientFactory httpClientFactory,
    IOptions<MediaStorageOptions> options,
    ILogger<GitHubReleaseStorageClient> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<GitHubReleaseAsset> UploadAssetAsync(
        string assetName,
        string filePath,
        string contentType,
        long contentLength,
        CancellationToken cancellationToken)
    {
        var github = ResolveOptions();
        for (var shard = 1; shard <= github.MaxReleaseShards; shard++)
        {
            var release = await GetOrCreateReleaseAsync(github, shard, cancellationToken);
            var assets = await ListAssetsAsync(github, release.Id, cancellationToken);
            var existingAsset = assets.FirstOrDefault(asset =>
                string.Equals(asset.Name, assetName, StringComparison.OrdinalIgnoreCase));
            if (existingAsset is not null)
            {
                return existingAsset;
            }

            if (assets.Count >= github.MaxAssetsPerRelease)
            {
                continue;
            }

            return await UploadAssetToReleaseAsync(
                github,
                release,
                assetName,
                filePath,
                contentType,
                contentLength,
                cancellationToken);
        }

        throw new InvalidOperationException(
            $"No GitHub release shard has free asset capacity. Increase Media:GitHub:MaxReleaseShards.");
    }

    private async Task<GitHubRelease> GetOrCreateReleaseAsync(
        GitHubReleaseMediaStorageOptions github,
        int shard,
        CancellationToken cancellationToken)
    {
        var tag = BuildReleaseTag(github, shard);
        using var getRequest = CreateRequest(
            github,
            HttpMethod.Get,
            $"https://api.github.com/repos/{github.Owner}/{github.Repository}/releases/tags/{Uri.EscapeDataString(tag)}");
        using var getResponse = await SendAsync(getRequest, cancellationToken);
        if (getResponse.StatusCode == HttpStatusCode.OK)
        {
            return await ReadJsonAsync<GitHubRelease>(getResponse, cancellationToken);
        }

        if (getResponse.StatusCode != HttpStatusCode.NotFound)
        {
            await ThrowGitHubErrorAsync(getResponse, "GitHub release lookup failed.", cancellationToken);
        }

        var body = JsonSerializer.Serialize(new
        {
            tag_name = tag,
            name = $"{github.ReleaseNamePrefix} {shard:000}",
            draft = github.Draft,
            prerelease = github.Prerelease
        }, JsonOptions);
        using var createRequest = CreateRequest(
            github,
            HttpMethod.Post,
            $"https://api.github.com/repos/{github.Owner}/{github.Repository}/releases");
        createRequest.Content = new StringContent(body, Encoding.UTF8, "application/json");
        using var createResponse = await SendAsync(createRequest, cancellationToken);
        if (createResponse.StatusCode == HttpStatusCode.Created)
        {
            return await ReadJsonAsync<GitHubRelease>(createResponse, cancellationToken);
        }

        if (createResponse.StatusCode == HttpStatusCode.UnprocessableEntity)
        {
            using var retryRequest = CreateRequest(
                github,
                HttpMethod.Get,
                $"https://api.github.com/repos/{github.Owner}/{github.Repository}/releases/tags/{Uri.EscapeDataString(tag)}");
            using var retryResponse = await SendAsync(retryRequest, cancellationToken);
            if (retryResponse.StatusCode == HttpStatusCode.OK)
            {
                return await ReadJsonAsync<GitHubRelease>(retryResponse, cancellationToken);
            }
        }

        await ThrowGitHubErrorAsync(createResponse, "GitHub release creation failed.", cancellationToken);
        throw new InvalidOperationException("GitHub release creation failed.");
    }

    private async Task<List<GitHubReleaseAsset>> ListAssetsAsync(
        GitHubReleaseMediaStorageOptions github,
        long releaseId,
        CancellationToken cancellationToken)
    {
        var assets = new List<GitHubReleaseAsset>();
        for (var page = 1; ; page++)
        {
            using var request = CreateRequest(
                github,
                HttpMethod.Get,
                $"https://api.github.com/repos/{github.Owner}/{github.Repository}/releases/{releaseId}/assets?per_page=100&page={page}");
            using var response = await SendAsync(request, cancellationToken);
            if (response.StatusCode != HttpStatusCode.OK)
            {
                await ThrowGitHubErrorAsync(response, "GitHub release asset listing failed.", cancellationToken);
            }

            var pageAssets = await ReadJsonAsync<List<GitHubReleaseAsset>>(response, cancellationToken);
            assets.AddRange(pageAssets);
            if (pageAssets.Count < 100)
            {
                return assets;
            }
        }
    }

    private async Task<GitHubReleaseAsset> UploadAssetToReleaseAsync(
        GitHubReleaseMediaStorageOptions github,
        GitHubRelease release,
        string assetName,
        string filePath,
        string contentType,
        long contentLength,
        CancellationToken cancellationToken)
    {
        var uploadUrl = release.UploadUrl.Split('{', 2)[0];
        var uploadUri = $"{uploadUrl}?name={Uri.EscapeDataString(assetName)}";
        await using var fileStream = File.OpenRead(filePath);
        using var request = CreateRequest(github, HttpMethod.Post, uploadUri, acceptsJson: false);
        request.Content = new StreamContent(fileStream);
        request.Content.Headers.ContentLength = contentLength;
        request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);

        using var response = await SendAsync(request, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Created)
        {
            return await ReadJsonAsync<GitHubReleaseAsset>(response, cancellationToken);
        }

        if (response.StatusCode == HttpStatusCode.UnprocessableEntity)
        {
            var assets = await ListAssetsAsync(github, release.Id, cancellationToken);
            var existingAsset = assets.FirstOrDefault(asset =>
                string.Equals(asset.Name, assetName, StringComparison.OrdinalIgnoreCase));
            if (existingAsset is not null)
            {
                return existingAsset;
            }
        }

        await ThrowGitHubErrorAsync(response, "GitHub release asset upload failed.", cancellationToken);
        throw new InvalidOperationException("GitHub release asset upload failed.");
    }

    private GitHubReleaseMediaStorageOptions ResolveOptions()
    {
        var github = options.Value.GitHub;
        if (string.IsNullOrWhiteSpace(github.Owner) ||
            string.IsNullOrWhiteSpace(github.Repository) ||
            string.IsNullOrWhiteSpace(github.Token))
        {
            throw new InvalidOperationException(
                "GitHub media storage is enabled but Media:GitHub:Owner, Repository, and Token are not fully configured.");
        }

        github.MaxAssetsPerRelease = Math.Clamp(github.MaxAssetsPerRelease, 1, 1000);
        github.MaxReleaseShards = Math.Max(1, github.MaxReleaseShards);
        github.ReleaseTagPrefix = string.IsNullOrWhiteSpace(github.ReleaseTagPrefix)
            ? "media-assets"
            : github.ReleaseTagPrefix.Trim();
        github.ReleaseNamePrefix = string.IsNullOrWhiteSpace(github.ReleaseNamePrefix)
            ? "Media Assets"
            : github.ReleaseNamePrefix.Trim();
        return github;
    }

    private static string BuildReleaseTag(GitHubReleaseMediaStorageOptions github, int shard) =>
        $"{github.ReleaseTagPrefix}-{shard:000}";

    private HttpRequestMessage CreateRequest(
        GitHubReleaseMediaStorageOptions github,
        HttpMethod method,
        string uri,
        bool acceptsJson = true)
    {
        var request = new HttpRequestMessage(method, uri);
        request.Headers.UserAgent.ParseAdd("HowDidWeGetHere/1.0");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", github.Token);
        request.Headers.TryAddWithoutValidation("X-GitHub-Api-Version", "2022-11-28");
        if (acceptsJson)
        {
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        }

        return request;
    }

    private async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var response = await httpClientFactory.CreateClient().SendAsync(request, cancellationToken);
        if ((int)response.StatusCode >= 500)
        {
            logger.LogWarning(
                "GitHub media request failed with server status. Method={Method} Uri={Uri} StatusCode={StatusCode}",
                request.Method,
                request.RequestUri,
                response.StatusCode);
        }

        return response;
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("GitHub response body could not be deserialized.");
    }

    private static async Task ThrowGitHubErrorAsync(
        HttpResponseMessage response,
        string message,
        CancellationToken cancellationToken)
    {
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        throw new InvalidOperationException($"{message} Status={(int)response.StatusCode} Body={body}");
    }
}

public sealed record GitHubRelease(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("tag_name")] string TagName,
    [property: JsonPropertyName("upload_url")] string UploadUrl);

public sealed record GitHubReleaseAsset(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("browser_download_url")] string BrowserDownloadUrl,
    [property: JsonPropertyName("digest")] string? Digest);
