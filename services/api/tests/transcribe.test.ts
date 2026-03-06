import { describe, expect, it } from "vitest";
import {
  buildTranscriptionPrompt,
  extractConfirmationFromTranscript,
  extractSelectionNumberFromTranscript
} from "../src/lib/transcribe.js";

describe("extractConfirmationFromTranscript", () => {
  it("detects positive confirmation", () => {
    expect(extractConfirmationFromTranscript("네 맞아요").confirmed).toBe(true);
  });

  it("detects negative confirmation", () => {
    expect(extractConfirmationFromTranscript("아니요 다시 할게요").confirmed).toBe(false);
  });
});

describe("extractSelectionNumberFromTranscript", () => {
  it("extracts numeric responses", () => {
    expect(extractSelectionNumberFromTranscript("2번이요").selectedNumber).toBe(2);
  });

  it("extracts spoken ordinal responses", () => {
    expect(extractSelectionNumberFromTranscript("첫 번째요").selectedNumber).toBe(1);
  });
});

describe("buildTranscriptionPrompt", () => {
  it("pins transcription to Korean", () => {
    expect(buildTranscriptionPrompt("FOOD_INFO")).toContain("Korean only");
  });

  it("adds an intent specific hint", () => {
    expect(buildTranscriptionPrompt("EMPLOYEE_LAST4")).toContain("last four digits");
  });
});
