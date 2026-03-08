#!/usr/bin/env python3
"""
wechat_scraper_mac.py
=====================
Scrapes chat messages directly from the macOS WeChat desktop window.

Strategy (tries in order):
  1. Accessibility API via AppleScript — extracts text with no OCR needed.
  2. Screenshot + Vision OCR — scrolls through the chat taking screenshots,
     then uses macOS Vision framework to read the text (great for Chinese).
  3. Screenshots only — saves images so you can upload them to claude.ai.

Requirements:
  - macOS with WeChat desktop app open and the target chat visible.
  - Terminal must have Accessibility permission:
      System Preferences → Privacy & Security → Accessibility → ✓ Terminal
  - For Vision OCR (strategy 2):
      pip install pyobjc-framework-Vision pyobjc-framework-Quartz

Usage:
  python wechat_scraper_mac.py
  python wechat_scraper_mac.py --scrolls 20 --output prompt.txt
  python wechat_scraper_mac.py --screenshots-only --output screenshots/
"""

import argparse
import subprocess
import sys
import tempfile
import time
from pathlib import Path


# ---------------------------------------------------------------------------
# AppleScript helpers
# ---------------------------------------------------------------------------

def _osascript(script: str, timeout: int = 30) -> tuple[str, str]:
    r = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True, text=True, timeout=timeout,
    )
    return r.stdout.strip(), r.stderr.strip()


def wechat_running() -> bool:
    out, _ = _osascript('tell application "System Events" to (exists process "WeChat")')
    return out.lower() == "true"


def accessibility_enabled() -> bool:
    out, _ = _osascript('tell application "System Events" to UI elements enabled')
    return out.lower() == "true"


def focus_wechat() -> None:
    _osascript('tell application "WeChat" to activate')
    time.sleep(0.6)


def get_window_bounds() -> tuple[int, int, int, int] | None:
    """Return (x, y, w, h) of WeChat's front window."""
    out, err = _osascript("""
    tell application "System Events"
        tell process "WeChat"
            set w to front window
            set {px, py} to position of w
            set {pw, ph} to size of w
            return (px as text) & "," & (py as text) & "," & (pw as text) & "," & (ph as text)
        end tell
    end tell
    """)
    if not out or "," not in out:
        return None
    try:
        x, y, w, h = [int(v) for v in out.split(",")]
        return x, y, w, h
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Strategy 1: Accessibility text extraction
# ---------------------------------------------------------------------------

def extract_via_accessibility() -> list[str]:
    """
    Walk WeChat's accessibility tree and collect all AXStaticText values.
    Returns a list of text strings (may include UI labels, not just messages).
    Times out after 45 s — WeChat's tree can be large.
    """
    script = """
    tell application "System Events"
        tell process "WeChat"
            set output to {}
            set w to front window
            try
                set allElems to entire contents of w
                repeat with elem in allElems
                    try
                        if class of elem is static text then
                            set v to value of elem
                            if v is not missing value and v is not "" then
                                set end of output to v
                            end if
                        end if
                    end try
                end repeat
            end try
            set AppleScript's text item delimiters to "\n"
            set r to output as text
            set AppleScript's text item delimiters to ""
            return r
        end tell
    end tell
    """
    try:
        out, err = _osascript(script, timeout=45)
    except subprocess.TimeoutExpired:
        print("  Accessibility scan timed out.", file=sys.stderr)
        return []

    if not out:
        return []
    lines = [ln.strip() for ln in out.splitlines() if ln.strip()]
    return lines


# ---------------------------------------------------------------------------
# Strategy 2 & 3: Screenshot + optional Vision OCR
# ---------------------------------------------------------------------------

def chat_region(win_x: int, win_y: int, win_w: int, win_h: int) -> tuple[int, int, int, int]:
    """
    Estimate the chat message area within the WeChat window.
    From the screenshot layout:
      - Left sidebar ≈ 350 px
      - Right info panel ≈ 280 px (only when open)
      - Top toolbar ≈ 60 px
      - Bottom input ≈ 110 px
    Adjust these constants if your window looks different.
    """
    LEFT_SIDEBAR = 350
    RIGHT_PANEL  = 280
    TOP_BAR      = 60
    BOTTOM_BAR   = 110

    cx = win_x + LEFT_SIDEBAR
    cy = win_y + TOP_BAR
    cw = win_w - LEFT_SIDEBAR - RIGHT_PANEL
    ch = win_h - TOP_BAR - BOTTOM_BAR
    return cx, cy, max(cw, 100), max(ch, 100)


