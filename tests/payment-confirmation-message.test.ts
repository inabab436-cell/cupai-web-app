import { describe, expect, it } from "vitest";

import { buildPaymentConfirmationMessage } from "@/lib/merchant-data.server";
import { DEFAULT_PAYMENT_POLICY, paymentAmountDue } from "@/lib/payment-policy";

describe("buildPaymentConfirmationMessage", () => {
  it("uses the selected method's percentage of the authoritative total", () => {
    const message = buildPaymentConfirmationMessage(
      {
        id: "pm-1",
        name: "فودافون كاش",
        behavior: "manual",
        detail_type: "phone",
        detail_value: "01000000000",
        instructions: "ديبوزت 20% والباقي عند الاستلام",
        payment_template: "",
        ...DEFAULT_PAYMENT_POLICY,
        allow_full_payment: false,
        allow_partial_payment: true,
        partial_payment_value: 20,
      },
      { orderNumber: "ORD-1", total: 1220 },
    );

    expect(message).toContain("تم تسجيل طلبك");
    expect(message).toContain("01000000000");
    expect(message).toContain("244 جنيه");
    expect(message).toContain("ORD-1");
  });

  it("uses the full total for a full-payment method", () => {
    expect(paymentAmountDue(DEFAULT_PAYMENT_POLICY, 1220)).toBe(1220);
  });

  it("uses the merchant's fixed amount rather than a percentage", () => {
    expect(paymentAmountDue({ ...DEFAULT_PAYMENT_POLICY, allow_full_payment: false, allow_partial_payment: true, partial_payment_type: "amount", partial_payment_value: 200 }, 1220)).toBe(200);
  });

  it("requires no transfer for cash on delivery", () => {
    expect(paymentAmountDue({ ...DEFAULT_PAYMENT_POLICY, payment_kind: "on_delivery" }, 1220)).toBeNull();
  });
});