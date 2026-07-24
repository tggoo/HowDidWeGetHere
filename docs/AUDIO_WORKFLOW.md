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
