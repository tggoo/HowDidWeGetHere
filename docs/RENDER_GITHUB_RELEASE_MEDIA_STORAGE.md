# Render GitHub Release Media Storage

Use this storage mode when media files are public and the application must avoid usage-based object-storage billing.

The API uploads imported and admin-uploaded media as GitHub Release assets. Postgres stores only metadata:

```text
StorageProvider
StorageKey
ContentHash
ContentLength
ContentType
ExternalId
ExternalUrl
ExternalETag
```

Imports compute a SHA-256 hash first. If a matching `StorageProvider + ContentHash + ContentLength` row already exists, the import reuses it and does not upload the binary again.

## GitHub Token

Create a fine-grained personal access token for the repository that will hold the release assets.

Required repository permission:

```text
Contents: Read and write
```

The repository should be public if frontend users need to play audio and load images without GitHub authentication.

## Render Environment Variables

Set these on the Render API service:

```text
Media__StorageMode=GitHubRelease
Media__PublicBaseUrl=https://howdidwegethere-api.onrender.com
Media__StoreLocalCopiesInDatabase=false
Media__GitHub__Owner=<github-owner-or-org>
Media__GitHub__Repository=<repo-name>
Media__GitHub__Token=<fine-grained-token>
Media__GitHub__ReleaseTagPrefix=media-assets
Media__GitHub__ReleaseNamePrefix=Media Assets
Media__GitHub__MaxAssetsPerRelease=950
Media__GitHub__MaxReleaseShards=100
Media__GitHub__Draft=false
Media__GitHub__Prerelease=false
```

With these defaults, the app writes assets into releases named:

```text
media-assets-001
media-assets-002
...
```

It starts a new release shard once the current release has `MaxAssetsPerRelease` assets.

## Serving Media

The public API still returns stable app URLs such as:

```text
https://howdidwegethere-api.onrender.com/media/sha256/ab/<hash>.mp3
```

The backend looks up that storage key in `media_blobs` and redirects GitHub-backed media requests to the asset `browser_download_url`.

## Recovering a Full Render Postgres Database

If imports fail with PostgreSQL error `XX000: could not write init file`, the database server cannot write its own internal cache files. On Render this usually means the database disk or quota is exhausted.

Immediate recovery options:

```sql
select pg_size_pretty(pg_database_size(current_database())) as database_size;
select count(*) as media_rows, pg_size_pretty(coalesce(sum(octet_length("Content")), 0)) as media_content_size
from media_blobs;
```

If media is already stored externally and `ExternalUrl` is populated, remove only the local database copies:

```sql
update media_blobs
set "Content" = null
where "ExternalUrl" is not null
  and "Content" is not null;
vacuum full media_blobs;
```

If the database still cannot accept connections, restore from a backup, upgrade the database storage, or clear data from the Render database console before retrying the import.
