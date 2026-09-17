/**
 * Google Gemini 3.6 AI Engine (Client-Side REST).
 * Handles:
 * 1. AI Flashcard generation with customizable card counts, categories, subcategories, and tags.
 * 2. Specialized cheat sheet & educational text parsing.
 * 3. Real-time answer grading and constructive feedback.
 * 4. Deterministic intelligent offline parser fallback.
 */

import { getTodayStr } from './leitner.js';

export async function generateCardsFromText(
  rawText,
  apiKey,
  documentId = 'doc-web',
  cardCount = 'auto',
  userCategory = 'General',
  userSubcategory = 'General',
  customTags = []
) {
  if (!rawText || !rawText.trim()) {
    throw new Error('Please enter text or notes to generate flashcards from.');
  }

  const isAuto = cardCount === 'auto' || !cardCount;
  const targetCount = isAuto ? 100 : (parseInt(cardCount, 10) || 10);
  const safeCategory = (userCategory && userCategory.trim()) ? userCategory.trim() : 'General';
  const safeSubcategory = (userSubcategory && userSubcategory.trim()) ? userSubcategory.trim() : 'General';

  // 1. If valid API key provided, call real Google Gemini 3.6 Flash
  if (apiKey && apiKey.trim()) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey.trim()}`;
      const countInstruction = isAuto
        ? "Generate as many high-yield flashcards as you deem appropriate to thoroughly cover all key concepts, commands, rules, definitions, and takeaways without leaving important material out."
        : `Generate up to ${targetCount} comprehensive, high-quality flashcards.`;

      const prompt = `You are an expert educational tutor creating high-yield flashcards.
Analyze the following educational text, tutorial, or cheat sheet.
${countInstruction}

Rules:
1. Category & Subcategory: Assign each flashcard the category "${safeCategory}" and subcategory "${safeSubcategory}".
2. Tags/Labels: ${customTags && customTags.length > 0 ? `Include these user labels: ${JSON.stringify(customTags)}, plus any concept-specific tags you extract from the text.` : `Extract relevant concept-specific tags from the text based on the subject matter.`}
3. Cover every distinct command, concept, definition, shortcut, or key takeaway.
4. If this is a cheat sheet, command reference, or study guide, create individual flashcards for each command, concept, or shortcut.
5. Make answers concise, precise, and educational.
6. Format your output strictly as a JSON array of objects with keys:
   - "question": string
   - "answer": string
   - "category": "${safeCategory}"
   - "subcategory": "${safeSubcategory}"
   - "tags": array of strings (including custom labels)
Do not include markdown fences, backticks, or preamble text.

Document Content:
${rawText.trim()}`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Gemini API returned HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      let items = [];
      try {
        items = JSON.parse(rawJson);
      } catch (e) {
        const cleaned = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        items = JSON.parse(cleaned);
      }

      const today = getTodayStr();
      if (Array.isArray(items) && items.length > 0) {
        const finalItems = isAuto ? items : items.slice(0, targetCount);
        return finalItems.map((item, idx) => {
          const itemTags = Array.isArray(item.tags) ? item.tags : [];
          const mergedTags = new Set([...itemTags, ...customTags]);
          return {
            id: crypto.randomUUID ? crypto.randomUUID() : 'card-' + Date.now() + '-' + idx,
            question: item.question,
            answer: item.answer,
            category: item.category || safeCategory,
            subcategory: item.subcategory || safeSubcategory,
            box_number: 1,
            last_reviewed: today,
            next_review_date: today,
            tags: Array.from(mergedTags),
            source_document_id: documentId && documentId !== 'doc-web' ? documentId : null
          };
        });
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to enhanced local parser:', err);
      window.lastGeminiError = err.message;
    }
  }

  // 2. Enhanced Intelligent Offline Parser
  return enhancedLocalParser(rawText, documentId, targetCount, safeCategory, safeSubcategory, customTags);
}

export async function evaluateAnswerWithGemini(question, referenceAnswer, studentAnswer, apiKey) {
  if (!studentAnswer || !studentAnswer.trim()) {
    return {
      is_correct: false,
      score: 0,
      feedback: "Please provide an answer before asking the AI tutor to evaluate."
    };
  }

  if (apiKey && apiKey.trim()) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey.trim()}`;
      const prompt = `You are an encouraging and rigorous AI tutor evaluating a student's answer to a flashcard.
Flashcard Question: ${question}
Reference Answer: ${referenceAnswer}
Student Answer: ${studentAnswer}

Evaluate if the student demonstrates understanding of the core concept.
Format your output strictly as a JSON object with:
{
  "is_correct": true or false,
  "score": integer between 0 and 100,
  "feedback": "constructive 1-2 sentence feedback explaining what was right or missing"
}
Do not include markdown fences or any other text.`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        const data = await resp.json();
        const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const cleaned = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          is_correct: Boolean(parsed.is_correct),
          score: Number(parsed.score) || (parsed.is_correct ? 80 : 35),
          feedback: parsed.feedback || (parsed.is_correct ? "Great grasp of the core concept!" : "Review the reference answer.")
        };
      }
    } catch (err) {
      console.warn('Gemini answer evaluation failed, using heuristic evaluation:', err);
    }
  }

  return heuristicEvaluateAnswer(referenceAnswer, studentAnswer);
}

