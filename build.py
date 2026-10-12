#!/usr/bin/env python3
"""Turn the claude.ai Bookly artifact (retain.html) into the standalone phone app in www/."""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).parent
src = pathlib.Path(sys.argv[1]).read_text()
SRC = ROOT / "src"

def rep(old, new, count=1):
    global src
    n = src.count(old)
    assert n == count, f"expected {count} of {old[:70]!r}, found {n}"
    src = src.replace(old, new)

# 1. Head: local fonts, PWA metadata, safe areas.
fonts = "\n".join(
    f'@font-face {{ font-family: "{fam}"; font-style: {sty}; font-weight: {w}; font-display: swap; src: url(fonts/{file}) format("woff2"); }}'
    for fam, sty, w, file in [
        ("Instrument Sans", "normal", 400, "instrument-sans-latin-400-normal.woff2"),
        ("Instrument Sans", "normal", 500, "instrument-sans-latin-500-normal.woff2"),
        ("Instrument Sans", "normal", 600, "instrument-sans-latin-600-normal.woff2"),
        ("Instrument Sans", "normal", 700, "instrument-sans-latin-700-normal.woff2"),
        ("Literata", "normal", 400, "literata-latin-400-normal.woff2"),
        ("Literata", "normal", 500, "literata-latin-500-normal.woff2"),
        ("Literata", "normal", 600, "literata-latin-600-normal.woff2"),
        ("Literata", "italic", 400, "literata-latin-400-italic.woff2"),
    ])
head_old = src[: src.index("<style>") + len("<style>")]
assert head_old.startswith("<title>Bookly</title>")
src = src.replace(head_old, f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#141318">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Bookly">
<meta name="description" content="Remember the key ideas from the books you read.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icons/icon-32.png">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<title>Bookly</title>
<style>
{fonts}
html, body {{ margin: 0; }}
body {{ overscroll-behavior-y: none; -webkit-tap-highlight-color: transparent; }}""", 1)
rep("</style>\n</head>" if "</style>\n</head>" in src else "</style>",
    ".screen { padding-top: calc(24px + env(safe-area-inset-top, 0px)); }\n"
    ".brandmark { display: flex; align-items: center; gap: 10px; }\n"
    ".brandmark img { width: 34px; height: 27px; display: block; }\n</style>\n</head>\n<body>")
src = src.rstrip() + "\n</body>\n</html>\n"

# 2. Local database instead of claude.ai storage.
rep("<script>\n(function () {", '<script src="localdb.js"></script>\n<script>\n(function () {')
rep('var use = window.claude && window.claude.use ? window.claude.use("db") : Promise.resolve(null);',
    "var use = window.BooklyDB;")
rep("Open Bookly from claude.ai while signed in. Your books, points and progress are saved there and sync to every device.",
    "Bookly couldn\\u2019t open its storage on this phone. Close the app fully and open it again. In a private browsing tab, open Bookly in a normal one instead.")
rep('function failSave(e) { var code = e && e.code; toast(code === "quota_exceeded" ? "Storage is full. Remove some books to add more." : code === "invalid_argument" ? "Only the owner can change this library." : "Could not save. Check your connection."); }',
    'function failSave(e) { var code = e && e.code; toast(code === "quota_exceeded" ? "Your phone is out of storage space." : "Could not save. Try again."); }')

# 3. Sheet sync over the Sheet's read link instead of the claude.ai connector.
a = src.index("  /* ---------- Sync from Google Sheet ---------- */")
b = src.index("  function cell(r, i)")
src = src[:a] + (SRC / "standalone.js").read_text() + src[b:]
rep('''    if (!S.db) return toast("Open Bookly from claude.ai to sync.");
    S.syncing = true; render();
    getMcp().then(function (mcp) {
      if (!mcp) throw { code: "not_granted" };
      return Promise.all([readRange(mcp, "Books!A1:K1000"), readRange(mcp, "Cards!A1:I6000")]);
    }).then(''', '''    if (!S.db) return toast("Your library is still loading.");
    S.syncing = true; render();
    Promise.all([readRange("Books", "A1:K1000"), readRange("Cards", "A1:I6000")]).then(''')

# 4. Logo in the header, install banner on Today, backup panel on Progress.
rep("""h += '<header class="brandrow"><h1 class="brand" style="margin:0">Bookly</h1></header>';""",
    """h += '<header class="brandrow"><h1 class="brand brandmark" style="margin:0"><img src="icons/mark.svg" alt="">Bookly</h1></header>' + installBanner();""")
rep('''(S.syncing ? "Reading…" : "Sync from Sheet") + "</button></div></section>";''',
    '''(S.syncing ? "Reading…" : "Sync from Sheet") + "</button></div></section>" + backupPanel();''')
rep("  /* ---------- Boot ---------- */", (SRC / "extras.js").read_text() + "  /* ---------- Boot ---------- */")

assert "claude.use" not in src and "getMcp" not in src and "fonts.googleapis" not in src
out = ROOT / "www" / "index.html"
out.write_text(src)
(ROOT / "www" / "localdb.js").write_text((SRC / "localdb.js").read_text())
print("wrote", out, len(src))
