"""Generate field-level TTS plaintext and MP3 files from Markdown entry translations."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from content_package_zip import DEFAULT_MAX_ZIP_MIB, write_package_zips
from markdown_tts import markdown_to_tts


ROOT = Path(__file__).resolve().parents[1]

DEFAULT_PACKAGE_PATHS = (
    ROOT / "generated/packages/master-timeline/entries.json",
    ROOT / "generated/packages/mythology/entries.json",
)

TRACKS = {
    "title": {
        "kind": "Title",
        "sortOrder": 10,
        "isPrimary": False,
    },
    "summary": {
        "kind": "Summary",
        "sortOrder": 20,
        "isPrimary": False,
    },
    "description": {
        "kind": "Description",
        "sortOrder": 0,
        "isPrimary": True,
    },
    "whyItMatters": {
        "kind": "WhyItMatters",
        "sortOrder": 30,
        "isPrimary": False,
    },
}

WORLD_DIVISION_TRACKS = {
    "title": {
        "kind": "Title",
        "sortOrder": 10,
        "isPrimary": False,
    },
    "summary": {
        "kind": "Summary",
        "sortOrder": 0,
        "isPrimary": True,
    },
    "facts": {
        "kind": "WhyItMatters",
        "sortOrder": 20,
        "isPrimary": False,
    },
    "mapNote": {
        "kind": "Description",
        "sortOrder": 30,
        "isPrimary": False,
    },
}

DEFAULT_TRACKS = ("title", "summary", "description", "whyItMatters", "facts", "mapNote")
GENERATED_KINDS = {
    "Narration",
    *(track["kind"] for track in TRACKS.values()),
    *(track["kind"] for track in WORLD_DIVISION_TRACKS.values()),
}
SUPPORTED_LANGUAGES = {"cs", "en"}


@dataclass(frozen=True)
class SelectedEntry:
    package_path: Path
    document: dict[str, Any]
    entry: dict[str, Any]
    languages: tuple[str, ...]


@dataclass(frozen=True)
class SelectedWorldDivision:
    package_path: Path
    document: dict[str, Any]
    division: dict[str, Any]
    languages: tuple[str, ...]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate field-based TTS text and optional mp3 files from entry translations."
    )
    parser.add_argument("--tts-root", default=r"C:\Users\danie\Documents\Repos\TTS")
    parser.add_argument("--out", default="generated/audio")
    parser.add_argument(
        "--entries-json",
        action="append",
        type=Path,
        help="Use one or more entries.json files instead of the generated package defaults.",
    )
    parser.add_argument(
        "--packages-root",
        type=Path,
        help="Find entries.json files in this directory or its direct package subdirectories.",
    )
    parser.add_argument("--package", action="append", choices=("master-timeline", "mythology"))
    parser.add_argument("--slug", action="append", help="Limit generation to one or more entry slugs.")
    parser.add_argument("--world-division", action="append", help="Limit generation to one or more world division ids.")
    parser.add_argument("--lang", action="append", help="Limit generation to one or more languages, e.g. en or cs.")
    parser.add_argument(
        "--track",
        action="append",
        choices=tuple(dict.fromkeys((*TRACKS, *WORLD_DIVISION_TRACKS))),
        help="Limit to selected tracks.",
    )
    parser.add_argument("--limit", type=int, default=0, help="Limit the number of selected entries.")
    parser.add_argument("--generate", action="store_true", help="Call the TTS project and create mp3 files.")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--no-package-update", action="store_true")
    parser.add_argument("--max-package-zip-mib", type=float, default=DEFAULT_MAX_ZIP_MIB)
    parser.add_argument(
        "--clean-package-audio",
        action="store_true",
        help="Remove generated package audio before copying current field tracks.",
    )
    args = parser.parse_args()

    package_filter = set(args.package or [])
    slug_filter = set(args.slug or [])
    world_division_filter = set(args.world_division or [])
    lang_filter = {lang.lower() for lang in (args.lang or [])}
    selected_tracks = tuple(args.track or DEFAULT_TRACKS)
    selected_entry_tracks = tracks_for_kind(selected_tracks, TRACKS)
    selected_world_division_tracks = tracks_for_kind(selected_tracks, WORLD_DIVISION_TRACKS)
    out_root = resolve_repo_path(args.out)
    tts_root = Path(args.tts_root)
    package_paths = resolve_package_paths(args.entries_json, args.packages_root)

    packages = read_packages(package_paths, package_filter)
    selected_entries = list(select_entries(packages, slug_filter, lang_filter))
    selected_world_divisions = list(select_world_divisions(packages, world_division_filter, lang_filter))
    if args.limit > 0:
        selected_entries = selected_entries[: args.limit]
        selected_world_divisions = selected_world_divisions[: args.limit]

    if not selected_entries and not selected_world_divisions:
        print("No matching entries or world divisions found.", flush=True)
        return

    print(
        f"Found {len(packages)} package(s), {len(selected_entries)} entry/entries, "
        f"{len(selected_world_divisions)} world division(s), "
        f"{len(selected_tracks)} track(s): {', '.join(selected_tracks)}.",
        flush=True,
    )

    text_count = extract_plaintext(selected_entries, selected_entry_tracks, out_root)
    text_count += extract_world_division_plaintext(
        selected_world_divisions,
        selected_world_division_tracks,
        out_root,
    )

    if args.generate:
        selected_item_count = len(selected_entries) + len(selected_world_divisions)
        print(f"Plaintext extraction complete {selected_item_count}/{selected_item_count}. Continuing with TTS.", flush=True)
        mp3_count = generate_audio(selected_entries, selected_entry_tracks, out_root, tts_root, args.overwrite)
        mp3_count += generate_world_division_audio(
            selected_world_divisions,
            selected_world_division_tracks,
            out_root,
            tts_root,
            args.overwrite,
        )
    else:
        mp3_count = count_existing_mp3(selected_entries, selected_entry_tracks, out_root)
        mp3_count += count_existing_world_division_mp3(
            selected_world_divisions,
            selected_world_division_tracks,
            out_root,
        )
        print("TTS generation skipped because --generate was not provided.", flush=True)

    package_track_count = 0
    if args.no_package_update:
        print("Package JSON update skipped because --no-package-update was provided.", flush=True)
    else:
        package_track_count = update_packages(
            packages,
            selected_entries,
            selected_entry_tracks,
            selected_world_divisions,
            selected_world_division_tracks,
            out_root,
            clean_package_audio=args.clean_package_audio,
            max_zip_bytes=int(args.max_package_zip_mib * 1024 * 1024),
        )

    print(f"Wrote {text_count} plaintext TTS file(s).", flush=True)
    if args.generate:
        print(f"Generated/found {mp3_count} mp3 file(s).", flush=True)
    if not args.no_package_update:
        print(f"Updated {package_track_count} package audio track reference(s).", flush=True)


def resolve_repo_path(path: str | Path) -> Path:
    resolved = Path(path)
    return resolved if resolved.is_absolute() else ROOT / resolved


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    chars: list[str] = []
    for char in normalized:
        if unicodedata.category(char) == "Mn":
            continue
        chars.append(char.lower() if char.isalnum() else "-")
    return re.sub("-+", "-", "".join(chars)).strip("-") or "world-division"


def resolve_package_paths(entries_json: list[Path] | None, packages_root: Path | None) -> tuple[Path, ...]:
    paths: list[Path] = []
    if entries_json:
        paths.extend(resolve_repo_path(path) for path in entries_json)
    if packages_root is not None:
        paths.extend(discover_entries_json(resolve_repo_path(packages_root)))
    if not paths:
        paths.extend(DEFAULT_PACKAGE_PATHS)

    unique_paths = sorted({path.resolve() for path in paths})
    missing = [path for path in unique_paths if not path.exists()]
    if missing:
        formatted = "\n".join(f"- {path}" for path in missing)
        raise SystemExit(f"Missing entries.json file(s):\n{formatted}")
    return tuple(unique_paths)


def discover_entries_json(root: Path) -> tuple[Path, ...]:
    if root.is_file():
        if root.name != "entries.json":
            raise SystemExit(f"Expected an entries.json file, got: {root}")
        return (root,)

    candidates: list[Path] = []
    direct = root / "entries.json"
    if direct.exists():
        candidates.append(direct)
    candidates.extend(path for path in root.glob("*/entries.json") if path.is_file())

    unique_candidates = tuple(sorted({path.resolve() for path in candidates}))
    if not unique_candidates:
        raise SystemExit(f"No entries.json files found in {root} or its direct subdirectories.")
    return unique_candidates


def read_packages(package_paths: tuple[Path, ...], package_filter: set[str]) -> list[tuple[Path, dict[str, Any]]]:
    packages = []
    for path in package_paths:
        document = json.loads(path.read_text(encoding="utf-8"))
        if package_filter and document["packageSlug"] not in package_filter:
            continue
        packages.append((path, document))
    return packages


def tracks_for_kind(selected_tracks: tuple[str, ...], track_definitions: dict[str, dict[str, Any]]) -> tuple[str, ...]:
    return tuple(track for track in selected_tracks if track in track_definitions)


def select_entries(
    packages: list[tuple[Path, dict[str, Any]]],
    slug_filter: set[str],
    lang_filter: set[str],
) -> list[SelectedEntry]:
    selected = []
    for package_path, document in packages:
        for entry in document.get("entries", []):
            if slug_filter and entry["slug"] not in slug_filter:
                continue
            languages = tuple(
                language
                for language, translation in entry.get("translations", {}).items()
                if isinstance(translation, dict) and (not lang_filter or language.lower() in lang_filter)
            )
            if languages:
                selected.append(SelectedEntry(package_path, document, entry, languages))
    return selected


def select_world_divisions(
    packages: list[tuple[Path, dict[str, Any]]],
    division_filter: set[str],
    lang_filter: set[str],
) -> list[SelectedWorldDivision]:
    selected = []
    normalized_filter = {slugify(value) for value in division_filter}
    for package_path, document in packages:
        for division in document.get("worldDivisions", []):
            if not isinstance(division, dict):
                continue
            division_id = world_division_id(division)
            if normalized_filter and division_id not in normalized_filter:
                continue
            languages = tuple(
                language
                for language in available_world_division_languages(document, division)
                if not lang_filter or language.lower() in lang_filter
            )
            if languages:
                selected.append(SelectedWorldDivision(package_path, document, division, languages))
    return selected


def available_world_division_languages(document: dict[str, Any], division: dict[str, Any]) -> tuple[str, ...]:
    languages: set[str] = set()
    translations = division.get("translations")
    if isinstance(translations, dict):
        languages.update(
            normalize_language(language)
            for language, translation in translations.items()
            if isinstance(translation, dict)
        )

    for track_key in WORLD_DIVISION_TRACKS:
        value = division.get(track_key)
        if isinstance(value, dict):
            languages.update(normalize_language(language) for language in value if value.get(language))
        elif isinstance(value, (str, list)) and value:
            languages.add(normalize_language(document.get("defaultLanguage") or "en"))

    return tuple(sorted(language for language in languages if language in SUPPORTED_LANGUAGES))


def extract_plaintext(selected_entries: list[SelectedEntry], selected_tracks: tuple[str, ...], out_root: Path) -> int:
    total = len(selected_entries)
    text_count = 0
    if not selected_entries or not selected_tracks:
        return 0
    print("Extracting Markdown source fields to plaintext TTS files.", flush=True)
    for entry_index, selected in enumerate(selected_entries, start=1):
        extracted: dict[str, list[str]] = {}
        for language in selected.languages:
            translation = selected.entry["translations"][language]
            for track_key in selected_tracks:
                try:
                    text = build_track_text(translation, language, track_key)
                except Exception as exc:
                    package_slug = selected.document.get("packageSlug", selected.package_path.parent.name)
                    slug = selected.entry.get("slug", "unknown")
                    raise RuntimeError(f"{package_slug}/{slug} {language} {track_key}: {exc}") from exc

                if not text:
                    continue

                text_path = track_text_path(out_root, selected.entry["slug"], language, track_key)
                text_path.parent.mkdir(parents=True, exist_ok=True)
                text_path.write_text(text, encoding="utf-8")
                extracted.setdefault(language, []).append(track_key)
                text_count += 1

        print(
            f"[text {entry_index}/{total}] {selected.entry['slug']}: {format_lang_tracks(extracted, 'extracted')}",
            flush=True,
        )
    return text_count


def extract_world_division_plaintext(
    selected_divisions: list[SelectedWorldDivision],
    selected_tracks: tuple[str, ...],
    out_root: Path,
) -> int:
    total = len(selected_divisions)
    text_count = 0
    if not selected_divisions or not selected_tracks:
        return 0
    print("Extracting world division fields to plaintext TTS files.", flush=True)
    for division_index, selected in enumerate(selected_divisions, start=1):
        division_id = world_division_id(selected.division)
        extracted: dict[str, list[str]] = {}
        for language in selected.languages:
            for track_key in selected_tracks:
                try:
                    text = build_world_division_track_text(selected.document, selected.division, language, track_key)
                except Exception as exc:
                    package_slug = selected.document.get("packageSlug", selected.package_path.parent.name)
                    raise RuntimeError(f"{package_slug}/{division_id} {language} {track_key}: {exc}") from exc

                if not text:
                    continue

                text_path = world_division_text_path(out_root, division_id, language, track_key)
                text_path.parent.mkdir(parents=True, exist_ok=True)
                text_path.write_text(text, encoding="utf-8")
                extracted.setdefault(language, []).append(track_key)
                text_count += 1

        print(
            f"[world text {division_index}/{total}] {division_id}: {format_lang_tracks(extracted, 'extracted')}",
            flush=True,
        )
    return text_count


def generate_audio(
    selected_entries: list[SelectedEntry],
    selected_tracks: tuple[str, ...],
    out_root: Path,
    tts_root: Path,
    overwrite: bool,
) -> int:
    total = len(selected_entries)
    mp3_count = 0
    if not selected_entries or not selected_tracks:
        return 0
    print("Generating MP3 files from plaintext TTS files.", flush=True)
    for entry_index, selected in enumerate(selected_entries, start=1):
        generated = 0
        reused = 0
        ready = 0
        expected = 0
        for language in selected.languages:
            for track_key in selected_tracks:
                text_path = track_text_path(out_root, selected.entry["slug"], language, track_key)
                if not text_path.exists() or not text_path.read_text(encoding="utf-8").strip():
                    continue

                expected += 1
                mp3_path = track_mp3_path(out_root, selected.entry["slug"], language, track_key)
                should_generate = overwrite or not mp3_path.exists() or mp3_path.stat().st_size == 0
                if should_generate:
                    try:
                        run_tts(tts_root, text_path, mp3_path, language)
                    except Exception as exc:
                        package_slug = selected.document.get("packageSlug", selected.package_path.parent.name)
                        slug = selected.entry.get("slug", "unknown")
                        raise RuntimeError(f"{package_slug}/{slug} {language} {track_key}: TTS failed: {exc}") from exc
                    generated += 1
                else:
                    reused += 1

                if not mp3_path.exists() or mp3_path.stat().st_size == 0:
                    package_slug = selected.document.get("packageSlug", selected.package_path.parent.name)
                    slug = selected.entry.get("slug", "unknown")
                    raise RuntimeError(f"{package_slug}/{slug} {language} {track_key}: TTS output is missing or empty")

                ready += 1
                mp3_count += 1

        print(
            f"[tts {entry_index}/{total}] {selected.entry['slug']}: ready {ready}/{expected} track(s) "
            f"({generated} generated, {reused} reused)",
            flush=True,
        )
    return mp3_count


def generate_world_division_audio(
    selected_divisions: list[SelectedWorldDivision],
    selected_tracks: tuple[str, ...],
    out_root: Path,
    tts_root: Path,
    overwrite: bool,
) -> int:
    total = len(selected_divisions)
    mp3_count = 0
    if not selected_divisions or not selected_tracks:
        return 0
    print("Generating world division MP3 files from plaintext TTS files.", flush=True)
    for division_index, selected in enumerate(selected_divisions, start=1):
        division_id = world_division_id(selected.division)
        generated = 0
        reused = 0
        ready = 0
        expected = 0
        for language in selected.languages:
            for track_key in selected_tracks:
                text_path = world_division_text_path(out_root, division_id, language, track_key)
                if not text_path.exists() or not text_path.read_text(encoding="utf-8").strip():
                    continue

                expected += 1
                mp3_path = world_division_mp3_path(out_root, division_id, language, track_key)
                should_generate = overwrite or not mp3_path.exists() or mp3_path.stat().st_size == 0
                if should_generate:
                    try:
                        run_tts(tts_root, text_path, mp3_path, language)
                    except Exception as exc:
                        package_slug = selected.document.get("packageSlug", selected.package_path.parent.name)
                        raise RuntimeError(f"{package_slug}/{division_id} {language} {track_key}: TTS failed: {exc}") from exc
                    generated += 1
                else:
                    reused += 1

                if not mp3_path.exists() or mp3_path.stat().st_size == 0:
                    package_slug = selected.document.get("packageSlug", selected.package_path.parent.name)
                    raise RuntimeError(f"{package_slug}/{division_id} {language} {track_key}: TTS output is missing or empty")

                ready += 1
                mp3_count += 1

        print(
            f"[world tts {division_index}/{total}] {division_id}: ready {ready}/{expected} track(s) "
            f"({generated} generated, {reused} reused)",
            flush=True,
        )
    return mp3_count


def count_existing_mp3(selected_entries: list[SelectedEntry], selected_tracks: tuple[str, ...], out_root: Path) -> int:
    count = 0
    for selected in selected_entries:
        for language in selected.languages:
            for track_key in selected_tracks:
                mp3_path = track_mp3_path(out_root, selected.entry["slug"], language, track_key)
                if mp3_path.exists() and mp3_path.stat().st_size > 0:
                    count += 1
    return count


def count_existing_world_division_mp3(
    selected_divisions: list[SelectedWorldDivision],
    selected_tracks: tuple[str, ...],
    out_root: Path,
) -> int:
    count = 0
    for selected in selected_divisions:
        division_id = world_division_id(selected.division)
        for language in selected.languages:
            for track_key in selected_tracks:
                mp3_path = world_division_mp3_path(out_root, division_id, language, track_key)
                if mp3_path.exists() and mp3_path.stat().st_size > 0:
                    count += 1
    return count


def update_packages(
    packages: list[tuple[Path, dict[str, Any]]],
    selected_entries: list[SelectedEntry],
    selected_tracks: tuple[str, ...],
    selected_world_divisions: list[SelectedWorldDivision],
    selected_world_division_tracks: tuple[str, ...],
    out_root: Path,
    *,
    clean_package_audio: bool,
    max_zip_bytes: int,
) -> int:
    changed_package_paths: set[Path] = set()
    package_track_count = 0
    total = len(selected_entries)
    world_total = len(selected_world_divisions)

    if clean_package_audio:
        clean_package_audio_dirs({
            selected.package_path.parent
            for selected in [*selected_entries, *selected_world_divisions]
        })
        changed_package_paths.update(selected.package_path for selected in selected_entries)
        changed_package_paths.update(selected.package_path for selected in selected_world_divisions)

    if selected_entries and selected_tracks:
        print("Updating entries.json audio references from generated MP3 files.", flush=True)
    for entry_index, selected in enumerate(selected_entries, start=1):
        if clean_package_audio:
            clear_generated_audio_tracks(selected.entry, selected.languages)

        updated_tracks: dict[str, list[str]] = {}
        for language in selected.languages:
            for track_key in selected_tracks:
                mp3_path = track_mp3_path(out_root, selected.entry["slug"], language, track_key)
                if not mp3_path.exists() or mp3_path.stat().st_size == 0:
                    continue

                text_path = track_text_path(out_root, selected.entry["slug"], language, track_key)
                transcript = text_path.read_text(encoding="utf-8").strip() if text_path.exists() else ""
                upsert_package_audio(selected.package_path.parent, selected.entry, language, track_key, transcript, mp3_path)
                changed_package_paths.add(selected.package_path)
                updated_tracks.setdefault(language, []).append(track_key)
                package_track_count += 1

        print(
            f"[json {entry_index}/{total}] {selected.entry['slug']}: {format_lang_tracks(updated_tracks, 'updated')}",
            flush=True,
        )

    if selected_world_divisions and selected_world_division_tracks:
        print("Updating entries.json world division audio references from generated MP3 files.", flush=True)
    for division_index, selected in enumerate(selected_world_divisions, start=1):
        division_id = world_division_id(selected.division)
        if clean_package_audio:
            clear_generated_world_division_audio_tracks(selected.division, selected.languages)

        updated_tracks: dict[str, list[str]] = {}
        for language in selected.languages:
            for track_key in selected_world_division_tracks:
                mp3_path = world_division_mp3_path(out_root, division_id, language, track_key)
                if not mp3_path.exists() or mp3_path.stat().st_size == 0:
                    continue

                text_path = world_division_text_path(out_root, division_id, language, track_key)
                transcript = text_path.read_text(encoding="utf-8").strip() if text_path.exists() else ""
                upsert_world_division_package_audio(
                    selected.package_path.parent,
                    selected.division,
                    language,
                    track_key,
                    transcript,
                    mp3_path,
                )
                changed_package_paths.add(selected.package_path)
                updated_tracks.setdefault(language, []).append(track_key)
                package_track_count += 1

        print(
            f"[world json {division_index}/{world_total}] {division_id}: {format_lang_tracks(updated_tracks, 'updated')}",
            flush=True,
        )

    if changed_package_paths:
        print("Generating package ZIP files.", flush=True)
    for package_path in sorted(changed_package_paths):
        document = next(document for current_path, document in packages if current_path == package_path)
        package_path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        zip_paths = write_package_zips(package_path.parent, max_zip_bytes)
        print(f"Generated {', '.join(path.name for path in zip_paths)}.", flush=True)

    return package_track_count


def build_track_text(translation: dict[str, str], language: str, track_key: str) -> str:
    if track_key not in TRACKS:
        raise ValueError(f"Unsupported track: {track_key}")
    return markdown_to_tts(translation.get(track_key), language)


def build_world_division_track_text(
    document: dict[str, Any],
    division: dict[str, Any],
    language: str,
    track_key: str,
) -> str:
    if track_key not in WORLD_DIVISION_TRACKS:
        raise ValueError(f"Unsupported world division track: {track_key}")

    value = world_division_field_value(document, division, language, track_key)
    if isinstance(value, list):
        return " ".join(
            text
            for text in (markdown_to_tts(str(item), language) for item in value)
            if text
        ).strip()

    return markdown_to_tts(value, language)


def world_division_field_value(
    document: dict[str, Any],
    division: dict[str, Any],
    language: str,
    track_key: str,
) -> Any:
    translations = division.get("translations")
    if isinstance(translations, dict):
        translation = translations.get(language)
        if isinstance(translation, dict) and track_key in translation:
            return translation.get(track_key)

    value = division.get(track_key)
    if isinstance(value, dict):
        return value.get(language) or value.get(document.get("defaultLanguage") or "en") or value.get("en")
    return value


def track_text_path(out_root: Path, slug: str, language: str, track_key: str) -> Path:
    return out_root / slug / language / f"{track_key}.txt"


def track_mp3_path(out_root: Path, slug: str, language: str, track_key: str) -> Path:
    return out_root / slug / language / f"{track_key}.mp3"


def world_division_text_path(out_root: Path, division_id: str, language: str, track_key: str) -> Path:
    return out_root / "world-divisions" / division_id / language / f"{track_key}.txt"


def world_division_mp3_path(out_root: Path, division_id: str, language: str, track_key: str) -> Path:
    return out_root / "world-divisions" / division_id / language / f"{track_key}.mp3"


def run_tts(tts_root: Path, text_path: Path, mp3_path: Path, lang: str) -> None:
    python_path = tts_root / ".venv" / "Scripts" / "python.exe"
    if not python_path.exists():
        python_path = Path(sys.executable)
    script_path = tts_root / "text_to_speech.py"
    subprocess.run(
        [
            str(python_path),
            str(script_path),
            str(text_path),
            "--lang",
            lang,
            "--output",
            str(mp3_path),
        ],
        check=True,
    )


def clean_package_audio_dirs(package_dirs: set[Path]) -> None:
    for package_dir in sorted(package_dirs):
        audio_dir = package_dir / "audio"
        if audio_dir.exists():
            shutil.rmtree(audio_dir)
        audio_dir.mkdir(parents=True, exist_ok=True)
        print(f"Cleaned package audio directory {audio_dir}.", flush=True)


def clear_generated_audio_tracks(entry: dict[str, Any], languages: tuple[str, ...]) -> None:
    selected_languages = {language.lower() for language in languages}
    audio = entry.get("audio")
    if not isinstance(audio, list):
        entry["audio"] = []
        return

    entry["audio"] = [
        track
        for track in audio
        if not is_generated_audio_track(entry["slug"], track, selected_languages)
    ]


def is_generated_audio_track(slug: str, track: Any, selected_languages: set[str]) -> bool:
    if not isinstance(track, dict):
        return True
    language = normalize_language(track.get("languageCode"))
    if language not in selected_languages:
        return False

    kind = str(track.get("kind") or "")
    path = str(track.get("path") or "").replace("\\", "/")
    return kind in GENERATED_KINDS or path.startswith(f"audio/{language}/") or path.startswith(f"audio/{slug}/")


def clear_generated_world_division_audio_tracks(division: dict[str, Any], languages: tuple[str, ...]) -> None:
    selected_languages = {language.lower() for language in languages}
    audio = division.get("audio")
    if not isinstance(audio, list):
        division["audio"] = []
        return

    division_id = world_division_id(division)
    division["audio"] = [
        track
        for track in audio
        if not is_generated_world_division_audio_track(division_id, track, selected_languages)
    ]


def is_generated_world_division_audio_track(division_id: str, track: Any, selected_languages: set[str]) -> bool:
    if not isinstance(track, dict):
        return True
    language = normalize_language(track.get("languageCode"))
    if language not in selected_languages:
        return False

    kind = str(track.get("kind") or "")
    path = str(track.get("path") or "").replace("\\", "/")
    return kind in GENERATED_KINDS or path.startswith(f"audio/world-divisions/{division_id}/")


def upsert_package_audio(
    package_dir: Path,
    entry: dict[str, Any],
    language: str,
    track_key: str,
    transcript: str,
    source_mp3_path: Path,
) -> None:
    track_def = TRACKS[track_key]
    package_audio_path = package_dir / "audio" / entry["slug"] / language / f"{track_key}.mp3"
    package_audio_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_mp3_path, package_audio_path)

    audio = entry.setdefault("audio", [])
    if track_def["isPrimary"]:
        for existing_track in audio:
            if normalize_language(existing_track.get("languageCode")) == language:
                existing_track["isPrimary"] = False

    new_track = {
        "languageCode": language,
        "kind": track_def["kind"],
        "isPrimary": track_def["isPrimary"],
        "sortOrder": track_def["sortOrder"],
        "title": f"{entry['slug']} {track_key} ({language})",
        "transcript": transcript,
        "path": f"audio/{entry['slug']}/{language}/{track_key}.mp3",
    }

    existing_index = next(
        (
            index
            for index, existing_track in enumerate(audio)
            if normalize_language(existing_track.get("languageCode")) == language
            and existing_track.get("kind") == track_def["kind"]
            and existing_track.get("sortOrder") == track_def["sortOrder"]
        ),
        None,
    )
    if existing_index is None:
        audio.append(new_track)
    else:
        audio[existing_index] = new_track


def upsert_world_division_package_audio(
    package_dir: Path,
    division: dict[str, Any],
    language: str,
    track_key: str,
    transcript: str,
    source_mp3_path: Path,
) -> None:
    track_def = WORLD_DIVISION_TRACKS[track_key]
    division_id = world_division_id(division)
    package_audio_path = package_dir / "audio" / "world-divisions" / division_id / language / f"{track_key}.mp3"
    package_audio_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_mp3_path, package_audio_path)

    audio = division.setdefault("audio", [])
    if track_def["isPrimary"]:
        for existing_track in audio:
            if normalize_language(existing_track.get("languageCode")) == language:
                existing_track["isPrimary"] = False

    new_track = {
        "languageCode": language,
        "kind": track_def["kind"],
        "isPrimary": track_def["isPrimary"],
        "sortOrder": track_def["sortOrder"],
        "title": f"{division_id} {track_key} ({language})",
        "transcript": transcript,
        "path": f"audio/world-divisions/{division_id}/{language}/{track_key}.mp3",
    }

    existing_index = next(
        (
            index
            for index, existing_track in enumerate(audio)
            if normalize_language(existing_track.get("languageCode")) == language
            and existing_track.get("kind") == track_def["kind"]
            and existing_track.get("sortOrder") == track_def["sortOrder"]
        ),
        None,
    )
    if existing_index is None:
        audio.append(new_track)
    else:
        audio[existing_index] = new_track


def normalize_language(language: Any) -> str:
    return str(language or "").lower()


def world_division_id(division: dict[str, Any]) -> str:
    value = division.get("id")
    if not value:
        title = division.get("title")
        if isinstance(title, dict):
            value = title.get("en") or next((item for item in title.values() if item), None)
        else:
            value = title
    return slugify(str(value or "world-division"))


def format_lang_tracks(tracks_by_language: dict[str, list[str]], verb: str) -> str:
    if not tracks_by_language:
        return f"{verb} 0 track(s)"
    parts = [
        f"{language}({', '.join(track_keys)})"
        for language, track_keys in sorted(tracks_by_language.items())
    ]
    return f"{verb} " + "; ".join(parts)


if __name__ == "__main__":
    main()
