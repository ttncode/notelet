const HISTORY_LIMIT = 200;

export class History {
  #past = [];
  #future = [];

  record(snapshot) {
    if (this.#past.at(-1)?.html === snapshot.html) return;
    this.#past.push(snapshot);
    if (this.#past.length > HISTORY_LIMIT) this.#past.shift();
    this.#future = [];
  }

  undo(current) {
    let previous = this.#past.pop();
    while (previous && previous.html === current.html) previous = this.#past.pop();
    if (!previous) return null;
    this.#future.push(current);
    return previous;
  }

  redo(current) {
    const next = this.#future.pop();
    if (!next) return null;
    this.#past.push(current);
    return next;
  }

  clear() {
    this.#past = [];
    this.#future = [];
  }
}
