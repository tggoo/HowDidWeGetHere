"""Utilities for writing size-limited content package ZIP files."""

from __future__ import annotations

import json
import zipfile
from pathlib import Path
from typing import Any


DEFAULT_MAX_ZIP_MIB = 20
DEFAULT_MAX_ZIP_BYTES = DEFAULT_MAX_ZIP_MIB * 1024 * 1024
MEDIA_FIELDS = ("audio", "images")


def write_package_zips(package_dir: Path, max_zip_bytes: int = DEFAULT_MAX_ZIP_BYTES) -> list[Path]:
    if max_zip_bytes <= 0:
        raise ValueError("max_zip_bytes must be greater than zero.")

    entries_path = package_dir / "entries.json"
    document = json.loads(entries_path.read_text(encoding="utf-8"))
    entries = document.get("entries")
    if not isinstance(entries, list):
        raise ValueError(f"{entries_path} must contain an entries array.")

    package_slug = str(document.get("packageSlug") or package_dir.name)
    output_dir = package_dir.parent
    missing_media_paths = missing_media_paths_for_entries(package_dir, entries)
    if missing_media_paths:
        formatted = ", ".join(path.as_posix() for path in missing_media_paths[:10])
        remaining_count = len(missing_media_paths) - 10
        if remaining_count > 0:
            formatted = f"{formatted}, and {remaining_count} more"
        raise ValueError(f"{entries_path} references missing media file(s): {formatted}")

    remove_existing_zips(output_dir, package_slug)

    single_zip_path = output_dir / f"{package_slug}.zip"
    write_zip(single_zip_path, package_dir, document, entries)
    if single_zip_path.stat().st_size <= max_zip_bytes:
        return [single_zip_path]

    single_zip_path.unlink()
    parts = split_entries(package_dir, document, entries, max_zip_bytes)
    zip_paths: list[Path] = []
    for index, part_entries in enumerate(parts, start=1):
        part_document = build_part_document(document, package_slug, index, part_entries)
        zip_path = output_dir / f"{package_slug}-part-{index:03d}.zip"
        write_zip(zip_path, package_dir, part_document, part_entries)
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
            candidate_document = build_part_document(document, package_slug, part_index, candidate_entries)
            write_zip(candidate_path, package_dir, candidate_document, candidate_entries)
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
            candidate_document = build_part_document(document, package_slug, part_index, current)
            write_zip(candidate_path, package_dir, candidate_document, current)
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
) -> dict[str, Any]:
    part_document = {key: value for key, value in document.items() if key not in {"packageSlug", "title", "entries"}}
    part_document["packageSlug"] = f"{package_slug}-part-{part_index:03d}"
    part_document["title"] = f"{document.get('title') or package_slug} Part {part_index}"
    part_document["entries"] = entries
    return part_document


def write_zip(
    zip_path: Path,
    package_dir: Path,
    document: dict[str, Any],
    entries: list[dict[str, Any]],
) -> None:
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("entries.json", json.dumps(document, ensure_ascii=False, indent=2) + "\n")
        for relative_path in sorted(media_paths_for_entries(entries)):
            source_path = package_dir / relative_path
            if not source_path.is_file():
                raise FileNotFoundError(f"Missing media file referenced by package: {source_path}")
            archive.write(source_path, relative_path.as_posix())


def media_paths_for_entries(entries: list[dict[str, Any]]) -> set[Path]:
    paths: set[Path] = set()
    for entry in entries:
        for field in MEDIA_FIELDS:
            items = entry.get(field)
            if not isinstance(items, list):
                continue

            for item in items:
                if not isinstance(item, dict):
                    continue

                package_path = normalize_package_path(item.get("path"))
                if package_path is not None:
                    paths.add(package_path)

    return paths


def missing_media_paths_for_entries(package_dir: Path, entries: list[dict[str, Any]]) -> list[Path]:
    return sorted(
        relative_path
        for relative_path in media_paths_for_entries(entries)
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
