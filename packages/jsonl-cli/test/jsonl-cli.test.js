import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";

const CLI = fileURLToPath(new URL("../bin/jsonl.js", import.meta.url));

test("cli validates files and prints diagnostics", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "jsonl-cli-"));
  const file = path.join(dir, "bad.jsonl");
  await writeFile(file, '{"a":1}\n{"b":}\n', "utf8");

  const result = await runCli(["validate", file]);

  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /bad\.jsonl:2:6: error: Expected JSON value/);
});

test("cli normalizes stdin to stdout", async () => {
  const result = await runCli(["normalize"], ' { "a" : 1 }\n');

  assert.equal(result.code, 0);
  assert.equal(result.stdout, '{"a":1}\n');
  assert.equal(result.stderr, "");
});

test("cli format check fails when input is not normalized", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "jsonl-cli-"));
  const file = path.join(dir, "needs-format.jsonl");
  await writeFile(file, ' { "a" : 1 }\n', "utf8");

  const result = await runCli(["format", "--check", file]);
  const unchanged = await readFile(file, "utf8");

  assert.equal(result.code, 1);
  assert.equal(unchanged, ' { "a" : 1 }\n');
  assert.match(result.stderr, /needs-format\.jsonl is not normalized/);
});

test("cli pretty prints one selected record", async () => {
  const result = await runCli(["pretty-record"], '{"a":[1,2]}');

  assert.equal(result.code, 0);
  assert.equal(result.stdout, '{\n  "a": [\n    1,\n    2\n  ]\n}\n');
  assert.equal(result.stderr, "");
});

function runCli(args, stdin = "") {
  return runScript(process.execPath, stdin, [CLI, ...args]);
}

function runScript(command, stdin = "", args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });

    child.stdin.end(stdin);
  });
}
