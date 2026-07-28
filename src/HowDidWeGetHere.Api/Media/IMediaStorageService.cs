using HowDidWeGetHere.Domain.Media;

namespace HowDidWeGetHere.Api.Media;

public interface IMediaStorageService
{
    Task<StoredMediaFile> StoreAsync(
        Stream sourceStream,
        string fileName,
        string? contentType,
        string mediaFolder,
        HttpRequest httpRequest,
        CancellationToken cancellationToken);

    Uri? CreateReadUri(MediaBlob mediaBlob);
}
