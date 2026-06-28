# 🎵 Game Scoring System — Setup Guide

**For non-technical organizers. Follow these steps exactly and you'll be live in under 15 minutes.**

---

## What You'll Need

- A Google Account (Gmail)
- A computer with Chrome browser
- 10–15 minutes

---

## Step 1: Create the Google Sheet

1. Open [Google Sheets](https://sheets.google.com) and click **+ New spreadsheet**
2. Name it: `Game Scoring System` (or your event name)
3. Keep this tab open — you'll need the spreadsheet URL later

---

## Step 2: Set Up the Google Apps Script

1. In your spreadsheet, click the menu: **Extensions → Apps Script**
2. A new tab opens showing a code editor
3. **Delete all existing code** in the editor (Ctrl+A, then Delete)
4. Open the file `backend/google-apps-script.js` from this project folder
5. **Copy all the code** and paste it into the Apps Script editor
6. Click the **Save** button (💾 icon or Ctrl+S)
7. Name the project: `Game Scoring System`

---

## Step 3: Run First-Time Setup

1. In the Apps Script editor, find the function dropdown (top bar, shows `myFunction` or `doGet`)
2. **Change it to `setupSpreadsheet`**
3. Click the **Run** button (▶️)
4. A popup asks for permissions — click **Review permissions**
5. Choose your Google account
6. Click **Advanced** → **Go to Game Scoring System (unsafe)** → **Allow**
7. Wait a few seconds — the script will create all 8 sheets in your spreadsheet

✅ **Your spreadsheet should now have these sheets:**
`Settings · Players · Teams · Team Members · Scores · Master Scoreboard · Finals · Event Log`

---

## Step 4: Deploy as a Web App

1. In the Apps Script editor, click **Deploy → New deployment**
2. Click the gear icon ⚙️ next to "Select type" and choose **Web app**
3. Fill in:
   - **Description:** `Game Scoring API`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Click **Deploy**
5. **Copy the Web App URL** — it looks like:
   `https://script.google.com/macros/s/AKfycb.../exec`

> ⚠️ **Save this URL!** You will need it in Step 5.

---

## Step 5: Connect the Web App to the Frontend

1. Open `index.html` from this project folder in Chrome
2. Click **Settings** (⚙️) in the navigation
3. Paste your Web App URL into the **"Google Apps Script URL"** field
4. Click **Connect**
5. You should see: ✅ Connected!

---

## Step 6: Configure Your Event Settings

Click **Settings → Activate Admin** and enter password: `admin123`

Then configure:

| Setting | Example Value |
|---------|---------------|
| Event Name | Antakshari 2025 |
| Number of Teams | 4 |
| Members Per Team | 6 |
| Number of Games | 3 |
| Rounds Per Game | 3 |
| Default Timer (sec) | 60 |
| Finalists Count | 2 |

---

## Step 7: Set Up Teams

1. Go to **Team Generator** page
2. Click **Edit Teams**
3. Enter team names (e.g. Sur, Taal, Raag, Lay) and pick colors
4. Click **Save Teams**

---

## Step 8: Register Players & Add Bulk Pre-registered Lists

You can add pre-registered players into the system prior to the event (irrespective of whether they are present at the venue yet):

### Option A: Bulk Import via Web App (Recommended)
1. Go to **Team Generator** page (Admin mode).
2. Click **📥 Bulk Import**.
3. Paste your entire list of registered players (one per line, e.g., `Name, Gender, Age, Mobile`).
4. Leave the "Mark as Present" unchecked so they remain registered but unassigned until they arrive at the venue!
5. Click **Import Players**.

### Option B: Direct Copy-Paste in Google Sheets
1. Open your connected Google Sheet.
2. Go to the **Players** tab.
3. Paste all registered names under `PlayerName`, `Gender`, `Age`, and `Mobile` columns. Leave `Present` as `No`.
4. Return to the Web App and refresh!

### On Event Day:
1. Simply toggle the switch next to each player's name as they arrive to mark them **Present**.
2. Click **Generate Teams** → **Save Assignments**.


---

## How to Use on Event Day

### Morning (Before Event)

1. Open `index.html` in Chrome
2. Activate Admin mode (Settings → Admin password)
3. Mark players as Present as they arrive
4. Generate Teams and share WhatsApp message

### During Games

1. Go to **Score Entry**
2. Select Game → Round → Sub-Round
3. Tap the team name → enter scores → Save
4. Live Scoreboard updates automatically

### Timer

- Click the ⏱️ gold button (bottom right) any time from any page
- **Space bar** = start/pause timer
- Last 10 seconds play a flashing animation automatically

### Finals

1. Go to **Finals** page
2. Top teams are auto-qualified (based on Finalists Count setting)
3. Adjust manually if needed
4. Click **"Reveal Winners!"** for the ceremony

---

## Sharing Results

### WhatsApp Teams
1. Go to **Team Generator** → **Share** button
2. Copy the text OR download the image

### Reports
1. Go to **Reports** page
2. Click **Print** for any report
3. Use Chrome's Print dialog → Save as PDF

---

## Admin Password

Default password: `admin123`

To change it: Settings → scroll to find `ADMIN_PASSWORD` → change value

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause timer |
| `F` | Open timer fullscreen |
| `Esc` | Close overlay / modal |
| `1` | Go to Dashboard |
| `2` | Go to Scoreboard |
| `3` | Go to Score Entry |
| `4` | Go to Team Generator |
| `5` | Go to Timer |
| `T` | Toggle Dark/Light mode |
| `P` | Toggle Projector mode |

---

## Projector Mode

Click the 📽️ button in the top bar. Scoreboard text becomes very large and high-contrast — perfect for a TV or projector screen.

---

## Offline Mode

The app works without internet after the first load:
- Last-known scores are cached locally
- New score entries are queued and sync when connection returns
- A red banner appears when you're offline

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "GAS URL not configured" | Go to Settings and paste your Web App URL |
| "Connection failed" | Check that the script is deployed with "Anyone" access |
| Scoreboard not updating | Click 🔄 Refresh, or wait for auto-refresh |
| Admin button not working | Clear browser session: open Settings → Deactivate → re-activate |
| Scores not saving offline | They're queued — they'll sync when back online |
| Need to redo team assignments | Team Generator → Reset Teams |

---

## File Structure (For Developers)

```
Game Scoring System/
├── index.html              ← Open this in Chrome
├── style.css               ← All styling
├── app.js                  ← Core state + router + timer + sounds
├── pages/
│   ├── dashboard.js        ← Event dashboard
│   ├── team-generator.js   ← Player & team management
│   ├── score-entry.js      ← Score input with undo
│   ├── live-scoreboard.js  ← Live rankings
│   ├── finals.js           ← Finals ceremony
│   ├── timer-page.js       ← Timer controls
│   ├── reports.js          ← Print/CSV reports
│   └── settings.js         ← Configuration
└── backend/
    └── google-apps-script.js  ← Paste into Apps Script
```

---

## Reusing for Other Events

This system works for **any competition** — just change these settings:

- **Event Name** → Quiz Night / Tambola / Sports Day
- **Num Games / Rounds** → adjust to your format
- **Timer** → different per game type
- **Positive/Negative Marks** → your scoring rules

Everything else adjusts automatically. No code changes needed.

---

*Built with ❤️ for Antakshari and all indoor competitions*
