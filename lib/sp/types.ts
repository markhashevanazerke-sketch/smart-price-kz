// SMART PRICE — shared domain types (client + server)

export type Role = 'specialist' | 'analyst' | 'admin';

export type ProductCategory = 'dairy' | 'groceries' | 'vegetables' | 'other';
export type ProductUnit = 'kg' | 'l' | 'pcs';
export type StoreType = 'supermarket' | 'shop' | 'market';
export type MonitoringStatus = 'active' | 'paused';
export type PriceSource = 'manual' | 'excel' | 'photo' | 'demo';
export type PriceStatus = 'pending' | 'verified' | 'flagged';
export type AnomalyType = 'spike' | 'drop' | 'outlier';
export type AnomalySeverity = 'high' | 'medium' | 'low';
export type AnomalyStatus = 'new' | 'review' | 'confirmed' | 'dismissed';
export type CommentType = 'comment' | 'flag' | 'conclusion' | 'transfer';
export type Decision = 'confirmed' | 'rejected';

export interface User {
  id: string;
  name: string;
  role: Role;
  pin: string;
  lang: string;
  active: number;
  created_at: string;
}

export interface Product {
  id: string;
  base_key: string;
  name_kk: string;
  name_ru: string;
  name_en: string;
  category: ProductCategory;
  brand?: string;
  producer?: string;
  fat?: number; // fatness % (milk products)
  amount: number; // quantity in `unit` per package (0.9, 1, 5, 10 ...)
  unit: ProductUnit;
  package: string; // bottle / bag / carton / pack / bulk / loaf
  barcode?: string;
  is_demo: number;
  created_at: string;
}

export interface Store {
  id: string;
  name: string;
  type: StoreType;
  region_code: string; // ISO 3166-2, e.g. KZ-19
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
  monitoring_status: MonitoringStatus;
  last_checked_at: string | null;
  is_demo: number;
  created_at: string;
}

export interface PriceEntry {
  id: string;
  product_id: string;
  store_id: string;
  price: number; // KZT per package
  collected_at: string; // ISO date (yyyy-mm-dd)
  source: PriceSource;
  status: PriceStatus;
  entered_by?: string;
  note?: string;
  created_at: string;
  // denormalized for UI:
  product?: Product;
  store?: Store;
  price_per_unit?: number;
  prev_price?: number | null;
  change_pct?: number | null;
}

export interface Anomaly {
  id: string;
  price_entry_id: string | null;
  product_id: string;
  store_id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  change_pct: number | null;
  metric: string;
  value: number | null;
  prev_price: number | null;
  new_price: number | null;
  message: string;
  status: AnomalyStatus;
  reviewer?: string;
  decision_note?: string;
  detected_at: string;
  is_demo: number;
  product?: Product;
  store?: Store;
}

export interface Evidence {
  id: string;
  price_entry_id: string | null;
  store_id: string | null;
  product_id: string | null;
  photo_b64?: string; // data URL
  checked_at: string;
  employee_name: string;
  comment: string;
  ocr_price: number | null;
  ocr_status: 'pending' | 'matched' | 'mismatched';
  created_at: string;
}

export interface CommentRow {
  id: string;
  ref_type: 'price' | 'anomaly';
  ref_id: string;
  author: string;
  role: Role | string;
  type: CommentType;
  content: string;
  decision: Decision | null;
  created_at: string;
}

export interface AuditRow {
  id: string;
  actor: string;
  role: string;
  action: string;
  entity: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  kind: 'anomaly' | 'system' | 'demo';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  ref_id: string | null;
  read: number;
  created_at: string;
}

export interface BasketItem {
  product_id: string;
  amount: number; // how much of the product's unit the basket needs
}

export interface Summary {
  products_count: number;
  stores_count: number;
  prices_count: number;
  basket_avg: number | null;
  basket_change_pct: number | null;
  rising_products: number;
  falling_products: number;
  suspicious_count: number;
  series: { date: string; value: number }[];
  top_rising: { base_key: string; name: string; change_pct: number; from: number; to: number }[];
  top_falling: { base_key: string; name: string; change_pct: number; from: number; to: number }[];
  last_updates: PriceEntry[];
  notifications: Notification[];
}
