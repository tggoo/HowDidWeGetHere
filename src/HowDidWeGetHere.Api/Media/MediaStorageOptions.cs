namespace HowDidWeGetHere.Api.Media;

public sealed class MediaStorageOptions
{
    public string StorageMode { get; set; } = "Local";
    public string StorageRootPath { get; set; } = string.Empty;
    public string PublicBaseUrl { get; set; } = string.Empty;
    public bool StoreLocalCopiesInDatabase { get; set; } = true;
    public S3MediaStorageOptions S3 { get; set; } = new();
    public GitHubReleaseMediaStorageOptions GitHub { get; set; } = new();
}

public sealed class S3MediaStorageOptions
{
    public string Endpoint { get; set; } = string.Empty;
    public string Region { get; set; } = "auto";
    public string Bucket { get; set; } = string.Empty;
    public string AccessKeyId { get; set; } = string.Empty;
    public string SecretAccessKey { get; set; } = string.Empty;
    public bool UsePathStyle { get; set; } = true;
    public int PresignedUrlExpirySeconds { get; set; } = 3600;
    public string PublicBaseUrl { get; set; } = string.Empty;
}

public sealed class GitHubReleaseMediaStorageOptions
{
    public string Owner { get; set; } = string.Empty;
    public string Repository { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string ReleaseTagPrefix { get; set; } = "media-assets";
    public string ReleaseNamePrefix { get; set; } = "Media Assets";
    public int MaxAssetsPerRelease { get; set; } = 950;
    public int MaxReleaseShards { get; set; } = 100;
    public bool Draft { get; set; }
    public bool Prerelease { get; set; }
}
