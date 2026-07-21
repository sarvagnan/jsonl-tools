export const FINAL_NEWLINE_POLICIES = new Set(["preserve", "always", "never"]);

const DEFAULT_OPTIONS = {
  allowBlankLines: false,
  finalNewline: "preserve"
};

export class JsonLineParseError extends Error {
  constructor(message, index) {
    super(message);
    this.name = "JsonLineParseError";
    this.index = index;
  }
}

class JsonLineParser {
  constructor(text) {
    this.text = text;
    this.index = 0;
  }

  parse() {
    this.skipWhitespace();
    const compact = this.parseValue();
    this.skipWhitespace();

    if (!this.isEnd()) {
      this.fail("Unexpected non-whitespace character after JSON value");
    }

    return compact;
  }

  parseValue() {
    if (this.isEnd()) {
      this.fail("Expected JSON value");
    }

    const char = this.peek();

    if (char === "{") {
      return this.parseObject();
    }

    if (char === "[") {
      return this.parseArray();
    }

    if (char === '"') {
      return this.parseString();
    }

    if (char === "-" || isDigit(char)) {
      return this.parseNumber();
    }

    const literal = this.matchLiteral("true") ?? this.matchLiteral("false") ?? this.matchLiteral("null");

    if (literal) {
      return literal;
    }

    this.fail("Expected JSON value");
  }

  parseObject() {
    this.consume("{");
    this.skipWhitespace();

    if (this.peek() === "}") {
      this.advance();
      return "{}";
    }

    const members = [];

    while (true) {
      if (this.peek() !== '"') {
        this.fail('Expected object property name string');
      }

      const key = this.parseString();
      this.skipWhitespace();
      this.consume(":", "Expected ':' after object property name");
      this.skipWhitespace();
      const value = this.parseValue();
      members.push(`${key}:${value}`);
      this.skipWhitespace();

      if (this.peek() === "}") {
        this.advance();
        return `{${members.join(",")}}`;
      }

      this.consume(",", "Expected ',' or '}' after object property value");
      this.skipWhitespace();

      if (this.peek() === "}") {
        this.fail("Trailing commas are not valid JSON");
      }
    }
  }

  parseArray() {
    this.consume("[");
    this.skipWhitespace();

    if (this.peek() === "]") {
      this.advance();
      return "[]";
    }

    const items = [];

    while (true) {
      items.push(this.parseValue());
      this.skipWhitespace();

      if (this.peek() === "]") {
        this.advance();
        return `[${items.join(",")}]`;
      }

      this.consume(",", "Expected ',' or ']' after array item");
      this.skipWhitespace();

      if (this.peek() === "]") {
        this.fail("Trailing commas are not valid JSON");
      }
    }
  }

  parseString() {
    const start = this.index;
    this.consume('"');

    while (!this.isEnd()) {
      const char = this.peek();

      if (char === '"') {
        this.advance();
        return this.text.slice(start, this.index);
      }

      if (char === "\\") {
        this.parseEscape();
        continue;
      }

      if (char < " ") {
        this.fail("Unescaped control character in string");
      }

      this.advance();
    }

    this.fail("Unterminated string");
  }

  parseEscape() {
    this.consume("\\");

    if (this.isEnd()) {
      this.fail("Unterminated escape sequence");
    }

    const escaped = this.peek();

    if (['"', "\\", "/", "b", "f", "n", "r", "t"].includes(escaped)) {
      this.advance();
      return;
    }

    if (escaped === "u") {
      this.advance();

      for (let offset = 0; offset < 4; offset += 1) {
        if (this.isEnd() || !isHexDigit(this.peek())) {
          this.fail("Invalid unicode escape sequence");
        }

        this.advance();
      }

      return;
    }

    this.fail("Invalid escape sequence");
  }

  parseNumber() {
    const start = this.index;

    if (this.peek() === "-") {
      this.advance();
    }

    if (this.isEnd()) {
      this.fail("Expected digit after minus sign");
    }

    if (this.peek() === "0") {
      this.advance();

      if (!this.isEnd() && isDigit(this.peek())) {
        this.fail("Leading zeroes are not valid JSON numbers");
      }
    } else if (isNonZeroDigit(this.peek())) {
      this.consumeDigits();
    } else {
      this.fail("Expected digit");
    }

    if (this.peek() === ".") {
      this.advance();

      if (this.isEnd() || !isDigit(this.peek())) {
        this.fail("Expected digit after decimal point");
      }

      this.consumeDigits();
    }

    if (this.peek() === "e" || this.peek() === "E") {
      this.advance();

      if (this.peek() === "+" || this.peek() === "-") {
        this.advance();
      }

      if (this.isEnd() || !isDigit(this.peek())) {
        this.fail("Expected digit in exponent");
      }

      this.consumeDigits();
    }

    return this.text.slice(start, this.index);
  }

  consumeDigits() {
    while (!this.isEnd() && isDigit(this.peek())) {
      this.advance();
    }
  }

  matchLiteral(literal) {
    if (this.text.slice(this.index, this.index + literal.length) !== literal) {
      return undefined;
    }

    this.index += literal.length;
    return literal;
  }

  consume(expected, message = `Expected '${expected}'`) {
    if (this.peek() !== expected) {
      this.fail(message);
    }

    this.advance();
  }

