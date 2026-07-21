import assert from "node:assert/strict";
import test from "node:test";
import {
  formatJsonRecord,
  isSupportedJsonLinesPath,
  normalizeJsonLines,
  parseJsonLines,
  splitPhysicalLines,
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

test("a line of non-breaking spaces is malformed JSON, not blank", () => {
  const result = validateJsonLines("{\"a\":1}\n  \n", { allowBlankLines: true });

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].line, 2);
});
