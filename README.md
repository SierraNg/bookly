# Bookly

Spaced repetition for the key ideas in your nonfiction books. 351 books, 1,995 cards, works offline.

## Install on your phone

**iPhone:** open the web app link in Safari, tap Share, then **Add to Home Screen**. Bookly opens full screen from its icon and works offline.

**Android:** download `Bookly.apk` from the latest release and open it. Android asks once to allow installs from your browser or Files app. New versions install over the old one and keep your progress. (Adding the web app to your home screen from Chrome also works.)

## Where your data lives

Progress, edits and new books are stored on your phone. Use **Progress → Backup → Save** now and then, and **Restore** to move to a new phone.

## Sync from your Google Sheet

**Progress → Sync from Sheet** reads the Books and Cards tabs. The Sheet must be shared as *Anyone with the link: Viewer*. Edits update cards, new rows add cards, and `Drop` in the *Your verdict* column removes a card.

## How it's built

- `src/retain.html` is the original claude.ai version. `python3 build.py src/retain.html` turns it into the phone app in `www/` (local storage, offline cache, Sheet sync over the read link, backup).
- `www/` is published to GitHub Pages by `.github/workflows/pages.yml`.
- `android/` is a Capacitor wrapper. `.github/workflows/android.yml` builds a signed APK and attaches it to a release on every change.
- After editing anything in `www/`, bump `VERSION` in `www/sw.js` so installed copies pick up the update.
