# Polyglot Flashcard System — Progressive Web App (PWA)

A modern, serverless **Progressive Web App (PWA)** implementing a Flashcard System:
- **Zero Backend Required**: Runs directly in the browser on desktop PCs, laptops, iPads, iPhones, and Android devices.
- **Leitner Spaced Repetition Engine**: Complete 5-box algorithm with scheduled review intervals (1, 3, 7, 14, 30 days).
- **Google Drive Cloud Sync**: Directly syncs `my_deck.json` to/from Google Drive via Google Identity Services (OAuth 2.0) and the Google Drive REST API v3.
- **Google Gemini 3.6 AI**: Client-side AI card generation from source text/notes, plus intelligent answer grading and feedback.
- **100% Offline Capability**: Uses Service Worker asset caching (`sw.js`) and browser storage (`localStorage`), installable to mobile home screen or PC desktop.
- **Schema Parity**: 100% compatible with the `my_deck.json` format used by the original Polyglot Flashcard System.

---

## Architecture Overview (Option A: PWA + Google Drive + Gemini)

```mermaid
flowchart TD
    subgraph Client [User Devices (PC & Mobile)]
        PWA[📱/🖥️ Progressive Web App<br/>HTML5 + Vanilla CSS + ES Modules]
        SW[⚙️ Service Worker & Cache<br/>100% Offline Capability]
        LocalStore[(Browser LocalStorage<br/>Local-First Master Deck)]
    end

    subgraph GoogleCloud [Google Cloud & APIs]
        Auth[Google Identity Services<br/>OAuth 2.0 Web Client]
        GDrive[(Google Drive REST API v3<br/>• my_deck.json<br/>• /documents)]
        Gemini[Google Gemini 3.6 API<br/>• Flashcard Generation<br/>• Answer Grading & Feedback]
    end

    PWA <--> SW
    PWA <--> LocalStore
    PWA <-->|OAuth 2.0 Auth| Auth
    PWA <-->|Sync my_deck.json| GDrive
    PWA <-->|AI Tutor & Generation| Gemini
```

---

## Quick Start (Local Testing)

### Option 1: Using npx serve or any static HTTP server
```powershell
cd C:\dev\source\2026\flashcard-system-progressive-web
npx serve . -p 3000
```
Open your browser at `http://localhost:3000`.

### Option 2: Using Python built-in HTTP server
```powershell
cd C:\dev\source\2026\flashcard-system-progressive-web
python -m http.server 3000
```
Open `http://localhost:3000`.

---

## Cloud Deployment Guide (Internet Access for PC & Mobile)

Because this app is 100% static, you can host it anywhere for **$0 / free**:

### 1. Google Sites / Google Workspace
1. Host the static assets on **Firebase Hosting** or **Google Cloud Storage** static web bucket:
   ```powershell
   firebase deploy --only hosting
   ```
2. Or embed the web app into your Google Site using the **Embed > Embed code** or URL widget.

### 2. GitHub Pages
1. Push this folder to a GitHub repository.
2. Go to **Settings > Pages** and select `main` branch root.
3. Your app will be live globally at `https://<username>.github.io/<repo-name>/`.

---

## Configuration: Google Drive OAuth & Gemini API Key

Click the **⚙️ Settings** icon in the app header:

### 1. Google Drive Sync Setup (Optional)
To enable multi-device sync across PC and mobile:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Drive API**.
3. Under **APIs & Services > Credentials**, click **Create Credentials > OAuth Client ID**.
4. Choose **Web application**.
5. Under **Authorized JavaScript origins**, add your deployment URL (e.g. `http://localhost:3000` for local testing, or your production domain).
6. Copy the **Client ID** and paste it into the **Settings > Google OAuth Client ID** field in the app.
7. Click **Sign in with Google**. Your `my_deck.json` will now sync automatically between devices!

### 2. Google Gemini API Key (Optional)
1. Get an API key from [Google AI Studio](https://aistudio.google.com/).
2. Paste it into **Settings > Gemini API Key**.
3. *(If omitted, the app uses its built-in intelligent heuristic tutor and generator for full offline capability).*

---

## Features & Keyboard Shortcuts

* **Spacebar**: Flip flashcard (Question ⟷ Answer).
* **1 or A**: Demote card to Leitner Box 1 (Again).
* **2 or G**: Advance card to next Leitner Box (Good).
* **3 or E**: Fast-track mastery (Easy).
* **Install PWA**: On mobile Safari/Chrome, tap **Share / More > Add to Home Screen** to install as a native fullscreen app.
