export interface Order {
  id: string;
  productId: number;
  email: string;
  gateway: string;
  amount: number;
  currency: string;
  status: string;
  gatewayOrderId?: string;
  paidAt?: string;
  deliveredAt?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
  product?: {
    name: string;
  };
}

export interface OrderFilters {
  page?: number;
  limit?: number;
  status?: string;
  gateway?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface FilterOptions {
  statuses: Array<{ value: string; label: string }>;
  gateways: Array<{ value: string; label: string }>;
  currencies: Array<{ value: string; label: string }>;
  dateRanges: Array<{ value: string; label: string }>;
  sortOptions: Array<{ value: string; label: string }>;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface OrderListResponse {
  orders: Order[];
  pagination: Pagination;
}
