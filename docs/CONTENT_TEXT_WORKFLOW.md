# Content text workflow

## Source fields

The source of truth for entry body text is the Markdown stored in `entries.json` translation fields:

- `translations.<lang>.summary`
- `translations.<lang>.description`
- `translations.<lang>.whyItMatters`

`translations.<lang>.title` is also processed for speech, but it is normally plain text.

Backend import and API responses keep these values as source text. The frontend renders them as safe Markdown.

## Supported Markdown

The web app supports the formatting needed by current entry content:

- paragraphs
- bold and italic text
- links
- unordered and ordered lists
- small headings
- blockquotes
- inline code

Raw HTML is not inserted into the page. The React renderer in `web/src/content/MarkdownText.tsx` renders Markdown tokens as React elements and sanitizes links before they reach the DOM.

## TTS text

TTS text is derived from the Markdown source. Do not edit generated TTS `.txt` files manually.

The conversion function is `markdown_to_tts` in `tools/markdown_tts.py`. It parses Markdown with `markdown-it-py`, removes formatting, keeps readable link labels, omits images by default, strips HTML tags, decodes HTML entities and then applies locale-specific speech cleanup from `tools/text_sanitizer.py`.

Install or refresh tool dependencies before running the generator in a new Python environment:

```powershell
python -m pip install -r tools/requirements.txt
```

Generated text files use this layout:

```text
generated/audio/<entry-slug>/<language>/title.txt
generated/audio/<entry-slug>/<language>/summary.txt
generated/audio/<entry-slug>/<language>/description.txt
generated/audio/<entry-slug>/<language>/whyItMatters.txt
```

Regenerate all plain TTS inputs from the web package scripts:

```powershell
cd web
npm run generate:tts
```

Generate MP3 files only when the plain text has been reviewed:

```powershell
python tools/generate-translation-audio.py --lang en --lang cs --generate
```

Run the full package audio pipeline after review:

```bash
./run.sh audio generated/packages
```

This extracts Markdown to plaintext, generates MP3 files, copies them into the package `audio/<entry-slug>/<language>/` layout, updates package `entries.json` audio references and regenerates the package ZIP files.

## Tests

Python tests cover Markdown-to-TTS conversion and idempotent text generation:

```powershell
python -m unittest discover -s tools/tests
```

Frontend helper tests cover safe link handling and HTML text extraction:

```powershell
cd web
npm test
```
