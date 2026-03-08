#!/usr/bin/env python3
"""
WeChat Chat Room Summarizer (no API key required)
==================================================
Parses exported WeChat chat logs, trims them to a size that fits
claude.ai's context window, then prints a ready-to-paste prompt
so you can summarize using your Claude Pro account at claude.ai.

How to export your WeChat chat:
  - iOS:  Chat → top-right menu → "Email Chat History"
  - Android: Chat → top-right menu → "More" → "Email Chat History"
  - PC WeChat: Chat window → "..." → "Backup and Restore"

Usage:
  python wechat_summarizer.py <path_to_chat_export.txt>
  python wechat_summarizer.py <path_to_chat_export.txt> --max-messages 500
"""

import argparse
import re
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Chat log parsers — WeChat exports vary by platform/language
# ---------------------------------------------------------------------------

def parse_wechat_export(text: str) -> list[dict]:
    """
    Parse WeChat exported chat text into a list of message dicts.

    Handles several common export formats:
      1. "2024/01/01 10:00:00 Name\nMessage"   (PC WeChat)
      2. "[2024-01-01 10:00:00] Name: Message"  (iOS email export)
      3. "Name (2024/01/01 10:00:00)\nMessage"  (Android export)
    """
    messages = []

    # --- Format 1: PC WeChat ---
    # Pattern: timestamp on its own line followed by sender on next line
    pattern_pc = re.compile(
        r"(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}:\d{2})\n(.+?)\n([\s\S]*?)(?=\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}:\d{2}|\Z)",
        re.MULTILINE,
    )
    pc_matches = list(pattern_pc.finditer(text))

    # --- Format 2: iOS / email export ---
    # Pattern: [timestamp] Sender: message
    pattern_ios = re.compile(
        r"\[(\d{4}[-/]\d{2}[-/]\d{2},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s+(.+?):\s+([\s\S]*?)(?=\[|\Z)",
        re.MULTILINE,
    )
    ios_matches = list(pattern_ios.finditer(text))

    # --- Format 3: Android export ---
    # Pattern: Sender (timestamp)\nMessage
    pattern_android = re.compile(
        r"^(.+?)\s+\((\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2})\)\n([\s\S]*?)(?=^.+?\s+\(\d{4}[-/]|\Z)",
        re.MULTILINE,
    )
    android_matches = list(pattern_android.finditer(text))

    # --- Format 4: Simple "Sender: message" lines (fallback) ---
    pattern_simple = re.compile(r"^(.+?):\s+(.+)$", re.MULTILINE)
    simple_matches = list(pattern_simple.finditer(text))

    # Pick the format with the most matches
    chosen_format = max(
        [
            ("pc", pc_matches),
            ("ios", ios_matches),
            ("android", android_matches),
        ],
        key=lambda x: len(x[1]),
    )

    format_name, matches = chosen_format

    if len(matches) == 0:
        # Fall back to simple sender: message format
        for m in simple_matches:
            messages.append(
                {
                    "timestamp": None,
                    "sender": m.group(1).strip(),
                    "content": m.group(2).strip(),
                }
            )
        return messages

    if format_name == "pc":
        for m in matches:
            content = m.group(3).strip()
            if content:
                messages.append(
                    {
                        "timestamp": m.group(1).strip(),
                        "sender": m.group(2).strip(),
                        "content": content,
                    }
                )
    elif format_name == "ios":
        for m in matches:
            content = m.group(3).strip()
            if content:
                messages.append(
                    {
                        "timestamp": m.group(1).strip(),
                        "sender": m.group(2).strip(),
                        "content": content,
                    }
                )
    elif format_name == "android":
        for m in matches:
            content = m.group(3).strip()
            if content:
                messages.append(
                    {
                        "timestamp": m.group(2).strip(),
                        "sender": m.group(1).strip(),
                        "content": content,
                    }
                )

    return messages


def format_messages(messages: list[dict]) -> str:
    """Format parsed messages into a readable block."""
    lines = []
    for msg in messages:
        ts = f"[{msg['timestamp']}] " if msg["timestamp"] else ""
        lines.append(f"{ts}{msg['sender']}: {msg['content']}")
    return "\n".join(lines)


