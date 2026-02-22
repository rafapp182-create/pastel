
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc, 
  query, 
  orderBy, 
  getDocs,
  limit,
  where,
  deleteDoc,
  writeBatch
} from "firebase/firestore";
import { firestore } from "./firebase";
import { 
  Product, 
  Order, 
  Table, 
  OrderStatus, 
  TableStatus, 
  CashierSession, 
  OrderItem, 
  PaymentType,
  Category
} from '../types';

const initialCategories = [
  { name: 'Pasteis de Carne', order: 1 },
  { name: 'Pasteis de Frango', order: 2 },
  { name: 'Pasteis Especiais', order: 3 },
  { name: 'Bebidas', order: 4 },
  { name: 'Encomendas', order: 5 },
];

const initialProducts: Product[] = [
  { id: '1', name: 'Pastel de Carne', description: 'Carne moída temperada, ovo e azeitona', category: 'Pasteis de Carne', price: 12.50, imageUrl: 'https://picsum.photos/seed/p1/300/200', active: true },
  { id: '2', name: 'Carne com Queijo', description: 'Carne moída com mussarela derretida', category: 'Pasteis de Carne', price: 13.50, imageUrl: 'https://picsum.photos/seed/p12/300/200', active: true },
  { id: '3', name: 'Pastel de Frango', description: 'Frango desfiado temperado', category: 'Pasteis de Frango', price: 11.00, imageUrl: 'https://picsum.photos/seed/p2/300/200', active: true },
  { id: '4', name: 'Frango c/ Catupiry', description: 'Frango desfiado com o legítimo Catupiry', category: 'Pasteis de Frango', price: 14.00, imageUrl: 'https://picsum.photos/seed/p3/300/200', active: true },
  { id: '5', name: '4 Queijos Especial', description: 'Mussarela, provolone, parmesão e gorgonzola', category: 'Pasteis Especiais', price: 16.00, imageUrl: 'https://picsum.photos/seed/p4/300/200', active: true },
  { id: '6', name: 'Pastel de Bacalhau', description: 'Bacalhau do porto desfiado com azeitonas', category: 'Pasteis Especiais', price: 22.00, imageUrl: 'https://picsum.photos/seed/p13/300/200', active: true },
  { id: '7', name: 'Caldo de Cana 500ml', description: 'Moído na hora, bem geladinho', category: 'Bebidas', price: 8.00, imageUrl: 'https://picsum.photos/seed/p5/300/200', active: true },
  { id: '8', name: 'Coca-Cola Lata', description: '350ml gelada', category: 'Bebidas', price: 6.50, imageUrl: 'https://picsum.photos/seed/p6/300/200', active: true },
  { id: '9', name: 'Pastel de Camarão', description: 'Camarões selecionados com molho especial', category: 'Pasteis Especiais', price: 25.00, imageUrl: 'https://picsum.photos/seed/p14/300/200', active: true },
  { id: '10', name: 'Encomenda Cento Mini', description: 'Cento de mini pastéis variados para festas', category: 'Encomendas', price: 120.00, imageUrl: 'https://picsum.photos/seed/p15/300/200', active: true },
];

const initialTables: Table[] = Array.from({ length: 12 }, (_, i) => ({
  id: `t${i + 1}`,
  number: i + 1,
  status: TableStatus.LIVRE
}));

class FirebaseDatabase {
  private products: Product[] = [];
  private orders: Order[] = [];
  private tables: Table[] = [];
  private categories: Category[] = [];
  private currentSession: CashierSession | null = null;
  private listeners: Set<() => void> = new Set();
  private initialized = false;
  private activeUnsubs: (() => void)[] = [];
  private isSeedingProducts = false;
  private isSeedingTables = false;
  private isSeedingCategories = false;

  constructor() {
    // Não inicia mais no construtor para evitar erros de permissão antes do login
  }

