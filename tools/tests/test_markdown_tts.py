"""Test Markdown-to-TTS conversion and field audio generator behavior."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

from markdown_tts import markdown_to_tts  # noqa: E402


class MarkdownToTtsTests(unittest.TestCase):
    def test_bold(self) -> None:
        self.assertEqual(
            markdown_to_tts("Decision granted **freedom of worship**.", "en"),
            "Decision granted freedom of worship.",
        )

    def test_italic(self) -> None:
        self.assertEqual(markdown_to_tts("This was *important* for cities.", "en"), "This was important for cities.")

    def test_link_uses_label_without_url(self) -> None:
        self.assertEqual(markdown_to_tts("See [Rome](https://example.com).", "en"), "See Rome.")

    def test_heading_gets_terminal_punctuation(self) -> None:
        self.assertEqual(markdown_to_tts("## Context\n\nThe empire changed.", "en"), "Context. The empire changed.")

    def test_multiple_paragraphs(self) -> None:
        self.assertEqual(
            markdown_to_tts("First paragraph.\n\nSecond paragraph.", "en"),
            "First paragraph. Second paragraph.",
        )

    def test_bullet_list(self) -> None:
        self.assertEqual(markdown_to_tts("- First point\n- Second point", "en"), "First point. Second point.")

    def test_ordered_list(self) -> None:
        self.assertEqual(markdown_to_tts("1. First point\n2. Second point", "en"), "First point. Second point.")

    def test_blockquote(self) -> None:
        self.assertEqual(markdown_to_tts("> Quoted **text**.", "en"), "Quoted text.")

    def test_inline_code(self) -> None:
        self.assertEqual(markdown_to_tts("Use `edict` as the key.", "en"), "Use edict as the key.")

    def test_html_entity(self) -> None:
        self.assertEqual(markdown_to_tts("Rome &amp; Milan.", "en"), "Rome & Milan.")

    def test_empty_and_none(self) -> None:
        self.assertEqual(markdown_to_tts("", "en"), "")
        self.assertEqual(markdown_to_tts(None, "cs"), "")

    def test_czech_normalization(self) -> None:
        text = "Udalo se p\u0159ibl. 313 n. l. v casti Literatura / Mytologie."
        expected = "Udalo se p\u0159ibli\u017en\u011b 313 na\u0161eho letopo\u010dtu v casti literatura a mytologie."
        self.assertEqual(markdown_to_tts(text, "cs"), expected)

    def test_english_normalization(self) -> None:
        self.assertEqual(markdown_to_tts("Dated c. 313 BCE.", "en"), "Dated around 313 before the Common Era.")

    def test_escaped_markdown_characters(self) -> None:
        self.assertEqual(markdown_to_tts(r"\*literal asterisks\*", "en"), "*literal asterisks*")

    def test_html_tags_keep_readable_text_without_script_content(self) -> None:
        self.assertEqual(markdown_to_tts("<span>Readable</span><script>alert(1)</script>", "en"), "Readable")


class TtsGeneratorTests(unittest.TestCase):
    def test_generator_is_idempotent_and_preserves_json(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            package_dir = temp / "package"
            package_dir.mkdir()
            entries_path = package_dir / "entries.json"
            document = {
                "schemaVersion": 1,
                "packageSlug": "sample",
                "title": "Sample",
                "defaultLanguage": "en",
                "entries": [
                    {
                        "slug": "edict-of-milan",
                        "kind": "Event",
                        "translations": {
                            "en": {
                                "title": "Edict of Milan",
                                "summary": "Granted **religious toleration**.",
                                "description": "First paragraph.\n\nSecond paragraph with [Rome](https://example.com).",
                                "whyItMatters": "- Public worship became legal\n- Imperial policy changed",
                            },
                            "cs": {
                                "title": "Edikt mil\u00e1nsk\u00fd",
                                "summary": "Zaru\u010dil **svobodu vyzn\u00e1n\u00ed**.",
                                "description": "Prvn\u00ed odstavec.\n\nDruh\u00fd odstavec.",
                                "whyItMatters": "Ud\u00e1lost je p\u0159ibl. z roku 313 n. l.",
                            },
                        },
                        "startYear": 313,
                    }
                ],
            }
            original_json = json.dumps(document, ensure_ascii=False, indent=2) + "\n"
            entries_path.write_text(original_json, encoding="utf-8")

            out = temp / "audio"
            command = [
                sys.executable,
                str(TOOLS / "generate-translation-audio.py"),
                "--entries-json",
                str(entries_path),
                "--out",
                str(out),
                "--overwrite",
                "--no-package-update",
            ]

            subprocess.run(command, cwd=ROOT, check=True, capture_output=True, text=True)
            first = _read_tree(out)
            subprocess.run(command, cwd=ROOT, check=True, capture_output=True, text=True)
            second = _read_tree(out)

            self.assertEqual(first, second)
            self.assertEqual(entries_path.read_text(encoding="utf-8"), original_json)
            reloaded = json.loads(entries_path.read_text(encoding="utf-8"))
            self.assertEqual(reloaded["entries"][0]["slug"], "edict-of-milan")
            self.assertEqual(reloaded["entries"][0]["startYear"], 313)
            self.assertEqual(first["edict-of-milan/en/summary.txt"], "Granted religious toleration.")
            self.assertEqual(first["edict-of-milan/en/description.txt"], "First paragraph. Second paragraph with Rome.")
            self.assertNotIn("**", "\n".join(first.values()))
            self.assertNotIn("https://example.com", "\n".join(first.values()))

    def test_generator_discovers_packages_root_and_updates_package_zip(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            packages_root = temp / "packages"
            package_dir = packages_root / "master-timeline"
            package_dir.mkdir(parents=True)
            entries_path = package_dir / "entries.json"
            document = {
                "schemaVersion": 1,
                "packageSlug": "master-timeline",
                "title": "Master Timeline",
                "defaultLanguage": "en",
                "entries": [
                    {
                        "slug": "edict-of-milan",
                        "translations": {
                            "en": {
                                "title": "Edict of Milan",
                                "summary": "Granted **religious toleration**.",
                                "description": "Longer text.",
                                "whyItMatters": "Changed imperial policy.",
                            }
                        },
                        "audio": [
                            {
                                "languageCode": "en",
                                "kind": "Narration",
                                "isPrimary": True,
                                "sortOrder": 0,
                                "title": "old narration",
                                "path": "audio/en/edict-of-milan.mp3",
                            }
                        ],
                    }
                ],
            }
            entries_path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            old_audio = package_dir / "audio" / "en" / "edict-of-milan.mp3"
            old_audio.parent.mkdir(parents=True)
            old_audio.write_bytes(b"old")

            out = temp / "audio"
            mp3 = out / "edict-of-milan" / "en" / "summary.mp3"
            mp3.parent.mkdir(parents=True)
            mp3.write_bytes(b"mp3")

            command = [
                sys.executable,
                str(TOOLS / "generate-translation-audio.py"),
                "--packages-root",
                str(packages_root),
                "--out",
                str(out),
                "--track",
                "summary",
                "--clean-package-audio",
            ]

            subprocess.run(command, cwd=ROOT, check=True, capture_output=True, text=True)

            reloaded = json.loads(entries_path.read_text(encoding="utf-8"))
            audio = reloaded["entries"][0]["audio"]
            self.assertEqual(len(audio), 1)
            self.assertEqual(audio[0]["kind"], "Summary")
            self.assertEqual(audio[0]["path"], "audio/edict-of-milan/en/summary.mp3")
            self.assertEqual(audio[0]["transcript"], "Granted religious toleration.")
            self.assertFalse(old_audio.exists())
            self.assertTrue((package_dir / "audio" / "edict-of-milan" / "en" / "summary.mp3").exists())
            self.assertTrue((packages_root / "master-timeline.zip").exists())


def _read_tree(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): path.read_text(encoding="utf-8")
        for path in sorted(root.rglob("*.txt"))
    }


if __name__ == "__main__":
    unittest.main()
