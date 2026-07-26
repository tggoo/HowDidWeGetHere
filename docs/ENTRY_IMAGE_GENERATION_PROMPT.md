# Entry Image Generation Prompt

Use this prompt in a new Codex/image-generation thread when generating missing entry images for the generated content packages.

```text
You are working in the HowDidWeGetHere repository. Generate missing images for entries in:

- generated/packages/master-timeline/entries.json
- generated/packages/mythology/entries.json

Goal:
Create one primary image for every slug that does not already have an image. Use the English entry text as the source of truth, especially translations.en.description. Also use translations.en.title, translations.en.summary, translations.en.whyItMatters, dateLabel, timeConfidence, tags, places, sources, and raw fields when the description is short or missing. Do not invent precise factual claims that are not supported by those fields.

How to detect missing images:
1. Load both package entries.json files.
2. An entry needs an image if its images array is missing/empty, or if the referenced image path does not exist in the package.
3. Also check generated/images/<slug>.* with supported extensions .jpg, .jpeg, .png, .webp, .gif, .avif. If a valid slug-named image already exists there, treat the slug as already covered unless the user asks to replace it.
4. Save newly generated source images as generated/images/<slug>.png or generated/images/<slug>.jpg. The package builder uses slug-named files from generated/images and copies them into package images folders.

Style reference:
Use the existing edict-of-milan image as visual inspiration if it exists locally, for example generated/images/edict-of-milan.* or another slug-named package image. Match its spirit, not every detail: educational, memorable, clear, lightly funny, and visually approachable.

Visual tone:
- Make the topic feel fun and memorable for learners.
- Use gentle humor through staging, facial expressions, tiny anachronistic props, visual metaphors, or small background jokes.
- Keep the humor respectful. For wars, disasters, pandemics, persecution, death, religion, and living/recent political subjects, avoid ridicule, gore, propaganda, or jokes about suffering. In those cases, use a warm, clever, non-cruel visual metaphor instead.
- The image should still teach the entry. It must be recognizable, not a generic fantasy/history placeholder.

Language and text rules:
- The images must work independently of the UI language.
- Avoid paragraphs, captions, speech bubbles, labels, and translated UI-language text.
- Use little or no text. If text is useful, keep it short.
- Allowed text: original proper names, names of people, places, documents, objects, myths, scientific concepts, and short canonical terms from the source fields.
- Do not translate names. Copy names exactly from the source fields or use their canonical original form when present, for example Julius Caesar, Karel IV., Schrodinger/Schrödinger, Thor, Kitsune.
- Numbers, dates, equations, and compact symbols are allowed when they help memory.
- Document-heavy entries may include a few visible words or seals if that is central to the entry, similar to Edict of Milan. Avoid long body text.

Symbol rule:
Only use symbols, emblems, animals, artifacts, equations, colors, or visual shorthand that are explained by the entry's visible text fields, or that are common enough and directly named in those fields. If you decide to use a useful symbol that is not explained in the current English entry text, still generate the image, but include a report line in this exact Czech format:

<slug>: je třeba do textu doplnit význam symbolů <A>, <B> a <C>.

Example:
thor: je třeba do textu doplnit význam symbolů Mjolnir a goats.

Image composition:
- Prefer a single strong scene or visual metaphor over a collage.
- Landscape 16:9 composition, suitable for app cards and detail pages.
- Clear subject in the first read, with secondary details rewarding closer inspection.
- Bright, balanced colors; not a one-color wash.
- No dark blurred stock-photo look.
- No copyrighted franchise style, no living-artist imitation, no watermarks.
- Avoid photorealistic fake archival photos unless the entry specifically calls for a modern documentary look. Prefer polished educational illustration.

Per-entry generation workflow:
1. For each missing slug, read the English title and description first.
2. Identify 2-4 core facts or motifs that can be shown visually.
3. Decide whether text is necessary. Default to no text; allow names/dates only when they improve recognition.
4. Write a concise image-generation prompt for that slug.
5. Generate the image.
6. Save the file as generated/images/<slug>.<ext>.
7. Record any symbol-text gaps using the Czech report line above.

After image generation:
- Do not translate image text for different languages.
- If package files need to be refreshed, use the repository's existing content package workflow instead of hand-inventing a new schema. The current command is `python tools/build-content-packages.py` from the repository root; inspect the diff because it rewrites generated package directories and ZIPs from the workbook plus generated media.
- Summarize generated files, skipped slugs, and symbol-text gaps.
```
