import assert from "node:assert/strict";
import test from "node:test";
import {
  formatJsonRecord,
  isSupportedJsonLinesPath,
  normalizeJsonLines,
  parseJsonLines,
  renderJsonValue,
  splitPhysicalLines,
  summarizeJsonLines,
  validateJsonLines
} from "../src/index.js";

test("validates one JSON value per physical line", () => {
  const result = validateJsonLines('{"a":1}\n[true,false]\n"ok"\n42\nnull\n');

  assert.equal(result.ok, true);
  assert.equal(result.lineCount, 5);
  assert.equal(result.hasFinalNewline, true);
});

test("rejects blank lines by default", () => {
  const result = validateJsonLines('{"a":1}\n\n{"b":2}\n');

  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics, [
    {
      line: 2,
      column: 1,
      message: "Blank lines are not valid JSON Lines",
      severity: "error"
    }
  ]);
});

test("can allow and skip blank lines", () => {
  const result = normalizeJsonLines('{"a":1}\n\n{"b":2}\n', {
    allowBlankLines: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.output, '{"a":1}\n{"b":2}\n');
});

test("reports accurate line and column diagnostics", () => {
  const result = validateJsonLines('{"a":1}\n{"b":}\n[1,]\n');

  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics, [
    {
      line: 2,
      column: 6,
      message: "Expected JSON value",
      severity: "error"
    },
    {
      line: 3,
      column: 4,
      message: "Trailing commas are not valid JSON",
      severity: "error"
    }
  ]);
});

test("rejects multiline JSON as separate invalid physical lines", () => {
  const result = validateJsonLines('{\n"a": 1\n}\n');

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.length, 3);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => [diagnostic.line, diagnostic.column]),
    [
      [1, 2],
      [2, 4],
      [3, 1]
    ]
  );
});

test("normalizes each record to compact JSON", () => {
  const result = normalizeJsonLines(' { "b" : [ 1, true, null ] }\n"hi"');

  assert.equal(result.ok, true);
  assert.equal(result.output, '{"b":[1,true,null]}\n"hi"');
});

test("normalization preserves numeric lexemes without JavaScript rounding", () => {
  const result = normalizeJsonLines(' { "id" : 9007199254740993123456789 }\n');

  assert.equal(result.ok, true);
  assert.equal(result.output, '{"id":9007199254740993123456789}\n');
});

test("supports final newline policies", () => {
  assert.equal(
    normalizeJsonLines('{"a":1}', { finalNewline: "always" }).output,
    '{"a":1}\n'
  );
  assert.equal(
    normalizeJsonLines('{"a":1}\n', { finalNewline: "never" }).output,
    '{"a":1}'
  );
});

test("returns source offsets for records", () => {
  const result = parseJsonLines(' {"a":1}\n\t[2]\n');

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.records.map((record) => ({
      line: record.line,
      column: record.column,
      startOffset: record.startOffset,
      endOffset: record.endOffset
    })),
    [
      { line: 1, column: 2, startOffset: 0, endOffset: 8 },
      { line: 2, column: 2, startOffset: 9, endOffset: 13 }
    ]
  );
});

test("formats a single selected record for pretty viewing", () => {
  const result = formatJsonRecord('{"a":[1,2]}', { indent: 2 });

  assert.equal(result.ok, true);
  assert.equal(result.output, '{\n  "a": [\n    1,\n    2\n  ]\n}\n');
});

test("recognizes jsonl and ndjson paths", () => {
  assert.equal(isSupportedJsonLinesPath("events.jsonl"), true);
  assert.equal(isSupportedJsonLinesPath("events.ndjson"), true);
  assert.equal(isSupportedJsonLinesPath("events.json"), false);
});

test("splits physical lines without adding a phantom final line", () => {
  assert.deepEqual(
    splitPhysicalLines("a\r\nb\nc\rd").map((line) => [line.number, line.text, line.ending]),
    [
      [1, "a", "\r\n"],
      [2, "b", "\n"],
      [3, "c", "\r"],
      [4, "d", ""]
    ]
  );
});

test("pretty printing preserves numeric lexemes, key order, and duplicate keys", () => {
  const result = formatJsonRecord('{"big":9007199254740993,"huge":1e400,"z":1,"a":2,"z":3}');

  assert.equal(result.ok, true);
  assert.equal(
    result.output,
    '{\n  "big": 9007199254740993,\n  "huge": 1e400,\n  "z": 1,\n  "a": 2,\n  "z": 3\n}\n'
  );
});

test("pretty printing with indent 0 stays compact", () => {
  const result = formatJsonRecord('{ "a" : [ 1 , 2 ] }', { indent: 0 });

  assert.equal(result.ok, true);
  assert.equal(result.output, '{"a":[1,2]}\n');
});

test("renders a multi-line JSON value compactly", () => {
  const result = renderJsonValue('{\n  "a": [\n    1,\n    2\n  ]\n}', { indent: 0 });

  assert.equal(result.ok, true);
  assert.equal(result.output, '{"a":[1,2]}');
});

test("renders a compact JSON value with the default indent and no trailing newline", () => {
  const text = '{"a":[1,2]}';
  const rendered = renderJsonValue(text);
  const formatted = formatJsonRecord(text);

  assert.equal(rendered.ok, true);
  assert.equal(rendered.output, '{\n  "a": [\n    1,\n    2\n  ]\n}');
  assert.equal(formatted.output, `${rendered.output}\n`);
});

test("rendering rejects a raw newline inside a JSON string", () => {
  const result = renderJsonValue('{"a":"x\ny"}');

  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics, [
    {
      line: 1,
      column: 8,
      message: "Unescaped control character in string",
      severity: "error"
    }
  ]);
});

