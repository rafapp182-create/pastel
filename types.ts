
export enum OrderStatus {
  NOVO = 'novo',
  PREPARO = 'preparo',
  FINALIZADO = 'finalizado',
  SAIU_ENTREGA = 'saiu_entrega',
  ENTREGUE = 'entregue',
  PAGO = 'pago',
  CANCELADO = 'cancelado'
}

export enum PaymentType {
  PIX = 'pix',
  DINHEIRO = 'dinheiro',
  CARTAO = 'cartao'
}

export enum TableStatus {
  LIVRE = 'livre',
  OCUPADA = 'ocupada',
  FECHADA = 'fechada'
}

export enum UserRole {
  ADMIN = 'admin',
  CAIXA = 'caixa',
  COZINHA = 'cozinha',
  CUSTOMER = 'customer'
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  description?: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  deliveryFee?: number;
  discount?: number;
  paymentType?: PaymentType;
  amountReceived?: number;
  change?: number;
  status: OrderStatus;
  tableNumber?: number;
  customerName?: string;
  customerAddress?: string;
  customerWhatsapp?: string;
  customerId?: string;
  createdAt: number;
  deliveredAt?: number;
  sessionId?: string;
  type: 'delivery' | 'table' | 'counter';
}

export interface BusinessSettings {
  name: string;
  whatsapp: string;
  address: string;
  deliveryFee: number;
  minOrderValue: number;
  isOpen: boolean;
  openingHours: string;
}

export interface Table {
  id: string;
  number: number;
  status: TableStatus;
  currentOrderId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  address?: string;
  whatsapp?: string;
}

export interface CashierSession {
  id: string;
  startTime: number;
  endTime?: number;
  initialAmount: number;
  status: 'open' | 'closed';
}
