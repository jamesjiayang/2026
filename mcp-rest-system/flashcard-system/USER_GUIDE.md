# Polyglot Flashcard System — User Guide

Welcome to the **Polyglot Flashcard System**! This guide walks you through starting, configuring, and using the system for automated AI flashcard generation, spaced-repetition study sessions, and SQLite/Google Drive storage management.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start (2 Steps)](#quick-start-2-steps)
3. [Interactive Menu Walkthrough](#interactive-menu-walkthrough)
   - [Option 1: Generate Flashcards from Documents](#option-1-generate-flashcards-from-documents)
   - [Option 2: Interactive Study Session (Spaced Repetition)](#option-2-interactive-study-session-spaced-repetition)
   - [Option 3: View Master Deck & Leitner Distribution](#option-3-view-master-deck--leitner-distribution)
   - [Option 4: Storage & Backup Management](#option-4-storage--backup-management)
4. [Configuration (Offline vs Cloud)](#configuration-offline-vs-cloud)
5. [Automated Verification & Testing](#automated-verification--testing)
6. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Prerequisites

- **Java 17+** (e.g. OpenJDK 25, 21, or 17)
- **Maven 3.6+**
- **Python 3.10+** (with virtual environment at `python-client/venv`)
- **PowerShell** (Windows)

---

## Quick Start (2 Steps)

### Step 1: Start the Java Data Service (Storage Guardian)
In your first terminal, launch the Java backend:

```powershell
.\start_java_service.bat
# Or: .\start_java_service.ps1
```
*Or manually via Maven:*
```powershell
cd java-data-service
mvn spring-boot:run
```

**What happens on startup**:
- Starts on `http://localhost:8080`.
- Automatically initializes the local transactional database at `./flashcards.db`.
- If the database is new, it seeds sample cards or hydrates from your Google Drive backup store.

---

### Step 2: Launch the Python CLI
In a second terminal, start the interactive interface:

```powershell
.\run_cli.bat
# Or: .\run_cli.ps1
```
*Or manually via virtual environment:*
```powershell
cd python-client
.\venv\Scripts\python.exe app\cli.py
```

You will see the main menu:

```text
╔════════════════════════════════════════════════════════════════════════════╗
║             POLYGLOT FLASHCARD SYSTEM (Python + Java + SQLite)             ║
║  AI LangGraph ◄──► SQLite (Local Transactional DB) ◄──► GDrive Docs/Backup ║
╚════════════════════════════════════════════════════════════════════════════╝
Connecting to Java Storage Layer at http://localhost:8080... [CONNECTED]

Main Menu:
  1. 📄 Generate Cards from Document (Workflow 1: Generation Graph)
  2. 🧠 Start Study Session          (Workflow 2: Study Session Graph)
  3. 📊 View Master Deck Status      (Leitner Distribution & Due Count)
  4. 💾 Storage & Backup Management  (SQLite & Google Drive Architecture)
  5. 🚪 Exit

Select an option [1-5]:
```

---

## Interactive Menu Walkthrough

### Option 1: Generate Flashcards from Documents
**LangGraph AI Pipeline (`Workflow 1`)**:
1. Select **`1`** from the main menu.
2. Enter the Document ID (default: `doc-sample-1` or any custom document filename stored in Google Drive / `drive_store/documents/`).
3. **Execution Steps**:
   - **Retrieve Node**: Java extracts raw unstructured text from Google Drive.
   - **Generate Node**: Gemini / AI Tutor drafts conceptual questions and answers.
   - **Review Node**: Gemini polishes cards for clarity and conciseness.
   - **Save Node**: Cards are committed transactionally to **SQLite** (`./flashcards.db`) and replicated to the **Google Drive** backup target.

---

### Option 2: Interactive Study Session (Spaced Repetition)
**Leitner Box State Machine (`Workflow 2`)**:
1. Select **`2`** from the main menu.
2. Java queries SQLite for all cards where `next_review_date <= today` using SQL indexes.
3. For each due card:
   - The question and current Leitner box number are displayed.
   - Type your answer and press `Enter`.
   - The AI Tutor evaluates correctness and gives constructive feedback.
4. **Leitner Box Progression**:
   - **Correct Answer**: Card advances to next box (up to Box 5) with exponential review interval:
     - *Box 1*: Review tomorrow (1 day)
     - *Box 2*: Review in 3 days
     - *Box 3*: Review in 7 days
     - *Box 4*: Review in 14 days
     - *Box 5*: Review in 30 days
   - **Incorrect Answer**: Resets immediately back to Box 1 for review tomorrow.
5. Updates are saved atomically to **SQLite** and replicated to **Google Drive**.

---

### Option 3: View Master Deck & Leitner Distribution
Select **`3`** to see real-time statistics:
- Total card count.
- Number of cards currently due for review.
- Visual ASCII bar charts of cards across Leitner Boxes 1 through 5.
- Last sync timestamp.

---

### Option 4: Storage & Backup Management
Select **`4`** to manage the hybrid storage engine:
- **Telemetry Display**: View current transactional database engine (SQLite), database file path, master deck version, and Google Drive connection status.
- **Action 1 (Manual Backup)**: Immediately exports an updated snapshot of SQLite to Google Drive (`POST /api/deck/backup`).
- **Action 2 (Disaster Recovery Restore)**: Restores the local SQLite database from the Google Drive backup target (`POST /api/deck/restore`).

---

## Configuration (Offline vs Cloud)

### 1. Zero-Config Mode (Default)
The system works **100% offline out-of-the-box**:
- Uses an intelligent built-in tutor simulator for AI card generation and grading.
- Uses a local drive simulator directory (`./drive_store/`) for documents and backup snapshots.

### 2. Live Google Gemini AI (Optional)
To use live Gemini models for card generation and grading:
1. Copy `python-client/.env.example` to `python-client/.env`.
2. Add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```

### 3. Live Google Drive Cloud Integration (Optional)
To connect live Google Drive instead of local simulated storage:
1. Place your Google Cloud service account JSON or OAuth client credentials at `java-data-service/credentials.json`.
2. In `java-data-service/src/main/resources/application.properties`:
   ```properties
   google.drive.enabled=true
   google.drive.credentials-path=./credentials.json
   ```

### 4. Custom SQLite Database Path (Optional)
In `java-data-service/src/main/resources/application.properties`:
```properties
sqlite.db.path=./flashcards.db
spring.datasource.url=jdbc:sqlite:${SQLITE_DB_PATH:./flashcards.db}
backup.auto-sync=true
```

---

## Automated Verification & Testing

You can run automated tests at any time to verify system health:

```powershell
# Run both Java unit tests and Python end-to-end integration tests
.\test_system.bat
# Or: .\test_system.ps1
```

Or run test suites independently:
```powershell
# 1. Java Unit Tests (SQLite schema, transactions, due-date indexing, backup/restore)
mvn -f java-data-service\pom.xml test

# 2. End-to-End Integration Suite (Full pipeline against live service)
.\python-client\venv\Scripts\python.exe python-client\app\test_e2e.py
```

---

## Troubleshooting & FAQ

### 1. "Java Data Service is not running on http://localhost:8080"
- Run `.\start_java_service.ps1` in a separate terminal.
- Check that port 8080 is not in use by another application.

### 2. "Document not found in drive store"
- Ensure the document exists in Google Drive or under `./drive_store/documents/` (e.g. `doc-sample-1.txt`).
- You can place any new text files directly into `./drive_store/documents/` and generate cards from them by entering their name in Option 1.

### 3. "How do I reset my deck to fresh state?"
- Go to Option 4 in the CLI and select `Restore SQLite Database from Google Drive Backup Target`, or delete `flashcards.db` and restart the Java service to re-seed from clean backup state.
