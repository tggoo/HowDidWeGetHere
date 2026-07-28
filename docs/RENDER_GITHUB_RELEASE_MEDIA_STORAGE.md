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
