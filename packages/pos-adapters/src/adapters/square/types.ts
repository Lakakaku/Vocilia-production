import { POSTransaction, POSLocation, POSCredentials } from '../../types';

// Square-specific API types
export interface SquareLocation {
  id: string;
  name: string;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    administrative_district_level_1?: string;
    postal_code?: string;
    country?: string;
  };
  timezone?: string;
  merchant_id?: string;
  phone_number?: string;
  business_name?: string;
  type?: string;
  website_url?: string;
  business_hours?: any;
  status?: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
  capabilities?: string[];
}

export interface SquareMerchant {
  id: string;
  business_name?: string;
  country: string;
  language_code?: string;
  currency?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  main_location_id?: string;
  created_at?: string;
}

export interface SquarePayment {
  id: string;
  created_at: string;
  updated_at?: string;
  amount_money: {
    amount: number;
    currency: string;
  };
  tip_money?: {
    amount: number;
    currency: string;
  };
  total_money: {
    amount: number;
    currency: string;
  };
  app_fee_money?: {
    amount: number;
    currency: string;
  };
  processing_fee?: Array<{
    amount_money: {
      amount: number;
      currency: string;
    };
    type: string;
  }>;
  receipt_number?: string;
  receipt_url?: string;
  status: 'APPROVED' | 'PENDING' | 'COMPLETED' | 'CANCELED' | 'FAILED';
  delay_duration?: string;
  delay_action?: string;
  delayed_until?: string;
  source_type: string;
  card_details?: {
    status: string;
    card: {
      card_brand: string;
      last_4: string;
      exp_month?: number;
      exp_year?: number;
      fingerprint?: string;
      card_type: string;
      prepaid_type?: string;
      bin?: string;
    };
    entry_method: string;
    cvv_status?: string;
    avs_status?: string;
    auth_result_code?: string;
  };
  location_id?: string;
  order_id?: string;
  reference_id?: string;
  customer_id?: string;
  employee_id?: string;
  refund_ids?: string[];
  risk_evaluation?: {
    created_at?: string;
    risk_level?: 'PENDING' | 'NORMAL' | 'MODERATE' | 'HIGH';
  };
  buyer_email_address?: string;
  billing_address?: any;
  shipping_address?: any;
  note?: string;
  statement_description_identifier?: string;
  capabilities?: string[];
  receipt_number_display?: string;
  external_details?: any;
}

export interface SquareOrder {
  id: string;
  location_id: string;
  order_source?: {
    name?: string;
  };
  line_items?: Array<{
    uid?: string;
    name?: string;
    quantity: string;
    base_price_money?: {
      amount: number;
      currency: string;
    };
    gross_sales_money?: {
      amount: number;
      currency: string;
    };
    total_money?: {
      amount: number;
      currency: string;
    };
  }>;
  taxes?: Array<{
    uid?: string;
    name?: string;
    percentage?: string;
    applied_money?: {
      amount: number;
      currency: string;
    };
  }>;
  discounts?: Array<{
    uid?: string;
    name?: string;
    percentage?: string;
    applied_money?: {
      amount: number;
      currency: string;
    };
  }>;
  service_charges?: Array<{
    uid?: string;
    name?: string;
    percentage?: string;
    applied_money?: {
      amount: number;
      currency: string;
    };
  }>;
  fulfillments?: any[];
  returns?: any[];
  return_amounts?: any;
  net_amounts?: {
    total_money?: {
      amount: number;
      currency: string;
    };
    tax_money?: {
      amount: number;
      currency: string;
    };
    discount_money?: {
      amount: number;
      currency: string;
    };
    tip_money?: {
      amount: number;
      currency: string;
    };
    service_charge_money?: {
      amount: number;
      currency: string;
    };
  };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  state: 'OPEN' | 'COMPLETED' | 'CANCELED';
  version: number;
  total_money?: {
    amount: number;
    currency: string;
  };
  total_tax_money?: {
    amount: number;
    currency: string;
  };
  total_discount_money?: {
    amount: number;
    currency: string;
  };
  total_tip_money?: {
    amount: number;
    currency: string;
  };
  total_service_charge_money?: {
    amount: number;
    currency: string;
  };
  pricing_options?: any;
  rewards?: any[];
}

export interface SquareCredentials extends POSCredentials {
  provider: 'square';
  applicationId?: string;
  locationId?: string;
  webhookSigningSecret?: string;
  environment: 'sandbox' | 'production';
}

export interface SquareWebhookEvent {
  merchant_id: string;
  location_id?: string;
  type: string;
  event_id: string;
  created_at: string;
  data: {
    type: string;
    id: string;
    object?: any;
  };
}

// Square API response types
export interface SquareApiResponse<T = any> {
  data?: T;
  errors?: Array<{
    category: string;
    code: string;
    detail?: string;
    field?: string;
  }>;
  cursor?: string;
}

// Transaction search and filtering
export interface SquarePaymentFilter {
  begin_time?: string;
  end_time?: string;
  sort_order?: 'ASC' | 'DESC';
  cursor?: string;
  location_id?: string;
  total?: {
    amount?: number;
    currency?: string;
  };
  source_type?: string;
  card_brand?: string;
  status?: string;
}

export interface SquareTransactionCache {
  locationId: string;
  transactions: Map<string, SquarePayment>;
  lastFetch: Date;
  cursor?: string;
  expiresAt: Date;
}

// Mock data for Swedish testing
export interface SwedishMockData {
  businesses: Array<{
    name: string;
    orgNumber: string;
    location: string;
    merchantId: string;
    locationId: string;
  }>;
  transactions: Array<{
    id: string;
    amount: number;
    currency: string;
    timestamp: string;
    items: string[];
  }>;
}