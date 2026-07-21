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
