/**
 * Polyglot Flashcard PWA - Main Application Coordinator.
 * Coordinates Study Session, Deck Management, AI Card Generation,
 * Google Drive Cloud Sync, and PWA Lifecycle.
 */

import {
  getTodayStr,
  getDueCards,
  advanceCard,
  resetCard,
  getDeckStatistics,
  isCardDue,
  getUniqueCategories,
  getUniqueSubcategories,
  getUniqueTags,
  deleteCardsByCategory,
  deleteCardsBySubcategory,
  deleteCardsByTag,
  extractDeckVocab,
  registerVocabItem
} from './leitner.js';

import {
  loadDeck,
  saveDeck,
  loadSettings,
  saveSettings,
  exportDeckJson,
  importDeckJson,
  INITIAL_SAMPLE_DECK
} from './storage.js';

import {
  initGoogleAuth,
  requestDriveAuth,
  findDeckFile,
  downloadDeck,
  uploadDeck,
  isGapiLoaded,
  getCurrentToken,
  disconnectDrive,
  getDriveDeckVocab
} from './gdrive.js';

import {
  generateCardsFromText,
  evaluateAnswerWithGemini
} from './gemini.js';

let cachedDriveVocab = null;
try {
  const raw = localStorage.getItem('flashcard_drive_vocab_v1');
  if (raw) cachedDriveVocab = JSON.parse(raw);
} catch (e) {}

// Application State
const state = {
  deck: loadDeck(),
  settings: loadSettings(),
  driveVocab: cachedDriveVocab,
  dueQueue: [],
  currentIndex: 0,
  isFlipped: false,
  activeTab: 'study',
  cardFilter: 'all',
  categoryFilter: 'all',
  subcategoryFilter: 'all',
  searchQuery: '',
  draftCards: [],
  isDriveConnected: false,
  isSyncing: false,
  driveFileId: null,
  deckViewLevel: 'categories', // 'categories' | 'subcategories' | 'cards'
  selectedCategory: null,
  selectedSubcategory: null
};

