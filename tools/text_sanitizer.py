"""Normalize language-specific abbreviations and symbols that TTS engines read poorly."""

from __future__ import annotations

import re


def sanitize_for_tts(text: str, language: str) -> str:
    if not text:
        return text
    normalized_language = (language or "").lower()
    if normalized_language.startswith("cs"):
        return sanitize_czech_for_tts(text)
    if normalized_language.startswith("en"):
        return sanitize_english_for_tts(text)
    return text


def sanitize_english_for_tts(text: str) -> str:
    result = text
    result = replace_slash_separators(result, "and")
    result = re.sub(r"\bc\.\s*(?=\d)", "around ", result)
    result = re.sub(r"\bca\.\s*(?=\d)", "around ", result, flags=re.IGNORECASE)
    result = re.sub(r"\bapprox\.\s*", "approximately ", result, flags=re.IGNORECASE)
    result = re.sub(r"\be\.g\.", "for example", result, flags=re.IGNORECASE)
    result = re.sub(r"\bi\.e\.", "that is", result, flags=re.IGNORECASE)
    result = re.sub(r"\betc\.", "and so on", result, flags=re.IGNORECASE)
    result = re.sub(r"\bBCE\b", "before the Common Era", result)
    result = re.sub(r"\bBC\b", "before Christ", result)
    result = re.sub(r"\bCE\b", "Common Era", result)
    result = re.sub(r"\bAD\b", "Anno Domini", result)
    return normalize_spacing(result)


def sanitize_czech_for_tts(text: str) -> str:
    result = text
    result = replace_slash_separators(result, "a")
    result = result.replace("Mytologie a Literatura", "mytologie a literatura")
    result = result.replace("Literatura a Mytologie", "literatura a mytologie")
    replacements = (
        ("p\u0159. n. l.", "p\u0159ed na\u0161\u00edm letopo\u010dtem"),
        ("p\u0159.n.l.", "p\u0159ed na\u0161\u00edm letopo\u010dtem"),
        ("n. l.", "na\u0161eho letopo\u010dtu"),
        ("n.l.", "na\u0161eho letopo\u010dtu"),
        ("p\u0159ibl.", "p\u0159ibli\u017en\u011b"),
        ("nap\u0159.", "nap\u0159\u00edklad"),
        ("atd.", "a tak d\u00e1le"),
        ("tj.", "to je"),
        ("resp.", "respektive"),
        ("tzv.", "takzvan\u00fd"),
    )
    for source, target in replacements:
        result = result.replace(source, target)
    return normalize_spacing(result)


def replace_slash_separators(text: str, conjunction: str) -> str:
    return re.sub(r"\s+/\s+", f" {conjunction} ", text)


def normalize_spacing(text: str) -> str:
    lines = [re.sub(r"[ \t]{2,}", " ", line).rstrip() for line in text.splitlines()]
    return "\n".join(lines).strip()
