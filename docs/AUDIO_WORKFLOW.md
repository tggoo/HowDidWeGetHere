# Audio workflow

## Generate narration files

The project can generate narration text files from the workbook and optionally call the sibling TTS project.

```powershell
python tools/generate-entry-audio.py --lang en
python tools/generate-entry-audio.py --lang en --generate
```

Generated files are written under `generated/audio/<lang>/`:

- `texts/` contains `<entry-slug>.<lang>.txt`
- `mp3/` contains `<entry-slug>.<lang>.mp3`
- `entry-audio-<lang>.zip` is ready for admin bulk upload

The script expects the TTS project at `C:\Users\danie\Documents\Repos\TTS` by default. Override it when needed:

```powershell
python tools/generate-entry-audio.py --lang cs --tts-root C:\Users\danie\Documents\Repos\TTS --generate
```

## Bulk upload

In the admin UI open `Media`, choose `Bulk audio ZIP`, select the language, and run `Preview audio ZIP` first.
If the preview shows the expected matched entries and no unexpected missing slugs, upload the generated zip.

The backend matches audio files by entry slug. Supported names:

- `entry-slug.mp3`
- `entry-slug.en.mp3`
- `entry-slug.cs.mp3`
- `entry-slug.es.mp3`

When an entry already has a primary audio track for that language, bulk upload replaces it. Otherwise it creates a new primary narration track.

## Preferred content package workflow

The preferred import path is now a single content package ZIP. It contains entries plus media, so admins do not need to upload workbook rows, audio and images separately.

Generate packages from the current workbook and generated media:

```powershell
python tools/build-content-packages.py
```

Generated package files:

- `generated/packages/master-timeline.zip`
- `generated/packages/mythology.zip`

Each package has this structure:

```text
entries.json
audio/en/<entry-slug>.mp3
audio/cs/<entry-slug>.mp3
audio/es/<entry-slug>.mp3
images/<entry-slug>.<ext>
```

`entries.json` stores normalized entries, tags, time periods, sources, approximate places and references to media paths inside the same ZIP.

Admin import order:

1. Open `Admin -> Import`.
2. Select a generated content package ZIP.
3. Run `Preview package`.
4. If counts look correct, run `Import package`.

The package import is idempotent. It updates existing entries by `sourceSheet/sourceRow` first, then by `slug`. Existing primary audio for the same language and existing primary images are replaced on re-import.
