using HowDidWeGetHere.Domain.Common;
using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Domain.Media;

public sealed class MediaBlob : AuditableEntity
{
    public StorageProvider StorageProvider { get; set; } = StorageProvider.Local;
    public string StorageKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public byte[]? Content { get; set; }
    public long ContentLength { get; set; }
    public string ContentHash { get; set; } = string.Empty;
    public string? ExternalId { get; set; }
    public string? ExternalUrl { get; set; }
    public string? ExternalETag { get; set; }
}
