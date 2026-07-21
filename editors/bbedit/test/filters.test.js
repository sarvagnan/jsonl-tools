import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

function runFilter(name, stdin) {
  const filter = fileURLToPath(new URL(`../filters/${name}`, import.meta.url));

  return new Promise((resolve, reject) => {
    const child = spawn(filter, { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));

    child.stdin.end(stdin);
  });
}

test("normalize filter compacts stdin", async () => {
  const result = await runFilter("Normalize JSONL.sh", ' { "a" : true }\n');

  assert.equal(result.code, 0);
  assert.equal(result.stdout, '{"a":true}\n');
  assert.equal(result.stderr, "");
});

test("validate filter passes valid input through and reports errors", async () => {
  const ok = await runFilter("Validate JSONL.sh", '{"a":1}\n');

  assert.equal(ok.code, 0);

  const bad = await runFilter("Validate JSONL.sh", "{broken\n");

  assert.notEqual(bad.code, 0);
});

test("pretty print filter expands a single record", async () => {
  const result = await runFilter("Pretty Print JSONL Record.sh", '{"a":[1,2]}');

  assert.equal(result.code, 0);
  assert.equal(result.stdout, '{\n  "a": [\n    1,\n    2\n  ]\n}\n');
});