def screenshot_region(x: int, y: int, w: int, h: int, path: str) -> bool:
    r = subprocess.run(
        ["screencapture", "-x", "-R", f"{x},{y},{w},{h}", path],
        capture_output=True,
    )
    return r.returncode == 0


def scroll_up_page(n_pages: int = 1) -> None:
    """Scroll WeChat chat up by sending Page-Up key events."""
    script = f"""
    tell application "System Events"
        tell process "WeChat"
            set frontmost to true
        end tell
        repeat {n_pages} times
            key code 116  -- Page Up
            delay 0.15
        end repeat
    end tell
    """
    _osascript(script)


def scroll_to_bottom() -> None:
    """Scroll WeChat chat back to the bottom (Cmd+Down)."""
    _osascript("""
    tell application "System Events"
        tell process "WeChat"
            set frontmost to true
        end tell
        key code 125 using {command down}
    end tell
    """)


def ocr_vision(image_path: str) -> str:
    """OCR an image using macOS Vision framework. Requires pyobjc."""
    try:
        import Vision   # pyobjc-framework-Vision
        import Quartz   # pyobjc-framework-Quartz

        url = Quartz.NSURL.fileURLWithPath_(image_path)
        handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, None)
        req = Vision.VNRecognizeTextRequest.alloc().init()
        req.setRecognitionLanguages_(["zh-Hans", "zh-Hant", "en"])
        req.setRecognitionLevel_(1)  # Accurate
        req.setUsesLanguageCorrection_(True)

        error = handler.performRequests_error_([req], None)
        lines = []
        for obs in (req.results() or []):
            candidates = obs.topCandidates_(1)
            if candidates:
                lines.append(candidates[0].string())
        return "\n".join(lines)

    except ImportError:
        return ""   # caller will check for empty string
    except Exception as e:
        print(f"  Vision OCR error: {e}", file=sys.stderr)
        return ""


def vision_available() -> bool:
    try:
        import Vision  # noqa: F401
        import Quartz  # noqa: F401
        return True
    except ImportError:
        return False


# ---------------------------------------------------------------------------
# Deduplication helpers
# ---------------------------------------------------------------------------

def deduplicate(lines: list[str]) -> list[str]:
    """Remove duplicate adjacent lines while preserving order."""
    seen: set[str] = set()
    out: list[str] = []
    for ln in lines:
        if ln not in seen:
            seen.add(ln)
            out.append(ln)
    return out


# ---------------------------------------------------------------------------
# Prompt builder (for pasting into claude.ai)
# ---------------------------------------------------------------------------

PROMPT_TEMPLATE = """\
Please summarize this WeChat group chat. Structure your response as:

# WeChat Chat Summary
## Overview
## Key Topics & Discussions
## Decisions & Action Items
## Important Details (dates, links, plans mentioned)
## Tone & Dynamics
## Open Questions / Follow-ups

Be specific about names, dates, and facts.

---
{chat_text}
---
"""


