import { describe, expect, it } from "vitest";

import { cn } from "./utils.js";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("ignores falsy values", () => {
    expect(cn("block", false && "hidden", undefined, "text-sm")).toBe("block text-sm");
  });
});
