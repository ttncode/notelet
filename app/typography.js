// macOS-style substitutions: what was typed becomes the typographic character, and Undo
// right after gives the typed text back.
// Longest first, so "<=>" is not read as "=>" with a "<" before it.
const SUBSTITUTIONS = [
  ["<-->", "⟷"],
  ["<==>", "⟺"],
  ["===>", "⟹"],
  ["<===", "⟸"],
  ["<->", "↔"],
  ["<=>", "⇔"],
  ["-->", "⟶"],
  ["<--", "⟵"],
  ["==>", "⇒"],
  ["<==", "⇐"],
  ["...", "…"],
  ["->", "→"],
  ["<-", "←"],
  ["<=", "≤"],
  [">=", "≥"],
  ["=>", "≥"],
  ["!=", "≠"],
  ["--", "—"],
];
// "--->" or "<<=" is something else being typed, not a symbol with a stray character before it.
const TOKEN_CHARACTERS = new Set(["-", "<", ">", "=", ".", "!"]);
const OPENING_CONTEXT = /[\s([{“‘—–]/;
const SMART_QUOTES = { '"': ["“", "”"], "'": ["‘", "’"] };

// The substitution for the text just before the caret, or null when it ends with none.
export function substitutionBefore(text) {
  const match = SUBSTITUTIONS.find(([typed]) => text.endsWith(typed));
  if (!match) return null;
  const [typed, replacement] = match;
  if (TOKEN_CHARACTERS.has(text.at(-typed.length - 1))) return null;
  return { typed, replacement };
}

export const isStraightQuote = (key) => Object.hasOwn(SMART_QUOTES, key);

// A quote at the start of a line or after a space or bracket opens; anywhere else, as in
// "don't", it closes.
export function smartQuote(quote, previousCharacter) {
  const [opening, closing] = SMART_QUOTES[quote];
  return !previousCharacter || OPENING_CONTEXT.test(previousCharacter) ? opening : closing;
}
