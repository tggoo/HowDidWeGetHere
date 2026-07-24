using HowDidWeGetHere.Domain.Common;

namespace HowDidWeGetHere.Domain.Media;

public sealed class MediaBlob : AuditableEntity
{
    public string StorageKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public byte[] Content { get; set; } = [];
    public long ContentLength { get; set; }
    public string ContentHash { get; set; } = string.Empty;
}
