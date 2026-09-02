// Presence colours for collaborators: vivid but sit well on the dark palette.
export const PRESENCE_COLORS = [
  '#c8f04a', '#60a5fa', '#f472b6', '#f5b83b', '#34d399', '#a78bfa', '#fb7185', '#22d3ee', '#fbbf24', '#818cf8',
];
export function hashString(s = '') {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
export function colorFor(id = '') {
  return PRESENCE_COLORS[hashString(id) % PRESENCE_COLORS.length];
}
export function initials(name = '') {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
