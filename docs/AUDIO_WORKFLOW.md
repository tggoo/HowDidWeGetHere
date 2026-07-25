# Audio workflow

## Generate narration files

The project can generate narration text files from the workbook and optionally call the sibling TTS project.

```powershell
python tools/generate-entry-audio.py --lang en
python tools/generate-entry-audio.py --lang en --generate
```

Generated files are written under `generated/audio/<entry-slug>/<language>/`:

- `narration.txt` contains the generated narration text
- `narration.mp3` contains the generated narration audio when `--generate` is used
- `generated/audio/entry-audio-<lang>.zip` is ready for admin bulk upload

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

## Generate translation field audio

Use this workflow for multiple audio tracks generated from `entries.json` translations. It creates four field tracks per language:

- `title`
- `summary`
- `description`
- `whyItMatters`

The source values can contain Markdown. Before text is sent to TTS, `tools/markdown_tts.py` parses Markdown and writes plain text into the generated `.txt` files. Do not edit those `.txt` files by hand; edit `entries.json` source fields and regenerate them.

Run the full package audio pipeline from the repository root:

```bash
./run.sh audio generated/packages
```

When the path is omitted, the script uses the current directory. If it is run from the repository root and no package `entries.json` is found there, it falls back to `generated/packages`.

The pipeline:

1. Finds package directories containing `entries.json`.
2. Extracts `title`, `summary`, `description` and `whyItMatters` from Markdown to plaintext `.txt`.
3. Generates matching MP3 files.
4. Copies MP3 files into `audio/<entry-slug>/<language>/<field>.mp3` inside each package.
5. Updates package `entries.json` audio references and transcripts.
6. Regenerates package ZIP files.

Optional filters are passed through to the Python generator:

```bash
./run.sh audio generated/packages --lang en --slug edict-of-milan
```

```powershell
python tools/generate-translation-audio.py --package master-timeline --slug edict-of-milan --lang en --lang cs
python tools/generate-translation-audio.py --package master-timeline --slug edict-of-milan --lang en --lang cs --generate
```

Generated files use a slug-first structure:

```text
generated/audio/<entry-slug>/<language>/title.txt
generated/audio/<entry-slug>/<language>/title.mp3
generated/audio/<entry-slug>/<language>/summary.txt
generated/audio/<entry-slug>/<language>/summary.mp3
generated/audio/<entry-slug>/<language>/description.txt
generated/audio/<entry-slug>/<language>/description.mp3
generated/audio/<entry-slug>/<language>/whyItMatters.txt
generated/audio/<entry-slug>/<language>/whyItMatters.mp3
```

Inside content packages, the paths mirror the same structure under the package audio folder:

```text
audio/<entry-slug>/<language>/title.mp3
audio/<entry-slug>/<language>/summary.mp3
audio/<entry-slug>/<language>/description.mp3
audio/<entry-slug>/<language>/whyItMatters.mp3
```

The script updates the package `entries.json` and rebuilds the package ZIP when matching MP3 files exist.

To regenerate only the plain text inputs for all generated packages without creating MP3 files or touching package JSON references:

```powershell
cd web
npm run generate:tts
```

## Preferred content package workflow

The preferred import path is now a single content package ZIP. It contains entries plus media, so admins do not need to upload workbook rows, audio and images separately.

Generate packages from the current workbook and generated media:

```powershell
python tools/build-content-packages.py
```

Generated package files:

- `generated/packages/master-timeline-part-001.zip`, `master-timeline-part-002.zip`, ...
- `generated/packages/mythology-part-001.zip`, `mythology-part-002.zip`, ...

The package ZIP writer keeps each ZIP at or below 20 MiB by default. If a package is small enough to fit into one ZIP, it keeps the unsuffixed name such as `master-timeline.zip`.

Each package has this structure:

```text
entries.json
audio/<entry-slug>/<language>/title.mp3
audio/<entry-slug>/<language>/summary.mp3
audio/<entry-slug>/<language>/description.mp3
images/<entry-slug>.<ext>
```

`entries.json` stores normalized entries, tags, time periods, sources, approximate places and references to media paths inside the same ZIP.

Admin import order:

1. Open `Admin -> Import`.
2. Select a generated content package ZIP part.
3. Run `Preview package`.
4. If counts look correct, run `Import package`.
5. Repeat for each part of the same package.

The package import is idempotent. It updates existing entries by `sourceSheet/sourceRow` first, then by `slug`. Audio tracks are matched by language, kind and sort order; when a package provides a primary `Description` track for a language, stale audio tracks for that same language are removed. Existing primary images are replaced on re-import.
