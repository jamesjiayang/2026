/**
 * Google Drive REST API v3 and Google Identity Services (GIS) Integration.
 * Manages OAuth 2.0 Web Client authentication, finding my_deck.json,
 * downloading the remote master deck, and uploading deck snapshots.
 */

import { extractDeckVocab } from './leitner.js';

let tokenClient = null;
let currentAccessToken = null;
let cachedFileId = null;

// Hydrate existing token from sessionStorage if valid
try {
  const saved = sessionStorage.getItem('gdrive_token');
  if (saved) currentAccessToken = saved;
} catch (e) {}

const DRIVE_FILE_NAME = 'my_deck.json';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function isGapiLoaded() {
  return typeof google !== 'undefined' && google.accounts && google.accounts.oauth2;
}

export function initGoogleAuth(clientId, onTokenReceived, onError) {
  if (!clientId || !clientId.trim()) {
    console.warn('Google Client ID not configured.');
    return false;
  }
  if (!isGapiLoaded()) {
    console.warn('Google Identity Services library not yet loaded in DOM.');
    return false;
  }

  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: DRIVE_SCOPE,
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          currentAccessToken = tokenResponse.access_token;
          try { sessionStorage.setItem('gdrive_token', currentAccessToken); } catch (e) {}
          if (onTokenReceived) onTokenReceived(currentAccessToken);
        } else if (tokenResponse && tokenResponse.error) {
          console.error('OAuth token error:', tokenResponse.error);
          if (onError) onError(tokenResponse.error);
        }
      },
    });
    return true;
  } catch (err) {
    console.error('Failed to initialize Google Token Client:', err);
    if (onError) onError(err);
    return false;
  }
}

export function requestDriveAuth() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized. Please configure your Google Client ID in Settings.'));
      return;
    }
    tokenClient.callback = (resp) => {
      if (resp && resp.access_token) {
        currentAccessToken = resp.access_token;
        try { sessionStorage.setItem('gdrive_token', currentAccessToken); } catch (e) {}
        resolve(currentAccessToken);
      } else if (resp && resp.error) {
        reject(new Error(resp.error_description || resp.error));
      } else {
        reject(new Error('Authentication cancelled'));
      }
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export function getCurrentToken() {
  if (!currentAccessToken) {
    try {
      currentAccessToken = sessionStorage.getItem('gdrive_token');
    } catch (e) {}
  }
  return currentAccessToken;
}

export function disconnectDrive() {
  currentAccessToken = null;
  cachedFileId = null;
  try { sessionStorage.removeItem('gdrive_token'); } catch (e) {}
}

export async function findDeckFile(accessToken = null) {
  const token = accessToken || getCurrentToken();
  if (!token) throw new Error('Not authenticated with Google Drive');

  const query = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,description)&spaces=drive`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!resp.ok) {
    if (resp.status === 401) disconnectDrive();
    throw new Error(`Drive search failed: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  if (data.files && data.files.length > 0) {
    cachedFileId = data.files[0].id;
    return data.files[0];
  }
  return null;
}

export async function downloadDeck(accessToken = null, fileId = null) {
  const token = accessToken || getCurrentToken();
  if (!token) throw new Error('Not authenticated with Google Drive');

  const targetId = fileId || cachedFileId || (await findDeckFile(token))?.id;
  if (!targetId) {
    return null; // File does not exist yet on Drive
  }

  cachedFileId = targetId;
  const url = `https://www.googleapis.com/drive/v3/files/${targetId}?alt=media`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!resp.ok) {
    if (resp.status === 401) disconnectDrive();
    throw new Error(`Drive download failed: ${resp.status} ${resp.statusText}`);
  }

  const deck = await resp.json();
  return deck;
}

export async function uploadDeck(deck, accessToken = null) {
  const token = accessToken || getCurrentToken();
  if (!token) throw new Error('Not authenticated with Google Drive');

  // Check if file already exists
  if (!cachedFileId) {
    const existing = await findDeckFile(token);
    if (existing) cachedFileId = existing.id;
  }

  const vocab = extractDeckVocab(deck);
  const fileContent = JSON.stringify(deck, null, 2);
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: DRIVE_FILE_NAME,
    mimeType: 'application/json',
    description: JSON.stringify(vocab)
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  let url, method;
  if (cachedFileId) {
    url = `https://www.googleapis.com/upload/drive/v3/files/${cachedFileId}?uploadType=multipart`;
    method = 'PATCH';
  } else {
    url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    method = 'POST';
  }

  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!resp.ok) {
    if (resp.status === 401) disconnectDrive();
    throw new Error(`Drive upload failed: ${resp.status} ${resp.statusText}`);
  }

  const result = await resp.json();
  cachedFileId = result.id;
  return result;
}

export async function updateFileDescription(fileId, description, accessToken = null) {
  const token = accessToken || getCurrentToken();
  if (!token || !fileId) return;

  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
    await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ description })
    });
  } catch (err) {
    console.warn('Could not update Drive file description:', err);
  }
}

export async function getDriveDeckVocab(accessToken = null) {
  const token = accessToken || getCurrentToken();
  if (!token) return null;

  try {
    const file = await findDeckFile(token);
    if (!file) return null;

    // 1. Instant check: read pre-indexed vocab from Drive file description without downloading cards
    if (file.description) {
      try {
        const vocab = JSON.parse(file.description);
        if (vocab && (Array.isArray(vocab.categories) || Array.isArray(vocab.tags))) {
          return vocab;
        }
      } catch (e) {
        console.warn('Could not parse Drive file description:', e);
      }
    }

    // 2. Fallback: If legacy file lacks description, download once, extract vocab, and persist description
    const deck = await downloadDeck(token, file.id);
    if (deck) {
      const vocab = extractDeckVocab(deck);
      updateFileDescription(file.id, JSON.stringify(vocab), token);
      return vocab;
    }
  } catch (err) {
    console.warn('Failed to load Drive vocab:', err);
  }

  return null;
}
