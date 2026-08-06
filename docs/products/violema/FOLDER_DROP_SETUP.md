# Folder-drop ingestion — setup runbook

**What this turns on.** A platform-owned Google service account ("the reader")
gets read-only access to a workspace's `Violema Library` Drive folder. Once
shared, anything an operator hand-drops into that folder — PDF, DOCX, Markdown,
plain text, Google Docs — becomes sweepable evidence for every mission that
reads the library, without the operator naming or categorizing anything. See
`docs/superpowers/specs/2026-08-06-library-folder-drop-ingestion-design.md`
for the design; this doc is only the "make it live" checklist.

**Owner of every step below: Max.** Nothing here runs itself — the lane sits
`not_configured` (safe, inert, silent) until the key exists on the server.

---

## Blast radius — read this before handling the key

**One key, every customer.** The reader is a single platform-owned identity.
Every workspace that completes §4 grants *that one service account* Viewer
access to its `Violema Library` folder. So the private key in
`/root/violema-secrets/library-reader.json` is not "a credential for one
tenant" — it is a **read grant over every customer folder ever shared with the
reader, simultaneously**, usable from anywhere on the internet by anyone
holding the file. There is no per-tenant scoping between them, and no
rate limit or audit trail on Google's side that would flag a stolen key being
used from a laptop.

That is the entire justification for the handling discipline in §2, and none
of it is ceremony:

| Rule | What it stops |
| --- | --- |
| `/root/violema-secrets/`, `chmod 700` | Any non-root process on the box reading the directory |
| `library-reader.json`, `chmod 600` | Any non-root user reading the key itself |
| Outside `/var/www/nexus` | The key ever entering the git working tree |
| Path in `.env`, never contents | The key entering a backup, a log, or a note |
| Delete local copies after §5 | The key living on in Downloads or shell history |

The repo's `.gitignore` additionally covers `*-key.json`,
`*service-account*.json` and `library-reader*.json` as defense in depth. Treat
that as a backstop for a mistake, not as permission to keep a key in the tree.

If the key is ever exposed — pasted into a chat, committed, emailed, left on a
shared machine — treat it as compromised and run §6 (rotation) immediately.
Rotation is cheap and invisible to customers; assuming it was probably fine is
not.

---

## 0. Before you start

- A workspace must have connected Google Drive at least once already — that
  first connection is what creates the app-owned `Violema Library` root
  folder. The reader shares onto a folder that has to exist; there is nothing
  to share to for a workspace that has never touched Drive.
- You need `gcloud` authenticated to a GCP project you control, and root SSH
  access to the VPS (`violema.com`, app dir `/var/www/nexus`).
- Nothing in this doc, in `backend/.env`, or on the VPS should ever be pasted
  back into a note, a commit, or this repo. Path-only awareness — where the
  key lives, never what is inside it.

---

## 1. GCP: create the service account (~5 min)

No IAM roles are granted anywhere in this section — the reader's only access
to any customer's Drive data comes from that customer's folder share (§4).
The service account key by itself opens nothing.

**CLI:**

```bash
# Reuse an existing project or create one:
gcloud projects create violema-library-reader --name="Violema Library Reader"
gcloud config set project violema-library-reader   # or your existing project id

# Enable the Drive API — required for the REST calls the reader makes directly
# (files.list / files.get / files.get?alt=media / files.export); no other API
# is touched.
gcloud services enable drive.googleapis.com

# Create the service account — no --role flag, on purpose.
gcloud iam service-accounts create violema-library-reader \
  --display-name="Violema Library Reader"

# Create the JSON key. <project> is the project id from `gcloud config get-value project`.
gcloud iam service-accounts keys create reader-key.json \
  --iam-account=violema-library-reader@<project>.iam.gserviceaccount.com
```