// DOM Element References
const elements = {
  // Navigation
  navTabs: document.querySelectorAll('.nav-tab'),
  mobileNavItems: document.querySelectorAll('.mobile-nav-item'),
  tabContents: document.querySelectorAll('.tab-content'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  cloudPill: document.getElementById('cloud-pill'),
  cloudText: document.getElementById('cloud-text'),

  // Leitner Overview Bar
  statTotalCards: document.getElementById('stat-total-cards'),
  statDueCards: document.getElementById('stat-due-cards'),
  statMastery: document.getElementById('stat-mastery'),
  meterFills: {
    1: document.getElementById('meter-fill-1'),
    2: document.getElementById('meter-fill-2'),
    3: document.getElementById('meter-fill-3'),
    4: document.getElementById('meter-fill-4'),
    5: document.getElementById('meter-fill-5')
  },
  meterCounts: {
    1: document.getElementById('meter-count-1'),
    2: document.getElementById('meter-count-2'),
    3: document.getElementById('meter-count-3'),
    4: document.getElementById('meter-count-4'),
    5: document.getElementById('meter-count-5')
  },

  // Study View
  studyViewport: document.getElementById('study-viewport'),
  emptyDueCard: document.getElementById('empty-due-card'),
  studyCounter: document.getElementById('study-counter'),
  studyBoxBadge: document.getElementById('study-box-badge'),
  flipCardWrapper: document.getElementById('flip-card-wrapper'),
  studyQuestionText: document.getElementById('study-question-text'),
  studyAnswerText: document.getElementById('study-answer-text'),
  studyTagsFront: document.getElementById('study-tags-front'),
  studyTagsBack: document.getElementById('study-tags-back'),
  studyNextReview: document.getElementById('study-next-review'),
  btnRateAgain: document.getElementById('btn-rate-again'),
  btnRateGood: document.getElementById('btn-rate-good'),
  btnRateEasy: document.getElementById('btn-rate-easy'),
  btnStudyAll: document.getElementById('btn-study-all'),
  btnStudySync: document.getElementById('btn-study-sync'),
  btnStudyDelete: document.getElementById('btn-study-delete'),
  btnCardDeleteFront: document.getElementById('btn-card-delete-front'),
  btnCardDeleteBack: document.getElementById('btn-card-delete-back'),
  btnStudySyncBottom: document.getElementById('btn-study-sync-bottom'),
  btnStudyDeleteBottom: document.getElementById('btn-study-delete-bottom'),

  // AI Tutor in Study View
  aiStudentAnswer: document.getElementById('ai-student-answer'),
  btnAiEvaluate: document.getElementById('btn-ai-evaluate'),
  aiFeedbackBanner: document.getElementById('ai-feedback-banner'),
  aiFeedbackText: document.getElementById('ai-feedback-text'),
  aiScoreBadge: document.getElementById('ai-score-badge'),

  // Deck Management View
  deckBreadcrumbs: document.getElementById('deck-breadcrumbs'),
  deckBtnBack: document.getElementById('deck-btn-back'),
  deckLevelStats: document.getElementById('deck-level-stats'),
  deckBoxFilterPills: document.getElementById('deck-box-filter-pills'),
  deckSearchInput: document.getElementById('deck-search-input'),
  filterPills: document.querySelectorAll('.filter-pill'),
  cardsGrid: document.getElementById('cards-grid'),
  btnOpenAddCard: document.getElementById('btn-open-add-card'),

  // AI Generator View
  aiSourceText: document.getElementById('ai-source-text'),
  aiDocIdInput: document.getElementById('ai-doc-id-input'),
  aiLoadedDocBadge: document.getElementById('ai-loaded-doc-badge'),
  aiCategoryInput: document.getElementById('ai-category-input'),
  aiCategorySelect: document.getElementById('ai-category-select'),
  aiSubcategoryInput: document.getElementById('ai-subcategory-input'),
  aiSubcategorySelect: document.getElementById('ai-subcategory-select'),
  aiCustomTags: document.getElementById('ai-custom-tags'),
  aiTagSelect: document.getElementById('ai-tag-select'),
  btnAddTag: document.getElementById('btn-add-tag'),
  btnRunGenerate: document.getElementById('btn-run-generate'),
  btnGenerateSpinner: document.getElementById('btn-generate-spinner'),
  btnGenerateText: document.getElementById('btn-generate-text'),
  draftCardsArea: document.getElementById('draft-cards-area'),
  draftCardsList: document.getElementById('draft-cards-list'),
  btnAddSelectedDrafts: document.getElementById('btn-add-selected-drafts'),

  // Modals
  cardModalBackdrop: document.getElementById('card-modal-backdrop'),
  cardModalTitle: document.getElementById('card-modal-title'),
  cardForm: document.getElementById('card-form'),
  cardEditId: document.getElementById('card-edit-id'),
  cardInputQuestion: document.getElementById('card-input-question'),
  cardInputAnswer: document.getElementById('card-input-answer'),
  cardInputBox: document.getElementById('card-input-box'),
  cardInputTags: document.getElementById('card-input-tags'),
  btnCancelCardModal: document.getElementById('btn-cancel-card-modal'),

  settingsModalBackdrop: document.getElementById('settings-modal-backdrop'),
  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnCancelSettings: document.getElementById('btn-cancel-settings'),
  settingsForm: document.getElementById('settings-form'),
  inputGoogleClientId: document.getElementById('input-google-client-id'),
  inputGeminiApiKey: document.getElementById('input-gemini-api-key'),
  btnGoogleSignIn: document.getElementById('btn-google-signin'),
  btnSyncDriveManual: document.getElementById('btn-sync-drive-manual'),
  btnExportJson: document.getElementById('btn-export-json'),
  fileImportInput: document.getElementById('file-import-input'),
  btnResetDeck: document.getElementById('btn-reset-deck'),

  // Toast Container
  toastContainer: document.getElementById('toast-container')
};

// Initialize Application

// ---------------------------------------------------------------------------
// CATEGORIES & SUBCATEGORIES MANAGEMENT
// ---------------------------------------------------------------------------
function updateCategoryDatalistsAndFilters() {
  const categories = getUniqueCategories(state.deck);
  const subcategories = getUniqueSubcategories(state.deck, state.categoryFilter);

  // Populate Datalists for Autocomplete
  const catDatalist = document.getElementById('category-datalist');
  if (catDatalist) {
    catDatalist.innerHTML = categories.map(c => `<option value="${escapeHtml(c.name)}"></option>`).join('');
  }
  const subDatalist = document.getElementById('subcategory-datalist');
  if (subDatalist) {
    subDatalist.innerHTML = subcategories.map(s => `<option value="${escapeHtml(s.subcategory)}"></option>`).join('');
  }

  // Populate Deck Category Filter Dropdown
  const catSelect = document.getElementById('deck-category-select');
  if (catSelect) {
    const prevVal = catSelect.value;
    catSelect.innerHTML = '<option value="all">All Categories</option>' +
      categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} (${c.count})</option>`).join('');
    if (categories.some(c => c.name === prevVal)) {
      catSelect.value = prevVal;
    } else {
      catSelect.value = 'all';
      state.categoryFilter = 'all';
    }
  }

  // Populate Deck Subcategory Filter Dropdown
  const subSelect = document.getElementById('deck-subcategory-select');
  if (subSelect) {
    const prevSub = subSelect.value;
    subSelect.innerHTML = '<option value="all">All Subcategories</option>' +
      subcategories.map(s => `<option value="${escapeHtml(s.subcategory)}">${escapeHtml(s.subcategory)} (${s.count})</option>`).join('');
    if (subcategories.some(s => s.subcategory === prevSub)) {
      subSelect.value = prevSub;
    } else {
      subSelect.value = 'all';
      state.subcategoryFilter = 'all';
    }
  }

  // Also refresh comboboxes (Category, Subcategory, Tags)
  populateComboboxes();
}

function populateComboboxes(vocab = null) {
  const v = vocab || state.driveVocab || extractDeckVocab(state.deck);
  if (!v) return;

  const categories = v.categories || [];
  const tags = v.tags || [];

  // 1. Populate Category Combobox Select
  if (elements.aiCategorySelect) {
    elements.aiCategorySelect.innerHTML = '<option value="">▼ Select...</option>' +
      categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  // 2. Populate Category Datalist
  const catDatalist = document.getElementById('category-datalist');
  if (catDatalist) {
    catDatalist.innerHTML = categories.map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
  }

  // 3. Populate Subcategory Combobox Select & Datalist
  updateSubcategoryCombobox(elements.aiCategoryInput?.value || '', v);

  // 4. Populate Tags Combobox Select
  if (elements.aiTagSelect) {
    elements.aiTagSelect.innerHTML = '<option value="">-- Choose previously used tag from Drive --</option>' +
      tags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  }

  // 5. Populate Tags Datalist
  const tagsDatalist = document.getElementById('tags-datalist');
  if (tagsDatalist) {
    tagsDatalist.innerHTML = tags.map(t => `<option value="${escapeHtml(t)}"></option>`).join('');
  }
}

function updateSubcategoryCombobox(selectedCategory = '', vocab = null) {
  const v = vocab || state.driveVocab || extractDeckVocab(state.deck);
  if (!v || !v.subcategories) return;

  const catTrimmed = (selectedCategory || '').trim();
  let subs = [];
  if (catTrimmed && Array.isArray(v.subcategories[catTrimmed])) {
    subs = v.subcategories[catTrimmed];
  } else if (Array.isArray(v.subcategories._all)) {
    subs = v.subcategories._all;
  } else {
    subs = Object.values(v.subcategories).flat();
  }

  const uniqueSubs = Array.from(new Set(subs)).sort();

  if (elements.aiSubcategorySelect) {
    elements.aiSubcategorySelect.innerHTML = '<option value="">▼ Select...</option>' +
      uniqueSubs.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  }

  const subDatalist = document.getElementById('subcategory-datalist');
  if (subDatalist) {
    subDatalist.innerHTML = uniqueSubs.map(s => `<option value="${escapeHtml(s)}"></option>`).join('');
  }
}

async function prePopulateFromGoogleDrive(token = null) {
  try {
    const vocab = await getDriveDeckVocab(token);
    if (vocab) {
      state.driveVocab = vocab;
      try {
        localStorage.setItem('flashcard_drive_vocab_v1', JSON.stringify(vocab));
      } catch (e) {}
      populateComboboxes(vocab);
      showToast('Pre-populated categories, subcategories & tags from Google Drive!', 'success');
      return true;
    }
  } catch (err) {
    console.warn('Could not pre-populate from Google Drive:', err);
  }
  return false;
}

function handleAddTagFromCombobox() {
  if (!elements.aiTagSelect || !elements.aiCustomTags) return;
  const selectedTag = elements.aiTagSelect.value.trim();
  if (!selectedTag) {
    showToast('Please select a tag from the dropdown first.', 'info');
    return;
  }

  const current = elements.aiCustomTags.value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  if (current.some(t => t.toLowerCase() === selectedTag.toLowerCase())) {
    showToast(`Tag "${selectedTag}" is already added.`, 'info');
    elements.aiTagSelect.value = '';
    return;
  }

  current.push(selectedTag);
  elements.aiCustomTags.value = current.join(', ');
  elements.aiTagSelect.value = '';
  showToast(`Added tag "${selectedTag}"!`, 'success');
}

function openBatchDeleteModal() {
  renderBatchDeleteLists();
  const modal = document.getElementById('batch-delete-modal-backdrop');
  if (modal) modal.classList.add('open');
}

function renderBatchDeleteLists() {
  const categories = getUniqueCategories(state.deck);
  const subcategories = getUniqueSubcategories(state.deck);
  const tags = getUniqueTags(state.deck);

  // 1. Render Categories
  const catContainer = document.getElementById('batch-list-category');
  if (catContainer) {
    if (categories.length === 0) {
      catContainer.innerHTML = '<p style="color: var(--text-dim); text-align: center; padding: 2rem;">No categories found.</p>';
    } else {
      catContainer.innerHTML = categories.map(c => `
        <div class="batch-item-row">
          <div class="batch-item-info">
            <span class="batch-item-title">📁 ${escapeHtml(c.name)}</span>
            <span class="batch-item-count">${c.count} card${c.count > 1 ? 's' : ''}</span>
          </div>
          <button class="btn-mini danger btn-delete-cat-batch" data-category="${escapeHtml(c.name)}" style="padding: 0.4rem 0.8rem; font-weight: 600;">
            🗑️ Delete Category Cards
          </button>
        </div>
      `).join('');

      catContainer.querySelectorAll('.btn-delete-cat-batch').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = btn.dataset.category;
          if (confirm(`Are you sure you want to remove all cards in category "${cat}"?`)) {
            const count = deleteCardsByCategory(state.deck, cat);
            saveDeck(state.deck);
            showToast(`Deleted ${count} cards from category "${cat}".`, 'success');
            onDeckStructureModified();
            renderBatchDeleteLists();
          }
        });
      });
    }
  }

  // 2. Render Subcategories
  const subContainer = document.getElementById('batch-list-subcategory');
  if (subContainer) {
    if (subcategories.length === 0) {
      subContainer.innerHTML = '<p style="color: var(--text-dim); text-align: center; padding: 2rem;">No subcategories found.</p>';
    } else {
      subContainer.innerHTML = subcategories.map(s => `
        <div class="batch-item-row">
          <div class="batch-item-info">
            <span class="batch-item-title">📂 ${escapeHtml(s.category)} › ${escapeHtml(s.subcategory)}</span>
            <span class="batch-item-count">${s.count} card${s.count > 1 ? 's' : ''}</span>
          </div>
          <button class="btn-mini danger btn-delete-sub-batch" data-category="${escapeHtml(s.category)}" data-subcategory="${escapeHtml(s.subcategory)}" style="padding: 0.4rem 0.8rem; font-weight: 600;">
            🗑️ Delete Subcategory Cards
          </button>
        </div>
      `).join('');

      subContainer.querySelectorAll('.btn-delete-sub-batch').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = btn.dataset.category;
          const sub = btn.dataset.subcategory;
          if (confirm(`Are you sure you want to remove all cards in subcategory "${cat} › ${sub}"?`)) {
            const count = deleteCardsBySubcategory(state.deck, cat, sub);
            saveDeck(state.deck);
            showToast(`Deleted ${count} cards from subcategory "${cat} › ${sub}".`, 'success');
            onDeckStructureModified();
            renderBatchDeleteLists();
          }
        });
      });
    }
  }

  // 3. Render Tags
  const tagContainer = document.getElementById('batch-list-tag');
  if (tagContainer) {
    if (tags.length === 0) {
      tagContainer.innerHTML = '<p style="color: var(--text-dim); text-align: center; padding: 2rem;">No tags found.</p>';
    } else {
      tagContainer.innerHTML = tags.map(t => `
        <div class="batch-item-row">
          <div class="batch-item-info">
            <span class="batch-item-title">🏷️ #${escapeHtml(t.tag)}</span>
            <span class="batch-item-count">${t.count} card${t.count > 1 ? 's' : ''} with this tag</span>
          </div>
          <button class="btn-mini danger btn-delete-tag-batch" data-tag="${escapeHtml(t.tag)}" style="padding: 0.4rem 0.8rem; font-weight: 600;">
            🗑️ Delete Cards with Tag
          </button>
        </div>
      `).join('');

      tagContainer.querySelectorAll('.btn-delete-tag-batch').forEach(btn => {
        btn.addEventListener('click', () => {
          const tag = btn.dataset.tag;
          if (confirm(`Are you sure you want to remove all cards tagged with "#${tag}"?`)) {
            const count = deleteCardsByTag(state.deck, tag);
            saveDeck(state.deck);
            showToast(`Deleted ${count} cards tagged with "#${tag}".`, 'success');
            onDeckStructureModified();
            renderBatchDeleteLists();
          }
        });
      });
    }
  }
}

function onDeckStructureModified() {
  updateCategoryDatalistsAndFilters();
  refreshDueQueue();
  updateLeitnerDashboard();
  renderDeckGrid();
  renderStudyView();
  autoSyncToDrive();
}

export function init() {
  applyTheme(state.settings.theme || 'dark');
  refreshDueQueue();
  updateLeitnerDashboard();
  renderStudyView();
  renderDeckGrid();
  updateCategoryDatalistsAndFilters();
  populateComboboxes();
  setupEventListeners();
  initGoogleClient();
  registerServiceWorker();
}

// ---------------------------------------------------------------------------
// THEME & PWA
// ---------------------------------------------------------------------------
function applyTheme(theme) {
  state.settings.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.textContent = theme === 'light' ? '🌙' : '☀️';
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('[PWA] ServiceWorker registered with scope:', reg.scope))
        .catch(err => console.warn('[PWA] ServiceWorker registration failed:', err));
    });
  }
}

// ---------------------------------------------------------------------------
// LEITNER DASHBOARD
// ---------------------------------------------------------------------------
function updateLeitnerDashboard() {
  const stats = getDeckStatistics(state.deck);
  if (elements.statTotalCards) elements.statTotalCards.textContent = stats.totalCards;
  if (elements.statDueCards) elements.statDueCards.textContent = stats.dueCount;
  if (elements.statMastery) elements.statMastery.textContent = `${stats.masteryPercentage}%`;

  for (let box = 1; box <= 5; box++) {
    const count = stats.boxCounts[box] || 0;
    const pct = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
    if (elements.meterFills[box]) {
      elements.meterFills[box].style.width = `${pct}%`;
    }
    if (elements.meterCounts[box]) {
      elements.meterCounts[box].textContent = count;
    }
  }

  // Update tab badge
  const dueTabBadge = document.getElementById('study-tab-badge');
  if (dueTabBadge) {
    dueTabBadge.textContent = stats.dueCount;
    dueTabBadge.style.display = stats.dueCount > 0 ? 'inline-block' : 'none';
  }
}

function refreshDueQueue(forceAll = false) {
  if (forceAll) {
    state.dueQueue = [...state.deck.cards];
  } else {
    state.dueQueue = getDueCards(state.deck);
  }
  state.currentIndex = 0;
  state.isFlipped = false;
}

// ---------------------------------------------------------------------------
// VIEW 1: STUDY SESSION
// ---------------------------------------------------------------------------
function renderStudyView() {
  if (state.dueQueue.length === 0) {
    if (elements.studyViewport) elements.studyViewport.style.display = 'none';
    if (elements.emptyDueCard) elements.emptyDueCard.style.display = 'flex';
    return;
  }

  if (elements.studyViewport) elements.studyViewport.style.display = 'flex';
  if (elements.emptyDueCard) elements.emptyDueCard.style.display = 'none';

  if (state.currentIndex >= state.dueQueue.length) {
    showToast('🎉 Study Session Complete! All due cards reviewed.', 'success');
    refreshDueQueue();
    updateLeitnerDashboard();
    renderStudyView();
    autoSyncToDrive();
    return;
  }

  const card = state.dueQueue[state.currentIndex];
  state.isFlipped = false;
  if (elements.flipCardWrapper) elements.flipCardWrapper.classList.remove('is-flipped');

  // Update header text
  if (elements.studyCounter) {
    elements.studyCounter.textContent = `Card ${state.currentIndex + 1} of ${state.dueQueue.length}`;
  }

  // Update Box Pill
  const boxNum = Math.max(1, Math.min(card.box_number || 1, 5));
  if (elements.studyBoxBadge) {
    elements.studyBoxBadge.className = `box-pill b-${boxNum}`;
    elements.studyBoxBadge.textContent = `Box ${boxNum}`;
  }

  // Update Category & Subcategory breadcrumb
  const catBadgeText = `📁 ${escapeHtml(card.category || 'General')} › ${escapeHtml(card.subcategory || 'General')}`;
  const catBadgeFront = document.getElementById('study-category-badge-front');
  const catBadgeBack = document.getElementById('study-category-badge-back');
  if (catBadgeFront) catBadgeFront.innerHTML = catBadgeText;
  if (catBadgeBack) catBadgeBack.innerHTML = catBadgeText;

  // Populate Question and Answer
  if (elements.studyQuestionText) elements.studyQuestionText.textContent = card.question;
  if (elements.studyAnswerText) elements.studyAnswerText.textContent = card.answer;

  // Render Tags
  const renderTags = (container, tags) => {
    if (!container) return;
    container.innerHTML = '';
    (tags || []).forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag-badge';
      span.textContent = `#${tag}`;
      container.appendChild(span);
    });
  };
  renderTags(elements.studyTagsFront, card.tags);
  renderTags(elements.studyTagsBack, card.tags);

  if (elements.studyNextReview) {
    elements.studyNextReview.textContent = card.next_review_date || getTodayStr();
  }

  // Reset AI Tutor Feedback for this card
  if (elements.aiStudentAnswer) elements.aiStudentAnswer.value = '';
  if (elements.aiFeedbackBanner) elements.aiFeedbackBanner.classList.remove('show');
}

