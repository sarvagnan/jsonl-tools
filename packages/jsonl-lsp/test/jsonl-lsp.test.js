import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const LSP = fileURLToPath(new URL("../bin/jsonl-lsp.js", import.meta.url));

test("lsp publishes diagnostics and document formatting edits", async () => {
  const server = spawn(process.execPath, [LSP], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  const client = new LspTestClient(server);

  try {
    await client.request("initialize", {
      processId: null,
      rootUri: null,
      capabilities: {},
      initializationOptions: {
        jsonl: {
          allowBlankLines: false
        }
      }
    });

    client.notify("textDocument/didOpen", {
      textDocument: {
        uri: "file:///tmp/bad.jsonl",
        languageId: "jsonl",
        version: 1,
        text: ' { "a" : 1 }\n{"b":}\n'
      }
    });

    const diagnosticNotification = await client.nextNotification("textDocument/publishDiagnostics");
    assert.equal(diagnosticNotification.params.diagnostics.length, 1);
    assert.equal(diagnosticNotification.params.diagnostics[0].range.start.line, 1);
    assert.equal(diagnosticNotification.params.diagnostics[0].range.start.character, 5);

    client.notify("textDocument/didChange", {
      textDocument: {
        uri: "file:///tmp/bad.jsonl",
        version: 2
      },
      contentChanges: [
        {
          text: ' { "a" : 1 }\n'
        }
      ]
    });

    await client.nextNotification("textDocument/publishDiagnostics");
    const edits = await client.request("textDocument/formatting", {
      textDocument: {
        uri: "file:///tmp/bad.jsonl"
      },
      options: {
        tabSize: 2,
        insertSpaces: true
      }
    });

    assert.deepEqual(edits, [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 1, character: 0 }
        },
        newText: '{"a":1}\n'
      }
    ]);
  } finally {
    await client.shutdown();
  }
});

test("lsp answers malformed frames with protocol errors and stays alive", async () => {
  const server = spawn(process.execPath, [LSP], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  const client = new LspTestClient(server);

  try {
    server.stdin.write("Content-Length: 5\r\n\r\n{bad}");
    const parseError = await client.nextErrorResponse();
    assert.equal(parseError.error.code, -32700);

    server.stdin.write("Content-Length: 4\r\n\r\nnull");
    const invalidRequest = await client.nextErrorResponse();
    assert.equal(invalidRequest.error.code, -32600);

    const init = await client.request("initialize", { capabilities: {} });
    assert.ok(init.capabilities, "server should still answer after malformed frames");
  } finally {
    await client.shutdown();
  }
});

test("lsp applies ranged didChange deltas instead of clobbering the document", async () => {
  const server = spawn(process.execPath, [LSP], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  const client = new LspTestClient(server);

  try {
    await client.request("initialize", { capabilities: {} });

    client.notify("textDocument/didOpen", {
      textDocument: {
        uri: "file:///tmp/delta.jsonl",
        languageId: "jsonl",
        version: 1,
        text: ' { "a" : 1 }\n'
      }
    });
    await client.nextNotification("textDocument/publishDiagnostics");

    client.notify("textDocument/didChange", {
      textDocument: { uri: "file:///tmp/delta.jsonl", version: 2 },
      contentChanges: [
        {
          range: {
            start: { line: 0, character: 9 },
            end: { line: 0, character: 10 }
          },
          text: "2"
        }
      ]
    });
    await client.nextNotification("textDocument/publishDiagnostics");

    const edits = await client.request("textDocument/formatting", {
      textDocument: { uri: "file:///tmp/delta.jsonl" },
      options: { tabSize: 2, insertSpaces: true }
    });

    assert.equal(edits[0].newText, '{"a":2}\n');
  } finally {
    await client.shutdown();
  }
});

test("lsp advertises and returns hierarchical document symbols", async () => {
  const server = spawn(process.execPath, [LSP], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  const client = new LspTestClient(server);
  const uri = "file:///tmp/symbols.jsonl";
  const text = '{"name":"alice","age":30}\r\n' +
    '{"foo":"bar","baz":1}\r' +
    "[1,2,3]\n" +
    "not json\r\n" +
    " \t";

  try {
    const initialize = await client.request("initialize", { capabilities: {} });
    assert.equal(initialize.capabilities.documentSymbolProvider, true);

    client.notify("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: "jsonl",
        version: 1,
        text
      }
    });
    await client.nextNotification("textDocument/publishDiagnostics");

    const symbols = await client.request("textDocument/documentSymbol", {
      textDocument: { uri }
    });

    assert.equal(symbols.length, 4);
    assert.deepEqual(
      symbols.map(({ name, kind, range, selectionRange }) => ({
        name,
        kind,
        range,
        selectionRange
      })),
      [
        {
          name: "name: alice",
          kind: 19,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 25 }
          },
          selectionRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 25 }
          }
        },
        {
          name: "foo: bar",
          kind: 19,
          range: {
            start: { line: 1, character: 0 },
            end: { line: 1, character: 21 }
          },
          selectionRange: {
            start: { line: 1, character: 0 },
            end: { line: 1, character: 21 }
          }
        },
        {
          name: "[1,2,3]",
          kind: 18,
          range: {
            start: { line: 2, character: 0 },
            end: { line: 2, character: 7 }
          },
          selectionRange: {
            start: { line: 2, character: 0 },
            end: { line: 2, character: 7 }
          }
        },
        {
          name: "✗ invalid JSON",
          kind: 21,
          range: {
            start: { line: 3, character: 0 },
            end: { line: 3, character: 8 }
          },
          selectionRange: {
            start: { line: 3, character: 0 },
            end: { line: 3, character: 8 }
          }
        }
      ]
    );

    assert.deepEqual(
      symbols[0].children.map(({ name, kind, range, selectionRange }) => ({
        name,
        kind,
        range,
        selectionRange,
        rangeText: text.split(/\r\n|\r|\n/)[range.start.line].slice(
          range.start.character,
          range.end.character
        ),
        selectionText: text.split(/\r\n|\r|\n/)[selectionRange.start.line].slice(
          selectionRange.start.character,
          selectionRange.end.character
        )
      })),
      [
        {
          name: "name",
          kind: 15,
          range: {
            start: { line: 0, character: 2 },
            end: { line: 0, character: 15 }
          },
          selectionRange: {
            start: { line: 0, character: 2 },
            end: { line: 0, character: 6 }
          },
          rangeText: 'name":"alice"',
          selectionText: "name"
        },
        {
          name: "age",
          kind: 16,
          range: {
            start: { line: 0, character: 17 },
            end: { line: 0, character: 24 }
          },
          selectionRange: {
            start: { line: 0, character: 17 },
            end: { line: 0, character: 20 }
          },
          rangeText: 'age":30',
          selectionText: "age"
        }
      ]
    );
    assert.equal("children" in symbols[2], false);
    assert.equal("children" in symbols[3], false);
  } finally {
    await client.shutdown();
  }
});

