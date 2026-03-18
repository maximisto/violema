#!/usr/bin/env python3
"""Flask web app — export a Telegram chat to CSV."""

import csv
import io
import os
from datetime import timezone

from flask import Flask, render_template, request, Response, stream_with_context

app = Flask(__name__)


def iter_messages(api_id: int, api_hash: str, chat: str, limit: int):
    """Yield message dicts from a Telegram chat via Telethon."""
    from telethon.sync import TelegramClient          # type: ignore
    from telethon.tl.types import User, Chat, Channel # type: ignore

    session = os.path.join(os.path.dirname(__file__), "tg_session")
    rows = []
    with TelegramClient(session, api_id, api_hash) as client:
        entity = client.get_entity(chat)
        for msg in client.iter_messages(entity, limit=limit or None):
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

    rows.reverse()
    return rows


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/export", methods=["POST"])
def export():
    api_id   = request.form.get("api_id", "").strip()
    api_hash = request.form.get("api_hash", "").strip()
    chat     = request.form.get("chat", "").strip()
    limit    = int(request.form.get("limit") or 0)

    if not api_id or not api_hash or not chat:
        return "Missing api_id, api_hash, or chat name.", 400

    try:
        rows = iter_messages(int(api_id), api_hash, chat, limit)
    except Exception as e:
        return f"Error: {e}", 500

    def generate():
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=["id", "date", "from", "text", "reply_to_id"])
        writer.writeheader()
        buf.seek(0)
        yield buf.read()
        for row in rows:
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=["id", "date", "from", "text", "reply_to_id"])
            writer.writerow(row)
            buf.seek(0)
            yield buf.read()

    filename = f"{chat.replace(' ', '_')}_chat.csv"
    return Response(
        stream_with_context(generate()),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=True, port=port)