function flipCard() {
  state.isFlipped = !state.isFlipped;
  if (elements.flipCardWrapper) {
    elements.flipCardWrapper.classList.toggle('is-flipped', state.isFlipped);
  }
}

function handleRateCard(rating) {
  if (state.dueQueue.length === 0 || state.currentIndex >= state.dueQueue.length) return;

  const currentCard = state.dueQueue[state.currentIndex];
  let updated;

  if (rating === 'again') {
    updated = resetCard(currentCard);
    showToast(`Demoted to Box 1. Due tomorrow.`, 'info');
  } else if (rating === 'good') {
    updated = advanceCard(currentCard);
    showToast(`Promoted to Box ${updated.box_number}! Next: ${updated.next_review_date}`, 'success');
  } else if (rating === 'easy') {
    // Advance box twice (fast track)
    const step1 = advanceCard(currentCard);
    updated = advanceCard(step1);
    showToast(`Mastered! Promoted to Box ${updated.box_number}. Next: ${updated.next_review_date}`, 'success');
  }

  // Update in master deck
  const deckIdx = state.deck.cards.findIndex(c => c.id === currentCard.id);
  if (deckIdx !== -1) {
    state.deck.cards[deckIdx] = updated;
    saveDeck(state.deck);
  }

  state.currentIndex++;
  updateLeitnerDashboard();
  renderStudyView();
}

async function handleAiEvaluate() {
  const card = state.dueQueue[state.currentIndex];
  if (!card) return;

  const studentAnswer = elements.aiStudentAnswer?.value || '';
  if (!studentAnswer.trim()) {
    showToast('Please type your answer first.', 'info');
    return;
  }

  if (elements.btnAiEvaluate) {
    elements.btnAiEvaluate.disabled = true;
    elements.btnAiEvaluate.innerHTML = '<span class="spinner"></span> Evaluating...';
  }

  try {
    const result = await evaluateAnswerWithGemini(
      card.question,
      card.answer,
      studentAnswer,
      state.settings.geminiApiKey
    );

    if (elements.aiFeedbackBanner) {
      elements.aiFeedbackBanner.classList.add('show');
    }
    if (elements.aiFeedbackText) {
      elements.aiFeedbackText.textContent = result.feedback;
    }
    if (elements.aiScoreBadge) {
      elements.aiScoreBadge.textContent = `${result.score}/100`;
      elements.aiScoreBadge.style.color = result.is_correct ? 'var(--accent-emerald)' : 'var(--accent-rose)';
    }

    // Auto-flip to reveal reference answer
    if (!state.isFlipped) flipCard();
  } catch (err) {
    showToast(`AI Evaluation error: ${err.message}`, 'error');
  } finally {
    if (elements.btnAiEvaluate) {
      elements.btnAiEvaluate.disabled = false;
      elements.btnAiEvaluate.innerHTML = '✨ Grade with Gemini';
    }
  }
}

async function handleStudyDeleteCard() {
  if (state.dueQueue.length === 0 || state.currentIndex >= state.dueQueue.length) {
    showToast('No active flashcard to delete.', 'info');
    return;
  }

  const currentCard = state.dueQueue[state.currentIndex];
  if (!currentCard) return;

  const cardSnippet = (currentCard.question || 'this card').replace(/\n/g, ' ');
  const displaySnippet = cardSnippet.length > 70 ? cardSnippet.slice(0, 70) + '...' : cardSnippet;

  if (!confirm(`Are you sure you want to delete this flashcard?\n\n"${displaySnippet}"\n\nThis will permanently remove it from your deck.`)) {
    return;
  }

  // 1. Record ID in deletedCardIds to prevent resurrections on Google Drive sync
  if (!state.deck.deletedCardIds) state.deck.deletedCardIds = [];
  if (currentCard.id && !state.deck.deletedCardIds.includes(currentCard.id)) {
    state.deck.deletedCardIds.push(currentCard.id);
  }

  // 2. Remove card from master deck and persist locally
  state.deck.cards = state.deck.cards.filter(c => c.id !== currentCard.id);
  saveDeck(state.deck);

  // 3. Remove from due queue in-place so study session continues smoothly
  state.dueQueue.splice(state.currentIndex, 1);

  // If we were on the last card and there are still cards left, adjust index to new last card
  if (state.currentIndex >= state.dueQueue.length && state.dueQueue.length > 0) {
    state.currentIndex = state.dueQueue.length - 1;
  }

  // 4. Update UI dashboards, datalists, and render next card (or completion view)
  updateLeitnerDashboard();
  updateCategoryDatalistsAndFilters();
  renderDeckGrid();
  renderStudyView();

  // 5. Cloud Sync
  if (getCurrentToken()) {
    showToast('Flashcard deleted. Syncing change to Google Drive...', 'success');
    await autoSyncToDrive();
  } else {
    showToast('Flashcard deleted locally. Connect Drive in Settings to sync across devices.', 'info');
  }
}