`reader-key.json` now holds `client_email` / `private_key` — the two fields
`readDriveReaderConfig()` (`backend/src/integrationGateway/adapters/nativeDriveReader.ts`)
reads. That `client_email` is the address every workspace shares its folder
with (the product surfaces it — see §4; you never need to type it in by hand).

**Console-click equivalent:**

1. [console.cloud.google.com](https://console.cloud.google.com) → project
   picker → **New Project** (or select an existing one you control).
2. **APIs & Services → Library** → search "Google Drive API" → **Enable**.
3. **IAM & Admin → Service Accounts → Create Service Account** → name
   `violema-library-reader` → **Create and Continue** → skip the "Grant this
   service account access" step (leave it role-less) → **Done**.
4. Open the new service account → **Keys** tab → **Add Key → Create new key
   → JSON** → downloads `reader-key.json` to your machine.

---

## 2. VPS: land the key (~2 min)

```bash
# From your machine, with reader-key.json in the current directory:
ssh root@<vps-host> "mkdir -p /root/violema-secrets && chmod 700 /root/violema-secrets"
scp reader-key.json root@<vps-host>:/root/violema-secrets/library-reader.json
ssh root@<vps-host> "chmod 600 /root/violema-secrets/library-reader.json"

# Set the env var (path only — this command never prints the key).
# Idempotent on purpose: a bare `echo ... >> .env` run twice leaves TWO
# GOOGLE_LIBRARY_READER_KEY_FILE lines, and dotenv silently keeps the first,
# so a later "fix" appended to the bottom would have no effect at all and
# look like a mystery. Add the line only if the key is not already present.
ssh root@<vps-host> \
  "grep -q '^GOOGLE_LIBRARY_READER_KEY_FILE=' /var/www/nexus/backend/.env \
     || echo 'GOOGLE_LIBRARY_READER_KEY_FILE=/root/violema-secrets/library-reader.json' \
        >> /var/www/nexus/backend/.env"

# Confirm exactly one line, and that it points where you think it does:
ssh root@<vps-host> "grep -c '^GOOGLE_LIBRARY_READER_KEY_FILE=' /var/www/nexus/backend/.env"
```

If that count is anything but `1`, edit `/var/www/nexus/backend/.env` by hand
(`nano`, `vi`) and delete the duplicates before continuing.

Never commit the key, never place it under `/var/www/nexus` (the git working
tree), and never put its contents — only its path — in `backend/.env`.

**Check the backend process can actually read it.** The key is `chmod 600`
under `/root`, so only root can open it. That is correct *if* pm2 runs the
backend as root, and a silent failure if it does not — `readDriveReaderConfig()`
never throws, so an unreadable key is indistinguishable from no key at all:
the lane just sits at `not_configured` forever with nothing in the logs.

```bash
# Who does pm2 run the backend as?
ssh root@<vps-host> "pm2 jlist | python3 -c \"import sys,json; print([(p['name'], p['pm2_env'].get('username')) for p in json.load(sys.stdin)])\""

# Prove that user can read the key (substitute the username printed above):
ssh root@<vps-host> "sudo -u <username> test -r /root/violema-secrets/library-reader.json && echo READABLE || echo NOT-READABLE"
```

`READABLE` (or a `username` of `root`) and you are fine. `NOT-READABLE` means
the lane will never leave `not_configured`: either run the backend as root, or
move the key to a directory that user owns and keep the same `600` mode —
never widen the file to `644` to make this pass.

**Apply it:** a normal `deploy.sh` run picks this up automatically (the
backend calls `dotenv.config()` on boot). To apply it sooner without a full
deploy:

```bash
ssh root@<vps-host> "pm2 restart violema-backend"
```

Delete the local `reader-key.json` and any local copy of it once it is on the
VPS and confirmed working (§5) — do not leave it sitting in a Downloads
folder or shell history beyond that.

---

## 3. Local dev (~1 min)

Copy the same key file somewhere outside the repo (e.g. next to `backend/`,
not inside a directory git tracks — the working tree's `.gitignore` already
covers `.env` itself but do not rely on it for a stray key file), then in
`backend/.env`:

```
GOOGLE_LIBRARY_READER_KEY_FILE=/absolute/path/to/your/local/reader-key.json
```

Restart the backend dev server (`npm run dev:backend` or `npm run dev`) to
pick it up.

---

## 4. In-product: share + verify (~2 min per workspace)

The lane is per-server (one key, one reader identity) but the *share* is
per-workspace — each workspace's Drive folder owner has to grant that reader
access individually.

1. Sign in to the workspace → **Settings → Folder drop** card.
2. Status pill starts at **Needs share** once the key is live on the server
   (it was **Not configured** before §1–§2 landed).
3. Click **Share**. This calls `GOOGLEDRIVE_CREATE_PERMISSION` on the
   workspace's own Composio Drive connection to grant the reader **Viewer**
   on the `Violema Library` folder directly — no operator action needed in
   the common case.
   - If the card instead shows a manual-share prompt (copy: *"Share your
     Violema Library folder with the reader address below, then verify."*),
     use the **copy** button next to the reader email, open the
     `Violema Library` folder in Drive, **Share → paste the address → Viewer
     → Send** (or Share without notifying — either works), then come back.
4. Click **Verify**. On success the pill flips to **Active** (copy: *"Violema
   can see files you drop in your Violema Library folder."*) and a
   content-free audit event (`workspace.library_folder_share.enabled`:
   workspace id + folder id only) is recorded once, on the first transition.
5. Drop a test file into the `Violema Library` folder in Drive and run any
   mission with a library-read step — the review's Evidence section should
   show the file by name, linked back to Drive.

**Manual smoke test — do this once before rolling out to real operators.**
The share path (`GOOGLEDRIVE_CREATE_PERMISSION`) is confirmed present on the
live Composio `googledrive` toolkit and is what ships (see the design doc's
Deviations section below), but it is **not exercised by any automated test**
— the test environment has no `COMPOSIO_API_KEY`, so the share call is a fake
executor in CI. Before pointing real operators at this: pick one real
workspace with Drive connected, run through steps 1–5 above end to end, and
confirm (a) the Share button actually grants Viewer access in real Drive (not
just a 200 from the route) and (b) Verify flips to Active from a cold
`needs_share` state, not just a cached one.

---

## 5. Post-deploy verification (~5 min, every time this ships)

Two things are new enough in this feature's dependency chain that "the gates
were green" does not fully prove the VPS will behave the same way:

1. **Node version on the VPS satisfies `pdf-parse`'s engine range**
   (`>=20.16.0 <21 || >=22.3.0`). `deploy/deploy.sh` only installs Node when
   `command -v node` finds nothing — on a VPS that already has Node from an
   earlier deploy, the install step is skipped entirely, so a stale pre-20.16
   Node is never corrected by the deploy script itself. Check explicitly:

   ```bash
   ssh root@<vps-host> "node --version"
   ```

   If it's outside the range, update Node on the VPS before relying on PDF
   parsing (Markdown/text/DOCX/Google Docs are unaffected either way).

2. **PDF text extraction actually works on this host.** `pdf-parse`
   (2.4.5, class-based `PDFParse` API) resolves `@napi-rs/canvas` — a native
   binary — per platform via its own `optionalDependencies` mechanism.
   `getText()` still depends on it loading successfully. If that binary
   fails to resolve on the VPS's OS/arch, parsing does **not** crash the
   sweep — every affected PDF just degrades to
   `{ ok: false, reason: 'parse_failed' }`, surfaced to the operator as an
   unreadable-content gap, never a run failure. Confirm it's actually
   working (not silently degraded) after every deploy that touches
   `node_modules`:

   - Drop a PDF with distinctive text into a test workspace's
     `Violema Library` folder.
   - Run a mission with a library-read step.
   - Confirm the review's Evidence section shows that PDF's real extracted
     text (not a `contentError` / "content unreadable" gap).

---

## 6. Key rotation (~5 min, zero customer action)

**The one thing worth knowing up front: rotating the key does NOT change the
reader's identity.** A service account can hold several keys at once, and the
`client_email` belongs to the *account*, not to any key. Every workspace's
Drive share is granted to that email address — so a new key inherits every
existing share automatically. **No workspace has to re-share, nothing flips
back to `needs_share`, and no operator ever sees this happen.** That is what
makes rotation cheap enough to do on suspicion rather than on proof.

Rotate on any of: a suspected exposure, an operator/laptop offboarding, or a
routine cadence (annually is reasonable for a read-only grant).

```bash
# 1. Create a SECOND key on the SAME service account — do not delete the old
#    one yet, so a mistake in step 2 cannot take the lane down.
gcloud iam service-accounts keys create reader-key-new.json \
  --iam-account=violema-library-reader@<project>.iam.gserviceaccount.com

# 2. Land it over the old one. Same path, same mode — the env var does not
#    change, so nothing else on the box needs touching.
scp reader-key-new.json root@<vps-host>:/root/violema-secrets/library-reader.json
ssh root@<vps-host> "chmod 600 /root/violema-secrets/library-reader.json"

# 3. RESTART. This is not optional: readDriveReaderConfig() memoizes its
#    result for the lifetime of the process, so swapping the file's contents
#    without a restart leaves the backend happily using the OLD key — and
#    step 4 would then take the lane down with no obvious cause.
ssh root@<vps-host> "pm2 restart violema-backend"

# 4. Confirm the new key works BEFORE destroying the old one: open Settings →
#    Folder drop in a workspace that was Active, and confirm it still reads
#    Active. Then list the keys and delete the previous one by id.
gcloud iam service-accounts keys list \
  --iam-account=violema-library-reader@<project>.iam.gserviceaccount.com
gcloud iam service-accounts keys delete <old-key-id> \
  --iam-account=violema-library-reader@<project>.iam.gserviceaccount.com
```

Then delete `reader-key-new.json` from your machine, per §2.

If you skip step 4's confirmation and the new key is bad, the symptom is the
whole lane reporting `not_configured` (not `needs_share` — a broken platform
credential is deliberately never blamed on the operator). Re-check the file
landed intact and that the backend was restarted.

**Rotating the reader's *identity*** — a different service account, a
different `client_email` — is a different, much more expensive operation:
every workspace's existing share points at the old address, so every one of
them would land back at `needs_share` and need §4 run again. Don't do it as
part of a routine rotation; it is only warranted if the account itself is
compromised in a way a new key cannot fix.

---

## 7. Rollback

Folder-drop is additive and fails inert by design — turning it off never
breaks anything else in the library or a mission run.

```bash
# 1. Revoke the platform's own access (optional but recommended — closes the
#    credential entirely rather than just hiding it from the app):
gcloud iam service-accounts keys delete <key-id> \
  --iam-account=violema-library-reader@<project>.iam.gserviceaccount.com

# 2. Remove the env var on the VPS, then restart:
ssh root@<vps-host> \
  "sed -i '/^GOOGLE_LIBRARY_READER_KEY_FILE=/d' /var/www/nexus/backend/.env"
ssh root@<vps-host> "pm2 restart violema-backend"

# 3. Remove the key file itself:
ssh root@<vps-host> "rm -f /root/violema-secrets/library-reader.json"
```

With no key present, `readDriveReaderConfig()` returns `null`, every
workspace's lane reports `not_configured`, and `readLibrary` reverts to
exactly today's behavior — app-created entries only, no sweep, no warnings.
No per-workspace cleanup is required; nothing was written to any customer's
Drive by this feature except the share grant itself (which the operator can
independently revoke in Drive at any time — see the design doc's revocation
note).
