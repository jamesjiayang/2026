/**
 * Local-First Storage Management.
 * Provides offline persistence via localStorage and IndexedDB fallback,
 * along with JSON import/export matching the system's my_deck.json schema.
 */

import { getTodayStr } from './leitner.js';

const STORAGE_DECK_KEY = 'flashcard_master_deck_v1';
const STORAGE_SETTINGS_KEY = 'flashcard_settings_v1';

export const INITIAL_SAMPLE_DECK = {
  "deck_id": "master-deck",
  "name": "CS & Distributed Systems",
  "version": 1,
  "last_synced": new Date().toISOString(),
  "cards": [
    {
      "id": "75983618-81b5-4933-9529-713234da8331",
      "question": "Define or explain Distributed Systems Fundamentals:",
      "answer": "A distributed system is a collection of autonomous computing entities that communicate over a network to achieve a common goal.",
      "box_number": 1,
      "last_reviewed": getTodayStr(),
      "next_review_date": getTodayStr(),
      "category": "Computer Science",
      "subcategory": "Distributed Systems",
      "tags": ["distributed-systems", "fundamentals", "doc-sample-1"],
      "source_document_id": "doc-sample-1"
    },
    {
      "id": "b37d3a84-6dd2-461e-acee-2a89fef06614",
      "question": "What is the CAP Theorem?",
      "answer": "Formulated by Eric Brewer, it states that any distributed data store can only simultaneously provide at most two of three guarantees: Consistency, Availability, and Partition Tolerance.",
      "box_number": 1,
      "last_reviewed": getTodayStr(),
      "next_review_date": getTodayStr(),
      "category": "Computer Science",
      "subcategory": "CAP Theorem",
      "tags": ["distributed-systems", "cap-theorem"],
      "source_document_id": "doc-sample-1"
    },
    {
      "id": "da50a072-8488-4a09-b35d-460f43d19f1a",
      "question": "In the CAP Theorem, what does Consistency mean?",
      "answer": "Every read operation receives the most recent write or an error.",
      "box_number": 1,
      "last_reviewed": getTodayStr(),
      "next_review_date": getTodayStr(),
      "tags": ["distributed-systems", "consistency"],
      "source_document_id": "doc-sample-1"
    },
    {
      "id": "da9ec176-84c7-4ea4-86e5-404cfcbe6b40",
      "question": "In the CAP Theorem, what does Availability mean?",
      "answer": "Every request receives a non-error response, without a guarantee that it contains the most recent write.",
      "box_number": 1,
      "last_reviewed": getTodayStr(),
      "next_review_date": getTodayStr(),
      "tags": ["distributed-systems", "availability"],
      "source_document_id": "doc-sample-1"
    },
    {
      "id": "bbf7c73c-ca82-4d38-a186-b03df41f138a",
      "question": "What happens to a card in Leitner Box 2 when answered correctly?",
      "answer": "It is promoted to Box 3, increasing its review interval from 3 days to 7 days.",
      "box_number": 2,
      "last_reviewed": getTodayStr(),
      "next_review_date": getTodayStr(),
      "category": "Learning Theory",
      "subcategory": "Spaced Repetition",
      "tags": ["learning-theory", "leitner"],
      "source_document_id": null
    },
    {
      "id": "8ea04c10-0c98-44d6-89c9-af416b0709fc",
      "question": "What happens to a flashcard in the Leitner system when answered incorrectly?",
      "answer": "It is immediately demoted back to Box 1 for daily review regardless of its prior box number.",
      "box_number": 3,
      "last_reviewed": getTodayStr(),
      "next_review_date": getTodayStr(),
      "category": "Learning Theory",
      "subcategory": "Spaced Repetition",
      "tags": ["learning-theory", "leitner"],
      "source_document_id": null
    },
    {
      "id": "0ac83c00-0c36-4583-9307-890c97b78903",
      "question": "What are the three possible states of a node in the Raft consensus algorithm?",
      "answer": "Follower, Candidate, and Leader.",
      "box_number": 3,
      "last_reviewed": getTodayStr(),
      "next_review_date": getTodayStr(),
      "category": "Computer Science",
      "subcategory": "Consensus",
      "tags": ["raft", "consensus"],
      "source_document_id": null
    }
  ]
};

export function loadDeck() {
  try {
    const raw = localStorage.getItem(STORAGE_DECK_KEY);
    if (!raw) {
      saveDeck(INITIAL_SAMPLE_DECK);
      return JSON.parse(JSON.stringify(INITIAL_SAMPLE_DECK));
    }
    const deck = JSON.parse(raw);
    if (!deck.cards || !Array.isArray(deck.cards)) {
      deck.cards = [];
    }
    return deck;
  } catch (err) {
    console.error('Failed to parse stored deck from localStorage:', err);
    return JSON.parse(JSON.stringify(INITIAL_SAMPLE_DECK));
  }
}

export function saveDeck(deck) {
  try {
    deck.version = (deck.version || 1) + 1;
    deck.last_synced = new Date().toISOString();
    localStorage.setItem(STORAGE_DECK_KEY, JSON.stringify(deck));
    return true;
  } catch (err) {
    console.error('Failed to save deck to localStorage:', err);
    return false;
  }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {
      geminiApiKey: '',
      googleClientId: '',
      theme: 'dark'
    };
  } catch (e) {
    return { geminiApiKey: '', googleClientId: '', theme: 'dark' };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.error('Failed to save settings:', e);
    return false;
  }
}

export function exportDeckJson(deck) {
  const jsonStr = JSON.stringify(deck, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my_deck.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importDeckJson(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.cards)) {
      throw new Error('Invalid deck JSON structure: missing "cards" array');
    }
    saveDeck(parsed);
    return parsed;
  } catch (err) {
    throw new Error('Failed to import deck JSON: ' + err.message);
  }
}
