#!/usr/bin/env python3
"""
Telegram Chat Exporter — fetch a single conversation with one person.

Two modes:
  1. Parse a Telegram Desktop JSON export  (no credentials needed)
     In Telegram Desktop: right-click the chat with Argus → Export Chat History → JSON
     python telegram_export.py --local result.json --out argus.csv

  2. Fetch live via Telethon  (requires API credentials from my.telegram.org)
     python telegram_export.py --api --chat "Argus" --out argus.csv

Environment variables for live mode:
  TG_API_ID    – integer app id  (https://my.telegram.org → API development tools)
  TG_API_HASH  – hash string     (same page)
"""

import argparse
import csv
import json
import os
import sys
from datetime import timezone


FIELDNAMES = ["id", "date", "from", "text", "reply_to_id"]


# ---------------------------------------------------------------------------
# Mode 1 — parse a Telegram Desktop JSON export
# ---------------------------------------------------------------------------

def load_local_export(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    rows = []
    for msg in data.get("messages", []):
        if msg.get("type") != "message":
            continue

        text_field = msg.get("text", "")
        if isinstance(text_field, list):
            text = "".join(
                p if isinstance(p, str) else p.get("text", "")
                for p in text_field
            )
        else:
            text = text_field

        rows.append({
            "id": msg.get("id"),
            "date": msg.get("date"),
            "from": msg.get("from", msg.get("actor", "")),
            "text": text,
            "reply_to_id": msg.get("reply_to_message_id", ""),
        })
    return rows


# ---------------------------------------------------------------------------
# Mode 2 — live fetch via Telethon
# ---------------------------------------------------------------------------

def fetch_via_telethon(chat: str, limit: int) -> list[dict]:
    try:
        from telethon.sync import TelegramClient          # type: ignore
        from telethon.tl.types import User, Chat, Channel # type: ignore
    except ImportError:
        sys.exit("Run: pip install telethon")

    api_id   = os.environ.get("TG_API_ID")
    api_hash = os.environ.get("TG_API_HASH")
    if not api_id or not api_hash:
        sys.exit(
            "Set TG_API_ID and TG_API_HASH.\n"
            "Get them at https://my.telegram.org → API development tools."
        )

    rows = []
    with TelegramClient(os.environ.get("TG_SESSION", "tg_session"),
                        int(api_id), api_hash) as client:
        entity = client.get_entity(chat)
        for msg in client.iter_messages(entity, limit=limit):
            if not (msg.text or msg.message):
                continue
            sender = msg.sender
            if isinstance(sender, User):
                name = f"{sender.first_name or ''} {sender.last_name or ''}".strip()
            elif isinstance(sender, (Chat, Channel)):
                name = sender.title
            else:
                name = str(getattr(sender, "id", ""))

            rows.append({
                "id": msg.id,
                "date": msg.date.astimezone(timezone.utc).isoformat(),
                "from": name,
                "text": msg.text or msg.message or "",
                "reply_to_id": msg.reply_to_msg_id or "",
            })

    rows.reverse()  # chronological order
    return rows


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Export a Telegram chat to CSV/JSON.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--local", metavar="FILE",
                      help="Path to a Telegram Desktop JSON export (result.json)")
    mode.add_argument("--api", action="store_true",
                      help="Fetch live via Telethon")

    parser.add_argument("--chat", metavar="NAME",
                        help="[--api] Contact name, username, or phone number")
    parser.add_argument("--limit", type=int, default=0,
                        help="[--api] Max messages to fetch (0 = all, default: 0)")
    parser.add_argument("--out", metavar="FILE", default="chat.csv",
                        help="Output file (.csv or .json, default: chat.csv)")
    args = parser.parse_args()

    if args.local:
        print(f"Reading {args.local} …")
        rows = load_local_export(args.local)
    else:
        if not args.chat:
            sys.exit("--chat is required with --api")
        limit = args.limit or None  # None = no limit in Telethon
        print(f"Fetching {'all' if not limit else limit} messages from '{args.chat}' …")
        rows = fetch_via_telethon(args.chat, limit)

    if not rows:
        print("No messages found.")
        return

    if args.out.endswith(".json"):
        write_json(rows, args.out)
    else:
        write_csv(rows, args.out)


if __name__ == "__main__":
    main()
