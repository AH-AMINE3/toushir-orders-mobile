import { Platform } from "react-native";

export const API_ORIGIN = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "web" ? "" : "http://localhost:5860")
).replace(/\/$/, "");
let bearer = "";
let tokenRefresher: null | (() => Promise<string | null>) = null;
export const setTokenRefresher = (refresh: () => Promise<string | null>) => {
  tokenRefresher = refresh;
};
export const getBearer = () => bearer;
export const setBearer = (token: string) => {
  bearer = token;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const request = () =>
      fetch(`${API_ORIGIN}/api${path}`, {
        ...options,
        signal: controller.signal,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          ...options.headers,
        },
      });
    let response = await request();
    if (
      response.status === 401 &&
      bearer.split(".").length === 3 &&
      tokenRefresher
    ) {
      const renewed = await tokenRefresher();
      if (renewed) {
        bearer = renewed;
        response = await request();
      }
    }
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("json")
      ? await response.json()
      : await response.text();
    if (!response.ok)
      throw new ApiError(
        response.status,
        body?.error?.code || "REQUEST_FAILED",
        body?.error?.message ||
          body?.message ||
          "Cette action n’a pas abouti. Réessayez.",
        body?.error?.details,
      );
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      0,
      "CONNECTION",
      "Connexion indisponible. Vérifiez votre réseau, puis réessayez.",
    );
  } finally {
    clearTimeout(timer);
  }
}
export const post = <T = any>(
  path: string,
  body: unknown = {},
  options: RequestInit = {},
) => api<T>(path, { ...options, method: "POST", body: JSON.stringify(body) });
export const patch = <T = any>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const put = <T = any>(
  path: string,
  body: unknown,
  options: RequestInit = {},
) => api<T>(path, { ...options, method: "PUT", body: JSON.stringify(body) });
export const remove = <T = any>(path: string) =>
  api<T>(path, { method: "DELETE" });
export const imageUrl = (url?: string | null) =>
  url ? (/^https?:\/\//.test(url) ? url : `${API_ORIGIN}${url}`) : undefined;
export const money = (amount: number | null | undefined) =>
  amount == null
    ? "Sur devis"
    : new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 2 }).format(
        amount,
      ) + " DA";
export const date = (value?: string | null, withTime = false) =>
  value
    ? new Intl.DateTimeFormat("fr-DZ", {
        timeZone: "Africa/Algiers",
        hourCycle: "h23",
        day: "numeric",
        month: "short",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(new Date(value))
    : "—";
export const quantityLabel = (p: Product) =>
  p.caseSize && p.caseSize > 1
    ? `Colis de ${p.caseSize} · ${p.unit || "unité"}`
    : p.unit || "Unité à confirmer";
export const operationKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export type Product = {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  imageUrl?: string;
  unit?: string;
  caseSize: number | null;
  minimumQuantity: number;
  price: number | null;
  stock: number | null;
  pricingMode: string;
  offerApproved: boolean;
  sourceUrl?: string;
  source?: string;
  sourceLicense?: string;
  imageLicense?: string;
  countryTags?: string[];
  isActive?: boolean;
};
export type Address = {
  id: string;
  label: string;
  wilaya: string;
  commune: string;
  street: string;
};
export type User = {
  id: string;
  name: string;
  email: string;
  role: "MERCHANT" | "ADMIN" | "DRIVER";
  shopName?: string;
  phone?: string;
  approvalStatus?: string;
  shop?: {
    id: string;
    name: string;
    role: "OWNER" | "MANAGER" | "BUYER" | "VIEWER";
    membershipVersion: number;
    isMember: boolean;
    canOrder: boolean;
    canManage: boolean;
  };
};
export type Session = {
  token: string;
  workspaceToken?: string;
  user: User;
  workspace: {
    id: string;
    name: string;
    isDemo: boolean;
    canSwitchRole?: boolean;
  };
};
export type CartLine = { productId: string; quantity: number };
export type CartQuote = {
  items: {
    product: Product;
    quantity: number;
    unitPrice: number | null;
    lineTotal: number | null;
    available: number | null;
    issues: string[];
    promotion?: {
      campaignId: string;
      campaignTitle: string;
      kind: string;
      giftQuantity: number;
      giftProductName: string;
      issue?: string;
    } | null;
  }[];
  subtotal: number | null;
  deliveryFee: number | null;
  total: number | null;
  needsQuote: boolean;
  canOrder: boolean;
  currency: string;
  pricingToken?: string | null;
  resolvedAt?: string;
};
export type Order = {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  merchant: User;
  items: {
    id: string;
    productId: string;
    name: string;
    brand: string;
    imageUrl?: string;
    requestedQuantity: number;
    quantity: number;
    unitPrice: number | null;
    lineTotal: number | null;
    caseSize: number | null;
    acceptedQuantity?: number;
    refusedQuantity?: number;
  }[];
  subtotal: number | null;
  deliveryFee: number | null;
  total: number | null;
  quoteVersion: number;
  quoteValidUntil?: string;
  createdAt: string;
  updatedAt: string;
  address: Address;
  note?: string;
  adminNote?: string;
  balance: {
    due: number;
    collected: number;
    remaining: number;
    refundDue: number;
  };
  timeline: {
    id: string;
    action: string;
    at: string;
    actor: string;
    details: string;
  }[];
  payments: any[];
  claims?: Claim[];
  credits?: Credit[];
  creditTotal?: number;
  reservationHeld: boolean;
  isDemo: boolean;
  canSwitchRole?: boolean;
};
export type Claim = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  status: "OPEN" | "ACCEPTED" | "REJECTED";
  resolutionNote: string;
  createdAt: string;
  resolvedAt?: string;
  receivedQuantity: number;
  inspectedQuantity: number;
  creditedAmount: number;
};
export type Credit = {
  id: string;
  claimId: string;
  amount: number;
  reason: string;
  at: string;
  actor: string;
};
export type OrderSummary = Pick<
  Order,
  | "id"
  | "number"
  | "status"
  | "paymentStatus"
  | "merchant"
  | "total"
  | "createdAt"
  | "updatedAt"
> & { itemCount: number; quantity: number; imageUrl?: string };
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
export const statuses: Record<string, string> = {
  REQUESTED: "Devis demandé",
  QUOTED: "Offre à valider",
  SUBMITTED: "Nouvelle commande",
  CONFIRMED: "Confirmée",
  PREPARING: "En préparation",
  READY: "Prête à partir",
  OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  PARTIALLY_DELIVERED: "Livraison partielle",
  DELIVERY_REFUSED: "Livraison refusée",
  CANCELLED: "Annulée",
  REJECTED: "Refusée",
  DECLINED: "Offre déclinée",
  UNPAID: "À encaisser",
  PARTIAL: "Encaissement partiel",
  COLLECTED: "Encaissé",
  REFUND_DUE: "À rembourser",
  RECONCILED: "Rapproché",
  APPROVED: "Approuvé",
  PENDING: "À approuver",
  OPEN: "À examiner",
  ACCEPTED: "Acceptée",
  SUSPENDED: "Suspendu",
};
