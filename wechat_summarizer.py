#!/usr/bin/env python3
"""
WeChat Chat Room Summarizer
============================
Parses exported WeChat chat logs and generates a structured summary
using the Claude API. The summary is saved to memory/wechat_summary.md
so it persists for future Claude sessions.

How to export your WeChat chat:
  - iOS:  Chat → top-right menu → "Email Chat History"
  - Android: Chat → top-right menu → "More" → "Email Chat History"
  - PC WeChat: Chat window → "..." → "Backup and Restore"

Usage:
  python wechat_summarizer.py <path_to_chat_export.txt>
  python wechat_summarizer.py <path_to_chat_export.txt> --output memory/wechat_summary.md
"""

import argparse
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import anthropic


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


def format_messages_for_claude(messages: list[dict]) -> str:
    """Format parsed messages into a readable block for Claude."""
    lines = []
    for msg in messages:
        ts = f"[{msg['timestamp']}] " if msg["timestamp"] else ""
        lines.append(f"{ts}{msg['sender']}: {msg['content']}")
    return "\n".join(lines)


def get_chat_stats(messages: list[dict]) -> dict:
    """Compute basic statistics about the chat."""
    if not messages:
        return {}

    senders = [m["sender"] for m in messages]
    sender_counts: dict[str, int] = {}
    for s in senders:
        sender_counts[s] = sender_counts.get(s, 0) + 1

    timestamps = [m["timestamp"] for m in messages if m["timestamp"]]

    return {
        "total_messages": len(messages),
        "participants": list(sender_counts.keys()),
        "message_counts_by_sender": sender_counts,
        "date_range": (
            f"{timestamps[0]} → {timestamps[-1]}" if timestamps else "unknown"
        ),
    }


# ---------------------------------------------------------------------------
# Claude summarisation
# ---------------------------------------------------------------------------

def summarize_with_claude(chat_text: str, stats: dict) -> str:
    """
    Send the chat to Claude Opus 4.6 and get back a structured summary.
    Uses adaptive thinking for a thorough analysis.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "ANTHROPIC_API_KEY environment variable is not set.\n"
            "Export it with: export ANTHROPIC_API_KEY='your-key-here'"
        )

    client = anthropic.Anthropic(api_key=api_key)

    stats_block = ""
    if stats:
        stats_block = f"""
## Chat Statistics
- Total messages: {stats.get('total_messages', 'N/A')}
- Participants: {', '.join(stats.get('participants', []))}
- Date range: {stats.get('date_range', 'N/A')}
- Messages per person: {stats.get('message_counts_by_sender', {})}

"""

    system_prompt = (
        "You are an expert analyst specializing in conversation summarization. "
        "Your goal is to create a concise yet comprehensive summary of a WeChat "
        "group chat or direct message history that captures:\n"
        "1. The main topics discussed\n"
        "2. Key decisions or action items\n"
        "3. Important information shared (links, files, plans, dates)\n"
        "4. The overall tone and dynamic of the conversation\n"
        "5. Any unresolved questions or follow-ups needed\n\n"
        "Format your response as a well-structured markdown document suitable "
        "for saving as a memory file. Be specific about names, dates, and facts."
    )

    user_message = (
        f"{stats_block}"
        f"Please analyze and summarize the following WeChat chat export:\n\n"
        f"---\n{chat_text}\n---\n\n"
        "Produce a detailed summary following the structure:\n"
        "# WeChat Chat Summary\n"
        "## Overview\n"
        "## Key Topics & Discussions\n"
        "## Decisions & Action Items\n"
        "## Important Details (dates, links, files mentioned)\n"
        "## Tone & Dynamics\n"
        "## Open Questions / Follow-ups\n"
    )

    print("Sending chat to Claude for analysis (streaming)...")

    summary_parts: list[str] = []

    with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        for event in stream:
            if event.type == "content_block_start":
                if event.content_block.type == "thinking":
                    print("\n[Claude is thinking...]\n", flush=True)
                elif event.content_block.type == "text":
                    print("\n[Summary]\n", flush=True)
            elif event.type == "content_block_delta":
                if event.delta.type == "text_delta":
                    print(event.delta.text, end="", flush=True)
                    summary_parts.append(event.delta.text)

        final = stream.get_final_message()
        usage = final.usage
        print(
            f"\n\n[Tokens used — input: {usage.input_tokens}, output: {usage.output_tokens}]"
        )

    return "".join(summary_parts)


# ---------------------------------------------------------------------------
# Memory persistence
# ---------------------------------------------------------------------------

def save_summary(summary: str, output_path: str, stats: dict) -> None:
    """Save the summary to a markdown file for Claude's memory."""
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = (
        f"<!-- Generated by wechat_summarizer.py on {generated_at} -->\n\n"
        f"*Last updated: {generated_at}*\n\n"
    )

    with open(out, "w", encoding="utf-8") as f:
        f.write(header + summary)

    print(f"\n✓ Summary saved to: {out.resolve()}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Parse a WeChat chat export and generate a Claude-powered summary."
    )
    parser.add_argument(
        "chat_file",
        help="Path to the exported WeChat chat text file",
    )
    parser.add_argument(
        "--output",
        default="memory/wechat_summary.md",
        help="Output path for the summary markdown file (default: memory/wechat_summary.md)",
    )
    parser.add_argument(
        "--encoding",
        default="utf-8",
        help="File encoding (default: utf-8). Try 'gbk' or 'utf-16' for Chinese exports.",
    )
    parser.add_argument(
        "--max-messages",
        type=int,
        default=2000,
        help="Maximum messages to include in the summary request (default: 2000)",
    )
    args = parser.parse_args()

    # Read the exported chat file
    chat_path = Path(args.chat_file)
    if not chat_path.exists():
        print(f"Error: file not found — {chat_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading chat export: {chat_path}")
    try:
        raw_text = chat_path.read_text(encoding=args.encoding)
    except UnicodeDecodeError:
        print(
            f"Could not decode with '{args.encoding}'. "
            "Try --encoding gbk or --encoding utf-16",
            file=sys.stderr,
        )
        sys.exit(1)

    # Parse into structured messages
    print("Parsing messages...")
    messages = parse_wechat_export(raw_text)

    if not messages:
        print(
            "Warning: no messages were parsed. The file may use an unsupported format.\n"
            "The raw text will be sent directly to Claude.",
            file=sys.stderr,
        )
        chat_text = raw_text
        stats: dict = {}
    else:
        # Trim if needed to stay within context limits
        if len(messages) > args.max_messages:
            print(
                f"Trimming to last {args.max_messages} messages "
                f"(found {len(messages)} total)."
            )
            messages = messages[-args.max_messages :]

        stats = get_chat_stats(messages)
        chat_text = format_messages_for_claude(messages)

        print(f"Parsed {stats['total_messages']} messages")
        print(f"Participants: {', '.join(stats['participants'])}")
        print(f"Date range: {stats['date_range']}")

    # Generate summary via Claude
    summary = summarize_with_claude(chat_text, stats)

    # Save to memory file
    save_summary(summary, args.output, stats)

    print("\nDone! You can reference this summary in future Claude sessions.")


if __name__ == "__main__":
    main()
