// Lightweight fuzzy search - no external dependencies
// Matches characters in order, scores based on consecutive matches and position

export interface FuzzyResult<T> {
  item: T;
  score: number;
  indices: number[];
}

export function fuzzySearch<T>(query: string, items: T[], getKey: (item: T) => string): FuzzyResult<T>[] {
  if (!query) return items.map(item => ({ item, score: 0, indices: [] }));

  const lowerQuery = query.toLowerCase();
  const results: FuzzyResult<T>[] = [];

  for (const item of items) {
    const key = getKey(item).toLowerCase();
    const result = fuzzyMatch(lowerQuery, key);
    if (result) {
      results.push({ item, score: result.score, indices: result.indices });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

function fuzzyMatch(query: string, target: string): { score: number; indices: number[] } | null {
  if (query.length === 0) return { score: 0, indices: [] };
  if (query.length > target.length) return null;

  const indices: number[] = [];
  let queryIdx = 0;
  let score = 0;
  let lastMatchIdx = -2;

  for (let i = 0; i < target.length && queryIdx < query.length; i++) {
    if (target[i] === query[queryIdx]) {
      indices.push(i);
      // Consecutive match bonus
      if (i === lastMatchIdx + 1) {
        score += 10;
      }
      // Start of word bonus
      if (i === 0 || target[i - 1] === ' ' || target[i - 1] === '_' || target[i - 1] === '-') {
        score += 5;
      }
      // Exact position bonus
      if (i === queryIdx) {
        score += 3;
      }
      score += 1;
      lastMatchIdx = i;
      queryIdx++;
    }
  }

  if (queryIdx !== query.length) return null;

  // Bonus for shorter targets (more precise match)
  score += Math.max(0, 20 - (target.length - query.length));

  return { score, indices };
}

// Simple substring search fallback
export function substringSearch<T>(query: string, items: T[], getKey: (item: T) => string): T[] {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items.filter(item => getKey(item).toLowerCase().includes(lower));
}
