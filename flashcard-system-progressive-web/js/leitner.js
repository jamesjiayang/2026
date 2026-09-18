/**
 * Leitner Spaced-Repetition Algorithm Engine.
 * Adheres strictly to the 5-box intervals and data contracts of the Flashcard System:
 * Box 1: 1 day
 * Box 2: 3 days
 * Box 3: 7 days
 * Box 4: 14 days
 * Box 5: 30 days
 */

export const LEITNER_INTERVALS = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30
};

export function getTodayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isCardDue(card, todayStr = getTodayStr()) {
  if (!card.next_review_date) return true;
  return card.next_review_date <= todayStr;
}

export function getDueCards(deck, todayStr = getTodayStr(), category = null, subcategory = null) {
  if (!deck || !Array.isArray(deck.cards)) return [];
  let cards = deck.cards;
  if (category && category !== 'all') {
    const catTarget = category.trim().toLowerCase();
    cards = cards.filter(c => (c.category || 'General').trim().toLowerCase() === catTarget);
    if (subcategory && subcategory !== 'all') {
      const subTarget = subcategory.trim().toLowerCase();
      cards = cards.filter(c => (c.subcategory || 'General').trim().toLowerCase() === subTarget);
    }
  }
  return cards.filter(c => isCardDue(c, todayStr));
}

export function advanceCard(card, todayStr = getTodayStr()) {
  const oldBox = card.box_number || 1;
  const newBox = Math.min(oldBox + 1, 5);
  const interval = LEITNER_INTERVALS[newBox] || 1;
  
  return {
    ...card,
    box_number: newBox,
    last_reviewed: todayStr,
    next_review_date: addDays(todayStr, interval)
  };
}

export function resetCard(card, todayStr = getTodayStr()) {
  return {
    ...card,
    box_number: 1,
    last_reviewed: todayStr,
    next_review_date: addDays(todayStr, 1)
  };
}

export function getDeckStatistics(deck, todayStr = getTodayStr(), category = null, subcategory = null) {
  let cards = (deck && Array.isArray(deck.cards)) ? deck.cards : [];
  if (category && category !== 'all') {
    const catTarget = category.trim().toLowerCase();
    cards = cards.filter(c => (c.category || 'General').trim().toLowerCase() === catTarget);
    if (subcategory && subcategory !== 'all') {
      const subTarget = subcategory.trim().toLowerCase();
      cards = cards.filter(c => (c.subcategory || 'General').trim().toLowerCase() === subTarget);
    }
  }
  const totalCards = cards.length;
  let dueCount = 0;
  const boxCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const card of cards) {
    const box = Math.max(1, Math.min(card.box_number || 1, 5));
    boxCounts[box] = (boxCounts[box] || 0) + 1;
    if (isCardDue(card, todayStr)) {
      dueCount++;
    }
  }

  const masteredCount = (boxCounts[4] || 0) + (boxCounts[5] || 0);
  const masteryPercentage = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

  return {
    totalCards,
    dueCount,
    boxCounts,
    masteredCount,
    masteryPercentage
  };
}