  private cleanObject(obj: any) {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined && obj[key] !== null && !Number.isNaN(obj[key])) {
        newObj[key] = obj[key];
      }
    });
    return newObj;
  }

  public async start(role: string, userId?: string) {
    // Limpa ouvintes anteriores se houver
    this.stop();

    console.log(`Iniciando banco de dados para papel: ${role}`);

    // Categorias são públicas
    const unsubCategories = onSnapshot(query(collection(firestore, "categories"), orderBy("order", "asc")), (snapshot) => {
      this.categories = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Category));
      console.log(`Categorias carregadas: ${this.categories.length}`);
      if (this.categories.length === 0 && !this.isSeedingCategories) {
        this.seedCategories();
      }
      this.notify();
    }, (err) => {
      console.error("Erro na escuta de categorias:", err);
    });
    this.activeUnsubs.push(unsubCategories);

    // Produtos são públicos
    const unsubProducts = onSnapshot(collection(firestore, "products"), (snapshot) => {
      this.products = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Product));
      if (this.products.length === 0) {
        this.seedProducts();
      }
      this.notify();
    });
    this.activeUnsubs.push(unsubProducts);

    // Mesas são para Staff
    if (role === 'admin' || role === 'caixa' || role === 'cozinha') {
      const unsubTables = onSnapshot(collection(firestore, "tables"), (snapshot) => {
        this.tables = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Table)).sort((a,b) => a.number - b.number);
        if (this.tables.length === 0) {
          this.seedTables();
        }
        this.notify();
      });
      this.activeUnsubs.push(unsubTables);
    }

    // Pedidos: Staff vê todos, Cliente vê apenas os seus
    let ordersQuery;
    if (role === 'admin' || role === 'caixa' || role === 'cozinha') {
      ordersQuery = query(collection(firestore, "orders"), orderBy("createdAt", "desc"), limit(100));
    } else if (userId) {
      ordersQuery = query(collection(firestore, "orders"), where("customerId", "==", userId), orderBy("createdAt", "desc"), limit(50));
    }

    if (ordersQuery) {
      const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
        this.orders = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Order));
        this.notify();
      }, (err) => {
        console.error("Erro na escuta de pedidos:", err);
      });
      this.activeUnsubs.push(unsubOrders);
    }

    // Sessão de Caixa: Apenas Admin e Caixa
    if (role === 'admin' || role === 'caixa') {
      const sessionsQuery = query(collection(firestore, "sessions"), where("status", "==", "open"), limit(1));
      const unsubSessions = onSnapshot(sessionsQuery, (snapshot) => {
        const active = snapshot.docs[0];
        this.currentSession = active ? ({ ...active.data(), id: active.id } as CashierSession) : null;
        this.notify();
      }, (error) => {
        console.error("Erro na escuta de sessões:", error);
      });
      this.activeUnsubs.push(unsubSessions);
    }

    this.initialized = true;
  }

  public stop() {
    this.activeUnsubs.forEach(unsub => unsub());
    this.activeUnsubs = [];
    this.initialized = false;
  }

  private async seedProducts() {
    if (this.isSeedingProducts) return;
    this.isSeedingProducts = true;
    try {
      console.log("Seeding initial products...");
      for (const p of initialProducts) {
        const { id, ...data } = p;
        await setDoc(doc(firestore, "products", id), data);
      }
    } finally {
      this.isSeedingProducts = false;
    }
  }

  private async seedTables() {
    if (this.isSeedingTables) return;
    this.isSeedingTables = true;
    try {
      console.log("Seeding initial tables...");
      for (const t of initialTables) {
        const { id, ...data } = t;
        await setDoc(doc(firestore, "tables", id), data);
      }
    } finally {
      this.isSeedingTables = false;
    }
  }

  private async seedCategories() {
    if (this.isSeedingCategories) return;
    this.isSeedingCategories = true;
    try {
      console.log("Semeando categorias iniciais...");
      const batch = writeBatch(firestore);
      initialCategories.forEach(cat => {
        const docRef = doc(collection(firestore, "categories"));
        batch.set(docRef, cat);
      });
      await batch.commit();
      console.log("Categorias semeadas com sucesso.");
    } catch (err) {
      console.error("Erro ao semear categorias:", err);
    } finally {
      this.isSeedingCategories = false;
    }
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getCurrentSession() { return this.currentSession; }
  
  async openCashier(initialAmount: number) {
    try {
      const sessionData = {
        startTime: Date.now(),
        initialAmount,
        status: 'open'
      };
      await addDoc(collection(firestore, "sessions"), sessionData);
    } catch (error) {
      console.error("Erro detalhado em openCashier:", error);
      throw error;
    }
  }

  async closeCashier() {
    if (this.currentSession) {
      await updateDoc(doc(firestore, "sessions", this.currentSession.id), {
        status: 'closed',
        endTime: Date.now()
      });
    }
  }

  getProducts() { return this.products; }
  
  async addProduct(p: Omit<Product, 'id'>) {
    const docRef = await addDoc(collection(firestore, "products"), p);
    return { ...p, id: docRef.id };
  }

  async updateProduct(id: string, p: Partial<Product>) {
    await updateDoc(doc(firestore, "products", id), p);
  }

  async deleteProduct(id: string) {
    await updateDoc(doc(firestore, "products", id), { active: false });
  }

  async getSettings() {
    const settingsDoc = await getDocs(query(collection(firestore, "settings"), limit(1)));
    if (settingsDoc.empty) {
      return { bannerUrl: 'https://picsum.photos/seed/pastel-hero/800/400' };
    }
    return settingsDoc.docs[0].data();
  }

  async updateSettings(settings: any) {
    const settingsCol = collection(firestore, "settings");
    const snapshot = await getDocs(settingsCol);
    if (snapshot.empty) {
      await addDoc(settingsCol, settings);
    } else {
      await updateDoc(doc(firestore, "settings", snapshot.docs[0].id), settings);
    }
  }

  // Carrinho persistente
  async getCart(userId: string): Promise<OrderItem[]> {
    const cartDoc = await getDoc(doc(firestore, "carts", userId));
    if (cartDoc.exists()) {
      return cartDoc.data().items || [];
    }
    return [];
  }

  async updateCart(userId: string, items: OrderItem[]) {
    await setDoc(doc(firestore, "carts", userId), {
      items,
      updatedAt: Date.now()
    });
  }

  subscribeToCart(userId: string, callback: (items: OrderItem[]) => void) {
    return onSnapshot(doc(firestore, "carts", userId), (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data().items || []);
      } else {
        callback([]);
      }
    });
  }

  getOrders() { return this.orders; }
  
  getOrderById(id: string) {
    return this.orders.find(o => o.id === id);
  }

  async createOrder(order: Omit<Order, 'id' | 'createdAt' | 'sessionId'>) {
    try {
      const itemsWithDescription = order.items.map(item => {
        const prod = this.products.find(p => p.id === item.productId);
        return {
          ...item,
          description: prod?.description || ''
        };
      });

      // Se não houver sessão ativa em memória, tenta buscar a mais recente aberta
      let sessionId = this.currentSession?.id;
      if (!sessionId) {
        try {
          const q = query(collection(firestore, "sessions"), where("status", "==", "open"), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            sessionId = snap.docs[0].id;
          }
        } catch (err) {
          console.warn("Aviso: Não foi possível buscar sessão aberta:", err);
        }
      }

      const orderData = this.cleanObject({
        ...order,
        items: itemsWithDescription,
        createdAt: Date.now(),
        sessionId: sessionId || 'manual'
      });

      const docRef = await addDoc(collection(firestore, "orders"), orderData);
      
      if (order.tableNumber && !Number.isNaN(order.tableNumber)) {
        const table = this.tables.find(t => t.number === order.tableNumber);
        if (table) {
          await updateDoc(doc(firestore, "tables", table.id), {
            status: TableStatus.OCUPADA,
            currentOrderId: docRef.id
          });
        }
      }

      return { ...orderData, id: docRef.id } as Order;
    } catch (error) {
      console.error("Erro detalhado em createOrder:", error);
      throw error;
    }
  }

  async updateOrderItems(orderId: string, items: OrderItem[]) {
    const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const updatedItems = items.map(item => {
      const prod = this.products.find(p => p.id === item.productId);
      return {
        ...item,
        description: prod?.description || item.description || ''
      };
    });

    await updateDoc(doc(firestore, "orders", orderId), {
      items: updatedItems,
      total
    });
  }

  async updateOrderCustomerName(orderId: string, name: string) {
    await updateDoc(doc(firestore, "orders", orderId), {
      customerName: name
    });
  }

  async markOrderAsDelivered(orderId: string) {
    await updateDoc(doc(firestore, "orders", orderId), {
      deliveredAt: Date.now()
    });
  }

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    await updateDoc(doc(firestore, "orders", orderId), { status });
    
    if (status === OrderStatus.PAGO) {
      const order = this.orders.find(o => o.id === orderId);
      if (order?.tableNumber) {
        const table = this.tables.find(t => t.number === order.tableNumber);
        if (table) {
          await updateDoc(doc(firestore, "tables", table.id), {
            status: TableStatus.LIVRE,
            currentOrderId: null
          });
        }
      }
    }
  }

  async updateOrderPayment(orderId: string, paymentType: PaymentType, amountReceived: number, change: number) {
    try {
      const updateData = this.cleanObject({
        paymentType,
        amountReceived,
        change,
        status: OrderStatus.PAGO
      });
      
      await updateDoc(doc(firestore, "orders", orderId), updateData);
      
      const order = this.orders.find(o => o.id === orderId);
      if (order?.tableNumber) {
        const table = this.tables.find(t => t.number === order.tableNumber);
        if (table) {
          await updateDoc(doc(firestore, "tables", table.id), {
            status: TableStatus.LIVRE,
            currentOrderId: null
          });
        }
      }

      // Retorna o objeto atualizado mesclando os dados antigos com os novos
      if (order) {
        return { ...order, ...updateData } as Order;
      }
      return null;
    } catch (error) {
      console.error("Erro detalhado em updateOrderPayment:", error);
      throw error;
    }
  }

  async clearOrderHistory() {
    try {
      // 1. Limpar Pedidos
      const qOrders = query(collection(firestore, "orders"));
      const snapOrders = await getDocs(qOrders);
      const batchOrders = writeBatch(firestore);
      snapOrders.docs.forEach(d => {
        batchOrders.delete(d.ref);
      });
      await batchOrders.commit();

      // 2. Limpar Sessões
      const qSessions = query(collection(firestore, "sessions"));
      const snapSessions = await getDocs(qSessions);
      const batchSessions = writeBatch(firestore);
      snapSessions.docs.forEach(d => {
        batchSessions.delete(d.ref);
      });
      await batchSessions.commit();

      // 3. Resetar Mesas
      const batchTables = writeBatch(firestore);
      this.tables.forEach(t => {
        batchTables.update(doc(firestore, "tables", t.id), {
          status: TableStatus.LIVRE,
          currentOrderId: null
        });
      });
      await batchTables.commit();

      this.currentSession = null;
      return true;
    } catch (error) {
      console.error("Erro detalhado em clearOrderHistory:", error);
      throw error;
    }
  }

  getCategories() { return this.categories; }

  async addCategory(name: string) {
    try {
      console.log('db.addCategory current categories:', this.categories);
      const order = this.categories.length > 0 
        ? Math.max(...this.categories.map(c => c.order)) + 1 
        : 1;
      console.log(`Adicionando categoria: ${name} com ordem ${order}`);
      const docRef = await addDoc(collection(firestore, "categories"), { name, order });
      console.log(`Categoria adicionada com ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error("Erro ao adicionar categoria no Firebase:", error);
      throw error;
    }
  }

  async deleteCategory(id: string) {
    await deleteDoc(doc(firestore, "categories", id));
  }

  async updateCategoryOrder(id: string, order: number) {
    await updateDoc(doc(firestore, "categories", id), { order });
  }

  getTables() { return this.tables; }
  
  getTableByNumber(num: number) {
    return this.tables.find(t => t.number === num);
  }
}

export const db = new FirebaseDatabase();
