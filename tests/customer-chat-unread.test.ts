import { describe, expect, it } from "vitest";
import { countUnreadReplies } from "@/lib/customer-chat-unread";

const messages = [
  { id: "customer-1", role: "user" },
  { id: "merchant-1", role: "assistant" },
  { id: "customer-2", role: "user" },
  { id: "merchant-2", role: "assistant" },
];

describe("customer chat unread replies", () => {
  it("counts merchant replies but not customer messages before the chat is viewed", () => {
    expect(countUnreadReplies(messages, null)).toBe(2);
  });
  it("clears the badge after viewing the latest message", () => {
    expect(countUnreadReplies(messages, "merchant-2")).toBe(0);
  });
  it("counts only new incoming messages after returning to the store", () => {
    expect(countUnreadReplies(messages, "merchant-1")).toBe(1);
  });
});