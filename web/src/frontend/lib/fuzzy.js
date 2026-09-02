// Small fuzzy matcher: returns a score (higher is better) and matched indices, or null.
export function fuzzyMatch(query, text) {
  if (!query) return { score: 0, indices: [] };
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  const indices = [];
  let lastMatch = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      if (lastMatch === ti - 1) score += 6; // consecutive
      if (ti === 0 || /[\s/._-]/.test(t[ti - 1])) score += 8; // word start
      score += 2;
      lastMatch = ti;
      qi++;
    }
  }
  if (qi < q.length) return null;
  score -= Math.min(20, t.length / 6);
  score -= indices[0] / 4;
  return { score, indices };
}
