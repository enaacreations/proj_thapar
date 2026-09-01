import { randomBytes } from "node:crypto";
import type { PaymentMethod } from "@proj/shared";

/**
 * Everything the app needs from a payment gateway, behind one interface.
 *
 * The mock below moves no money. Swapping in Razorpay/Stripe means writing one
 * more implementation of this interface and pointing `provider` at it — the
 * routes, the order lifecycle, the webhook handler and the reconciliation all
 * stay exactly as they are, because none of them know which provider is live.
 */

export interface CreateOrderInput {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  description: string;
}

export interface CreateOrderResult {
  providerRef: string;
  status: "pending" | "succeeded";
  /** Where to send the payer to authorise. Null when none is needed. */
  authorisationUrl: string | null;
}

export interface CreateMandateInput {
  mandateId: string;
  maxAmount: number;
  dayOfMonth: number;
}

export interface CreateMandateResult {
  providerRef: string;
  status: "pending" | "active";
  approvalUrl: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  /** False for the mock, so the UI can say plainly that nothing is charged. */
  readonly live: boolean;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  createMandate(input: CreateMandateInput): Promise<CreateMandateResult>;
  revokeMandate(providerRef: string): Promise<void>;
  /**
   * Verifies a webhook really came from the provider. The mock accepts its own
   * shared secret; a real one checks an HMAC over the raw body.
   */
  verifyWebhook(signature: string | undefined, rawBody: string): boolean;
}

const ref = (prefix: string) =>
  `${prefix}_${randomBytes(8).toString("hex")}`;

/**
 * Development provider. Orders sit in `pending` until something calls the
 * webhook, which is exactly how a real gateway behaves — so the interesting
 * code path (async confirmation, idempotency, reconciliation) is the same one
 * that runs in production.
 */
const mockProvider: PaymentProvider = {
  name: "mock",
  live: false,

  async createOrder(input) {
    return {
      providerRef: ref("ord"),
      status: "pending",
      // A real gateway returns its own hosted page. This points back at the
      // simulator so the flow is walkable end to end.
      authorisationUrl: `/api/payments/simulator/${input.orderId}`,
    };
  },

  async createMandate(input) {
    return {
      providerRef: ref("mnd"),
      status: "pending",
      approvalUrl: `/api/payments/simulator/mandate/${input.mandateId}`,
    };
  },

  async revokeMandate() {
    // Nothing to call; the row is the whole state for the mock.
  },

  verifyWebhook(signature) {
    return signature === MOCK_WEBHOOK_SECRET;
  },
};

export const MOCK_WEBHOOK_SECRET = "mock-webhook-secret";

export const provider: PaymentProvider = mockProvider;