test("lsp advertises record inspection and hovers valid physical lines", async () => {
  const server = spawn(process.execPath, [LSP], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  const client = new LspTestClient(server);
  const uri = "file:///tmp/hover.jsonl";
  const validLine = '{"name":"alice","items":[1,2]}';
  const text = `${validLine}\r\nnot json\r\n \t`;

  try {
    const initialize = await client.request("initialize", { capabilities: {} });
    assert.equal(initialize.capabilities.hoverProvider, true);
    assert.equal(initialize.capabilities.codeActionProvider, true);

    client.notify("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: "jsonl",
        version: 1,
        text
      }
    });
    await client.nextNotification("textDocument/publishDiagnostics");

    const hover = await client.request("textDocument/hover", {
      textDocument: { uri },
      position: { line: 0, character: 8 }
    });

    assert.deepEqual(hover, {
      contents: {
        kind: "markdown",
        value: "```json\n{\n  \"name\": \"alice\",\n  \"items\": [\n    1,\n    2\n  ]\n}\n```"
      },
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: validLine.length }
      }
    });

    const invalidHover = await client.request("textDocument/hover", {
      textDocument: { uri },
      position: { line: 1, character: 2 }
    });
    const blankHover = await client.request("textDocument/hover", {
      textDocument: { uri },
      position: { line: 2, character: 1 }
    });

    assert.equal(invalidHover, null);
    assert.equal(blankHover, null);
  } finally {
    await client.shutdown();
  }
});

