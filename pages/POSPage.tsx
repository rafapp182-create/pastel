
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockDatabase';
import { Product, OrderItem, PaymentType, OrderStatus, CashierSession, Order, Table } from '../types';

const POSPage: React.FC = () => {
  const [session, setSession] = useState<CashierSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.CARTAO);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [openingValue, setOpeningValue] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [pendingPaymentOrders, setPendingPaymentOrders] = useState<Order[]>([]);
  
  const [tables, setTables] = useState<Table[]>([]);
  const [showTableSelect, setShowTableSelect] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showCloseSummary, setShowCloseSummary] = useState(false);

  const [manualPayOrder, setManualPayOrder] = useState<Order | null>(null);

  useEffect(() => {
    const updateState = () => {
      setProducts(db.getProducts());
      setSession(db.getCurrentSession());
      setTables(db.getTables());
      
      const allOrders = db.getOrders();
      const ready = allOrders.filter(o => o.status === OrderStatus.FINALIZADO && !o.deliveredAt);
      setReadyOrders(ready);

      const pending = allOrders.filter(o => o.status !== OrderStatus.PAGO);
      setPendingPaymentOrders(pending);
    };
    updateState();
    const unsub = db.subscribe(updateState);
    return unsub;
  }, []);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleOpenCashier = () => {
    const val = parseFloat(openingValue);
    if (isNaN(val) || val < 0) {
      return notify('Insira um valor de abertura válido.', 'error');
    }
    db.openCashier(val);
    notify('Caixa aberto com sucesso!');
  };

  const handleCloseCashier = () => {
    db.closeCashier();
    setShowCloseSummary(false);
    setShowCloseConfirm(false);
    notify('Caixa fechado com sucesso.');
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        description: product.description,
        price: product.price, 
        quantity: 1 
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const handleImportTable = (table: Table) => {
    if (!table.currentOrderId) return;
    const order = db.getOrderById(table.currentOrderId);
    if (order) {
      setCart(order.items);
      setTableNumber(table.number.toString());
      setCustomerName(order.customerName || '');
      setManualPayOrder(order);
      setShowTableSelect(false);
      notify(`Pedido ${order.id.split('-')[1]} importado.`);
    }
  };

  const handleImportPending = (order: Order) => {
    setCart(order.items);
    setTableNumber(order.tableNumber?.toString() || '');
    setCustomerName(order.customerName || '');
    setManualPayOrder(order);
    notify(`Pedido #${order.id.split('-')[1]} carregado para pagamento.`);
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const change = paymentType === PaymentType.DINHEIRO 
    ? Math.max(0, Number(amountReceived) - total) 
    : 0;

  const handleOpenPayment = () => {
    if (cart.length === 0) return notify('O carrinho está vazio!', 'error');
    setShowPaymentModal(true);
  };

  const handleFinishOrder = () => {
    if (paymentType === PaymentType.DINHEIRO && (Number(amountReceived) < total || !amountReceived)) {
        return notify('Valor recebido insuficiente!', 'error');
    }

    setIsFinishing(true);

    const hasKitchenItems = cart.some(item => {
        const n = item.name.toLowerCase();
        return n.includes('pastel') || n.includes('suco') || n.includes('cana');
    });
    
    setTimeout(() => {
      if (manualPayOrder) {
        db.updateOrderPayment(manualPayOrder.id, paymentType, Number(amountReceived) || total, change);
        setLastOrder(db.getOrderById(manualPayOrder.id) || null);
        setManualPayOrder(null);
      } else {
        const order = db.createOrder({
          items: cart,
          total,
          paymentType,
          amountReceived: paymentType === PaymentType.DINHEIRO ? Number(amountReceived) : total,
          change,
          status: hasKitchenItems ? OrderStatus.NOVO : OrderStatus.PAGO,
          tableNumber: tableNumber ? parseInt(tableNumber) : undefined,
          customerName: customerName.trim() || undefined
        });
        setLastOrder(order);
      }

      setCart([]);
      setAmountReceived('');
      setTableNumber('');
      setCustomerName('');
      setIsFinishing(false);
      setShowPaymentModal(false);
      setShowReceipt(true);
      notify('Venda finalizada!');
    }, 800);
  };

  const markAsDeliveredOnly = (orderId: string) => {
    db.markOrderAsDelivered(orderId);
    notify('Entrega confirmada.');
  };

  const handlePrint = () => {
    window.print();
  };

  const getSessionSummary = () => {
    if (!session) return null;
    const sessionOrders = db.getOrders().filter(o => o.sessionId === session.id && o.status === OrderStatus.PAGO);
    
    const totals = {
      [PaymentType.DINHEIRO]: 0,
      [PaymentType.PIX]: 0,
      [PaymentType.CARTAO]: 0,
      total: 0
    };

    sessionOrders.forEach(o => {
      if (o.paymentType) {
        totals[o.paymentType] += o.total;
        totals.total += o.total;
      }
    });

    return {
      session,
      totals,
      ordersCount: sessionOrders.length,
      finalCash: session.initialAmount + totals[PaymentType.DINHEIRO]
    };
  };

  const sessionSummary = getSessionSummary();

  const Toast = () => (
    notification ? (
      <div className={`fixed top-4 right-4 z-[250] px-6 py-3 rounded-2xl shadow-2xl font-bold text-white animate-slide-in ${
        notification.type === 'error' ? 'bg-red-500' : 'bg-green-600'
      }`}>
        {notification.type === 'error' ? '❌ ' : '✅ '} {notification.message}
      </div>
    ) : null
  );

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Toast />
        <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-slate-100 max-w-md w-full text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner">
            💰
          </div>
          <h2 className="text-2xl font-black text-slate-800">Abrir Caixa</h2>
          <div className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
              <input 
                type="number"
                placeholder="0,00"
                value={openingValue}
                onChange={(e) => setOpeningValue(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-100 text-slate-900 border-none rounded-2xl outline-none font-black text-xl focus:ring-2 focus:ring-orange-500 transition-all"
              />
            </div>
            <button 
              onClick={handleOpenCashier}
              className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
            >
              Iniciar Turno
            </button>
          </div>
        </div>
      </div>
    );
  }

  const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category)))];
  const filteredProducts = activeCategory === 'Todos' 
    ? products 
    : products.filter(p => p.category === activeCategory);

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <Toast />

      {/* Notificações de Pronto */}
      {readyOrders.length > 0 && (
        <div className="bg-green-100 border-2 border-green-500 p-4 rounded-3xl animate-bounce-in shadow-lg">
          <h3 className="font-black text-green-800 mb-2 flex items-center gap-2">
            <span className="text-xl">🔔</span> {readyOrders.length} PRONTOS NA COZINHA
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {readyOrders.map(order => (
              <div key={order.id} className="bg-white p-3 rounded-2xl border border-green-200 min-w-[180px] flex flex-col gap-2 shadow-sm">
                <div className="flex justify-between items-center">
                   <span className="font-black text-xs text-slate-900">#{order.id.split('-')[1]}</span>
                   <span className="text-[9px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-black">
                     {order.tableNumber ? `M${order.tableNumber}` : 'BALCÃO'}
                   </span>
                </div>
                <button 
                  onClick={() => markAsDeliveredOnly(order.id)}
                  className="w-full bg-green-500 text-white py-2 rounded-xl text-[10px] font-black hover:bg-green-600"
                >
                  CONFIRMAR ENTREGA
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        <div className="space-y-4 print:hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Produtos</h2>
            <button 
              onClick={() => setShowCloseConfirm(true)}
              className="text-[10px] bg-red-50 text-red-500 px-3 py-1.5 rounded-full font-bold uppercase hover:bg-red-500 hover:text-white transition-all shadow-sm"
            >
              Fechar Caixa
            </button>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${
                  activeCategory === cat ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2">
            {filteredProducts.map(p => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 hover:border-orange-300 transition-all text-left flex flex-col gap-1 group"
              >
                <div className="relative overflow-hidden rounded-lg aspect-square">
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                  <div className="absolute top-0.5 right-0.5 bg-white/90 px-1.5 py-0.5 rounded text-[8px] font-black text-orange-600 shadow-sm">
                    R$ {p.price.toFixed(2)}
                  </div>
                </div>
                <h3 className="font-bold text-slate-800 text-[10px] h-7 line-clamp-2 leading-tight">{p.name}</h3>
              </button>
            ))}
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mt-4">
             <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Aguardando Pagamento</h3>
             <div className="space-y-2">
                {pendingPaymentOrders.length === 0 ? (
                  <p className="text-xs text-slate-300 italic">Nenhum pedido pendente.</p>
                ) : (
                  pendingPaymentOrders.map(o => (
                    <button 
                      key={o.id}
                      onClick={() => handleImportPending(o)}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-orange-50 rounded-xl transition-colors border border-transparent hover:border-orange-200"
                    >
                       <div className="text-left">
                          <p className="font-black text-xs text-slate-900">#{o.id.split('-')[1]} - {o.customerName || (o.tableNumber ? `Mesa ${o.tableNumber}` : 'Balcão')}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{o.status}</p>
                       </div>
                       <div className="text-right">
                          <p className="font-black text-orange-600">R$ {o.total.toFixed(2)}</p>
                          <span className="text-[8px] bg-slate-200 px-1.5 py-0.5 rounded uppercase font-bold text-slate-500">Pagar</span>
                       </div>
                    </button>
                  ))
                )}
             </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 border border-slate-100 flex flex-col sticky top-4 h-[calc(100vh-160px)] print:hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">Venda Atual</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowTableSelect(true)}
                className="text-xs bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full font-bold hover:bg-orange-500 hover:text-white transition-all border border-orange-200"
              >
                📂 Comandas
              </button>
              {manualPayOrder && (
                <button onClick={() => { setManualPayOrder(null); setCart([]); }} className="text-xs text-red-500 font-bold px-2">Limpar</button>
              )}
            </div>
          </div>

          <div className="mb-4">
            <input 
              type="text"
              placeholder="Identificação do Cliente"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="w-full bg-slate-100 text-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-200 transition-all"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 scrollbar-thin">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10 opacity-50">
                <span className="text-5xl mb-3">🛒</span>
                <p className="font-medium">Venda Vazia</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.productId} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="flex-1 mr-4">
                    <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{item.name}</h4>
                    <p className="text-[10px] text-orange-600 font-bold">R$ {item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <button onClick={() => updateQuantity(item.productId, -1)} className="px-2.5 py-1 text-slate-500 font-black">-</button>
                      <span className="px-2 py-1 font-black text-slate-900 text-sm w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)} className="px-2.5 py-1 text-slate-500 font-black">+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.productId)} className="p-2 text-red-300 hover:text-red-500 transition-colors">🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <div className="flex justify-between items-center text-2xl font-black text-slate-800 py-2">
              <span className="text-base font-bold text-slate-400 uppercase tracking-widest">Total</span>
              <span className="text-orange-600">R$ {total.toFixed(2)}</span>
            </div>

            <button 
              disabled={cart.length === 0}
              onClick={handleOpenPayment}
              className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg transition-all ${
                cart.length === 0 ? 'bg-slate-200 text-slate-400' : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
              }`}
            >
              Finalizar Pagamento
            </button>
          </div>
        </div>
      </div>

      {showCloseConfirm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center space-y-6">
            <div className="text-4xl">⚠️</div>
            <h3 className="text-xl font-bold text-slate-800">Fechar Caixa?</h3>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseConfirm(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Voltar</button>
              <button onClick={() => { setShowCloseConfirm(false); setShowCloseSummary(true); }} className="flex-1 py-3 bg-red-500 rounded-xl font-bold text-white shadow-lg">Ver Resumo</button>
            </div>
          </div>
        </div>
      )}

      {showCloseSummary && sessionSummary && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:bg-white print:p-0">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 flex flex-col space-y-6 overflow-hidden animate-bounce-in print:shadow-none print:max-w-none print:p-0">
            <div id="thermal-receipt" className="text-center font-mono text-sm space-y-4 text-slate-900 border-2 border-dashed border-slate-200 p-6 bg-slate-50 print:bg-white print:border-none print:p-2">
              <div className="border-b-2 border-slate-300 pb-3 mb-2">
                <h3 className="font-black text-lg uppercase tracking-tight">HOJE PODE PASTELARIA</h3>
                <p className="text-[10px] font-bold uppercase">FECHAMENTO DE CAIXA</p>
              </div>

              <div className="text-left text-[9px] space-y-1 mb-4">
                <p>TURNO: {sessionSummary.session.id}</p>
                <p>FECHAMENTO: {new Date().toLocaleString()}</p>
              </div>

              <div className="border-y border-slate-200 py-3 space-y-2">
                <div className="flex justify-between font-bold">
                  <span>INICIAL:</span>
                  <span>R$ {sessionSummary.session.initialAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs"><span>DINHEIRO:</span><span>R$ {sessionSummary.totals[PaymentType.DINHEIRO].toFixed(2)}</span></div>
                <div className="flex justify-between text-xs"><span>PIX:</span><span>R$ {sessionSummary.totals[PaymentType.PIX].toFixed(2)}</span></div>
                <div className="flex justify-between text-xs"><span>CARTÃO:</span><span>R$ {sessionSummary.totals[PaymentType.CARTAO].toFixed(2)}</span></div>
                <div className="h-px bg-slate-300 my-1"></div>
                <div className="flex justify-between font-black text-orange-600">
                  <span>TOTAL VENDAS:</span>
                  <span>R$ {sessionSummary.totals.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-slate-200 p-3 rounded-xl space-y-1 mt-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase">DINHEIRO ESPERADO</p>
                <p className="text-2xl font-black text-slate-900">R$ {sessionSummary.finalCash.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 print:hidden">
              <button onClick={handlePrint} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black">Imprimir</button>
              <div className="flex gap-2">
                <button onClick={() => setShowCloseSummary(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl">Voltar</button>
                <button onClick={handleCloseCashier} className="flex-[2] py-4 bg-red-500 text-white font-black rounded-2xl shadow-lg">Fechar Caixa</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTableSelect && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-lg w-full space-y-6">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-800">Selecione para Pagamento</h3>
                <button onClick={() => setShowTableSelect(false)} className="text-slate-400 p-2">✕</button>
             </div>
             <div className="grid grid-cols-3 gap-3">
                {tables.filter(t => t.status === 'ocupada').map(table => {
                  const order = db.getOrderById(table.currentOrderId!);
                  return (
                    <button key={table.id} onClick={() => handleImportTable(table)} className="p-4 bg-orange-50 border-2 border-orange-200 rounded-2xl text-center">
                      <span className="block font-black text-orange-600">Mesa {table.number}</span>
                      <span className="text-[10px] text-slate-500 mt-1">R$ {order?.total.toFixed(2)}</span>
                    </button>
                  );
                })}
             </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="bg-orange-500 p-6 text-white text-center">
               <p className="text-xs font-bold uppercase tracking-widest opacity-80">Total a Pagar</p>
               <h3 className="text-4xl font-black">R$ {total.toFixed(2)}</h3>
               {customerName && <p className="text-[10px] font-bold mt-2 uppercase">Cliente: {customerName}</p>}
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                {[
                  {type: PaymentType.CARTAO, icon: '💳', label: 'Cartão'},
                  {type: PaymentType.PIX, icon: '📱', label: 'PIX'},
                  {type: PaymentType.DINHEIRO, icon: '💵', label: 'Dinheiro'}
                ].map(p => (
                  <button key={p.type} onClick={() => setPaymentType(p.type)} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 ${paymentType === p.type ? 'bg-orange-50 border-orange-500 text-orange-600' : 'bg-white border-slate-100 text-slate-600'}`}>
                    <span className="text-3xl">{p.icon}</span>
                    <span className="font-bold text-xs uppercase">{p.label}</span>
                  </button>
                ))}
              </div>

              {paymentType === PaymentType.DINHEIRO && (
                <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-200 shadow-inner">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-600">Recebido</label>
                    <input 
                      type="number" 
                      autoFocus 
                      value={amountReceived} 
                      onChange={(e) => setAmountReceived(e.target.value)} 
                      className="pl-4 pr-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl font-black text-2xl w-36 text-right outline-none focus:ring-2 focus:ring-orange-500" 
                      placeholder="0,00" 
                    />
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="text-sm font-bold text-slate-400 uppercase">Troco</span>
                    <span className="text-2xl font-black text-green-600">R$ {change.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowPaymentModal(false)} className="flex-1 py-4 bg-slate-100 font-bold rounded-2xl text-slate-500">Voltar</button>
                <button onClick={handleFinishOrder} className="flex-[2] py-4 bg-orange-500 text-white font-black rounded-2xl shadow-xl">Finalizar Venda</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReceipt && lastOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:bg-white print:p-0">
          <div className="bg-white w-full max-sm rounded-3xl shadow-2xl p-8 flex flex-col space-y-6 overflow-hidden print:p-0">
            <div id="thermal-receipt" className="text-center font-mono text-sm space-y-4 text-slate-900 border-2 border-dashed border-slate-200 p-6 bg-slate-50 print:p-2 print:border-none print:bg-white">
              <h3 className="font-black text-lg uppercase tracking-tight">Hoje Pode Pastelaria</h3>
              <p className="text-[10px] font-bold uppercase mb-2">Venda #{lastOrder.id.split('-')[1]}</p>
              <div className="text-left text-[9px] space-y-1 mb-3">
                <p>DATA: {new Date(lastOrder.createdAt).toLocaleString()}</p>
                <p>IDENTIFICAÇÃO: {lastOrder.customerName || 'N/A'}</p>
                <p>MESA: {lastOrder.tableNumber || 'Balcão'}</p>
              </div>
              <div className="border-y-2 border-slate-300 py-2 space-y-2">
                {lastOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-[11px] font-bold border-b border-slate-100 pb-1">
                    <span className="flex-[3] text-left">{item.quantity}x {item.name}</span>
                    <span className="flex-1 text-right">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center font-black text-base py-2">
                <span>TOTAL PAGO:</span>
                <span>R$ {lastOrder.total.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3 print:hidden">
              <button onClick={handlePrint} className="flex-1 bg-slate-800 text-white py-4 rounded-2xl font-black">Imprimir</button>
              <button onClick={() => setShowReceipt(false)} className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-black">Novo Pedido</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @page { size: 80mm auto; margin: 0; }
        @media print {
          body * { visibility: hidden; }
          #thermal-receipt, #thermal-receipt * { visibility: visible; }
          #thermal-receipt { position: absolute; left: 0; top: 0; width: 80mm; padding: 5mm; background: white; font-family: 'Courier New', monospace; }
        }
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s ease-out forwards; }
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; }
        @keyframes bounce-in { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-bounce-in { animation: bounce-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default POSPage;
