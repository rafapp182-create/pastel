
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/mockDatabase';
import { Order, OrderStatus } from '../types';

const KitchenPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ativos' | 'historico'>('ativos');
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [newOrderNotify, setNewOrderNotify] = useState(false);
  const prevOrdersCount = useRef(0);

  // Função para verificar se o item deve ir para a cozinha (Pastel ou Suco)
  const isKitchenItem = (itemName: string, category?: string) => {
    const name = itemName.toLowerCase();
    const cat = category?.toLowerCase() || '';
    return name.includes('pastel') || name.includes('suco') || name.includes('cana') || 
           cat.includes('pastel') || cat.includes('bebida');
  };

  useEffect(() => {
    const fetchOrders = () => {
      const allOrders = db.getOrders();
      
      // Filtra pedidos que contêm itens de cozinha
      const kitchenRelevant = allOrders.filter(o => o.items.some(item => isKitchenItem(item.name)));

      // Pedidos Ativos: NOVO ou EM PREPARO
      const active = kitchenRelevant
        .filter(o => o.status === OrderStatus.NOVO || o.status === OrderStatus.PREPARO)
        .sort((a, b) => a.createdAt - b.createdAt);

      // Histórico: FINALIZADO (Pronto) ou PAGO (Entregue)
      // Limitamos aos últimos 20 para não sobrecarregar
      const completed = kitchenRelevant
        .filter(o => o.status === OrderStatus.FINALIZADO || o.status === OrderStatus.PAGO)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20);

      // Notificação se entrar pedido novo nos ativos
      if (active.length > prevOrdersCount.current) {
        setNewOrderNotify(true);
        console.log("🔔 ALERTA COZINHA: Novo pedido recebido!");
        setTimeout(() => setNewOrderNotify(false), 5000);
      }
      
      prevOrdersCount.current = active.length;
      setOrders(active);
      setHistory(completed);
    };

    fetchOrders();
    const unsub = db.subscribe(fetchOrders);
    return unsub;
  }, []);

  const handleUpdateStatus = (id: string, currentStatus: OrderStatus) => {
    let nextStatus = currentStatus;
    
    if (currentStatus === OrderStatus.NOVO) {
      nextStatus = OrderStatus.PREPARO;
    } else if (currentStatus === OrderStatus.PREPARO) {
      nextStatus = OrderStatus.FINALIZADO;
    }
    
    if (nextStatus !== currentStatus) {
      db.updateOrderStatus(id, nextStatus);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Notificação Flutuante */}
      {newOrderNotify && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-red-600 text-white px-8 py-4 rounded-full shadow-2xl font-black flex items-center gap-3 animate-bounce">
          <span className="text-2xl">🔔</span>
          NOVO PEDIDO NA COZINHA!
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold text-slate-800">Cozinha & Preparo</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Apenas Pastelaria & Sucos</p>
        </div>

        {/* Sub-navegação interna */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
          <button 
            onClick={() => setActiveTab('ativos')}
            className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'ativos' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500'}`}
          >
            ATIVOS ({orders.length})
          </button>
          <button 
            onClick={() => setActiveTab('historico')}
            className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'historico' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500'}`}
          >
            HISTÓRICO
          </button>
        </div>
      </div>

      {activeTab === 'ativos' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          {orders.length === 0 ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
              <span className="text-8xl mb-4 grayscale">👨‍🍳</span>
              <p className="text-xl font-black text-slate-300">Nenhum pedido pendente!</p>
            </div>
          ) : (
            orders.map(order => (
              <div key={order.id} className={`bg-white rounded-[2.5rem] shadow-xl overflow-hidden border-t-[12px] transition-all flex flex-col ${
                order.status === OrderStatus.NOVO ? 'border-red-500 animate-pulse-subtle' : 'border-yellow-500'
              }`}>
                <div className="p-6 border-b border-slate-50 flex justify-between items-start bg-slate-50/50">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-slate-800 text-white px-3 py-1 rounded-full text-xs font-black">
                        #{order.id.split('-')[1]}
                      </span>
                      <h3 className="text-2xl font-black text-slate-800">
                        {order.tableNumber ? `MESA ${order.tableNumber}` : 'BALCÃO'}
                      </h3>
                    </div>
                    {order.customerName && (
                      <div className="text-orange-600 font-black text-sm uppercase flex items-center gap-1">
                        <span>👤</span> {order.customerName}
                      </div>
                    )}
                    {order.customerAddress && (
                      <div className="text-slate-500 font-bold text-[10px] uppercase mt-1 flex items-center gap-1">
                        <span>📍</span> {order.customerAddress}
                      </div>
                    )}
                    {order.customerWhatsapp && (
                      <div className="text-green-600 font-bold text-[10px] uppercase flex items-center gap-1">
                        <span>📱</span> {order.customerWhatsapp}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
                      Recebido às {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                    order.status === OrderStatus.NOVO ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    {order.status}
                  </div>
                </div>

                <div className="p-6 space-y-4 flex-1">
                  {order.items.filter(item => isKitchenItem(item.name)).map((item, idx) => (
                    <div key={idx} className="flex flex-col border-b border-slate-100 last:border-none pb-3">
                      <div className="flex justify-between items-center text-slate-800">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm">
                            {item.quantity}
                          </span>
                          <span className="font-black text-xl">{item.name}</span>
                        </div>
                        <input type="checkbox" className="w-6 h-6 rounded-lg border-2 border-slate-200 text-orange-500 focus:ring-orange-500" />
                      </div>
                      {item.description && <p className="text-xs text-slate-400 italic mt-1 ml-13">{item.description}</p>}
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100">
                  <button 
                    onClick={() => handleUpdateStatus(order.id, order.status)}
                    className={`w-full py-4 rounded-2xl font-black text-lg transition-all shadow-lg active:scale-95 ${
                      order.status === OrderStatus.NOVO ? 'bg-red-500 text-white hover:bg-red-600' : 
                      'bg-yellow-500 text-white hover:bg-yellow-600'
                    }`}
                  >
                    {order.status === OrderStatus.NOVO ? 'INICIAR PREPARO' : 'CONCLUIR (PRONTO)'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-slate-50">
            <h3 className="text-lg font-black text-slate-800">Últimos Pedidos Concluídos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Local</th>
                  <th className="px-6 py-4">Itens Produzidos</th>
                  <th className="px-6 py-4">Horário</th>
                  <th className="px-6 py-4 text-center">Status Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-slate-300 italic">Nenhum pedido concluído recentemente.</td>
                  </tr>
                ) : (
                  history.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-black text-slate-400 text-xs">#{order.id.split('-')[1]}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {order.tableNumber ? `MESA ${order.tableNumber}` : 'BALCÃO'}
                        {order.customerName && <p className="text-[9px] text-orange-500 font-black">{order.customerName.toUpperCase()}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {order.items.filter(i => isKitchenItem(i.name)).map((item, idx) => (
                            <span key={idx} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                              {item.quantity}x {item.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                        {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                          order.status === OrderStatus.PAGO ? 'bg-slate-800 text-white' : 'bg-green-100 text-green-700'
                        }`}>
                          {order.status === OrderStatus.PAGO ? 'ENTREGUE/PAGO' : 'PRONTO'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s infinite ease-in-out;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default KitchenPage;
