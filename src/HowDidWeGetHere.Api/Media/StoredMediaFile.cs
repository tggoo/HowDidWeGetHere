using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Api.Media;

public sealed record StoredMediaFile(
    StorageProvider StorageProvider,
    string StorageKey,
    string PublicUrl,
    string MediaType,
    long ContentLength,
    string ContentHash);
