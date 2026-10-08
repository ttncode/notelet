// Chrome's list commands can leave the new list inside a <p>, which the HTML parser
// splits into empty paragraphs the next time the note is loaded.
export function liftListOutOfParagraph(list) {
  const paragraph = list.parentElement;
  if (paragraph?.tagName !== "P") return;
  const after = paragraph.ownerDocument.createElement("p");
  while (list.nextSibling) after.append(list.nextSibling);
  paragraph.after(list);
  if (after.hasChildNodes()) list.after(after);
  if (paragraph.textContent === "") paragraph.remove();
}
