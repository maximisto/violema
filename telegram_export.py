#!/usr/bin/env python3
"""
Telegram Conversation Exporter

Two modes:
  1. Parse a local Telegram Desktop HTML/JSON export (File > Export Chat History)
  2. Fetch messages via the Telethon MTProto client (requires API credentials)

Usage:
  # Parse a local export produced by Telegram Desktop:
  python telegram_export.py --local result.json --out messages.csv

  # Fetch live via Telethon:
  python telegram_export.py --api --chat "Friend Name" --limit 1000 --out messages.csv

Environment variables for live mode:
  TG_API_ID    – integer app id from https://my.telegram.org
  TG_API_HASH  – hash string from https://my.telegram.org
  TG_SESSION   – session file name (default: tg_session)
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


# ---------------------------------------------------------------------------
# Mode 1: parse a Telegram Desktop JSON export
# ---------------------------------------------------------------------------

def load_local_export(path: str) -> list[dict]:
    """Load messages from a Telegram Desktop JSON export file."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    messages = data.get("messages", [])
    rows = []
    for msg in messages:
        if msg.get("type") != "message":
            continue
        # 'text' can be a plain string or a list of text entities
        text_field = msg.get("text", "")
        if isinstance(text_field, list):
            text = "".join(
                part if isinstance(part, str) else part.get("text", "")
                for part in text_field
            )
        else:
            text = text_field

        rows.append({
            "id": msg.get("id"),
            "date": msg.get("date"),
            "from": msg.get("from", msg.get("actor", "")),
            "from_id": msg.get("from_id", msg.get("actor_id", "")),
            "text": text,
            "reply_to_id": msg.get("reply_to_message_id", ""),
            "media_type": msg.get("media_type", ""),
        })
    return rows


# ---------------------------------------------------------------------------
# Mode 2: live fetch via Telethon
# ---------------------------------------------------------------------------

def fetch_via_telethon(chat: str, limit: int) -> list[dict]:
    """Fetch messages from a chat using the Telethon MTProto client."""
    try:
        from telethon.sync import TelegramClient  # type: ignore
        from telethon.tl.types import User, Chat, Channel  # type: ignore
    except ImportError:
        sys.exit("Telethon is not installed. Run: pip install telethon")

    api_id = os.environ.get("TG_API_ID")
    api_hash = os.environ.get("TG_API_HASH")
    session = os.environ.get("TG_SESSION", "tg_session")

    if not api_id or not api_hash:
        sys.exit(
            "Set TG_API_ID and TG_API_HASH environment variables.\n"
            "Get them at https://my.telegram.org under 'API development tools'."
        )

    rows = []
    with TelegramClient(session, int(api_id), api_hash) as client:
        entity = client.get_entity(chat)
        for msg in client.iter_messages(entity, limit=limit):
            if msg.text is None and msg.message is None:
                continue
            sender = msg.sender
            if isinstance(sender, User):
                from_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip()
                from_id = sender.id
            elif isinstance(sender, (Chat, Channel)):
                from_name = sender.title
                from_id = sender.id
            else:
                from_name = ""
                from_id = ""

            rows.append({
                "id": msg.id,
                "date": msg.date.astimezone(timezone.utc).isoformat(),
                "from": from_name,
                "from_id": from_id,
                "text": msg.text or msg.message or "",
                "reply_to_id": msg.reply_to_msg_id or "",
                "media_type": type(msg.media).__name__ if msg.media else "",
            })

    # Return in chronological order
    rows.reverse()
    return rows


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

FIELDNAMES = ["id", "date", "from", "from_id", "text", "reply_to_id", "media_type"]


def write_csv(rows: list[dict], path: str) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved {len(rows)} messages → {path}")


def write_json(rows: list[dict], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(rows)} messages → {path}")


def print_preview(rows: list[dict], n: int = 10) -> None:
    print(f"\n--- Preview (first {min(n, len(rows))} messages) ---")
    for row in rows[:n]:
        ts = row["date"]
        sender = row["from"] or row["from_id"]
        text = row["text"][:80].replace("\n", " ")
        print(f"[{ts}] {sender}: {text}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export a Telegram conversation to CSV or JSON."
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--local",
        metavar="FILE",
        help="Path to a Telegram Desktop JSON export (result.json)",
    )
    mode.add_argument(
        "--api",
        action="store_true",
        help="Fetch messages live via Telethon (requires API credentials)",
    )

    parser.add_argument(
        "--chat",
        metavar="NAME_OR_ID",
        help="[--api mode] Chat name, username, or phone number to export",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1000,
        help="[--api mode] Maximum number of messages to fetch (default: 1000)",
    )
    parser.add_argument(
        "--out",
        metavar="FILE",
        default="messages.csv",
        help="Output file path (.csv or .json, default: messages.csv)",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Print first 10 messages to stdout after export",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.local:
        print(f"Loading local export: {args.local}")
        rows = load_local_export(args.local)
    else:
        if not args.chat:
            sys.exit("--chat is required when using --api mode")
        print(f"Fetching up to {args.limit} messages from '{args.chat}' via Telethon…")
        rows = fetch_via_telethon(args.chat, args.limit)

    if not rows:
        print("No messages found.")
        return

    out_path = args.out
    if out_path.endswith(".json"):
        write_json(rows, out_path)
    else:
        write_csv(rows, out_path)

    if args.preview:
        print_preview(rows)


if __name__ == "__main__":
    main()
