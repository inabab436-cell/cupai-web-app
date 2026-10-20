import { describe, expect, it } from "vitest";

import {
  DEFAULT_MANUAL_HANDOVER_MESSAGE,
  buildHandoverChatMessage,
} from "@/lib/storefront-handover.server";

describe("buildHandoverChatMessage", () => {
  it("falls back to the default payment sentence when empty", () => {
    expect(buildHandoverChatMessage("")).toBe(DEFAULT_MANUAL_HANDOVER_MESSAGE);
    expect(buildHandoverChatMessage(null)).toBe(DEFAULT_MANUAL_HANDOVER_MESSAGE);
  });

  it("preserves separate payment details and order number lines", () => {
    const message = "تم تسجيل طلبك\n\n01000000000\n\nرقم الطلب\nORD-1";
    expect(buildHandoverChatMessage(message)).toBe(message);
  });

  it("does not drop payment details or a trailing order number after 400 characters", () => {
    const message = `${"ا".repeat(500)}\n01000000000\nORD-1`;
    expect(buildHandoverChatMessage(message)).toBe(message);
  });
});
