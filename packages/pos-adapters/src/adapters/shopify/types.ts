import { POSCredentials, POSWebhook } from '../../types';

/**
 * Shopify-specific credential configuration
 */
export interface ShopifyCredentials extends POSCredentials {
  provider: 'shopify';
  shopDomain: string;
  accessToken?: string;
  apiKey: string;
  apiSecret: string;
  scopes?: string[];
  webhookSecret?: string;
  apiVersion?: string; // Default: 2024-01
}

/**
 * Shopify Order (represents a transaction in POS context)
 */
export interface ShopifyOrder {
  id: number;
  admin_graphql_api_id: string;
  app_id: number;
  browser_ip: string | null;
  buyer_accepts_marketing: boolean;
  cancel_reason: string | null;
  cancelled_at: string | null;
  cart_token: string | null;
  checkout_id: number | null;
  checkout_token: string | null;
  client_details: ShopifyClientDetails | null;
  closed_at: string | null;
  confirmed: boolean;
  contact_email: string | null;
  created_at: string;
  currency: string;
  current_subtotal_price: string;
  current_subtotal_price_set: ShopifyMoneySet;
  current_total_discounts: string;
  current_total_discounts_set: ShopifyMoneySet;
  current_total_duties_set: ShopifyMoneySet | null;
  current_total_price: string;
  current_total_price_set: ShopifyMoneySet;
  current_total_tax: string;
  current_total_tax_set: ShopifyMoneySet;
  customer_locale: string | null;
  device_id: number | null;
  email: string;
  estimated_taxes: boolean;
  financial_status: ShopifyFinancialStatus;
  fulfillment_status: string | null;
  gateway: string;
  landing_site: string | null;
  line_items: ShopifyLineItem[];
  location_id: number | null;
  name: string;
  note: string | null;
  note_attributes: any[];
  number: number;
  order_number: number;
  order_status_url: string;
  payment_gateway_names: string[];
  phone: string | null;
  presentment_currency: string;
  processed_at: string;
  processing_method: string;
  reference: string | null;
  referring_site: string | null;
  source_identifier: string | null;
  source_name: string;
  source_url: string | null;
  subtotal_price: string;
  subtotal_price_set: ShopifyMoneySet;
  tags: string;
  tax_lines: ShopifyTaxLine[];
  taxes_included: boolean;
  test: boolean;
  token: string;
  total_discounts: string;
  total_discounts_set: ShopifyMoneySet;
  total_line_items_price: string;
  total_line_items_price_set: ShopifyMoneySet;
  total_outstanding: string;
  total_price: string;
  total_price_set: ShopifyMoneySet;
  total_price_usd: string;
  total_shipping_price_set: ShopifyMoneySet;
  total_tax: string;
  total_tax_set: ShopifyMoneySet;
  total_tip_received: string;
  total_weight: number;
  updated_at: string;
  user_id: number | null;
  customer: ShopifyCustomer | null;
  discount_applications: any[];
  fulfillments: any[];
  refunds: ShopifyRefund[];
  shipping_address: ShopifyAddress | null;
  shipping_lines: any[];
}

export type ShopifyFinancialStatus = 
  | 'pending'
  | 'authorized'
  | 'partially_paid'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'voided';

export interface ShopifyMoneySet {
  shop_money: {
    amount: string;
    currency_code: string;
  };
  presentment_money: {
    amount: string;
    currency_code: string;
  };
}

export interface ShopifyClientDetails {
  accept_language: string | null;
  browser_height: number | null;
  browser_ip: string | null;
  browser_width: number | null;
  session_hash: string | null;
  user_agent: string | null;
}

export interface ShopifyLineItem {
  id: number;
  admin_graphql_api_id: string;
  fulfillable_quantity: number;
  fulfillment_service: string;
  fulfillment_status: string | null;
  gift_card: boolean;
  grams: number;
  name: string;
  price: string;
  price_set: ShopifyMoneySet;
  product_exists: boolean;
  product_id: number | null;
  properties: any[];
  quantity: number;
  requires_shipping: boolean;
  sku: string | null;
  taxable: boolean;
  title: string;
  total_discount: string;
  total_discount_set: ShopifyMoneySet;
  variant_id: number | null;
  variant_inventory_management: string | null;
  variant_title: string | null;
  vendor: string | null;
}

export interface ShopifyTaxLine {
  price: string;
  price_set: ShopifyMoneySet;
  rate: number;
  title: string;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  accepts_marketing: boolean;
  created_at: string;
  updated_at: string;
  first_name: string | null;
  last_name: string | null;
  orders_count: number;
  state: string;
  total_spent: string;
  last_order_id: number | null;
  verified_email: boolean;
  tax_exempt: boolean;
  tags: string;
  currency: string;
  phone: string | null;
  accepts_marketing_updated_at: string;
  marketing_opt_in_level: string | null;
}

export interface ShopifyAddress {
  first_name: string | null;
  address1: string | null;
  phone: string | null;
  city: string | null;
  zip: string | null;
  province: string | null;
  country: string | null;
  last_name: string | null;
  address2: string | null;
  company: string | null;
  latitude: number | null;
  longitude: number | null;
  name: string | null;
  country_code: string | null;
  province_code: string | null;
}

