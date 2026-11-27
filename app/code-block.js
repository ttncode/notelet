// A code block is a run of Monostyled lines (<pre>) next to each other. Its language is kept on
// each line as data-language, so it survives the first line being deleted or moved.
export const CODE_LANGUAGES = [
  ["", "Plain text"],
  ["bash", "Bash"],
  ["css", "CSS"],
  ["html", "HTML"],
  ["javascript", "JavaScript"],
  ["json", "JSON"],
  ["markdown", "Markdown"],
  ["php", "PHP"],
  ["python", "Python"],
  ["sql", "SQL"],
  ["typescript", "TypeScript"],
  ["yaml", "YAML"],
];
const LANGUAGE_IDS = new Set(CODE_LANGUAGES.map(([id]) => id).filter(Boolean));
const FENCE_ALIASES = { js: "javascript", ts: "typescript", sh: "bash", shell: "bash", py: "python", yml: "yaml", md: "markdown" };
const FENCE = /^```([a-z]*)$/i;

export const isCodeLanguage = (id) => LANGUAGE_IDS.has(id);

export function codeBlockLines(line) {
  let first = line;
  while (first.previousElementSibling?.tagName === "PRE") first = first.previousElementSibling;
  const lines = [first];
  while (lines.at(-1).nextElementSibling?.tagName === "PRE") lines.push(lines.at(-1).nextElementSibling);
  return lines;
}

export const codeBlockFirstLines = (root) => [...root.querySelectorAll("pre")].filter((line) => line.previousElementSibling?.tagName !== "PRE");

export const languageOf = (lines) => lines.map((line) => line.getAttribute("data-language")).find(isCodeLanguage) ?? "";

// An empty language makes the block plain text.
export function setLanguage(lines, language) {
  for (const line of lines) {
    if (language) line.setAttribute("data-language", language);
    else line.removeAttribute("data-language");
  }
}

// A line that joins a code block (made Monostyled above it, moved or pasted next to it) takes
// the block's language, so the corner label, the colours and a copy all agree.
export function unifyCodeLanguages(root) {
  for (const firstLine of codeBlockFirstLines(root)) {
    const lines = codeBlockLines(firstLine);
    const language = languageOf(lines);
    if (lines.some((line) => (line.getAttribute("data-language") ?? "") !== language)) setLanguage(lines, language);
  }
}

// "```" gives "", "```php" or "```js" the language's id; anything else, null.
export function fenceLanguage(text) {
  const match = FENCE.exec(text);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const id = FENCE_ALIASES[name] ?? name;
  return id === "" || isCodeLanguage(id) ? id : null;
}