async function handleStudySync() {
  const syncBtns = [
    elements.btnStudySync,
    elements.btnStudySyncBottom,
    document.getElementById('btn-study-sync'),
    document.getElementById('btn-study-sync-bottom')
  ].filter(Boolean);

  syncBtns.forEach(btn => {
    btn.classList.add('syncing');
    btn.disabled = true;
    const icon = btn.querySelector('.sync-icon');
    if (icon) icon.classList.add('spin-anim');
  });

  try {
    await handleSyncDriveManual();
  } finally {
    syncBtns.forEach(btn => {
      btn.classList.remove('syncing');
      btn.disabled = false;
      const icon = btn.querySelector('.sync-icon');
      if (icon) icon.classList.remove('spin-anim');
    });
  }
}

// ---------------------------------------------------------------------------
// VIEW 2: DECK MANAGER
// ---------------------------------------------------------------------------
function renderDeckGrid() {
  renderDeckManager();
}

function renderDeckManager() {
  if (!elements.cardsGrid) return;

  // Render navigation header (Breadcrumbs & Back button & stats)
  updateDeckNavigationHeader();

  // Route to the appropriate level
  if (state.deckViewLevel === 'categories') {
    renderCategoriesView();
  } else if (state.deckViewLevel === 'subcategories') {
    renderSubcategoriesView();
  } else if (state.deckViewLevel === 'cards') {
    renderCardsView();
  }
}

function updateDeckNavigationHeader() {
  const totalCards = state.deck.cards ? state.deck.cards.length : 0;
  const categories = getUniqueCategories(state.deck);

  if (state.deckViewLevel === 'categories') {
    if (elements.deckBtnBack) elements.deckBtnBack.style.display = 'none';
    if (elements.deckBreadcrumbs) {
      elements.deckBreadcrumbs.innerHTML = '<span class="deck-breadcrumb-item active">📁 Categories</span>';
    }
    if (elements.deckSearchInput) {
      elements.deckSearchInput.placeholder = 'Search categories...';
    }
    if (elements.deckBoxFilterPills) {
      elements.deckBoxFilterPills.style.display = 'none';
    }
    if (elements.deckLevelStats) {
      elements.deckLevelStats.innerHTML = `
        <span class="deck-stat-pill">📁 ${categories.length} ${categories.length === 1 ? 'Category' : 'Categories'}</span>
        <span class="deck-stat-pill">🎴 ${totalCards} ${totalCards === 1 ? 'Card' : 'Cards'}</span>
      `;
    }
  } else if (state.deckViewLevel === 'subcategories') {
    if (elements.deckBtnBack) elements.deckBtnBack.style.display = 'inline-flex';
    if (elements.deckBreadcrumbs) {
      elements.deckBreadcrumbs.innerHTML = `
        <button type="button" class="deck-breadcrumb-item" id="bc-go-categories" title="Back to all categories">📁 Categories</button>
        <span class="deck-breadcrumb-sep">›</span>
        <span class="deck-breadcrumb-item active">📂 ${escapeHtml(state.selectedCategory || '')}</span>
      `;
      document.getElementById('bc-go-categories')?.addEventListener('click', goToCategoriesLevel);
    }
    if (elements.deckSearchInput) {
      elements.deckSearchInput.placeholder = `Search subcategories in ${state.selectedCategory}...`;
    }
    if (elements.deckBoxFilterPills) {
      elements.deckBoxFilterPills.style.display = 'none';
    }
    const catCards = (state.deck.cards || []).filter(c => (c.category || 'General').trim().toLowerCase() === (state.selectedCategory || '').toLowerCase());
    const subSet = new Set(catCards.map(c => (c.subcategory || 'General').trim()));
    if (elements.deckLevelStats) {
      elements.deckLevelStats.innerHTML = `
        <span class="deck-stat-pill">📂 ${subSet.size} ${subSet.size === 1 ? 'Subcategory' : 'Subcategories'}</span>
        <span class="deck-stat-pill">🎴 ${catCards.length} ${catCards.length === 1 ? 'Card' : 'Cards'}</span>
      `;
    }
  } else if (state.deckViewLevel === 'cards') {
    if (elements.deckBtnBack) elements.deckBtnBack.style.display = 'inline-flex';
    if (elements.deckBreadcrumbs) {
      elements.deckBreadcrumbs.innerHTML = `
        <button type="button" class="deck-breadcrumb-item" id="bc-go-categories" title="Back to all categories">📁 Categories</button>
        <span class="deck-breadcrumb-sep">›</span>
        <button type="button" class="deck-breadcrumb-item" id="bc-go-subcategories" title="Back to subcategories">📂 ${escapeHtml(state.selectedCategory || '')}</button>
        <span class="deck-breadcrumb-sep">›</span>
        <span class="deck-breadcrumb-item active">📄 ${escapeHtml(state.selectedSubcategory || '')}</span>
      `;
      document.getElementById('bc-go-categories')?.addEventListener('click', goToCategoriesLevel);
      document.getElementById('bc-go-subcategories')?.addEventListener('click', goToSubcategoriesLevel);
    }
    if (elements.deckSearchInput) {
      elements.deckSearchInput.placeholder = `Search flashcards in ${state.selectedSubcategory}...`;
    }
    if (elements.deckBoxFilterPills) {
      elements.deckBoxFilterPills.style.display = 'flex';
    }
  }
}

function goToCategoriesLevel() {
  state.selectedCategory = null;
  state.selectedSubcategory = null;
  state.deckViewLevel = 'categories';
  state.searchQuery = '';
  if (elements.deckSearchInput) elements.deckSearchInput.value = '';
  renderDeckManager();
}

function goToSubcategoriesLevel() {
  state.selectedSubcategory = null;
  state.deckViewLevel = 'subcategories';
  state.searchQuery = '';
  if (elements.deckSearchInput) elements.deckSearchInput.value = '';
  renderDeckManager();
}

function handleDeckBack() {
  if (state.deckViewLevel === 'cards') {
    goToSubcategoriesLevel();
  } else if (state.deckViewLevel === 'subcategories') {
    goToCategoriesLevel();
  }
}

function renderCategoriesView() {
  elements.cardsGrid.innerHTML = '';
  const today = getTodayStr();
  const allCards = state.deck.cards || [];

  if (allCards.length === 0) {
    elements.cardsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-dim);">
        <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">📁</span>
        <p style="font-size: 1.2rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem;">No flashcard categories yet</p>
        <p style="font-size: 0.88rem; max-width: 440px; margin: 0 auto 1.5rem auto;">Create your first flashcard manually or use the AI Generator to extract cards from notes.</p>
        <button class="btn-primary" onclick="document.getElementById('btn-open-add-card')?.click()">
          <span>➕ Add Your First Card</span>
        </button>
      </div>
    `;
    return;
  }

  // Aggregate category stats
  const catMap = {};
  allCards.forEach(c => {
    const catName = (c.category || 'General').trim();
    if (!catMap[catName]) {
      catMap[catName] = {
        name: catName,
        cardCount: 0,
        subcategories: new Set(),
        dueCount: 0
      };
    }
    catMap[catName].cardCount += 1;
    catMap[catName].subcategories.add((c.subcategory || 'General').trim());
    if (isCardDue(c, today)) {
      catMap[catName].dueCount += 1;
    }
  });

  let categories = Object.values(catMap);

  // Filter categories by search query
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    categories = categories.filter(c => c.name.toLowerCase().includes(q));
  }

  // Sort alphabetically
  categories.sort((a, b) => a.name.localeCompare(b.name));

  if (categories.length === 0) {
    elements.cardsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--text-main);">No matching categories</p>
        <p style="font-size: 0.85rem;">No categories match "${escapeHtml(state.searchQuery)}". Try another search term.</p>
      </div>
    `;
    return;
  }

  categories.forEach(cat => {
    const cardEl = document.createElement('div');
    cardEl.className = 'deck-folder-card';
    cardEl.dataset.category = cat.name;

    const subCount = cat.subcategories.size;
    const cardCount = cat.cardCount;
    const dueBadge = cat.dueCount > 0 ? `<span class="folder-meta-pill due">🔥 ${cat.dueCount} Due</span>` : '';

    cardEl.innerHTML = `
      <div class="folder-card-top">
        <div class="folder-icon-box">📁</div>
        <div class="folder-title-area">
          <h3 class="folder-title">${escapeHtml(cat.name)}</h3>
          <div class="folder-meta-row">
            <span class="folder-meta-pill">📂 ${subCount} ${subCount === 1 ? 'Subcategory' : 'Subcategories'}</span>
            <span class="folder-meta-pill">🎴 ${cardCount} ${cardCount === 1 ? 'Card' : 'Cards'}</span>
            ${dueBadge}
          </div>
        </div>
      </div>
      <div class="folder-card-footer">
        <span class="folder-action-hint">Explore Subcategories &rarr;</span>
        <button type="button" class="btn-delete-folder" data-category="${escapeHtml(cat.name)}" title="Delete all cards under category ${escapeHtml(cat.name)}">
          🗑️ Delete
        </button>
      </div>
    `;

    // Clicking folder navigates into subcategories
    cardEl.addEventListener('click', () => {
      state.selectedCategory = cat.name;
      state.selectedSubcategory = null;
      state.deckViewLevel = 'subcategories';
      state.searchQuery = '';
      if (elements.deckSearchInput) elements.deckSearchInput.value = '';
      renderDeckManager();
    });

    // Clicking delete button only triggers category deletion
    const delBtn = cardEl.querySelector('.btn-delete-folder');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteCategory(cat.name, cardCount);
    });

    elements.cardsGrid.appendChild(cardEl);
  });
}