test("lsp offers expand and compact code actions with a round trip", async () => {
  const server = spawn(process.execPath, [LSP], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  const client = new LspTestClient(server);
  const uri = "file:///tmp/actions.jsonl";
  const text = '{"a": 1,"b":[1,2, 3]}';
  const compact = '{"a":1,"b":[1,2,3]}';
  const expanded = '{\n  "a": 1,\n  "b": [\n    1,\n    2,\n    3\n  ]\n}';
  const lineRange = {
    start: { line: 0, character: 0 },
    end: { line: 0, character: text.length }
  };

  try {
    await client.request("initialize", { capabilities: {} });
    client.notify("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: "jsonl",
        version: 1,
        text
      }
    });
    await client.nextNotification("textDocument/publishDiagnostics");

    const actions = await client.request("textDocument/codeAction", {
      textDocument: { uri },
      range: {
        start: { line: 0, character: 5 },
        end: { line: 0, character: 5 }
      },
      context: { diagnostics: [] }
    });

    assert.deepEqual(actions, [
      {
        title: "Expand record into indented JSON",
        kind: "refactor.rewrite",
        edit: {
          changes: {
            [uri]: [
              { range: lineRange, newText: expanded }
            ]
          }
        }
      },
      {
        title: "Compact record to one line",
        kind: "refactor.rewrite",
        edit: {
          changes: {
            [uri]: [
              { range: lineRange, newText: compact }
            ]
          }
        }
      }
    ]);

    client.notify("textDocument/didChange", {
      textDocument: { uri, version: 2 },
      contentChanges: [
        { text: expanded }
      ]
    });
    await client.nextNotification("textDocument/publishDiagnostics");

    const expandedLines = expanded.split("\n");
    const compactActions = await client.request("textDocument/codeAction", {
      textDocument: { uri },
      range: {
        start: { line: 0, character: 0 },
        end: {
          line: expandedLines.length - 1,
          character: expandedLines.at(-1).length
        }
      },
      context: { diagnostics: [] }
    });

    assert.equal(compactActions.length, 1);
    assert.equal(compactActions[0].title, "Compact record to one line");
    assert.equal(compactActions[0].kind, "refactor.rewrite");
    assert.equal(compactActions[0].edit.changes[uri][0].newText, compact);
  } finally {
    await client.shutdown();
  }
});

test("lsp returns no code actions for invalid JSON", async () => {
  const server = spawn(process.execPath, [LSP], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  const client = new LspTestClient(server);
  const uri = "file:///tmp/invalid-actions.jsonl";
  const text = '{"a":}';

  try {
    await client.request("initialize", { capabilities: {} });
    client.notify("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: "jsonl",
        version: 1,
        text
      }
    });
    await client.nextNotification("textDocument/publishDiagnostics");

    const actions = await client.request("textDocument/codeAction", {
      textDocument: { uri },
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: text.length }
      },
      context: { diagnostics: [] }
    });

    assert.deepEqual(actions, []);
  } finally {
    await client.shutdown();
  }
});

class LspTestClient {
  constructor(child) {
    this.child = child;
    this.nextId = 1;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.notifications = [];
    this.notificationWaiters = [];
    this.errorResponses = [];
    this.errorWaiters = [];

    child.stdout.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.readMessages();
    });
  }

  request(method, params) {
    const id = this.nextId;
    this.nextId += 1;
    this.write({ jsonrpc: "2.0", id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  notify(method, params) {
    this.write({ jsonrpc: "2.0", method, params });
  }

  nextNotification(method) {
    const index = this.notifications.findIndex((message) => message.method === method);

    if (index !== -1) {
      const [message] = this.notifications.splice(index, 1);
      return Promise.resolve(message);
    }

    return new Promise((resolve) => {
      this.notificationWaiters.push({ method, resolve });
    });
  }

  async shutdown() {
    try {
      await this.request("shutdown", null);
      this.notify("exit", null);
    } catch {
      this.child.kill();
    }
  }

  write(message) {
    const payload = JSON.stringify(message);
    this.child.stdin.write(`Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`);
  }

  readMessages() {
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");

      if (headerEnd === -1) {
        return;
      }

      const header = this.buffer.subarray(0, headerEnd).toString("ascii");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      const contentLength = Number(match[1]);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (this.buffer.length < messageEnd) {
        return;
      }

      const message = JSON.parse(this.buffer.subarray(messageStart, messageEnd).toString("utf8"));
      this.buffer = this.buffer.subarray(messageEnd);
      this.handleMessage(message);
    }
  }

  nextErrorResponse() {
    if (this.errorResponses.length > 0) {
      return Promise.resolve(this.errorResponses.shift());
    }

    return new Promise((resolve) => {
      this.errorWaiters.push(resolve);
    });
  }

  handleMessage(message) {
    if (message.error && !this.pending.has(message.id)) {
      const waiter = this.errorWaiters.shift();

      if (waiter) {
        waiter(message);
      } else {
        this.errorResponses.push(message);
      }

      return;
    }

    if (message.id !== undefined && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }

      return;
    }

    const waiterIndex = this.notificationWaiters.findIndex((waiter) => waiter.method === message.method);

    if (waiterIndex !== -1) {
      const [waiter] = this.notificationWaiters.splice(waiterIndex, 1);
      waiter.resolve(message);
      return;
    }

    this.notifications.push(message);
  }
}
