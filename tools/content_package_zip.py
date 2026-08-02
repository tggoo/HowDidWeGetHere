"""Utilities for writing size-limited content package ZIP files."""

from __future__ import annotations

import json
import zipfile
from pathlib import Path
from typing import Any


DEFAULT_MAX_ZIP_MIB = 20
DEFAULT_MAX_ZIP_BYTES = DEFAULT_MAX_ZIP_MIB * 1024 * 1024
ENTRY_MEDIA_FIELDS = ("audio", "images")
WORLD_DIVISION_MEDIA_FIELDS = ("audio",)


def write_package_zips(package_dir: Path, max_zip_bytes: int = DEFAULT_MAX_ZIP_BYTES) -> list[Path]:
    if max_zip_bytes <= 0:
        raise ValueError("max_zip_bytes must be greater than zero.")

    entries_path = package_dir / "entries.json"
    document = json.loads(entries_path.read_text(encoding="utf-8"))
    entries = document.get("entries", [])
    if not isinstance(entries, list):
        raise ValueError(f"{entries_path} must contain an entries array.")
    world_divisions = document.get("worldDivisions", [])
    if not isinstance(world_divisions, list):
        raise ValueError(f"{entries_path} worldDivisions must be an array when present.")

    package_slug = str(document.get("packageSlug") or package_dir.name)
    output_dir = package_dir.parent
    missing_media_paths = missing_media_paths_for_document(package_dir, entries, world_divisions)
    if missing_media_paths:
        formatted = ", ".join(path.as_posix() for path in missing_media_paths[:10])
        remaining_count = len(missing_media_paths) - 10
        if remaining_count > 0:
            formatted = f"{formatted}, and {remaining_count} more"
        raise ValueError(f"{entries_path} references missing media file(s): {formatted}")

    remove_existing_zips(output_dir, package_slug)

    single_zip_path = output_dir / f"{package_slug}.zip"
    write_zip(single_zip_path, package_dir, document, entries, world_divisions)
    if single_zip_path.stat().st_size <= max_zip_bytes:
        return [single_zip_path]
    if not entries:
        single_zip_size = single_zip_path.stat().st_size
        single_zip_path.unlink()
        raise ValueError(
            f"{single_zip_path.name} is {single_zip_size / 1024 / 1024:.2f} MiB, "
            f"above the configured {max_zip_bytes / 1024 / 1024:.2f} MiB limit."
        )

    single_zip_path.unlink()
    parts = split_entries(package_dir, document, entries, world_divisions, max_zip_bytes)
    zip_paths: list[Path] = []
    for index, part_entries in enumerate(parts, start=1):
        part_world_divisions = world_divisions if index == 1 else []
        part_document = build_part_document(document, package_slug, index, part_entries, part_world_divisions)
        zip_path = output_dir / f"{package_slug}-part-{index:03d}.zip"
        write_zip(zip_path, package_dir, part_document, part_entries, part_world_divisions)
        if zip_path.stat().st_size > max_zip_bytes:
            raise ValueError(
                f"{zip_path} is {zip_path.stat().st_size / 1024 / 1024:.2f} MiB, "
                f"above the configured {max_zip_bytes / 1024 / 1024:.2f} MiB limit."
            )
        zip_paths.append(zip_path)

    return zip_paths


def split_entries(
    package_dir: Path,
    document: dict[str, Any],
    entries: list[dict[str, Any]],
    world_divisions: list[dict[str, Any]],
    max_zip_bytes: int,
) -> list[list[dict[str, Any]]]:
    package_slug = str(document.get("packageSlug") or package_dir.name)
    output_dir = package_dir.parent
    candidate_path = output_dir / f".{package_slug}.candidate.zip"
    parts: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []

    try:
        for entry in entries:
            candidate_entries = [*current, entry]
            part_index = len(parts) + 1
            candidate_world_divisions = world_divisions if part_index == 1 else []
            candidate_document = build_part_document(
                document,
                package_slug,
                part_index,
                candidate_entries,
                candidate_world_divisions,
            )
            write_zip(candidate_path, package_dir, candidate_document, candidate_entries, candidate_world_divisions)
            candidate_size = candidate_path.stat().st_size
            candidate_path.unlink()

            if candidate_size <= max_zip_bytes:
                current = candidate_entries
                continue

            if not current:
                slug = entry.get("slug") or entry.get("title") or "entry"
                raise ValueError(
                    f"Entry '{slug}' cannot fit into a {max_zip_bytes / 1024 / 1024:.2f} MiB ZIP part."
                )

            parts.append(current)
            current = [entry]
            part_index = len(parts) + 1
            candidate_world_divisions = world_divisions if part_index == 1 else []
            candidate_document = build_part_document(
                document,
                package_slug,
                part_index,
                current,
                candidate_world_divisions,
            )
            write_zip(candidate_path, package_dir, candidate_document, current, candidate_world_divisions)
            candidate_size = candidate_path.stat().st_size
            candidate_path.unlink()
            if candidate_size > max_zip_bytes:
                slug = entry.get("slug") or entry.get("title") or "entry"
                raise ValueError(
                    f"Entry '{slug}' cannot fit into a {max_zip_bytes / 1024 / 1024:.2f} MiB ZIP part."
                )

        if current:
            parts.append(current)
    finally:
        if candidate_path.exists():
            candidate_path.unlink()

    return parts