function renderSubcategoriesView() {
  elements.cardsGrid.innerHTML = '';
  const today = getTodayStr();
  const allCards = state.deck.cards || [];
  const currentCat = state.selectedCategory || '';

  // Get all cards for current category
  const catCards = allCards.filter(c => (c.category || 'General').trim().toLowerCase() === currentCat.toLowerCase());

  if (catCards.length === 0) {
    elements.cardsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-dim);">
        <p style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 0.5rem;">Category "${escapeHtml(currentCat)}" has no flashcards.</p>
        <button class="btn-secondary" onclick="goToCategoriesLevel()" style="margin-top: 0.5rem;">
          <span>← Back to Categories</span>
        </button>
      </div>
    `;
    return;
  }

  // Aggregate subcategories
  const subMap = {};
  catCards.forEach(c => {
    const subName = (c.subcategory || 'General').trim();
    if (!subMap[subName]) {
      subMap[subName] = {
        name: subName,
        cardCount: 0,
        dueCount: 0
      };
    }
    subMap[subName].cardCount += 1;
    if (isCardDue(c, today)) {
      subMap[subName].dueCount += 1;
    }
  });

  let subcategories = Object.values(subMap);

  // Filter subcategories by search query
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    subcategories = subcategories.filter(s => s.name.toLowerCase().includes(q));
  }

  // Sort alphabetically
  subcategories.sort((a, b) => a.name.localeCompare(b.name));

  if (subcategories.length === 0) {
    elements.cardsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--text-main);">No matching subcategories</p>
        <p style="font-size: 0.85rem;">No subcategories match "${escapeHtml(state.searchQuery)}".</p>
      </div>
    `;
    return;
  }

  subcategories.forEach(sub => {
    const cardEl = document.createElement('div');
    cardEl.className = 'deck-folder-card sub-folder';
    cardEl.dataset.subcategory = sub.name;

    const cardCount = sub.cardCount;
    const dueBadge = sub.dueCount > 0 ? `<span class="folder-meta-pill due">🔥 ${sub.dueCount} Due</span>` : '';

    cardEl.innerHTML = `
      <div class="folder-card-top">
        <div class="folder-icon-box sub">📂</div>
        <div class="folder-title-area">
          <h3 class="folder-title">${escapeHtml(sub.name)}</h3>
          <div class="folder-meta-row">
            <span class="folder-meta-pill">🎴 ${cardCount} ${cardCount === 1 ? 'Card' : 'Cards'}</span>
            ${dueBadge}
          </div>
        </div>
      </div>
      <div class="folder-card-footer">
        <span class="folder-action-hint">View Flashcards &rarr;</span>
        <button type="button" class="btn-delete-folder" data-subcategory="${escapeHtml(sub.name)}" title="Delete all cards under subcategory ${escapeHtml(sub.name)}">
          🗑️ Delete
        </button>
      </div>
    `;

    // Clicking subfolder navigates to cards view
    cardEl.addEventListener('click', () => {
      state.selectedSubcategory = sub.name;
      state.deckViewLevel = 'cards';
      state.searchQuery = '';
      if (elements.deckSearchInput) elements.deckSearchInput.value = '';
      renderDeckManager();
    });

    // Clicking delete button only triggers subcategory deletion
    const delBtn = cardEl.querySelector('.btn-delete-folder');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteSubcategory(currentCat, sub.name, cardCount);
    });

    elements.cardsGrid.appendChild(cardEl);
  });
}

