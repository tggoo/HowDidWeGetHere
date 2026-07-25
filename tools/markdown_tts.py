"""Convert Markdown source text into deterministic locale-aware plaintext for TTS."""

from __future__ import annotations

import re
from html import unescape
from html.parser import HTMLParser
from typing import Any

from text_sanitizer import sanitize_for_tts

try:
    from markdown_it import MarkdownIt
except ImportError as import_error:  # pragma: no cover
    MarkdownIt = None  # type: ignore[assignment]
    MARKDOWN_IMPORT_ERROR = import_error
else:
    MARKDOWN_IMPORT_ERROR = None


_TERMINAL_PUNCTUATION = (".", "!", "?", ":", ";", "\u2026")
_UNSAFE_HTML_BLOCKS = {"script", "style"}


def markdown_to_tts(markdown: str | None, locale: str) -> str:
    if markdown is None:
        return ""

    source = strip_unsafe_html_blocks(str(markdown).strip())
    if not source:
        return ""

    parser = _markdown_parser()
    tokens = parser.parse(source)
    plain = " ".join(segment for segment in _block_segments(tokens) if segment)
    return sanitize_for_tts(normalize_tts_spacing(plain), locale)


def normalize_tts_spacing(text: str) -> str:
    result = unescape(text).replace("\xa0", " ")
    result = re.sub(r"[ \t\r\n]+", " ", result)
    result = re.sub(r"\s+([,.;:!?])", r"\1", result)
    result = re.sub(r"([(\[{])\s+", r"\1", result)
    result = re.sub(r"\s+([)\]}])", r"\1", result)
    return result.strip()


def html_to_text(html: str | None) -> str:
    if not html:
        return ""

    parser = _HtmlTextExtractor()
    parser.feed(html)
    parser.close()
    return normalize_tts_spacing(" ".join(parser.parts))


def strip_unsafe_html_blocks(text: str) -> str:
    return re.sub(r"<(script|style)\b[^>]*>[\s\S]*?</\1>", " ", text, flags=re.IGNORECASE)


def _markdown_parser() -> Any:
    if MarkdownIt is None:
        raise RuntimeError(
            "markdown-it-py is required for Markdown-to-TTS preprocessing. "
            "Install tools dependencies with: python -m pip install -r tools/requirements.txt"
        ) from MARKDOWN_IMPORT_ERROR

    return MarkdownIt("commonmark", {"html": True})


def _block_segments(tokens: list[Any]) -> list[str]:
    segments: list[str] = []
    index = 0
    while index < len(tokens):
        token = tokens[index]

        if token.type == "paragraph_open":
            inner_tokens, index = _collect_block(tokens, index + 1, "paragraph_close")
            text = _inline_text_from_block(inner_tokens)
            if text:
                segments.append(normalize_tts_spacing(text))
            continue

        if token.type == "heading_open":
            inner_tokens, index = _collect_block(tokens, index + 1, "heading_close")
            text = _inline_text_from_block(inner_tokens)
            if text:
                segments.append(_ensure_terminal_punctuation(normalize_tts_spacing(text)))
            continue

        if token.type in {"bullet_list_open", "ordered_list_open"}:
            closing_type = "bullet_list_close" if token.type == "bullet_list_open" else "ordered_list_close"
            inner_tokens, index = _collect_block(tokens, index + 1, closing_type)
            segments.extend(_list_item_segments(inner_tokens))
            continue

        if token.type == "blockquote_open":
            inner_tokens, index = _collect_block(tokens, index + 1, "blockquote_close")
            segments.extend(_block_segments(inner_tokens))
            continue

        if token.type in {"fence", "code_block"}:
            text = normalize_tts_spacing(token.content)
            if text:
                segments.append(text)
            index += 1
            continue

        if token.type == "html_block":
            text = normalize_tts_spacing(html_to_text(token.content))
            if text:
                segments.append(text)
            index += 1
            continue

        if token.type == "inline":
            text = normalize_tts_spacing(_inline_tokens_to_text(token.children or []))
            if text:
                segments.append(text)
            index += 1
            continue

        index += 1

    return segments


def _list_item_segments(tokens: list[Any]) -> list[str]:
    segments: list[str] = []
    index = 0
    while index < len(tokens):
        token = tokens[index]
        if token.type != "list_item_open":
            index += 1
            continue

        inner_tokens, index = _collect_block(tokens, index + 1, "list_item_close")
        text = normalize_tts_spacing(" ".join(_block_segments(inner_tokens)))
        if text:
            segments.append(_ensure_terminal_punctuation(text))

    return segments


def _inline_text_from_block(tokens: list[Any]) -> str:
    parts: list[str] = []
    for token in tokens:
        if token.type == "inline":
            parts.append(_inline_tokens_to_text(token.children or []))
        elif token.type == "html_inline":
            parts.append(html_to_text(token.content))
        elif token.type == "html_block":
            parts.append(html_to_text(token.content))
        elif token.type in {"fence", "code_block"}:
            parts.append(token.content)
    return normalize_tts_spacing(" ".join(part for part in parts if part))


def _inline_tokens_to_text(tokens: list[Any]) -> str:
    parts: list[str] = []
    index = 0
    while index < len(tokens):
        token = tokens[index]

        if token.type == "text":
            parts.append(token.content)
        elif token.type == "code_inline":
            parts.append(token.content)
        elif token.type in {"softbreak", "hardbreak"}:
            parts.append(" ")
        elif token.type == "html_inline":
            parts.append(html_to_text(token.content))
        elif token.type == "image":
            pass
        elif token.type.endswith("_open"):
            inner_tokens, index = _collect_inline(tokens, index + 1, token.type.replace("_open", "_close"))
            parts.append(_inline_tokens_to_text(inner_tokens))
            continue
        elif not token.type.endswith("_close") and getattr(token, "content", ""):
            parts.append(token.content)

        index += 1

    return normalize_tts_spacing(" ".join(part for part in parts if part))


def _collect_block(tokens: list[Any], start_index: int, closing_type: str) -> tuple[list[Any], int]:
    opening_type = closing_type.replace("_close", "_open")
    collected: list[Any] = []
    depth = 1
    index = start_index

    while index < len(tokens):
        token = tokens[index]
        if token.type == opening_type:
            depth += 1
        elif token.type == closing_type:
            depth -= 1
            if depth == 0:
                return collected, index + 1

        collected.append(token)
        index += 1

    return collected, index


def _collect_inline(tokens: list[Any], start_index: int, closing_type: str) -> tuple[list[Any], int]:
    opening_type = closing_type.replace("_close", "_open")
    collected: list[Any] = []
    depth = 1
    index = start_index

    while index < len(tokens):
        token = tokens[index]
        if token.type == opening_type:
            depth += 1
        elif token.type == closing_type:
            depth -= 1
            if depth == 0:
                return collected, index + 1

        collected.append(token)
        index += 1

    return collected, index


def _ensure_terminal_punctuation(text: str) -> str:
    normalized = normalize_tts_spacing(text)
    if not normalized or normalized.endswith(_TERMINAL_PUNCTUATION):
        return normalized
    return f"{normalized}."


class _HtmlTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in _UNSAFE_HTML_BLOCKS:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in _UNSAFE_HTML_BLOCKS and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            self.parts.append(data)
