/**
 * Incrementally decodes one string field (e.g. "narration") out of a JSON
 * object that arrives in fragments, so narration can be shown while the tool
 * input is still streaming.
 */
export class JsonFieldStreamer {
  private buf = '';
  private cursor = -1;
  private done = false;

  constructor(private readonly keys: string[]) {}

  push(chunk: string): string {
    this.buf += chunk;
    if (this.done) return '';
    if (this.cursor < 0) {
      const re = new RegExp(`"(${this.keys.join('|')})"\\s*:\\s*"`);
      const m = re.exec(this.buf);
      if (!m) return '';
      this.cursor = m.index + m[0].length;
    }
    let out = '';
    while (this.cursor < this.buf.length) {
      const ch = this.buf[this.cursor]!;
      if (ch === '"') {
        this.done = true;
        break;
      }
      if (ch === '\\') {
        if (this.cursor + 1 >= this.buf.length) break;
        const n = this.buf[this.cursor + 1]!;
        if (n === 'u') {
          if (this.cursor + 6 > this.buf.length) break;
          out += String.fromCharCode(parseInt(this.buf.slice(this.cursor + 2, this.cursor + 6), 16));
          this.cursor += 6;
          continue;
        }
        const map: Record<string, string> = { n: '\n', t: '\t', r: '', b: '', f: '', '"': '"', '\\': '\\', '/': '/' };
        out += map[n] ?? n;
        this.cursor += 2;
        continue;
      }
      out += ch;
      this.cursor += 1;
    }
    return out;
  }
}