export function getUniqueCategories(deck) {
  if (!deck || !Array.isArray(deck.cards)) return [];
  const counts = {};
  deck.cards.forEach(c => {
    const cat = (c.category || 'General').trim();
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return Object.entries(counts).map(([name, count]) => ({ name, count }));
}

export function getUniqueSubcategories(deck, selectedCategory = null) {
  if (!deck || !Array.isArray(deck.cards)) return [];
  const counts = {};
  deck.cards.forEach(c => {
    const cat = (c.category || 'General').trim();
    if (!selectedCategory || selectedCategory === 'all' || cat.toLowerCase() === selectedCategory.toLowerCase()) {
      const sub = (c.subcategory || 'General').trim();
      const key = `${cat}|||${sub}`;
      if (!counts[key]) {
        counts[key] = { category: cat, subcategory: sub, count: 0 };
      }
      counts[key].count += 1;
    }
  });
  return Object.values(counts);
}

export function getUniqueTags(deck) {
  if (!deck || !Array.isArray(deck.cards)) return [];
  const counts = {};
  deck.cards.forEach(c => {
    (c.tags || []).forEach(t => {
      const tag = t.trim();
      if (tag) counts[tag] = (counts[tag] || 0) + 1;
    });
  });
  return Object.entries(counts).map(([tag, count]) => ({ tag, count }));
}

export function deleteCardsByCategory(deck, category) {
  if (!deck || !Array.isArray(deck.cards)) return 0;
  const initial = deck.cards.length;
  const toDelete = deck.cards.filter(c => (c.category || 'General').trim().toLowerCase() === category.trim().toLowerCase());
  if (toDelete.length > 0) {
    if (!deck.deletedCardIds) deck.deletedCardIds = [];
    toDelete.forEach(c => {
      if (c.id && !deck.deletedCardIds.includes(c.id)) deck.deletedCardIds.push(c.id);
    });
  }
  deck.cards = deck.cards.filter(c => (c.category || 'General').trim().toLowerCase() !== category.trim().toLowerCase());
  return initial - deck.cards.length;
}

export function deleteCardsBySubcategory(deck, category, subcategory) {
  if (!deck || !Array.isArray(deck.cards)) return 0;
  const initial = deck.cards.length;
  const toDelete = deck.cards.filter(c => {
    const catMatch = (c.category || 'General').trim().toLowerCase() === category.trim().toLowerCase();
    const subMatch = (c.subcategory || 'General').trim().toLowerCase() === subcategory.trim().toLowerCase();
    return catMatch && subMatch;
  });
  if (toDelete.length > 0) {
    if (!deck.deletedCardIds) deck.deletedCardIds = [];
    toDelete.forEach(c => {
      if (c.id && !deck.deletedCardIds.includes(c.id)) deck.deletedCardIds.push(c.id);
    });
  }
  deck.cards = deck.cards.filter(c => {
    const catMatch = (c.category || 'General').trim().toLowerCase() === category.trim().toLowerCase();
    const subMatch = (c.subcategory || 'General').trim().toLowerCase() === subcategory.trim().toLowerCase();
    return !(catMatch && subMatch);
  });
  return initial - deck.cards.length;
}

export function deleteCardsByTag(deck, tag) {
  if (!deck || !Array.isArray(deck.cards)) return 0;
  const initial = deck.cards.length;
  const toDelete = deck.cards.filter(c => (c.tags || []).some(t => t.trim().toLowerCase() === tag.trim().toLowerCase()));
  if (toDelete.length > 0) {
    if (!deck.deletedCardIds) deck.deletedCardIds = [];
    toDelete.forEach(c => {
      if (c.id && !deck.deletedCardIds.includes(c.id)) deck.deletedCardIds.push(c.id);
    });
  }
  deck.cards = deck.cards.filter(c => !(c.tags || []).some(t => t.trim().toLowerCase() === tag.trim().toLowerCase()));
  return initial - deck.cards.length;
}

export function extractDeckVocab(deck) {
  if (deck && Array.isArray(deck.categories) && deck.subcategories && Array.isArray(deck.tags)) {
    return {
      categories: deck.categories,
      subcategories: deck.subcategories,
      tags: deck.tags
    };
  }

  const categoriesSet = new Set();
  const subcategoriesMap = { _all: [] };
  const allSubsSet = new Set();
  const tagsSet = new Set();

  if (deck && Array.isArray(deck.cards)) {
    deck.cards.forEach(c => {
      const cat = (c.category || 'General').trim();
      const sub = (c.subcategory || 'General').trim();
      if (cat) categoriesSet.add(cat);
      if (sub) {
        allSubsSet.add(sub);
        if (!subcategoriesMap[cat]) subcategoriesMap[cat] = [];
        if (!subcategoriesMap[cat].includes(sub)) {
          subcategoriesMap[cat].push(sub);
        }
      }
      (c.tags || []).forEach(t => {
        const tag = (t || '').trim();
        if (tag) tagsSet.add(tag);
      });
    });
  }

  subcategoriesMap._all = Array.from(allSubsSet).sort();

  const vocab = {
    categories: Array.from(categoriesSet).sort(),
    subcategories: subcategoriesMap,
    tags: Array.from(tagsSet).sort()
  };

  if (deck) {
    deck.categories = vocab.categories;
    deck.subcategories = vocab.subcategories;
    deck.tags = vocab.tags;
  }

  return vocab;
}

export function registerVocabItem(deck, category, subcategory, tags = []) {
  if (!deck) return;
  if (!Array.isArray(deck.categories)) deck.categories = [];
  if (!deck.subcategories) deck.subcategories = { _all: [] };
  if (!Array.isArray(deck.tags)) deck.tags = [];

  const cat = (category || 'General').trim();
  const sub = (subcategory || 'General').trim();

  if (cat && !deck.categories.includes(cat)) {
    deck.categories.push(cat);
    deck.categories.sort();
  }
  if (sub) {
    if (!deck.subcategories._all) deck.subcategories._all = [];
    if (!deck.subcategories._all.includes(sub)) {
      deck.subcategories._all.push(sub);
      deck.subcategories._all.sort();
    }
    if (!deck.subcategories[cat]) deck.subcategories[cat] = [];
    if (!deck.subcategories[cat].includes(sub)) {
      deck.subcategories[cat].push(sub);
      deck.subcategories[cat].sort();
    }
  }
  if (Array.isArray(tags)) {
    tags.forEach(t => {
      const tag = (t || '').trim();
      if (tag && !deck.tags.includes(tag)) {
        deck.tags.push(tag);
      }
    });
    deck.tags.sort();
  }
}
