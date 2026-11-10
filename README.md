# Latter Day Notebook

A phone app for taking notes at church. Its layout follows a paper note-taking notebook, with three kinds of notes:

| Note | Pages | Fields |
|---|---|---|
| **Sunday** | *Sacrament Meeting* | On My Mind · On My Heart · Speakers (☐ Testimony Meeting) · Music (☐ Musical Number ☐ Primary Program) · Hymns / Songs · Notes / Impressions · For Later · Promptings / Takeaways · Hear Him |
| | *Second Hour* | Announcements · **First Block** and **Second Block**, each with its own Today's Class · Today's Lesson · Something I Loved · Notes / Impressions · Promptings / Takeaways · then Looking Forward · Call to Action (Read / Pray / Share about) |
| **Meeting** (General, Stake & Ward Conference) | *Meeting Notes* | Presiding · Conference · Session · Announcements · Speakers (each with their own notes) · Music · Notes / Impressions · Hear Him · For Later · Invitations / Promised Blessings · Biggest Takeaways · Call to Action |
| **Daily Study** (Seminary / Institute or Personal Study) | *Come, Follow Me* (one note per week) | This week's Come, Follow Me reading · This week's lesson · Teacher (Seminary / Institute) · a tab for each day (Mon–Fri for Seminary / Institute, Mon–Sun for Personal Study), each with Today's Scriptures · Notes / Impressions · Something I Loved · For Later · Promptings / Takeaways · Hear Him · then Biggest Takeaways · Call to Action |


Sunday and Meeting notes also have a date, time and location. A Daily Study note has a "Week of" date (starting Monday) and opens to today's tab. When **General Conference** is checked, the Session choices change to Saturday Morning / Afternoon / Evening and Sunday Morning / Afternoon.

## Features

- Saves as you type, and works offline once it has been opened (no signal needed in the chapel).
- Lined, auto-growing writing areas that look like the notebook.
- **Appearance** setting (bottom of the home screen): System, Light, Dark, or Paper (tan page, brown ink).
- Tap circles for **Hear Him**.
- Search all notes and filter by Sundays or Meetings.
- **Share** sends a note as plain text to Messages, email, Notes and similar apps.
- **Back up / Restore** saves all notes to a file and loads them back. Back up opens the phone's share sheet (choose Save to Files, Drive or email). On Android the file may be a `.txt`, because Android only shares certain file types. Restore accepts either `.json` or `.txt`. Backups don't work in the claude.ai preview.
- Empty notes are thrown away when you leave them.

Notes are stored **only on the phone** (in the browser's local storage). Nothing is sent anywhere. Back up now and then.

## Android app

There's also a native Android app, **LDNotebook**, that runs on its own instead of inside Chrome. That helps if an app blocker or screen-time tool blocks Chrome. Download the latest APK on your phone and open it to install:

https://github.com/Macx10sen/LDS-Notes/releases/latest/download/LDNotebook.apk

Android will ask you to allow installing apps from the browser or Files app you used to open it. The app loads this site, so updates arrive without reinstalling. Its notes are separate from Chrome's, so move them with **Back up notes** and **Restore backup**. See [`android/README.md`](android/README.md) for how it's built and signed.

## Install on a phone

The app is a Progressive Web App: plain HTML, CSS and JavaScript, with no build step and no app store.

1. Host the folder over HTTPS. The easiest way is GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / `(root)`**. The app is then at `https://<user>.github.io/LDS-Notes/`. (Pages on a private repo needs a paid GitHub plan; otherwise use any static host, such as Netlify or Cloudflare Pages.)
2. Open that link on the phone.
   - **iPhone (Safari):** Share button → **Add to Home Screen**.
   - **Android (Chrome):** ⋮ menu → **Add to Home screen** / **Install app**.
3. Open it from the home screen icon. It runs full-screen like a normal app.

## Develop

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

- `schema.js` is the layout of each note type. Add, remove or rename fields here.
- `app.js` holds storage, the screens, sharing and backup.
- `styles.css` is the notebook look.
- `sw.js` handles offline use. It uses the network when there's signal (waiting at most 3 seconds) and the saved copy otherwise. Bump `VERSION` when you change app files.
- Android's bottom gesture bar takes its color from `theme_color` in `manifest.webmanifest`, not from the Appearance setting. Chrome only picks up a change after an app update or a reinstall.
