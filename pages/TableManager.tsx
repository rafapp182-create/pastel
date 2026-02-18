
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockDatabase';
import { Table, TableStatus, Product, Order, OrderItem, OrderStatus, PaymentType } from '../types';

const TableManager: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // States for finishing payment
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.CARTAO);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [isFinishing, setIsFinishing] = useState(false);

  // Dividir Conta
  const [splitPeople, setSplitPeople] = useState<number>(1);
  const [showSplitUI, setShowSplitUI] = useState(false);

  // Nome do cliente
  const [customerName, setCustomerName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    const update = () => {
      setTables(db.getTables());
      setProducts(db.getProducts());
      const allOrders = db.getOrders();
      setOrders(allOrders);
      if (selectedTable) {
        const updatedTable = db.getTableByNumber(selectedTable.number);
        if (updatedTable?.currentOrderId) {
          const order = db.getOrderById(updatedTable.currentOrderId);
          setActiveOrder(order || null);
          setCustomerName(order?.customerName || '');
        } else {
          setActiveOrder(null);
          setCustomerName('');
        }
      }
    };
    update();
    const unsub = db.subscribe(update);
    return unsub;
  }, [selectedTable]);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
    const order = table.currentOrderId ? db.getOrderById(table.currentOrderId) : null;
    setActiveOrder(order || null);
    setCustomerName(order?.customerName || '');
    setIsEditingName(false);
  };

  const addItemToComanda = (product: Product) => {
    if (!selectedTable) return;

    let order = activeOrder;
    if (!order) {
      order = db.createOrder({
        items: [{ 
          productId: product.id, 
          name: product.name, 
          description: product.description,
          price: product.price, 
          quantity: 1 
        }],
        total: product.price,
        status: OrderStatus.NOVO,
        tableNumber: selectedTable.number,
        customerName: customerName.trim()
      });
      setActiveOrder(order);
      notify(`Mesa ${selectedTable.number} aberta!`);
    } else {
      const existingItems = [...order.items];
      const itemIndex = existingItems.findIndex(i => i.productId === product.id);
      
      if (itemIndex > -1) {
        existingItems[itemIndex].quantity += 1;
      } else {
        existingItems.push({ 
          productId: product.id, 
          name: product.name, 
          description: product.description,
          price: product.price, 
          quantity: 1 
        });
      }
      
      db.updateOrderItems(order.id, existingItems);
      notify(`${product.name} adicionado!`);
    }
  };

  const handleSaveName = () => {
    if (activeOrder) {
      db.updateOrderCustomerName(activeOrder.id, customerName.trim());
      notify('Nome atualizado!');
    }
    setIsEditingName(false);
  };

  const updateItemQuantity = (productId: string, delta: number) => {
    if (!activeOrder) return;
    
    const updatedItems = activeOrder.items.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0);

    if (updatedItems.length === 0) {
      setShowClearConfirm(true);
    } else {
      db.updateOrderItems(activeOrder.id, updatedItems);
    }
  };

  const handleClearTable = () => {
    if (activeOrder) {
      db.updateOrderStatus(activeOrder.id, OrderStatus.PAGO);
      setSelectedTable(null);
      setActiveOrder(null);
      setShowClearConfirm(false);
      notify('Mesa liberada.');
    }
  };

  const getTableTotal = (table: Table) => {
    if (!table.currentOrderId) return 0;
    const order = orders.find(o => o.id === table.currentOrderId);
    return order ? order.total : 0;
  };

  const getTableCustomer = (table: Table) => {
    if (!table.currentOrderId) return '';
    const order = orders.find(o => o.id === table.currentOrderId);
    return order ? order.customerName : '';
  };

  const isTableReady = (table: Table) => {
    if (!table.currentOrderId) return false;
    const order = orders.find(o => o.id === table.currentOrderId);
    return order?.status === OrderStatus.FINALIZADO;
  };

  const total = activeOrder?.total || 0;
  const change = paymentType === PaymentType.DINHEIRO 
    ? Math.max(0, Number(amountReceived) - total) 
    : 0;

  const handleFinishPayment = () => {
    if (!activeOrder) return;
    if (paymentType === PaymentType.DINHEIRO && (Number(amountReceived) < total || !amountReceived)) {
      return notify('Valor recebido insuficiente!', 'error');
    }

    setIsFinishing(true);
    
    setTimeout(() => {
      db.updateOrderPayment(
        activeOrder.id,
        paymentType,
        paymentType === PaymentType.DINHEIRO ? Number(amountReceived) : total,
        change
      );

      setIsFinishing(false);
      setShowPaymentModal(false);
      setSelectedTable(null);
      setActiveOrder(null);
      setAmountReceived('');
      notify('Pagamento realizado e mesa liberada!');
    }, 800);
  };

  const handleOpenPayment = () => {
    setSplitPeople(1);
    setShowSplitUI(false);
    setShowPaymentModal(true);
  };

  const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category)))];
  const filteredProducts = activeCategory === 'Todos' 
    ? products 
    : products.filter(p => p.category === activeCategory);

  return (
    <div className="space-y-6 relative h-full">
      {notification && (
        <div className={`fixed top-4 right-4 z-[350] px-6 py-3 rounded-2xl shadow-2xl font-bold text-white animate-slide-in ${
          notification.type === 'error' ? 'bg-red-500' : 'bg-green-600'
        }`}>
          {notification.type === 'error' ? '❌ ' : '✅ '} {notification.message}
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center space-y-6">
            <div className="text-4xl">🗑️</div>
            <h3 className="text-xl font-bold text-slate-800">Liberar Mesa?</h3>
            <p className="text-slate-500 text-sm">Deseja fechar esta comanda e liberar a mesa sem registrar pagamento?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button>
              <button onClick={handleClearTable} className="flex-1 py-3 bg-red-500 rounded-xl font-bold text-white shadow-lg">Sim, Liberar</button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="bg-orange-500 p-6 text-white text-center">
              <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Total a Pagar</p>
              <h3 className="text-4xl font-black">R$ {total.toFixed(2)}</h3>
              {activeOrder?.customerName && <p className="text-[10px] font-bold mt-2 uppercase opacity-90">Cliente: {activeOrder.customerName}</p>}
            </div>

            <div className="p-8 space-y-6">
              <div className="flex flex-col gap-4">
                 <button 
                  onClick={() => { setShowSplitUI(!showSplitUI); if(!showSplitUI) setSplitPeople(2); else setSplitPeople(1); }}
                  className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 flex items-center justify-center gap-2 ${showSplitUI ? 'bg-orange-100 border-orange-200 text-orange-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                 >
                   👥 {showSplitUI ? 'Cancelar Divisão' : 'Dividir Conta'}
                 </button>

                 {showSplitUI && (
                   <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                         <span className="text-sm font-bold text-slate-600">Pessoas:</span>
                         <div className="flex items-center gap-4">
                            <button onClick={() => setSplitPeople(Math.max(2, splitPeople - 1))} className="w-8 h-8 rounded-full bg-white border border-orange-200 font-black text-orange-600 flex items-center justify-center shadow-sm">-</button>
                            <span className="font-black text-xl text-slate-800">{splitPeople}</span>
                            <button onClick={() => setSplitPeople(Math.min(10, splitPeople + 1))} className="w-8 h-8 rounded-full bg-white border border-orange-200 font-black text-orange-600 flex items-center justify-center shadow-sm">+</button>
                         </div>
                      </div>
                      <div className="pt-2 border-t border-orange-200 flex justify-between items-center">
                         <span className="text-xs font-bold text-orange-400 uppercase">Valor por pessoa</span>
                         <span className="text-xl font-black text-orange-600">R$ {(total / splitPeople).toFixed(2)}</span>
                      </div>
                   </div>
                 )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {type: PaymentType.CARTAO, icon: '💳', label: 'Cartão'},
                  {type: PaymentType.PIX, icon: '📱', label: 'PIX'},
                  {type: PaymentType.DINHEIRO, icon: '💵', label: 'Dinheiro'}
                ].map(p => (
                  <button 
                    key={p.type}
                    onClick={() => setPaymentType(p.type)}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                      paymentType === p.type ? 'bg-orange-50 border-orange-500 text-orange-600' : 'bg-white border-slate-100 text-slate-600'
                    }`}
                  >
                    <span className="text-3xl">{p.icon}</span>
                    <span className="font-bold text-xs uppercase">{p.label}</span>
                  </button>
                ))}
              </div>

              {paymentType === PaymentType.DINHEIRO && (
                <div className="bg-slate-50 p-6 rounded-3xl space-y-4 animate-fade-in border border-slate-200 shadow-inner">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-600">Valor Recebido</label>
                    <input 
                      type="number"
                      autoFocus
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      className="pl-4 pr-4 py-3 bg-white text-slate-800 border border-slate-200 rounded-xl font-black text-xl w-36 text-right outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="text-sm font-bold text-slate-600">Troco</span>
                    <span className="text-2xl font-black text-green-600">R$ {change.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowPaymentModal(false)} className="flex-1 py-4 bg-slate-100 font-bold rounded-2xl text-slate-500">Voltar</button>
                <button 
                  onClick={handleFinishPayment}
                  disabled={isFinishing || (paymentType === PaymentType.DINHEIRO && Number(amountReceived) < total)}
                  className={`flex-[2] py-4 font-black rounded-2xl shadow-xl transition-all ${
                    isFinishing ? 'bg-slate-200' : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                  }`}
                >
                  {isFinishing ? 'Processando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Monitor de Mesas</h2>
        <div className="flex gap-2 text-[10px] font-bold uppercase">
           <span className="flex items-center gap-1"><span className="w-2 h-2 bg-white border border-slate-200 rounded"></span> Livre</span>
           <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded"></span> Ocupada</span>
           <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded"></span> Pronto</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {tables.map(table => {
          const total = getTableTotal(table);
          const name = getTableCustomer(table);
          const isOccupied = table.status === TableStatus.OCUPADA;
          const ready = isTableReady(table);
          return (
            <button 
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`p-6 rounded-[2.5rem] border-2 transition-all flex flex-col items-center justify-center gap-2 group hover:scale-105 active:scale-95 relative ${
                !isOccupied 
                  ? 'bg-white border-slate-100 hover:border-orange-200' 
                  : ready
                    ? 'bg-green-500 border-green-600 text-white shadow-xl shadow-green-100'
                    : 'bg-orange-500 border-orange-600 text-white shadow-xl shadow-orange-100'
              }`}
            >
              <span className="text-4xl mb-1 transition-transform group-hover:scale-110">
                {isOccupied ? (ready ? '✅' : '🥟') : '🍽️'}
              </span>
              <span className={`text-xl font-black ${!isOccupied ? 'text-slate-800' : 'text-white'}`}>
                {table.number}
              </span>
              
              {isOccupied && (
                <div className="flex flex-col items-center gap-1">
                   {ready && <span className="text-[10px] font-black uppercase tracking-widest bg-white text-green-600 px-2 py-0.5 rounded-full animate-pulse shadow-sm">PRONTO</span>}
                   {name && <span className="text-[10px] font-bold truncate max-w-[80px] bg-white/20 px-2 rounded-full">{name}</span>}
                   <div className="bg-white text-orange-600 px-3 py-1 rounded-full font-black text-xs shadow-sm">
                      R$ {total.toFixed(2)}
                   </div>
                </div>
              )}

              {!isOccupied && (
                <span className="text-[9px] font-bold uppercase text-slate-400 mt-1">Vazio</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mt-8">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Estatísticas</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-2xl">
                <p className="text-2xl font-black text-green-600">{tables.filter(t => t.status === TableStatus.LIVRE).length}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">LIVRES</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-2xl">
                <p className="text-2xl font-black text-orange-600">{tables.filter(t => t.status === TableStatus.OCUPADA).length}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">OCUPADAS</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-2xl">
                <p className="text-2xl font-black text-green-700">{tables.filter(t => isTableReady(t)).length}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">PRONTAS</p>
            </div>
          </div>
      </div>

      {selectedTable && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-slate-50 animate-fade-in overflow-hidden">
          <div className="bg-orange-500 p-4 text-white flex items-center justify-between sticky top-0 z-[210] shadow-lg">
             <div className="flex items-center gap-4">
               <button onClick={() => setSelectedTable(null)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                 <span className="text-lg">🔙</span>
               </button>
               <div>
                  <h3 className="font-black text-lg">Mesa {selectedTable.number}</h3>
                  <div className="flex items-center gap-2">
                    {!isEditingName ? (
                      <button onClick={() => setIsEditingName(true)} className="flex items-center gap-1 text-[10px] font-bold uppercase opacity-80 hover:opacity-100">
                        {customerName || 'Adicionar Nome'} ✎
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input 
                          autoFocus
                          className="text-[10px] bg-white/20 border-none outline-none rounded px-1 text-white font-bold placeholder:text-white/50"
                          placeholder="Nome do Cliente"
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          onBlur={handleSaveName}
                          onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                        />
                      </div>
                    )}
                  </div>
               </div>
             </div>
             <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] opacity-70 font-bold uppercase">Consumo Total</p>
                  <p className="font-black text-xl">R$ {(activeOrder?.total || 0).toFixed(2)}</p>
                </div>
             </div>
          </div>

          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col p-4 md:p-6 space-y-4 overflow-hidden bg-white md:bg-transparent border-r border-slate-200">
              <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border shadow-sm ${
                      activeCategory === cat 
                        ? 'bg-orange-500 text-white border-orange-500' 
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 pb-20 md:pb-6 scrollbar-thin">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addItemToComanda(p)}
                    className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 hover:border-orange-500 hover:shadow-orange-100 transition-all text-left flex flex-col h-auto group"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden mb-2">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <h4 className="font-black text-slate-800 text-[10px] line-clamp-2 h-7 leading-tight">{p.name}</h4>
                    <p className="font-black text-orange-600 text-xs mt-1">R$ {p.price.toFixed(2)}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full md:w-[450px] bg-white flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.05)] z-[205]">
              <div className="p-6 border-b border-slate-50">
                 <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Resumo da Mesa</h4>
                 {isTableReady(selectedTable) && (
                   <div className="mt-2 bg-green-100 text-green-700 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest animate-pulse border border-green-200">
                     ✨ Pedido pronto para entrega!
                   </div>
                 )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
                {!activeOrder || activeOrder.items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12 text-center">
                    <div className="text-6xl mb-6 grayscale opacity-50">🛒</div>
                    <p className="font-black text-slate-400 text-lg">Comanda Vazia</p>
                    <p className="text-sm px-10">Adicione produtos do cardápio à esquerda para iniciar o pedido desta mesa.</p>
                  </div>
                ) : (
                  activeOrder.items.map(item => (
                    <div key={item.productId} className="flex flex-col py-4 border-b border-slate-50 animate-fade-in space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-4">
                          <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                        </div>
                        <div className="text-right min-w-[80px]">
                          <span className="font-black text-slate-800 text-sm">R$ {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-slate-400 font-medium italic">{item.description}</p>
                        <div className="flex items-center bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-inner">
                          <button 
                            onClick={() => updateItemQuantity(item.productId, -1)}
                            className="px-4 py-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors font-black"
                          >
                            −
                          </button>
                          <span className="w-6 text-center font-black text-slate-800 text-sm">{item.quantity}</span>
                          <button 
                            onClick={() => updateItemQuantity(item.productId, 1)}
                            className="px-4 py-1 text-slate-400 hover:text-green-500 hover:bg-green-50 transition-colors font-black"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-8 bg-slate-50 space-y-6">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Geral</span>
                  <span className="text-5xl font-black text-orange-600">
                    R$ {(activeOrder?.total || 0).toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-4">
                  <button 
                    onClick={() => setSelectedTable(null)}
                    className="w-full py-5 bg-white text-slate-600 font-black rounded-[2rem] border-2 border-slate-200 hover:bg-slate-100 transition-all flex items-center justify-center gap-3 shadow-sm"
                  >
                    <span>👀</span> Continuar Mesa
                  </button>
                  {activeOrder && (
                    <button 
                      onClick={handleOpenPayment}
                      className="w-full py-5 bg-orange-500 text-white font-black rounded-[2rem] hover:bg-orange-600 shadow-xl shadow-orange-100 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      <span>🧾</span> Fechar e Pagar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s ease-out forwards; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        @keyframes bounce-in { 
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in { animation: bounce-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>
    </div>
  );
};

export default TableManager;