def build_prompt(lines: list[str]) -> str:
    return PROMPT_TEMPLATE.format(chat_text="\n".join(lines))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape the visible WeChat chat on macOS and build a claude.ai prompt."
    )
    parser.add_argument(
        "--scrolls", type=int, default=15,
        help="Number of Page-Up scrolls to capture (default: 15). "
             "Each scroll ≈ one screen of messages.",
    )
    parser.add_argument(
        "--output", default="wechat_prompt.txt",
        help="File to save the prompt (default: wechat_prompt.txt). "
             "Pass a directory with --screenshots-only to save images there.",
    )
    parser.add_argument(
        "--screenshots-only", action="store_true",
        help="Skip OCR/accessibility — just save screenshots for manual upload to claude.ai.",
    )
    parser.add_argument(
        "--no-accessibility", action="store_true",
        help="Skip Accessibility API and go straight to screenshot mode.",
    )
    args = parser.parse_args()

    # ── Pre-flight checks ──────────────────────────────────────────────────
    if not wechat_running():
        print("✗ WeChat is not running. Please open it and navigate to the chat.", file=sys.stderr)
        sys.exit(1)

    if not accessibility_enabled():
        print(
            "✗ Accessibility access is disabled.\n"
            "  Enable it: System Preferences → Privacy & Security → Accessibility → ✓ Terminal",
            file=sys.stderr,
        )
        sys.exit(1)

    focus_wechat()

    bounds = get_window_bounds()
    if bounds is None:
        print("✗ Could not get WeChat window bounds.", file=sys.stderr)
        sys.exit(1)

    win_x, win_y, win_w, win_h = bounds
    cx, cy, cw, ch = chat_region(win_x, win_y, win_w, win_h)
    print(f"  WeChat window: {win_w}×{win_h} at ({win_x},{win_y})", file=sys.stderr)
    print(f"  Chat area:     {cw}×{ch} at ({cx},{cy})", file=sys.stderr)

    collected_lines: list[str] = []

    # ── Strategy 1: Accessibility ──────────────────────────────────────────
    if not args.no_accessibility and not args.screenshots_only:
        print("\n[1/2] Trying Accessibility API...", file=sys.stderr)
        a11y_lines = extract_via_accessibility()
        if a11y_lines:
            print(f"  Got {len(a11y_lines)} text elements.", file=sys.stderr)
            collected_lines.extend(a11y_lines)
        else:
            print("  No text found via accessibility (WeChat may use non-native views).",
                  file=sys.stderr)

    # ── Strategy 2/3: Screenshot scroll ───────────────────────────────────
    use_ocr = vision_available() and not args.screenshots_only
    mode_label = "Screenshot + Vision OCR" if use_ocr else "Screenshots"

    if args.screenshots_only:
        out_dir = Path(args.output) if Path(args.output).suffix == "" else Path("wechat_screenshots")
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n[2/2] {mode_label} → saving to {out_dir}/", file=sys.stderr)
    else:
        print(f"\n[2/2] {mode_label}...", file=sys.stderr)

    if not use_ocr and not args.screenshots_only:
        print("  pyobjc not found — install with: pip install pyobjc-framework-Vision pyobjc-framework-Quartz",
              file=sys.stderr)
        print("  Falling back to screenshots only.", file=sys.stderr)

    # Scroll to bottom first so we start from the most recent messages
    scroll_to_bottom()
    time.sleep(0.5)

    screenshot_paths: list[str] = []
    ocr_lines: list[str] = []

    with tempfile.TemporaryDirectory() as tmpdir:
        for i in range(args.scrolls + 1):
            if i > 0:
                scroll_up_page(1)
                time.sleep(0.4)   # let the UI settle

            if args.screenshots_only:
                img_path = str(out_dir / f"screen_{i:03d}.png")
            else:
                img_path = str(Path(tmpdir) / f"screen_{i:03d}.png")

            ok = screenshot_region(cx, cy, cw, ch, img_path)
            if not ok:
                print(f"  Screenshot {i} failed.", file=sys.stderr)
                continue

            screenshot_paths.append(img_path)
            print(f"  Screen {i+1}/{args.scrolls+1}", end="\r", file=sys.stderr)

            if use_ocr:
                text = ocr_vision(img_path)
                if text:
                    ocr_lines.extend(text.splitlines())

        print(file=sys.stderr)  # newline after \r progress

        if use_ocr:
            collected_lines.extend(ocr_lines)

    # Scroll back to bottom so the user's WeChat is in the same state
    scroll_to_bottom()

    # ── Output ─────────────────────────────────────────────────────────────
    if args.screenshots_only:
        print(f"\n✓ {len(screenshot_paths)} screenshots saved to: {out_dir}/", file=sys.stderr)
        print("  → Upload them to claude.ai and ask it to summarize the chat.", file=sys.stderr)
        return

    if not collected_lines:
        print(
            "\n✗ No text was captured. Try:\n"
            "  1. pip install pyobjc-framework-Vision pyobjc-framework-Quartz  (for OCR)\n"
            "  2. python wechat_scraper_mac.py --screenshots-only  (save images instead)",
            file=sys.stderr,
        )
        sys.exit(1)

    clean = deduplicate(collected_lines)
    print(f"\n  Collected {len(clean)} unique text lines.", file=sys.stderr)

    prompt = build_prompt(clean)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(prompt, encoding="utf-8")

    print(f"✓ Prompt saved to: {out_path.resolve()}", file=sys.stderr)
    print("  → Open claude.ai, start a new chat, and paste the file contents.", file=sys.stderr)


if __name__ == "__main__":
    main()
