import test from "node:test";
import assert from "node:assert/strict";
import { parseAgentPayload } from "../dist/agent/tools.js";

test("parses tool payloads", () => {
  assert.deepEqual(parseAgentPayload('{"type":"tool","tool":"search","args":["fusion"]}'), {
    type: "tool",
    tool: "search",
    args: ["fusion"],
  });
});

test("parses final payloads inside fenced json", () => {
  assert.deepEqual(
    parseAgentPayload('```json\n{"type":"final","answer":"Done [1]"}\n```'),
    {
      type: "final",
      answer: "Done [1]",
    }
  );
});

test("rejects invalid payloads", () => {
  assert.equal(parseAgentPayload('search("fusion")'), null);
  assert.equal(parseAgentPayload('{"type":"tool","tool":"search","args":[1]}'), null);
});
