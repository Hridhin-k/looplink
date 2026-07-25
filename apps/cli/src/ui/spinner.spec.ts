import { describe, expect, it } from "vitest";

import { createSpinner, OraSpinner, PlainSpinner } from "./spinner.js";
import type { Writer } from "../utils/output.js";

function createWriter(): Writer & { errors: string[] } {
  const errors: string[] = [];

  return {
    errors,
    writeLine: () => undefined,
    writeError: (message: string) => errors.push(message),
  };
}

describe("createSpinner", () => {
  it("animates in an interactive terminal", () => {
    expect(createSpinner(createWriter(), true)).toBeInstanceOf(OraSpinner);
  });

  it("falls back to plain lines when stderr is not a TTY", () => {
    expect(createSpinner(createWriter(), false)).toBeInstanceOf(PlainSpinner);
  });
});

describe("PlainSpinner", () => {
  it("writes every status transition as its own line", () => {
    const writer = createWriter();
    const spinner = new PlainSpinner(writer);

    spinner.start("starting");
    spinner.update("working");
    spinner.succeed("done");
    spinner.warn("careful");
    spinner.fail("broken");
    spinner.stop();

    expect(writer.errors).toEqual(["starting", "working", "done", "careful", "broken"]);
  });
});
