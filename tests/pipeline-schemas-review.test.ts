import { describe, it, expect } from "bun:test";
import { ReviewFrontmatterSchema } from "../extensions/megapowers/subagent/pipeline-schemas.js";

describe("ReviewFrontmatterSchema", () => {
  it("validates approve and reject verdicts and rejects invalid values", () => {
    const approve = ReviewFrontmatterSchema.safeParse({ verdict: "approve" });
    expect(approve.success).toBe(true);
    if (approve.success) expect(approve.data.verdict).toBe("approve");

    const reject = ReviewFrontmatterSchema.safeParse({ verdict: "reject" });
    expect(reject.success).toBe(true);
    if (reject.success) expect(reject.data.verdict).toBe("reject");

    const invalid = ReviewFrontmatterSchema.safeParse({ verdict: "maybe" });
    expect(invalid.success).toBe(false);

    const missing = ReviewFrontmatterSchema.safeParse({});
    expect(missing.success).toBe(false);
  });
});
