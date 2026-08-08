# Aura — Migraine Diary

A low-glare, distraction-free web app for logging migraine episodes, spotting
triggers, and tracking pain trends over time. Built for Task 1 of your
self-learning project (research → plan → build → add tracking features),
with Firebase for authentication and data storage.

## What's included

- `index.html` — app structure (auth screen + dashboard)
- `style.css` — the visual design (dark, low-glare theme by design, since
  bright screens can worsen migraines)
- `app.js` — all the logic: sign-in/sign-up, saving entries, live updates,
  stats, the trend chart, and the "sky diary" (a 14-day glowing dot view,
  brightness/color = pain level)
- `firebase-config.js` — where your Firebase project credentials go
- `firestore.rules` — security rules so each user can only see their own data

## 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**.
2. Once created, click the **</>** (Web) icon to register a web app. You don't need Firebase Hosting for this step — just register the app.
3. Copy the `firebaseConfig` object it gives you.
4. Paste those values into `firebase-config.js` in this folder, replacing the placeholders.

## 2. Turn on Authentication

1. In the Firebase console, go to **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password**.

## 3. Turn on Firestore

1. Go to **Build → Firestore Database → Create database**.
2. Start in **test mode** to begin (you'll lock it down next).
3. Once created, go to the **Rules** tab and paste in the contents of `firestore.rules` from this folder, then **Publish**. This makes sure each signed-in user can only read and write their own entries.

## 4. Run it locally

Because this uses ES modules (`type="module"`), you need to serve the files
over HTTP rather than opening `index.html` directly from disk. From this folder, run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

Any static server works — `npx serve`, VS Code's Live Server extension, etc.

## 5. Deploy it (optional)

The easiest option is **Firebase Hosting**, since you're already using Firebase:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # choose this folder as your public directory
firebase deploy
```

Netlify or Vercel also work — just drag-and-drop this folder in.

## How the data is structured

Each entry is stored at:

```
users/{your-uid}/entries/{entryId}
{
  date: "2026-07-13",
  startTime: "14:30",
  duration: 4,
  pain: 7,
  symptoms: ["Nausea", "Light sensitivity"],
  triggers: ["Poor sleep", "Stress"],
  sleepHours: 5.5,
  stress: 4,
  relief: "Advil, dark room",
  notes: "Started after a bad night's sleep",
  createdAt: <server timestamp>
}
```

## Where to go from here (matches your project's next steps)

- **Wireframes / layout tweaks** — the dashboard grid in `index.html` is a
  good place to reorganize cards if you want a different layout.
- **More charts** — Chart.js is already loaded, so adding e.g. a
  sleep-vs-pain scatter plot is mostly a new `<canvas>` + a new function
  in `app.js` modeled on `renderTrendChart()`.
- **Mobile app** — since your notes mention this as a natural next step,
  the Firestore structure here (per-user `entries` subcollection) will
  drop straight into a Flutter or React Native app using the same Firebase
  project, no data migration needed.