test("rendering preserves number lexemes, key order, and duplicate keys", () => {
  const result = renderJsonValue('{\n"z": 1.50,\n"a": 2,\n"z": 1E5\n}', { indent: 0 });

  assert.equal(result.ok, true);
  assert.equal(result.output, '{"z":1.50,"a":2,"z":1E5}');
});

test("rendering supports compact and pretty output for the same multi-line value", () => {
  const text = '[\r\n { "a": 1 },\r true\n]';

  assert.equal(renderJsonValue(text, { indent: 0 }).output, '[{"a":1},true]');
  assert.equal(
    renderJsonValue(text, { indent: 2 }).output,
    '[\n  {\n    "a": 1\n  },\n  true\n]'
  );
});

test("rendering reports multi-line invalid JSON at a one-based line and column", () => {
  const result = renderJsonValue('{\n  "a": 1,\n}');

  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics, [
    {
      line: 3,
      column: 1,
      message: "Trailing commas are not valid JSON",
      severity: "error"
    }
  ]);
});

test("a line of non-breaking spaces is malformed JSON, not blank", () => {
  const result = validateJsonLines("{\"a\":1}\n  \n", { allowBlankLines: true });

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].line, 2);
});

test("summaries choose the best preferred scalar key", () => {
  const summaries = summarizeJsonLines([
    '{"status":"late","type":"event"}',
    '{"name":{"nested":true},"status":"ready"}',
    '{"name":"","title":"fallback"}',
    '{"name":"raw\\ntext"}'
  ].join("\n"));

  assert.deepEqual(
    summaries.map((summary) => summary.name),
    ["type: event", "status: ready", "title: fallback", "name: raw\\ntext"]
  );
});

test("summaries fall back to the first object member", () => {
  const summaries = summarizeJsonLines([
    '{"foo":"bar","baz":1}',
    '{"data":{"x":1},"extra":2}',
    '{"items":[1,2],"extra":2}',
    '{"foo":"","extra":2}',
    '{"":1}',
    "{}"
  ].join("\n"));

  assert.deepEqual(
    summaries.map((summary) => summary.name),
    ["foo: bar", "data: …", "items: …", "foo: …", ": 1", "{}"]
  );
});

test("summaries describe arrays and each kind of top-level scalar", () => {
  const summaries = summarizeJsonLines(' \t[1,2,3]\t \n 42 \n "hello"\t\n true\nfalse\n null ');

  assert.deepEqual(
    summaries.map(({ name, valueKind, members }) => ({ name, valueKind, members })),
    [
      { name: "[1,2,3]", valueKind: "array", members: [] },
      { name: "42", valueKind: "number", members: [] },
      { name: '"hello"', valueKind: "string", members: [] },
      { name: "true", valueKind: "boolean", members: [] },
      { name: "false", valueKind: "boolean", members: [] },
      { name: "null", valueKind: "null", members: [] }
    ]
  );
});

test("summaries mark invalid lines and skip blank physical lines", () => {
  const text = '{"name":"first"}\r\n \t\rnot json\n\n42';
  const summaries = summarizeJsonLines(text);

  assert.deepEqual(
    summaries.map(({ line, valid, name }) => ({ line, valid, name })),
    [
      { line: 1, valid: true, name: "name: first" },
      { line: 3, valid: false, name: "✗ invalid JSON" },
      { line: 5, valid: true, name: "42" }
    ]
  );
  assert.deepEqual(summaries[1].members, []);
});

test("summary truncation follows the 48 UTF-16-unit boundary", () => {
  const plain47 = "a".repeat(47);
  const plain48 = "b".repeat(48);
  const plain49 = "c".repeat(49);
  const summaries = summarizeJsonLines([
    JSON.stringify({ name: plain47 }),
    JSON.stringify({ name: plain48 }),
    JSON.stringify({ name: plain49 }),
    JSON.stringify([plain49])
  ].join("\n"));

  assert.equal(summaries[0].name, `name: ${plain47}`);
  assert.equal(summaries[1].name, `name: ${plain48}`);
  assert.equal(summaries[2].name, `name: ${"c".repeat(48)}…`);
  assert.equal(summaries[3].name, `${JSON.stringify([plain49]).slice(0, 48)}…`);
});

test("summary truncation never splits a surrogate pair", () => {
  const value = `${"a".repeat(47)}😀z`;
  const [summary] = summarizeJsonLines(JSON.stringify({ name: value }));

  assert.equal(summary.name, `name: ${"a".repeat(47)}…`);
  assert.equal(summary.name.includes("\ud83d"), false);
});

test("summaries expose document-absolute top-level member offsets and kinds", () => {
  const text = '{"before":0}\r\n\t\n  { "alpha" : "x", "items": [1], "alpha": false, "nothing": null }';
  const summaries = summarizeJsonLines(text);
  const summary = summaries[1];

  assert.equal(summary.line, 3);
  assert.equal(summary.startOffset, text.indexOf("  {"));
  assert.equal(summary.endOffset, text.length);
  assert.deepEqual(
    summary.members.map((member) => ({
      key: member.key,
      keyText: text.slice(member.keyStart, member.keyEnd),
      valueText: text.slice(member.valueStart, member.valueEnd),
      valueKind: member.valueKind
    })),
    [
      { key: "alpha", keyText: "alpha", valueText: '"x"', valueKind: "string" },
      { key: "items", keyText: "items", valueText: "[1]", valueKind: "array" },
      { key: "alpha", keyText: "alpha", valueText: "false", valueKind: "boolean" },
      { key: "nothing", keyText: "nothing", valueText: "null", valueKind: "null" }
    ]
  );
});