def chat_stats(messages: list[dict]) -> dict:
    """Compute basic statistics about the chat."""
    if not messages:
        return {}
    sender_counts: dict[str, int] = {}
    for m in messages:
        sender_counts[m["sender"]] = sender_counts.get(m["sender"], 0) + 1
    timestamps = [m["timestamp"] for m in messages if m["timestamp"]]
    return {
        "total": len(messages),
        "participants": list(sender_counts.keys()),
        "counts": sender_counts,
        "date_range": f"{timestamps[0]} → {timestamps[-1]}" if timestamps else "unknown",
    }


def build_prompt(chat_text: str, stats: dict) -> str:
    """Build the full prompt to paste into claude.ai."""
    stats_block = ""
    if stats:
        counts_str = ", ".join(f"{k}: {v}" for k, v in stats["counts"].items())
        stats_block = (
            f"Chat stats — {stats['total']} messages, "
            f"date range: {stats['date_range']}, "
            f"participants: {counts_str}\n\n"
        )

    return (
        "Please summarize this WeChat chat export. "
        "Structure your response as markdown with these sections:\n"
        "# WeChat Chat Summary\n"
        "## Overview\n"
        "## Key Topics & Discussions\n"
        "## Decisions & Action Items\n"
        "## Important Details (dates, links, plans mentioned)\n"
        "## Tone & Dynamics\n"
        "## Open Questions / Follow-ups\n\n"
        "Be specific about names, dates, and facts.\n\n"
        f"{stats_block}"
        f"---\n{chat_text}\n---"
    )


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

# claude.ai Pro context window is ~200K tokens; ~4 chars/token → ~800K chars.
# We stay well under that with a conservative 300K char limit.
_MAX_CHARS = 300_000


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Parse a WeChat chat export and print a prompt ready to paste "
            "into claude.ai (no API key needed)."
        )
    )
    parser.add_argument("chat_file", help="Path to the exported WeChat chat text file")
    parser.add_argument(
        "--max-messages",
        type=int,
        default=2000,
        help="Maximum messages to include (default: 2000, most recent kept)",
    )
    parser.add_argument(
        "--encoding",
        default="utf-8",
        help="File encoding (default: utf-8). Try 'gbk' or 'utf-16' for Chinese exports.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional file path to save the prompt instead of printing it",
    )
    args = parser.parse_args()

    chat_path = Path(args.chat_file)
    if not chat_path.exists():
        print(f"Error: file not found — {chat_path}", file=sys.stderr)
        sys.exit(1)

    try:
        raw_text = chat_path.read_text(encoding=args.encoding)
    except UnicodeDecodeError:
        print(
            f"Could not decode with '{args.encoding}'. "
            "Try --encoding gbk or --encoding utf-16",
            file=sys.stderr,
        )
        sys.exit(1)

    messages = parse_wechat_export(raw_text)

    if not messages:
        print(
            "Warning: no structured messages found — sending raw text.",
            file=sys.stderr,
        )
        chat_text = raw_text
        stats: dict = {}
    else:
        if len(messages) > args.max_messages:
            print(
                f"Keeping the last {args.max_messages} of {len(messages)} messages.",
                file=sys.stderr,
            )
            messages = messages[-args.max_messages:]
        stats = chat_stats(messages)
        chat_text = format_messages(messages)
        print(
            f"Parsed {stats['total']} messages | "
            f"participants: {', '.join(stats['participants'])} | "
            f"range: {stats['date_range']}",
            file=sys.stderr,
        )

    # Trim to character budget
    if len(chat_text) > _MAX_CHARS:
        chat_text = chat_text[-_MAX_CHARS:]
        print(
            f"Chat trimmed to last {_MAX_CHARS:,} characters to fit claude.ai's context.",
            file=sys.stderr,
        )

    prompt = build_prompt(chat_text, stats)

    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(prompt, encoding="utf-8")
        print(f"\n✓ Prompt saved to: {out.resolve()}", file=sys.stderr)
        print(f"  → Open claude.ai, start a new chat, and paste the contents of that file.")
    else:
        print(prompt)
        print(
            "\n--- Copy everything above and paste it into claude.ai ---",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
