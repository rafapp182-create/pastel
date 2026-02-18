
export enum OrderStatus {
  NOVO = 'novo',
  PREPARO = 'preparo',
  FINALIZADO = 'finalizado',
  PAGO = 'pago'
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
  COZINHA = 'cozinha'
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
  paymentType?: PaymentType;
  amountReceived?: number;
  change?: number;
  status: OrderStatus;
  tableNumber?: number;
  customerName?: string;
  createdAt: number;
  deliveredAt?: number; // Novo campo para rastrear entrega
  sessionId?: string;
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
  role: UserRole;
}

export interface CashierSession {
  id: string;
  startTime: number;
  endTime?: number;
  initialAmount: number;
  status: 'open' | 'closed';
}