  skipWhitespace() {
    while (!this.isEnd() && isJsonWhitespace(this.peek())) {
      this.advance();
    }
  }

  peek() {
    return this.text[this.index];
  }

  advance() {
    this.index += 1;
  }

  isEnd() {
    return this.index >= this.text.length;
  }

  fail(message) {
    throw new JsonLineParseError(message, this.index);
  }
}

export function parseJsonLines(text, options = {}) {
  const settings = normalizeOptions(options);
  const lines = splitPhysicalLines(text);
  const records = [];
  const diagnostics = [];

  for (const line of lines) {
    if (line.text.trim().length === 0) {
      if (!settings.allowBlankLines) {
        diagnostics.push(createDiagnostic(line.number, 1, "Blank lines are not valid JSON Lines"));
      }

      continue;
    }

    try {
      const compact = new JsonLineParser(line.text).parse();
      records.push({
        line: line.number,
        column: firstNonWhitespaceColumn(line.text),
        startOffset: line.startOffset,
        endOffset: line.startOffset + line.text.length,
        raw: line.text,
        compact,
        value: JSON.parse(line.text)
      });
    } catch (error) {
      if (error instanceof JsonLineParseError) {
        diagnostics.push(createDiagnostic(line.number, error.index + 1, error.message));
      } else {
        diagnostics.push(createDiagnostic(line.number, 1, error.message));
      }
    }
  }

  return {
    ok: diagnostics.length === 0,
    diagnostics,
    records,
    lineCount: lines.length,
    hasFinalNewline: hasFinalLineEnding(text)
  };
}

export function validateJsonLines(text, options = {}) {
  const { ok, diagnostics, lineCount, hasFinalNewline } = parseJsonLines(text, options);
  return { ok, diagnostics, lineCount, hasFinalNewline };
}

export function normalizeJsonLines(text, options = {}) {
  const settings = normalizeOptions(options);
  const parsed = parseJsonLines(text, settings);

  if (!parsed.ok) {
    return {
      ok: false,
      diagnostics: parsed.diagnostics,
      output: null
    };
  }

  const body = parsed.records.map((record) => record.compact).join("\n");
  const finalNewline = shouldWriteFinalNewline(settings.finalNewline, parsed.hasFinalNewline, body);

  return {
    ok: true,
    diagnostics: [],
    output: finalNewline ? `${body}\n` : body
  };
}

export function formatJsonRecord(text, options = {}) {
  const indent = options.indent ?? 2;
  const parsed = parseJsonLines(text, {
    allowBlankLines: false,
    finalNewline: "never"
  });

  if (!parsed.ok) {
    return {
      ok: false,
      diagnostics: parsed.diagnostics,
      output: null
    };
  }

  if (parsed.records.length !== 1) {
    return {
      ok: false,
      diagnostics: [createDiagnostic(1, 1, "Expected exactly one JSONL record")],
      output: null
    };
  }

  return {
    ok: true,
    diagnostics: [],
    output: `${JSON.stringify(parsed.records[0].value, null, indent)}\n`
  };
}

export function isSupportedJsonLinesPath(path) {
  return /\.(jsonl|ndjson)$/i.test(path);
}

export function splitPhysicalLines(text) {
  const lines = [];
  let start = 0;
  let number = 1;

  while (start < text.length) {
    let index = start;

    while (index < text.length && text[index] !== "\n" && text[index] !== "\r") {
      index += 1;
    }

    if (index === text.length) {
      lines.push({
        number,
        text: text.slice(start),
        ending: "",
        startOffset: start
      });
      break;
    }

    let ending = text[index];
    let nextStart = index + 1;

    if (text[index] === "\r" && text[index + 1] === "\n") {
      ending = "\r\n";
      nextStart = index + 2;
    }

    lines.push({
      number,
      text: text.slice(start, index),
      ending,
      startOffset: start
    });

    start = nextStart;
    number += 1;
  }

  return lines;
}

function normalizeOptions(options) {
  const settings = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  if (!FINAL_NEWLINE_POLICIES.has(settings.finalNewline)) {
    throw new TypeError(`Invalid finalNewline policy: ${settings.finalNewline}`);
  }

  return settings;
}

function shouldWriteFinalNewline(policy, inputHadFinalNewline, body) {
  if (body.length === 0) {
    return policy === "always";
  }

  if (policy === "always") {
    return true;
  }

  if (policy === "never") {
    return false;
  }

  return inputHadFinalNewline;
}

function createDiagnostic(line, column, message) {
  return {
    line,
    column,
    message,
    severity: "error"
  };
}

function firstNonWhitespaceColumn(text) {
  const match = /\S/.exec(text);
  return match ? match.index + 1 : 1;
}

function hasFinalLineEnding(text) {
  return text.endsWith("\n") || text.endsWith("\r");
}

function isJsonWhitespace(char) {
  return char === " " || char === "\t";
}

function isDigit(char) {
  return char >= "0" && char <= "9";
}

function isNonZeroDigit(char) {
  return char >= "1" && char <= "9";
}

function isHexDigit(char) {
  return (
    (char >= "0" && char <= "9") ||
    (char >= "a" && char <= "f") ||
    (char >= "A" && char <= "F")
  );
}
