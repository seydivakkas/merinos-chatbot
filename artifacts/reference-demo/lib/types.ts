export type StockStatus = "Stokta" | "Sınırlı stok" | "Stokta yok";

export type Product = {
  id: number;
  code: string;
  name: string;
  collection: string;
  category: string;
  color: string;
  size: string;
  price: number;
  stock: StockStatus;
  pattern: string;
};

export type ProductSearchCriteria = {
  query?: string;
  categories?: string[];
  colors?: string[];
  sizes?: string[];
  collections?: string[];
  limit?: number;
};

export type ProductSearchResult = {
  items: Product[];
  total: number;
  criteria: ProductSearchCriteria;
  suggestions: MessageAction[];
};

export type OrderStepState = "done" | "current" | "next";
export type OrderStep = { label: string; detail: string; state: OrderStepState };
export type DemoOrder = {
  number: string;
  status: string;
  summary: string;
  estimatedDate: string;
  cargoCode?: string;
  steps: OrderStep[];
};

export type Dealer = {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  distance: string;
  hours: string;
  mapX: number;
  mapY: number;
  latitude: number;
  longitude: number;
  approximateDistanceKm?: number;
};

export type FaqStatus = "draft" | "review" | "published" | "archived";
export type Faq = {
  id: string;
  topic: string;
  question: string;
  answer: string;
  keywords: string[];
  aliases: string[];
  status: FaqStatus;
  source: string;
  contentVersion: string;
  reviewedAt: string;
};

export type ChatIntent = "product" | "order" | "dealer" | "faq" | null;
export type MessageAction = { label: string; value: string };
export type ChatMessageStatus = "sent" | "pending" | "failed";
export type ChatMessage = {
  id: number;
  sender: "bot" | "user";
  text: string;
  status?: ChatMessageStatus;
  clientMessageId?: string;
  requestId?: string;
  products?: Product[];
  order?: DemoOrder;
  dealers?: Dealer[];
  faq?: Faq;
  actions?: MessageAction[];
};

export type DataSourceMode = "local" | "api";
export type DataErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "TIMEOUT"
  | "ABORTED"
  | "NETWORK_ERROR"
  | "CONFLICT"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "UNAUTHORIZED"
  | "FORBIDDEN";
export type DataError = { code: DataErrorCode; message: string; retryable: boolean; requestId?: string };
export type DataMeta = { requestId?: string; source: DataSourceMode; generatedAt?: string; demo: boolean };
export type DataResult<T> = { ok: true; data: T; meta: DataMeta } | { ok: false; error: DataError; meta: DataMeta };