def build_part_document(
    document: dict[str, Any],
    package_slug: str,
    part_index: int,
    entries: list[dict[str, Any]],
    world_divisions: list[dict[str, Any]],
) -> dict[str, Any]:
    part_document = {
        key: value
        for key, value in document.items()
        if key not in {"packageSlug", "title", "entries", "worldDivisions"}
    }
    part_document["packageSlug"] = f"{package_slug}-part-{part_index:03d}"
    part_document["title"] = f"{document.get('title') or package_slug} Part {part_index}"
    part_document["entries"] = entries
    if world_divisions:
        part_document["worldDivisions"] = world_divisions
    return part_document


def write_zip(
    zip_path: Path,
    package_dir: Path,
    document: dict[str, Any],
    entries: list[dict[str, Any]],
    world_divisions: list[dict[str, Any]],
) -> None:
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("entries.json", json.dumps(document, ensure_ascii=False, indent=2) + "\n")
        for relative_path in sorted(media_paths_for_document(entries, world_divisions)):
            source_path = package_dir / relative_path
            if not source_path.is_file():
                raise FileNotFoundError(f"Missing media file referenced by package: {source_path}")
            archive.write(source_path, relative_path.as_posix())


def media_paths_for_entries(entries: list[dict[str, Any]]) -> set[Path]:
    return media_paths_for_items(entries, ENTRY_MEDIA_FIELDS)


def media_paths_for_world_divisions(world_divisions: list[dict[str, Any]]) -> set[Path]:
    return media_paths_for_items(world_divisions, WORLD_DIVISION_MEDIA_FIELDS)


def media_paths_for_document(
    entries: list[dict[str, Any]],
    world_divisions: list[dict[str, Any]],
) -> set[Path]:
    return media_paths_for_entries(entries) | media_paths_for_world_divisions(world_divisions)


def media_paths_for_items(items: list[dict[str, Any]], media_fields: tuple[str, ...]) -> set[Path]:
    paths: set[Path] = set()
    for item in items:
        for field in media_fields:
            media_items = item.get(field)
            if not isinstance(media_items, list):
                continue

            for media_item in media_items:
                if not isinstance(media_item, dict):
                    continue

                package_path = normalize_package_path(media_item.get("path"))
                if package_path is not None:
                    paths.add(package_path)

    return paths


def missing_media_paths_for_entries(package_dir: Path, entries: list[dict[str, Any]]) -> list[Path]:
    return missing_media_paths_for_document(package_dir, entries, [])


def missing_media_paths_for_document(
    package_dir: Path,
    entries: list[dict[str, Any]],
    world_divisions: list[dict[str, Any]],
) -> list[Path]:
    return sorted(
        relative_path
        for relative_path in media_paths_for_document(entries, world_divisions)
        if not (package_dir / relative_path).is_file()
    )


def normalize_package_path(value: Any) -> Path | None:
    if not isinstance(value, str) or not value.strip():
        return None

    segments = [segment.strip() for segment in value.replace("\\", "/").lstrip("/").split("/") if segment.strip()]
    if not segments or any(segment == ".." for segment in segments):
        return None

    return Path(*segments)


def remove_existing_zips(output_dir: Path, package_slug: str) -> None:
    single_zip = output_dir / f"{package_slug}.zip"
    if single_zip.exists():
        single_zip.unlink()

    for zip_path in output_dir.glob(f"{package_slug}-part-*.zip"):
        if zip_path.is_file():
            zip_path.unlink()