function enhancedLocalParser(text, documentId, maxCards = 20, userCategory = 'General', userSubcategory = 'General', customTags = []) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const cards = [];
  const today = getTodayStr();

  let currentSection = userSubcategory || 'General';
  let i = 0;

  const isHeading = (line) => {
    return line.length < 35 && (
      line.startsWith('#') ||
      /^[A-Z][A-Za-z0-9\s]{2,25}$/.test(line) ||
      ['Basic Usage', 'Movement', 'Deleting', 'Cut and Paste', 'Search and Replace', 'Insert mode'].some(h => line.toLowerCase().includes(h.toLowerCase()))
    );
  };

  while (i < lines.length && cards.length < maxCards) {
    const line = lines[i];

    if (isHeading(line) && !line.includes(':') && !line.includes('.')) {
      currentSection = line.replace(/^#+\s*/, '').trim();
      i++;
      continue;
    }

    // Pattern A: Inline separator
    if ((line.includes(':') || line.includes(' - ')) && line.length > 15) {
      const parts = line.includes(' - ') ? line.split(' - ') : line.split(':');
      const term = parts[0].replace(/^[-*\d.]+\s*/, '').trim();
      const def = parts.slice(1).join(line.includes(' - ') ? ' - ' : ':').trim();
      if (term.length >= 2 && term.length <= 40 && def.length >= 6) {
        cards.push({
          id: 'card-' + Date.now() + '-' + cards.length,
          question: `What is the function of "${term}"?`,
          answer: def,
          category: userCategory || 'General',
          subcategory: (userSubcategory && userSubcategory !== 'General') ? userSubcategory : currentSection,
          box_number: 1,
          last_reviewed: today,
          next_review_date: today,
          tags: Array.from(new Set([
            ...customTags,
            ...(currentSection && currentSection !== 'General' ? [currentSection.toLowerCase().replace(/[^a-z0-9]+/g, '-')] : [])
          ].filter(Boolean))),
          source_document_id: documentId && documentId !== 'doc-web' ? documentId : null
        });
        i++;
        continue;
      }
    }

    // Pattern B: Two-line Cheat Sheet (Line 1: Command, Line 2: Description)
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const isShortCommand = line.length <= 25 && !line.endsWith('.') && !line.endsWith('!') && !isHeading(line);
      const isDescription = nextLine.length >= 5 && (nextLine.endsWith('.') || nextLine.length > 12) && !isHeading(nextLine);

      if (isShortCommand && isDescription) {
        const cleanCmd = line.replace(/^[-*]\s*/, '').trim();
        const contextSubject = (userCategory && userCategory !== 'General') ? userCategory : (currentSection && currentSection !== 'General' ? currentSection : '');
        const qText = contextSubject ? `In ${contextSubject}, what does "${cleanCmd}" do?` : `What does "${cleanCmd}" do?`;
        cards.push({
          id: 'card-' + Date.now() + '-' + cards.length,
          question: qText,
          answer: nextLine,
          category: userCategory || 'General',
          subcategory: (userSubcategory && userSubcategory !== 'General') ? userSubcategory : currentSection,
          box_number: 1,
          last_reviewed: today,
          next_review_date: today,
          tags: Array.from(new Set([
            ...customTags,
            ...(currentSection && currentSection !== 'General' ? [currentSection.toLowerCase().replace(/[^a-z0-9]+/g, '-')] : [])
          ].filter(Boolean))),
          source_document_id: documentId && documentId !== 'doc-web' ? documentId : null
        });
        i += 2;
        continue;
      }
    }

    i++;
  }

  if (cards.length === 0) {
    const summaryTitle = (documentId && documentId !== 'doc-web') ? `Key summary for "${documentId}":` : `Key concept summary:`;
    cards.push({
      id: 'card-' + Date.now() + '-1',
      question: summaryTitle,
      answer: text.slice(0, 180).trim() + (text.length > 180 ? '...' : ''),
      category: userCategory || 'General',
      subcategory: userSubcategory || 'General',
      box_number: 1,
      last_reviewed: today,
      next_review_date: today,
      tags: Array.from(new Set([...customTags, 'summary'].filter(Boolean))),
      source_document_id: documentId && documentId !== 'doc-web' ? documentId : null
    });
  }

  return cards;
}

function heuristicEvaluateAnswer(reference, student) {
  const refWords = reference.toLowerCase().match(/\b[a-z0-9]{3,}\b/g) || [];
  const stuWords = student.toLowerCase().match(/\b[a-z0-9]{3,}\b/g) || [];

  if (stuWords.length === 0) {
    return { is_correct: false, score: 0, feedback: "No answer detected." };
  }

  let matches = 0;
  for (const w of stuWords) {
    if (refWords.includes(w)) matches++;
  }

  const ratio = matches / Math.max(1, Math.min(refWords.length, 6));
  const isCorrect = ratio >= 0.4 || stuWords.length >= 8;
  const score = Math.min(100, Math.round(ratio * 100) + (isCorrect ? 25 : 10));

  return {
    is_correct: isCorrect,
    score: score,
    feedback: isCorrect
      ? `Strong explanation! You hit ${matches} key terms aligned with the reference concept.`
      : `Partially covered. Ensure you include the core definition: "${reference.slice(0, 80)}..."`
  };
}