export interface ShopifyRefund {
  id: number;
  admin_graphql_api_id: string;
  created_at: string;
  note: string | null;
  order_id: number;
  processed_at: string;
  restock: boolean;
  total_duties_set: ShopifyMoneySet | null;
  user_id: number;
  refund_line_items: ShopifyRefundLineItem[];
  transactions: ShopifyTransaction[];
}

export interface ShopifyRefundLineItem {
  id: number;
  line_item_id: number;
  location_id: number | null;
  quantity: number;
  restock_type: string;
  subtotal: number;
  subtotal_set: ShopifyMoneySet;
  total_tax: number;
  total_tax_set: ShopifyMoneySet;
  line_item: ShopifyLineItem;
}

export interface ShopifyTransaction {
  id: number;
  admin_graphql_api_id: string;
  amount: string;
  authorization: string | null;
  created_at: string;
  currency: string;
  device_id: number | null;
  error_code: string | null;
  gateway: string;
  kind: string;
  location_id: number | null;
  message: string | null;
  order_id: number;
  parent_id: number | null;
  processed_at: string;
  receipt: any;
  source_name: string;
  status: string;
  test: boolean;
  user_id: number | null;
}

export interface ShopifyLocation {
  id: number;
  name: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  zip: string | null;
  province: string | null;
  country: string | null;
  phone: string | null;
  province_code: string | null;
  country_code: string | null;
  country_name: string | null;
  created_at: string;
  updated_at: string;
  legacy: boolean;
  active: boolean;
  localized_country_name: string | null;
  localized_province_name: string | null;
}

export interface ShopifyShop {
  id: number;
  name: string;
  email: string;
  domain: string;
  province: string | null;
  country: string;
  address1: string | null;
  zip: string | null;
  city: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  primary_locale: string;
  address2: string | null;
  created_at: string;
  updated_at: string;
  country_code: string;
  country_name: string;
  currency: string;
  customer_email: string;
  timezone: string;
  iana_timezone: string;
  shop_owner: string;
  money_format: string;
  money_with_currency_format: string;
  weight_unit: string;
  province_code: string | null;
  taxes_included: boolean | null;
  auto_configure_tax_inclusivity: boolean | null;
  tax_shipping: boolean | null;
  plan_display_name: string;
  plan_name: string;
  has_discounts: boolean;
  has_gift_cards: boolean;
  myshopify_domain: string;
  checkout_api_supported: boolean;
  multi_location_enabled: boolean;
  setup_required: boolean;
  pre_launch_enabled: boolean;
  enabled_presentment_currencies: string[];
  transactional_sms_disabled: boolean;
  marketing_sms_consent_enabled_at_checkout: boolean;
}

export interface ShopifyWebhookSubscription {
  id: number;
  address: string;
  topic: string;
  created_at: string;
  updated_at: string;
  format: 'json' | 'xml';
  fields: string[];
  metafield_namespaces: string[];
  api_version: string;
  private_metafield_namespaces: string[];
}

export interface ShopifyAPIResponse<T = any> {
  [key: string]: T | T[];
}

export interface ShopifyWebhookEvent {
  id: string;
  shop_domain: string;
  shop_id: number;
  topic: string;
  created_at: string;
  data: any;
}

export interface ShopifyOAuthResponse {
  access_token: string;
  scope: string;
  expires_in?: number;
  associated_user_scope?: string;
  associated_user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    account_owner: boolean;
    locale: string;
    collaborator: boolean;
    email_verified: boolean;
  };
}

export interface ShopifyOrderSearchOptions {
  status?: 'open' | 'closed' | 'cancelled' | 'any';
  financial_status?: ShopifyFinancialStatus;
  fulfillment_status?: 'shipped' | 'partial' | 'unshipped' | 'any' | 'unfulfilled';
  created_at_min?: string;
  created_at_max?: string;
  updated_at_min?: string;
  updated_at_max?: string;
  processed_at_min?: string;
  processed_at_max?: string;
  attribution_app_id?: string;
  fields?: string;
  limit?: number;
  page?: string;
  since_id?: number;
  ids?: string;
}

// Webhook topics supported by Shopify
export const SHOPIFY_WEBHOOK_TOPICS = {
  ORDERS: [
    'orders/create',
    'orders/updated',
    'orders/paid',
    'orders/cancelled',
    'orders/fulfilled',
    'orders/partially_fulfilled'
  ],
  PRODUCTS: [
    'products/create',
    'products/update',
    'products/delete'
  ],
  CUSTOMERS: [
    'customers/create',
    'customers/update',
    'customers/delete',
    'customers/disable',
    'customers/enable'
  ],
  APP: [
    'app/uninstalled',
    'app_subscriptions/update'
  ],
  SHOP: [
    'shop/update'
  ],
  REFUNDS: [
    'refunds/create'
  ],
  CHECKOUTS: [
    'checkouts/create',
    'checkouts/update',
    'checkouts/delete'
  ]
} as const;

// Multi-store support for Shopify Plus
export interface ShopifyPlusStore {
  id: string;
  domain: string;
  myshopifyDomain: string;
  name: string;
  accessToken: string;
  isMainStore: boolean;
  linkedStores?: string[]; // IDs of linked stores
}

export interface ShopifyMultiStoreConfig {
  mainStore: ShopifyPlusStore;
  additionalStores: ShopifyPlusStore[];
  syncSettings?: {
    syncOrders: boolean;
    syncInventory: boolean;
    syncCustomers: boolean;
  };
}