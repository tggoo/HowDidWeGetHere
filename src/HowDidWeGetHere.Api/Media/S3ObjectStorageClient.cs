using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace HowDidWeGetHere.Api.Media;

public sealed class S3ObjectStorageClient(
    IHttpClientFactory httpClientFactory,
    IOptions<MediaStorageOptions> options,
    ILogger<S3ObjectStorageClient> logger)
{
    private const string Algorithm = "AWS4-HMAC-SHA256";
    private const string Service = "s3";

    public async Task<string?> PutObjectAsync(
        string storageKey,
        string filePath,
        string contentType,
        string payloadHash,
        long contentLength,
        CancellationToken cancellationToken)
    {
        var s3 = ResolveOptions();
        var uri = BuildObjectUri(s3, storageKey);
        var timestamp = DateTimeOffset.UtcNow;
        var amzDate = timestamp.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
        var dateStamp = timestamp.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        var host = BuildHostHeader(uri);
        var authorization = BuildAuthorizationHeader(
            HttpMethod.Put.Method,
            uri,
            host,
            s3,
            amzDate,
            dateStamp,
            payloadHash);

        await using var fileStream = File.OpenRead(filePath);
        using var request = new HttpRequestMessage(HttpMethod.Put, uri);
        request.Headers.Host = host;
        request.Headers.TryAddWithoutValidation("x-amz-content-sha256", payloadHash);
        request.Headers.TryAddWithoutValidation("x-amz-date", amzDate);
        request.Headers.Authorization = AuthenticationHeaderValue.Parse(authorization);
        request.Content = new StreamContent(fileStream);
        request.Content.Headers.ContentLength = contentLength;
        request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);

        using var response = await httpClientFactory.CreateClient().SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogWarning(
                "S3 object upload failed. StatusCode={StatusCode} StorageKey={StorageKey} Response={Response}",
                response.StatusCode,
                storageKey,
                error);
        }

        response.EnsureSuccessStatusCode();
        return response.Headers.ETag?.Tag;
    }

    public Uri CreatePresignedGetUri(string storageKey)
    {
        var s3 = ResolveOptions();
        if (!string.IsNullOrWhiteSpace(s3.PublicBaseUrl))
        {
            return new Uri($"{s3.PublicBaseUrl.TrimEnd('/')}/{EncodePath(storageKey)}");
        }

        var uri = BuildObjectUri(s3, storageKey);
        var timestamp = DateTimeOffset.UtcNow;
        var amzDate = timestamp.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
        var dateStamp = timestamp.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        var host = BuildHostHeader(uri);
        var scope = BuildScope(s3, dateStamp);
        var expires = Math.Clamp(s3.PresignedUrlExpirySeconds, 60, 604800);
        var queryParameters = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["X-Amz-Algorithm"] = Algorithm,
            ["X-Amz-Credential"] = $"{s3.AccessKeyId}/{scope}",
            ["X-Amz-Date"] = amzDate,
            ["X-Amz-Expires"] = expires.ToString(CultureInfo.InvariantCulture),
            ["X-Amz-SignedHeaders"] = "host"
        };
        var canonicalQuery = BuildCanonicalQueryString(queryParameters);
        var canonicalRequest = string.Join('\n', [
            HttpMethod.Get.Method,
            uri.AbsolutePath,
            canonicalQuery,
            $"host:{host}",
            string.Empty,
            "host",
            "UNSIGNED-PAYLOAD"
        ]);
        var stringToSign = string.Join('\n', [
            Algorithm,
            amzDate,
            scope,
            Sha256Hex(canonicalRequest)
        ]);
        var signature = ToHexString(ComputeSignature(s3, dateStamp, stringToSign));
        var separator = string.IsNullOrWhiteSpace(uri.Query) ? "?" : "&";
        return new Uri($"{uri}{separator}{canonicalQuery}&X-Amz-Signature={signature}");
    }

    private string BuildAuthorizationHeader(
        string method,
        Uri uri,
        string host,
        S3MediaStorageOptions s3,
        string amzDate,
        string dateStamp,
        string payloadHash)
    {
        var scope = BuildScope(s3, dateStamp);
        const string signedHeaders = "host;x-amz-content-sha256;x-amz-date";
        var canonicalRequest = string.Join('\n', [
            method,
            uri.AbsolutePath,
            string.Empty,
            $"host:{host}\nx-amz-content-sha256:{payloadHash}\nx-amz-date:{amzDate}",
            string.Empty,
            signedHeaders,
            payloadHash
        ]);
        var stringToSign = string.Join('\n', [
            Algorithm,
            amzDate,
            scope,
            Sha256Hex(canonicalRequest)
        ]);
        var signature = ToHexString(ComputeSignature(s3, dateStamp, stringToSign));

        return $"{Algorithm} Credential={s3.AccessKeyId}/{scope}, SignedHeaders={signedHeaders}, Signature={signature}";
    }

    private S3MediaStorageOptions ResolveOptions()
    {
        var s3 = options.Value.S3;
        if (string.IsNullOrWhiteSpace(s3.Endpoint) ||
            string.IsNullOrWhiteSpace(s3.Bucket) ||
            string.IsNullOrWhiteSpace(s3.AccessKeyId) ||
            string.IsNullOrWhiteSpace(s3.SecretAccessKey))
        {
            throw new InvalidOperationException(
                "Media S3 storage is enabled but Media:S3:Endpoint, Bucket, AccessKeyId, and SecretAccessKey are not fully configured.");
        }

        if (string.IsNullOrWhiteSpace(s3.Region))
        {
            s3.Region = "auto";
        }

        return s3;
    }

    private static Uri BuildObjectUri(S3MediaStorageOptions s3, string storageKey)
    {
        var endpoint = new Uri(s3.Endpoint.TrimEnd('/') + "/");
        var port = endpoint.IsDefaultPort ? string.Empty : $":{endpoint.Port}";
        var encodedKey = EncodePath(storageKey);

        if (!s3.UsePathStyle)
        {
            return new Uri($"{endpoint.Scheme}://{s3.Bucket}.{endpoint.Host}{port}/{encodedKey}");
        }

        return new Uri($"{endpoint.Scheme}://{endpoint.Host}{port}/{AwsEncode(s3.Bucket)}/{encodedKey}");
    }

    private static string BuildHostHeader(Uri uri) =>
        uri.IsDefaultPort ? uri.Host : $"{uri.Host}:{uri.Port}";

    private static string BuildScope(S3MediaStorageOptions s3, string dateStamp) =>
        $"{dateStamp}/{s3.Region}/{Service}/aws4_request";

    private static string BuildCanonicalQueryString(SortedDictionary<string, string> queryParameters) =>
        string.Join("&", queryParameters.Select(parameter =>
            $"{AwsEncode(parameter.Key)}={AwsEncode(parameter.Value)}"));

    private static byte[] ComputeSignature(S3MediaStorageOptions s3, string dateStamp, string stringToSign)
    {
        var dateKey = HmacSha256(Encoding.UTF8.GetBytes("AWS4" + s3.SecretAccessKey), dateStamp);
        var dateRegionKey = HmacSha256(dateKey, s3.Region);
        var dateRegionServiceKey = HmacSha256(dateRegionKey, Service);
        var signingKey = HmacSha256(dateRegionServiceKey, "aws4_request");
        return HmacSha256(signingKey, stringToSign);
    }

    private static byte[] HmacSha256(byte[] key, string value)
    {
        using var hmac = new HMACSHA256(key);
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(value));
    }

    private static string Sha256Hex(string value) =>
        ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static string ToHexString(byte[] bytes) =>
        Convert.ToHexString(bytes).ToLowerInvariant();

    private static string EncodePath(string value) =>
        string.Join('/', value.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(AwsEncode));

    private static string AwsEncode(string value) =>
        Uri.EscapeDataString(value)
            .Replace("+", "%20", StringComparison.Ordinal)
            .Replace("*", "%2A", StringComparison.Ordinal)
            .Replace("%7E", "~", StringComparison.Ordinal);
}
