export type ApiProduct = {
  id: string;
  userId?: string | null;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt?: string | number | Date | null;
  updatedAt?: string | number | Date | null;
};

export type ApiOrderItem = {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  createdAt?: string | number | Date | null;
};

export type ApiOrder = {
  id: string;
  userId: string;
  status: string;
  total: number;
  items: ApiOrderItem[];
  createdAt?: string | number | Date | null;
  updatedAt?: string | number | Date | null;
};

export type ApiCartItem = {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  lineTotal: number;
  product: ApiProduct;
  createdAt?: string | number | Date | null;
  updatedAt?: string | number | Date | null;
};

export type ApiCartSummary = {
  items: ApiCartItem[];
  total: number;
  quantity: number;
};

export type ApiHealthSummary = {
  app: string;
  now: string;
  totals: {
    products: number;
    demoUserOrders: number;
    demoUserCartItems: number;
  };
};

export type ApiUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  permissions?: string[];
};

export type DashboardSnapshot = {
  summary: ApiHealthSummary;
  products: ApiProduct[];
  orders: ApiOrder[];
  cart: ApiCartSummary;
  users: ApiUser[];
  capabilities: {
    products: boolean;
    orders: boolean;
    cart: boolean;
    users: boolean;
  };
};