function renderCardsView() {
  elements.cardsGrid.innerHTML = '';
  const today = getTodayStr();
  const currentCat = state.selectedCategory || '';
  const currentSub = state.selectedSubcategory || '';

  // Filter cards by category & subcategory
  let cards = (state.deck.cards || []).filter(c => {
    const catMatch = (c.category || 'General').trim().toLowerCase() === currentCat.toLowerCase();
    const subMatch = (c.subcategory || 'General').trim().toLowerCase() === currentSub.toLowerCase();
    return catMatch && subMatch;
  });

  const totalInSubcategory = cards.length;

  // Filter by box or due status
  if (state.cardFilter === 'due') {
    cards = cards.filter(c => isCardDue(c, today));
  } else if (['1', '2', '3', '4', '5'].includes(state.cardFilter)) {
    cards = cards.filter(c => String(c.box_number || 1) === state.cardFilter);
  }

  // Filter by search query
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    cards = cards.filter(card => {
      const matchQ = (card.question || '').toLowerCase().includes(q);
      const matchA = (card.answer || '').toLowerCase().includes(q);
      const matchT = (card.tags || []).some(t => t.toLowerCase().includes(q));
      return matchQ || matchA || matchT;
    });
  }

  // Update level stats in header
  if (elements.deckLevelStats) {
    elements.deckLevelStats.innerHTML = `
      <span class="deck-stat-pill">🎴 ${cards.length} / ${totalInSubcategory} Cards</span>
      <button type="button" class="btn-delete-folder" id="btn-delete-current-sub" style="padding: 0.3rem 0.65rem;" title="Delete all cards in this subcategory">
        🗑️ Delete Subcategory
      </button>
    `;
    document.getElementById('btn-delete-current-sub')?.addEventListener('click', () => {
      handleDeleteSubcategory(currentCat, currentSub, totalInSubcategory);
    });
  }

  if (cards.length === 0) {
    elements.cardsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-dim);">
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--text-main);">No flashcards found</p>
        <p style="font-size: 0.85rem;">Try adjusting your box filter or search query, or add a new card.</p>
        <button class="btn-primary" onclick="openAddCardModal()" style="margin-top: 1rem;">
          <span>➕ Add Card to this Subcategory</span>
        </button>
      </div>
    `;
    return;
  }

  cards.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.className = 'deck-card-item';
    const boxNum = Math.max(1, Math.min(card.box_number || 1, 5));
    const dueBadge = isCardDue(card, today) ? '<span style="color: var(--accent-rose); font-weight: 700; margin-left: 0.5rem;">• Due</span>' : '';

    cardEl.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.35rem;">
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span class="category-breadcrumb-pill" style="font-size: 0.7rem;">📁 ${escapeHtml(card.category || 'General')} › ${escapeHtml(card.subcategory || 'General')}</span>
            <span class="box-pill b-${boxNum}">Box ${boxNum}</span>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-dim);">${card.next_review_date || 'Today'}${dueBadge}</span>
        </div>
        <h3 class="deck-card-q">${escapeHtml(card.question)}</h3>
      </div>
      <div>
        <div class="deck-card-a">${escapeHtml(card.answer)}</div>
        <div class="deck-card-footer">
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            ${(card.tags || []).map(t => `<span class="tag-badge">#${escapeHtml(t)}</span>`).join('')}
          </div>
          <div class="card-item-actions">
            <button class="btn-mini btn-edit-card" data-id="${card.id}" title="Edit Card">✏️</button>
            <button class="btn-mini danger btn-delete-card" data-id="${card.id}" title="Delete Card">🗑️</button>
          </div>
        </div>
      </div>
    `;

    cardEl.querySelector('.btn-edit-card').addEventListener('click', () => openEditCardModal(card));
    cardEl.querySelector('.btn-delete-card').addEventListener('click', () => handleDeleteCard(card.id));
    elements.cardsGrid.appendChild(cardEl);
  });
}

function handleDeleteCategory(categoryName, cardCount) {
  const countStr = cardCount !== undefined ? `${cardCount} ` : '';
  const msg = `Are you sure you want to delete all ${countStr}cards in category "${categoryName}"?\n\nThis will permanently delete the category and all its cards from your deck.`;
  if (!confirm(msg)) return;

  const deleted = deleteCardsByCategory(state.deck, categoryName);
  saveDeck(state.deck);
  showToast(`Deleted all ${deleted} cards from category "${categoryName}".`, 'success');

  // If user was viewing this category or its subcategories, reset to categories level
  if (state.selectedCategory && state.selectedCategory.toLowerCase() === categoryName.toLowerCase()) {
    state.selectedCategory = null;
    state.selectedSubcategory = null;
    state.deckViewLevel = 'categories';
  }

  onDeckStructureModified();
}

function handleDeleteSubcategory(categoryName, subcategoryName, cardCount) {
  const countStr = cardCount !== undefined ? `${cardCount} ` : '';
  const msg = `Are you sure you want to delete all ${countStr}cards in subcategory "${subcategoryName}" under "${categoryName}"?\n\nThis will permanently delete these cards from your deck.`;
  if (!confirm(msg)) return;

  const deleted = deleteCardsBySubcategory(state.deck, categoryName, subcategoryName);
  saveDeck(state.deck);
  showToast(`Deleted all ${deleted} cards from subcategory "${subcategoryName}".`, 'success');

  // Check if any cards remain in this category
  const remainingInCat = (state.deck.cards || []).filter(c => (c.category || 'General').trim().toLowerCase() === categoryName.toLowerCase());
  if (remainingInCat.length === 0) {
    state.selectedCategory = null;
    state.selectedSubcategory = null;
    state.deckViewLevel = 'categories';
  } else {
    // If we were viewing the cards of this deleted subcategory, return to subcategories level
    if (state.selectedSubcategory && state.selectedSubcategory.toLowerCase() === subcategoryName.toLowerCase()) {
      state.selectedSubcategory = null;
      state.deckViewLevel = 'subcategories';
    }
  }

  onDeckStructureModified();
}

function openAddCardModal() {
  if (elements.cardModalTitle) elements.cardModalTitle.textContent = 'Add New Flashcard';
  if (elements.cardEditId) elements.cardEditId.value = '';
  if (elements.cardInputQuestion) elements.cardInputQuestion.value = '';
  if (elements.cardInputAnswer) elements.cardInputAnswer.value = '';
  if (elements.cardInputBox) elements.cardInputBox.value = '1';
  if (elements.cardInputTags) elements.cardInputTags.value = '';
  const inputCat = document.getElementById('card-input-category');
  const inputSub = document.getElementById('card-input-subcategory');
  if (inputCat) inputCat.value = state.selectedCategory || (state.categoryFilter !== 'all' ? state.categoryFilter : 'General');
  if (inputSub) inputSub.value = state.selectedSubcategory || (state.subcategoryFilter !== 'all' ? state.subcategoryFilter : 'General');
  if (elements.cardModalBackdrop) elements.cardModalBackdrop.classList.add('open');
}

function openEditCardModal(card) {
  if (elements.cardModalTitle) elements.cardModalTitle.textContent = 'Edit Flashcard';
  if (elements.cardEditId) elements.cardEditId.value = card.id;
  if (elements.cardInputQuestion) elements.cardInputQuestion.value = card.question;
  if (elements.cardInputAnswer) elements.cardInputAnswer.value = card.answer;
  if (elements.cardInputBox) elements.cardInputBox.value = String(card.box_number || 1);
  if (elements.cardInputTags) elements.cardInputTags.value = (card.tags || []).join(', ');
  const inputCat = document.getElementById('card-input-category');
  const inputSub = document.getElementById('card-input-subcategory');
  if (inputCat) inputCat.value = card.category || 'General';
  if (inputSub) inputSub.value = card.subcategory || 'General';
  if (elements.cardModalBackdrop) elements.cardModalBackdrop.classList.add('open');
}

function handleSaveCardModal(e) {
  e.preventDefault();
  const id = elements.cardEditId?.value;
  const question = elements.cardInputQuestion?.value.trim();
  const answer = elements.cardInputAnswer?.value.trim();
  const boxNumber = parseInt(elements.cardInputBox?.value || '1', 10);
  const category = document.getElementById('card-input-category')?.value.trim() || 'General';
  const subcategory = document.getElementById('card-input-subcategory')?.value.trim() || 'General';
  const tags = (elements.cardInputTags?.value || '')
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (!question || !answer) {
    showToast('Question and answer are required.', 'error');
    return;
  }

  const today = getTodayStr();

  if (id) {
    // Edit existing
    const idx = state.deck.cards.findIndex(c => c.id === id);
    if (idx !== -1) {
      state.deck.cards[idx] = {
        ...state.deck.cards[idx],
        question,
        answer,
        category,
        subcategory,
        box_number: boxNumber,
        tags
      };
      showToast('Flashcard updated!', 'success');
    }
  } else {
    // Create new
    const newCard = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'card-' + Date.now(),
      question,
      answer,
      category,
      subcategory,
      box_number: boxNumber,
      last_reviewed: today,
      next_review_date: today,
      tags,
      source_document_id: null
    };
    state.deck.cards.push(newCard);
    showToast('New flashcard added!', 'success');
  }

  registerVocabItem(state.deck, category, subcategory, tags);
  saveDeck(state.deck);
  updateCategoryDatalistsAndFilters();
  elements.cardModalBackdrop?.classList.remove('open');
  refreshDueQueue();
  updateLeitnerDashboard();
  renderDeckGrid();
  renderStudyView();
  autoSyncToDrive();
}

function handleDeleteCard(id) {
  if (!confirm('Are you sure you want to delete this flashcard?')) return;
  if (!state.deck.deletedCardIds) state.deck.deletedCardIds = [];
  if (id && !state.deck.deletedCardIds.includes(id)) {
    state.deck.deletedCardIds.push(id);
  }
  state.deck.cards = state.deck.cards.filter(c => c.id !== id);
  saveDeck(state.deck);
  showToast('Flashcard deleted.', 'info');
  refreshDueQueue();
  updateLeitnerDashboard();
  renderDeckGrid();
  renderStudyView();
  autoSyncToDrive();
}

// ---------------------------------------------------------------------------
// VIEW 3: AI CARD GENERATOR (WORKFLOW 1 PARITY)
// ---------------------------------------------------------------------------
async function handleRunGenerate() {
  const text = elements.aiSourceText?.value || '';
  const docId = elements.aiDocIdInput?.value.trim() || null;

  if (!text.trim()) {
    showToast('Please enter text or notes to generate flashcards.', 'info');
    return;
  }

  if (elements.btnRunGenerate) {
    elements.btnRunGenerate.disabled = true;
    if (elements.btnGenerateSpinner) elements.btnGenerateSpinner.style.display = 'inline-block';
    if (elements.btnGenerateText) elements.btnGenerateText.textContent = 'Generating with Gemini...';
  }

  try {
    const cardCount = document.getElementById('ai-card-count')?.value || 'auto';
    const category = document.getElementById('ai-category-input')?.value.trim() || 'General';
    const subcategory = document.getElementById('ai-subcategory-input')?.value.trim() || 'General';
    const customTags = (document.getElementById('ai-custom-tags')?.value || '')
      .split(',').map(t => t.trim()).filter(Boolean);

    const generated = await generateCardsFromText(text, state.settings.geminiApiKey, docId, cardCount, category, subcategory, customTags);
    
    if (window.lastGeminiError) {
      showToast(`Notice: Used local parser (${window.lastGeminiError})`, 'info');
      window.lastGeminiError = null;
    }
    state.draftCards = generated;
    renderDraftCardsList();
    showToast(`Generated ${generated.length} conceptual flashcards!`, 'success');
  } catch (err) {
    showToast(`Generation failed: ${err.message}`, 'error');
  } finally {
    if (elements.btnRunGenerate) {
      elements.btnRunGenerate.disabled = false;
      if (elements.btnGenerateSpinner) elements.btnGenerateSpinner.style.display = 'none';
      if (elements.btnGenerateText) elements.btnGenerateText.textContent = '✨ Generate Flashcards';
    }
  }
}

function renderDraftCardsList() {
  if (!elements.draftCardsArea || !elements.draftCardsList) return;

  if (state.draftCards.length === 0) {
    elements.draftCardsArea.style.display = 'none';
    return;
  }

  elements.draftCardsArea.style.display = 'flex';
  elements.draftCardsList.innerHTML = '';

  state.draftCards.forEach((card, idx) => {
    const item = document.createElement('div');
    item.className = 'draft-card-editor';
    item.innerHTML = `
      <div class="draft-card-top">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem; font-weight: 600;">
          <input type="checkbox" id="draft-chk-${idx}" checked style="width: 18px; height: 18px; cursor: pointer;">
          <span>Include in Deck</span>
        </label>
        <button type="button" class="btn-mini danger btn-delete-draft" data-idx="${idx}" title="Remove Draft">🗑️</button>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
        <div class="form-group">
          <label class="form-label" style="font-size: 0.75rem;">Category</label>
          <input type="text" class="form-input draft-edit-cat" id="draft-cat-${idx}" value="${escapeHtml(card.category || 'General')}" style="padding: 0.4rem 0.6rem; font-size: 0.82rem;">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 0.75rem;">Subcategory</label>
          <input type="text" class="form-input draft-edit-sub" id="draft-sub-${idx}" value="${escapeHtml(card.subcategory || 'General')}" style="padding: 0.4rem 0.6rem; font-size: 0.82rem;">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" style="font-size: 0.75rem;">Question</label>
        <input type="text" class="form-input draft-input-q" id="draft-q-${idx}" value="${escapeHtml(card.question)}" style="padding: 0.5rem 0.75rem;">
      </div>

      <div class="form-group">
        <label class="form-label" style="font-size: 0.75rem;">Answer</label>
        <textarea class="form-input" id="draft-a-${idx}" rows="2" style="padding: 0.5rem 0.75rem; font-size: 0.88rem;">${escapeHtml(card.answer)}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label" style="font-size: 0.75rem;">Tags (comma-separated)</label>
        <input type="text" class="form-input" id="draft-tags-${idx}" value="${escapeHtml((card.tags || []).join(', '))}" style="padding: 0.4rem 0.6rem; font-size: 0.8rem;">
      </div>
    `;

    item.querySelector('.btn-delete-draft').addEventListener('click', () => {
      state.draftCards.splice(idx, 1);
      renderDraftCardsList();
    });

    elements.draftCardsList.appendChild(item);
  });
}

function handleAddSelectedDrafts() {
  const checkboxes = elements.draftCardsList?.querySelectorAll('input[type="checkbox"]');
  if (!checkboxes) return;

  let addedCount = 0;
  checkboxes.forEach((chk, idx) => {
    if (chk.checked && state.draftCards[idx]) {
      const orig = state.draftCards[idx];
      const editedQ = document.getElementById(`draft-q-${idx}`)?.value.trim() || orig.question;
      const editedA = document.getElementById(`draft-a-${idx}`)?.value.trim() || orig.answer;
      const editedCat = document.getElementById(`draft-cat-${idx}`)?.value.trim() || orig.category || 'General';
      const editedSub = document.getElementById(`draft-sub-${idx}`)?.value.trim() || orig.subcategory || 'General';
      const editedTags = (document.getElementById(`draft-tags-${idx}`)?.value || '')
        .split(',').map(t => t.trim()).filter(Boolean);

      state.deck.cards.push({
        ...orig,
        question: editedQ,
        answer: editedA,
        category: editedCat,
        subcategory: editedSub,
        tags: editedTags.length > 0 ? editedTags : orig.tags
      });
      registerVocabItem(state.deck, editedCat, editedSub, editedTags.length > 0 ? editedTags : orig.tags);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    saveDeck(state.deck);
    updateCategoryDatalistsAndFilters();
    showToast(`Added ${addedCount} cards to master deck!`, 'success');
    state.draftCards = [];
    renderDraftCardsList();
    if (elements.aiSourceText) elements.aiSourceText.value = '';
    if (elements.aiDocIdInput) elements.aiDocIdInput.value = '';
    if (elements.aiLoadedDocBadge) {
      elements.aiLoadedDocBadge.style.display = 'none';
      elements.aiLoadedDocBadge.textContent = '';
    }
    const fileInput = document.getElementById('ai-doc-file-input');
    if (fileInput) fileInput.value = '';
    refreshDueQueue();
    updateLeitnerDashboard();
    renderDeckGrid();
    renderStudyView();
    autoSyncToDrive();
  } else {
    showToast('No cards selected.', 'info');
  }
}

// ---------------------------------------------------------------------------
// CLOUD SYNC & SETTINGS
// ---------------------------------------------------------------------------
function initGoogleClient() {
  if (state.settings.googleClientId) {
    initGoogleAuth(
      state.settings.googleClientId,
      (token) => {
        state.isDriveConnected = true;
        updateCloudStatus('connected', 'Google Drive Connected');
      },
      (err) => {
        console.warn('Google Auth Error:', err);
      }
    );

    // Check if token already exists in sessionStorage
    const existingToken = getCurrentToken();
    if (existingToken) {
      state.isDriveConnected = true;
      updateCloudStatus('connected', 'Google Drive Connected');
      prePopulateFromGoogleDrive(existingToken);
    } else {
      updateCloudStatus('offline', 'Click to Sign In');
    }
  } else {
    updateCloudStatus('offline', 'Offline Mode');
  }
}

function updateCloudStatus(status, text) {
  if (elements.cloudPill) {
    elements.cloudPill.className = `cloud-pill ${status}`;
  }
  if (elements.cloudText) {
    elements.cloudText.textContent = text;
  }
}

async function handleGoogleSignIn() {
  const clientId = elements.inputGoogleClientId?.value.trim() || 
                   document.getElementById('settings-google-client-id')?.value.trim() || 
                   state.settings.googleClientId;

  if (!clientId) {
    showToast('Please enter your Google OAuth Client ID first.', 'error');
    return;
  }

  state.settings.googleClientId = clientId;
  saveSettings(state.settings);

  initGoogleAuth(clientId);

  try {
    showToast('Opening Google Sign-In...', 'info');
    const token = await requestDriveAuth();
    if (token) {
      state.isDriveConnected = true;
      updateCloudStatus('connected', 'Google Drive Connected');
      showToast('Signed in to Google Drive!', 'success');
      // Pre-populate Category, Subcategory, and Tags from Google Drive without traversing document
      await prePopulateFromGoogleDrive(token);
      await handleSyncDriveManual();
    }
  } catch (err) {
    console.error('Sign-in error:', err);
    showToast(`Google Sign-In: ${err.message || err}`, 'error');
  }
}

async function handleSyncDriveManual() {
  // If no token exists, prompt sign-in directly
  if (!getCurrentToken()) {
    const clientId = state.settings.googleClientId || elements.inputGoogleClientId?.value.trim() || document.getElementById('settings-google-client-id')?.value.trim();
    if (!clientId) {
      showToast('Please enter your Google Client ID in Settings first.', 'info');
      elements.settingsModalBackdrop?.classList.add('open');
      return;
    }
    await handleGoogleSignIn();
    return;
  }

  state.isDriveConnected = true;
  state.isSyncing = true;
  updateCloudStatus('syncing', 'Syncing...');
  showToast('Syncing with Google Drive...', 'info');

  try {
    // 1. Search for remote my_deck.json
    const remoteFile = await findDeckFile();
    if (remoteFile) {
      state.driveFileId = remoteFile.id;
      const remoteDeck = await downloadDeck();
      if (remoteDeck && Array.isArray(remoteDeck.cards)) {
        // Collect deleted IDs from both local and remote
        const deletedSet = new Set(state.deck.deletedCardIds || []);
        if (Array.isArray(remoteDeck.deletedCardIds)) {
          remoteDeck.deletedCardIds.forEach(id => deletedSet.add(id));
          state.deck.deletedCardIds = Array.from(deletedSet);
        }

        // Merge remote cards with local deck, excluding deleted cards
        const cardMap = new Map();
        remoteDeck.cards.forEach(c => {
          if (!deletedSet.has(c.id)) {
            cardMap.set(c.id, c);
          }
        });
        state.deck.cards.forEach(c => {
          if (!deletedSet.has(c.id)) {
            cardMap.set(c.id, c);
          }
        });
        state.deck.cards = Array.from(cardMap.values());
        saveDeck(state.deck);
      }
    }

    // 2. Upload merged state
    await uploadDeck(state.deck);
    updateCloudStatus('connected', 'Synced with Drive');
    showToast('Deck synced successfully with Google Drive!', 'success');
    refreshDueQueue();
    updateLeitnerDashboard();
    renderDeckGrid();
    renderStudyView();
  } catch (err) {
    console.error('Sync error:', err);
    if (err.message && (err.message.includes('401') || err.message.includes('Not authenticated'))) {
      disconnectDrive();
      state.isDriveConnected = false;
      updateCloudStatus('offline', 'Session Expired');
      showToast('Session expired. Please sign in with Google again.', 'error');
    } else {
      updateCloudStatus('connected', 'Sync Failed');
      showToast(`Sync failed: ${err.message}`, 'error');
    }
  } finally {
    state.isSyncing = false;
  }
}

async function autoSyncToDrive() {
  if (!getCurrentToken() || state.isSyncing) return;
  try {
    state.isSyncing = true;
    updateCloudStatus('syncing', 'Syncing...');
    await uploadDeck(state.deck);
    updateCloudStatus('connected', 'Synced with Drive');
  } catch (err) {
    console.warn('Auto-sync failed:', err);
    updateCloudStatus('connected', 'Offline Sync Pending');
  } finally {
    state.isSyncing = false;
  }
}

function handleSaveSettings(e) {
  if (e && e.preventDefault) e.preventDefault();
  state.settings.geminiApiKey = elements.inputGeminiApiKey?.value.trim() || 
                                document.getElementById('settings-gemini-key')?.value.trim() || '';
  state.settings.googleClientId = elements.inputGoogleClientId?.value.trim() || 
                                  document.getElementById('settings-google-client-id')?.value.trim() || '';
  saveSettings(state.settings);

  showToast('Settings saved successfully!', 'success');
  elements.settingsModalBackdrop?.classList.remove('open');
  initGoogleClient();
}

// ---------------------------------------------------------------------------
// TOAST & UTILITIES
// ---------------------------------------------------------------------------
export function showToast(message, type = 'info') {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------------------
// EVENT LISTENERS
// ---------------------------------------------------------------------------
function setupEventListeners() {
  // Navigation Tabs (Desktop & Mobile)
  const switchTab = (targetTab) => {
    state.activeTab = targetTab;
    elements.navTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === targetTab);
    });
    elements.mobileNavItems.forEach(item => {
      item.classList.toggle('active', item.dataset.tab === targetTab);
    });
    elements.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab-${targetTab}`);
    });
  };

  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  elements.mobileNavItems.forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  // Theme Toggle
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.addEventListener('click', () => {
      const newTheme = state.settings.theme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      saveSettings(state.settings);
    });
  }

  // Study View Events
  if (elements.flipCardWrapper) {
    elements.flipCardWrapper.addEventListener('click', (e) => {
      // Don't flip if clicking inside input, button, or link
      if (e.target.closest('button, input, textarea, a, .btn-card-quick-delete')) return;
      flipCard();
    });
  }

  // Study Delete Controls
  const onStudyDeleteClick = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    handleStudyDeleteCard();
  };

  elements.btnStudyDelete?.addEventListener('click', onStudyDeleteClick);
  elements.btnStudyDeleteBottom?.addEventListener('click', onStudyDeleteClick);
  elements.btnCardDeleteFront?.addEventListener('click', onStudyDeleteClick);
  elements.btnCardDeleteBack?.addEventListener('click', onStudyDeleteClick);

  // Study Sync Controls
  const onStudySyncClick = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    handleStudySync();
  };

  elements.btnStudySync?.addEventListener('click', onStudySyncClick);
  elements.btnStudySyncBottom?.addEventListener('click', onStudySyncClick);

  elements.btnRateAgain?.addEventListener('click', () => handleRateCard('again'));
  elements.btnRateGood?.addEventListener('click', () => handleRateCard('good'));
  elements.btnRateEasy?.addEventListener('click', () => handleRateCard('easy'));
  elements.btnStudyAll?.addEventListener('click', () => {
    refreshDueQueue(true);
    renderStudyView();
    showToast('Starting comprehensive review of all cards!', 'info');
  });

  elements.btnAiEvaluate?.addEventListener('click', handleAiEvaluate);

  // Category & Subcategory Filter Listeners in Deck Manager
  document.getElementById('deck-category-select')?.addEventListener('change', (e) => {
    state.categoryFilter = e.target.value;
    state.subcategoryFilter = 'all'; // reset subcategory on category change
    updateCategoryDatalistsAndFilters();
    renderDeckGrid();
  });

  document.getElementById('deck-subcategory-select')?.addEventListener('change', (e) => {
    state.subcategoryFilter = e.target.value;
    renderDeckGrid();
  });

  // Batch Deletion Modal Listeners
  document.getElementById('btn-open-batch-delete')?.addEventListener('click', openBatchDeleteModal);
  document.getElementById('btn-close-batch-modal')?.addEventListener('click', () => {
    document.getElementById('batch-delete-modal-backdrop')?.classList.remove('open');
  });
  document.getElementById('btn-done-batch-modal')?.addEventListener('click', () => {
    document.getElementById('batch-delete-modal-backdrop')?.classList.remove('open');
  });
  document.getElementById('batch-delete-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'batch-delete-modal-backdrop') {
      e.target.classList.remove('open');
    }
  });

  // Batch Deletion Tabs
  document.querySelectorAll('.batch-tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.batch-tab-btn').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      const target = tabBtn.dataset.batchTab;
      document.querySelectorAll('.batch-tab-view').forEach(v => v.style.display = 'none');
      const targetView = document.getElementById(`batch-list-${target}`);
      if (targetView) targetView.style.display = 'block';
    });
  });

  // Deck Management Events
  elements.deckBtnBack?.addEventListener('click', handleDeckBack);

  elements.deckSearchInput?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    renderDeckGrid();
  });

  elements.filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      elements.filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.cardFilter = pill.dataset.filter;
      renderDeckGrid();
    });
  });

  elements.btnOpenAddCard?.addEventListener('click', openAddCardModal);
  elements.btnCancelCardModal?.addEventListener('click', () => {
    elements.cardModalBackdrop?.classList.remove('open');
  });
  elements.cardForm?.addEventListener('submit', handleSaveCardModal);

  // AI Generator Events
  elements.btnRunGenerate?.addEventListener('click', handleRunGenerate);

  // File Upload for AI Generator
  elements.aiLoadedDocBadge?.addEventListener('click', () => {
    if (elements.aiDocIdInput) elements.aiDocIdInput.value = '';
    if (elements.aiLoadedDocBadge) {
      elements.aiLoadedDocBadge.style.display = 'none';
      elements.aiLoadedDocBadge.textContent = '';
    }
    const fileInput = document.getElementById('ai-doc-file-input');
    if (fileInput) fileInput.value = '';
    showToast('Document detached.', 'info');
  });

  document.getElementById('ai-doc-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (elements.aiSourceText) elements.aiSourceText.value = ev.target.result;
      const cleanDocId = file.name.replace(/\.[^/.]+$/, "");
      if (elements.aiDocIdInput) elements.aiDocIdInput.value = cleanDocId;
      if (elements.aiLoadedDocBadge) {
        elements.aiLoadedDocBadge.textContent = `📄 ${file.name} ✕`;
        elements.aiLoadedDocBadge.style.display = 'inline-block';
      }
      showToast(`Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`, 'success');
    };
    reader.readAsText(file);
  });
  // Drag & drop support on textarea
  const textarea = elements.aiSourceText;
  if (textarea) {
    textarea.addEventListener('input', () => {
      if (!textarea.value.trim()) {
        if (elements.aiDocIdInput) elements.aiDocIdInput.value = '';
        if (elements.aiLoadedDocBadge) {
          elements.aiLoadedDocBadge.style.display = 'none';
          elements.aiLoadedDocBadge.textContent = '';
        }
        const fileInput = document.getElementById('ai-doc-file-input');
        if (fileInput) fileInput.value = '';
      }
    });
    textarea.addEventListener('dragover', (e) => {
      e.preventDefault();
      textarea.style.borderColor = 'var(--accent-cyan)';
      textarea.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.5)';
    });
    textarea.addEventListener('dragleave', () => {
      textarea.style.borderColor = '';
      textarea.style.boxShadow = '';
    });
    textarea.addEventListener('drop', (e) => {
      e.preventDefault();
      textarea.style.borderColor = '';
      textarea.style.boxShadow = '';
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          textarea.value = ev.target.result;
          const cleanDocId = file.name.replace(/\.[^/.]+$/, "");
          if (elements.aiDocIdInput) elements.aiDocIdInput.value = cleanDocId;
          if (elements.aiLoadedDocBadge) {
            elements.aiLoadedDocBadge.textContent = `📄 ${file.name} ✕`;
            elements.aiLoadedDocBadge.style.display = 'inline-block';
          }
          showToast(`Loaded "${file.name}" via drag & drop!`, 'success');
        };
        reader.readAsText(file);
      }
    });
  }

  elements.btnAddSelectedDrafts?.addEventListener('click', handleAddSelectedDrafts);

  // AI Generator Combobox & Tag Events
  elements.aiCategorySelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      if (elements.aiCategoryInput) elements.aiCategoryInput.value = val;
      updateSubcategoryCombobox(val);
      e.target.value = '';
    }
  });

  elements.aiCategoryInput?.addEventListener('input', (e) => {
    updateSubcategoryCombobox(e.target.value);
  });

  elements.aiSubcategorySelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      if (elements.aiSubcategoryInput) elements.aiSubcategoryInput.value = val;
      e.target.value = '';
    }
  });

  elements.btnAddTag?.addEventListener('click', handleAddTagFromCombobox);
  elements.aiTagSelect?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTagFromCombobox();
    }
  });

  // Settings & Sync Modal Events
  elements.btnOpenSettings?.addEventListener('click', () => {
    if (elements.inputGoogleClientId) elements.inputGoogleClientId.value = state.settings.googleClientId || '';
    if (elements.inputGeminiApiKey) elements.inputGeminiApiKey.value = state.settings.geminiApiKey || '';
    elements.settingsModalBackdrop?.classList.add('open');
  });
  elements.cloudPill?.addEventListener('click', () => {
    elements.btnOpenSettings?.click();
  });
  elements.btnCancelSettings?.addEventListener('click', () => {
    elements.settingsModalBackdrop?.classList.remove('open');
  });
  elements.settingsForm?.addEventListener('submit', handleSaveSettings);
    elements.btnGoogleSignIn?.addEventListener('click', handleGoogleSignIn);
  document.getElementById('btn-google-signin-tab')?.addEventListener('click', handleGoogleSignIn);

  elements.btnSyncDriveManual?.addEventListener('click', handleSyncDriveManual);
  document.getElementById('btn-sync-drive-tab')?.addEventListener('click', handleSyncDriveManual);

  // Export / Import
  elements.btnExportJson?.addEventListener('click', () => {
    exportDeckJson(state.deck);
    showToast('Exported my_deck.json successfully.', 'success');
  });

  elements.fileImportInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        state.deck = importDeckJson(ev.target.result);
        refreshDueQueue();
        updateLeitnerDashboard();
        renderDeckGrid();
        renderStudyView();
        showToast('Deck imported successfully!', 'success');
        elements.settingsModalBackdrop?.classList.remove('open');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
    reader.readAsText(file);
  });

  elements.btnResetDeck?.addEventListener('click', () => {
    if (confirm('Reset to initial sample deck? Any local changes will be replaced.')) {
      state.deck = JSON.parse(JSON.stringify(INITIAL_SAMPLE_DECK));
      saveDeck(state.deck);
      refreshDueQueue();
      updateLeitnerDashboard();
      renderDeckGrid();
      renderStudyView();
      showToast('Deck reset to sample data.', 'info');
      elements.settingsModalBackdrop?.classList.remove('open');
    }
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Ignore keyboard shortcuts if user is typing in an input or textarea
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    if (state.activeTab === 'study' && state.dueQueue.length > 0) {
      if (e.code === 'Space') {
        e.preventDefault();
        flipCard();
      } else if (e.key === '1' || e.key.toLowerCase() === 'a') {
        handleRateCard('again');
      } else if (e.key === '2' || e.key.toLowerCase() === 'g') {
        handleRateCard('good');
      } else if (e.key === '3' || e.key.toLowerCase() === 'e') {
        handleRateCard('easy');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleStudyDeleteCard();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleStudySync();
      }
    }
  });
}

// Start app on DOMContentLoaded
window.addEventListener('DOMContentLoaded', init);
