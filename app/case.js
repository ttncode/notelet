// An apostrophe stays inside a word, so "don't" becomes "Don't", not "Don'T".
const WORD_CHAR = /[\p{L}\p{N}_'’]/u;

const lower = (text) => text.toLowerCase();
const upper = (text) => text.toUpperCase();
// before is the character just ahead of text, for text split over several nodes.
const title = (text, before = "") => [...text].map((char, index, chars) => {
  const previous = index === 0 ? before : chars[index - 1];
  return WORD_CHAR.test(previous) ? char.toLowerCase() : char.toUpperCase();
}).join("");

// Word's Shift+F3: lowercase, then UPPERCASE, then Capitalize Each Word, then lowercase again.
// A step that would leave the text as it is gets skipped.
export function nextCase(text) {
  const order = text === upper(text) ? [title, lower, upper] : text === lower(text) ? [upper, title, lower] : [lower, upper, title];
  return order.find((change) => change(text) !== text) ?? lower;
}

// The word around offset as [start, end]; equal when the caret touches no word.
export function wordAt(text, offset) {
  let start = offset;
  let end = offset;
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start -= 1;
  while (end < text.length && WORD_CHAR.test(text[end])) end += 1;
  return [start, end];
}
