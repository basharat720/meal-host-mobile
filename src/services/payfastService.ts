import { apiRequest } from "./client";

/**
 * PayFast's hosted checkout, driven the same way as on the website: the server
 * prepares a signed form, the app posts it to PayFast inside a WebView, and
 * PayFast returns to FoodPal's success or failure address with the outcome.
 *
 * See feature-docs/14-paying-with-payfast.md.
 */

/** Every field is posted to PayFast as-is; ITEMS becomes ITEMS[i][KEY] fields. */
export type PayFastFormData = Record<string, string | number | PayFastItem[]> & {
  SUCCESS_URL: string;
  FAILURE_URL: string;
};

export interface PayFastItem {
  SKU: string;
  NAME: string;
  PRICE: number | string;
  QTY: number;
}

export interface PayFastInitiateResponse {
  form_data: PayFastFormData;
  post_url: string;
}

export interface PayFastVerifyResponse {
  success: boolean;
  order_id: number;
  transaction_id: string;
  amount: number;
  status: string;
  payment_method: string;
  message: string;
}

/** What PayFast appends to the success/failure address it returns to. */
export interface PayFastReturn {
  transactionId: string | null;
  basketId: string | null;
  errCode: string | null;
  errMsg: string | null;
  validationHash: string | null;
}

/** PayFast's code for a payment that went through. */
export const PAYFAST_SUCCESS_CODE = "000";

export const payfastService = {
  initiatePayment: (
    orderId: number,
    customerMobile: string
  ): Promise<PayFastInitiateResponse> =>
    apiRequest<PayFastInitiateResponse>("payments/payfast/initiate", {
      method: "POST",
      body: JSON.stringify({
        order_id: orderId,
        customer_mobile: customerMobile,
      }),
    }),

  verifyPayment: (ret: PayFastReturn): Promise<PayFastVerifyResponse> => {
    const params = new URLSearchParams({
      transaction_id: ret.transactionId ?? "",
      basket_id: ret.basketId ?? "",
      err_code: ret.errCode ?? "",
      validation_hash: ret.validationHash ?? "",
    });
    return apiRequest<PayFastVerifyResponse>(
      `payments/payfast/verify?${params.toString()}`
    );
  },
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/**
 * A page that posts the form to PayFast as soon as it loads — the in-app
 * equivalent of the website's bridge page. PayFast needs a real top-level POST,
 * which only a WebView can make.
 */
export const buildPayFastAutoSubmitHtml = (
  formData: PayFastFormData,
  postUrl: string
): string => {
  const fields: string[] = [];
  const add = (name: string, value: unknown) =>
    fields.push(
      `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(String(value ?? ""))}" />`
    );

  Object.entries(formData).forEach(([key, value]) => {
    if (key === "ITEMS" && Array.isArray(value)) {
      value.forEach((item, index) => {
        Object.entries(item).forEach(([itemKey, itemValue]) =>
          add(`ITEMS[${index}][${itemKey}]`, itemValue)
        );
      });
    } else {
      add(key, value);
    }
  });

  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="font-family: -apple-system, Roboto, sans-serif; text-align: center; padding-top: 40vh; color: #555;">
<p>Connecting to PayFast…</p>
<form id="pf" method="POST" action="${escapeHtml(postUrl)}">${fields.join("")}</form>
<script>document.getElementById("pf").submit();</script>
</body></html>`;
};

/**
 * If `url` is PayFast returning to FoodPal's success or failure address, the
 * outcome it carries; otherwise null.
 */
export const parsePayFastReturn = (
  url: string,
  formData: Pick<PayFastFormData, "SUCCESS_URL" | "FAILURE_URL">
): (PayFastReturn & { kind: "success" | "failure" }) | null => {
  const base = url.split(/[?#]/)[0].replace(/\/+$/, "");
  const matches = (target: string) =>
    !!target && base === target.split(/[?#]/)[0].replace(/\/+$/, "");

  const kind = matches(formData.SUCCESS_URL)
    ? "success"
    : matches(formData.FAILURE_URL)
      ? "failure"
      : null;
  if (!kind) return null;

  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1).split("#")[0] : "";
  const params = new URLSearchParams(query);
  return {
    kind,
    transactionId: params.get("transaction_id"),
    basketId: params.get("basket_id"),
    errCode: params.get("err_code"),
    errMsg: params.get("err_msg"),
    validationHash: params.get("validation_hash"),
  };
};
