
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockDatabase';
import { Product, OrderItem, OrderStatus } from '../types';

interface CustomerMenuProps {
  user?: any;
  onLogout?: () => void;
}

const CustomerMenu: React.FC<CustomerMenuProps> = ({ user, onLogout }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [bannerUrl, setBannerUrl] = useState('https://picsum.photos/seed/pastel-hero/800/400');
  const [businessWhatsapp, setBusinessWhatsapp] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  useEffect(() => {
    setProducts(db.getProducts().filter(p => p.active));
    db.getSettings().then(s => {
      setBannerUrl(s.bannerUrl || 'https://picsum.photos/seed/pastel-hero/800/400');
      setBusinessWhatsapp(s.businessWhatsapp || '');
    });
  }, []);

  // Sync cart with Firestore
  useEffect(() => {
    if (user?.id) {
      const unsub = db.subscribeToCart(user.id, (items) => {
        setCart(items);
      });
      return unsub;
    }
  }, [user?.id]);

  const addToCart = async (product: Product) => {
    const newCart = [...cart];
    const existing = newCart.find(item => item.productId === product.id);
    
    if (existing) {
      existing.quantity += 1;
    } else {
      newCart.push({ 
        productId: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1 
      });
    }

    setCart(newCart);
    if (user?.id) {
      await db.updateCart(user.id, newCart);
    }
  };

  const updateQuantity = async (productId: string, delta: number) => {
    const newCart = cart.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0);

    setCart(newCart);
    if (user?.id) {
      await db.updateCart(user.id, newCart);
    }
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const formatWhatsappMessage = (orderItems: OrderItem[], orderTotal: number) => {
    let message = `*NOVO PEDIDO - HOJE PODE!* 🥟\n\n`;
    message += `*Cliente:* ${user?.name || 'Não identificado'}\n`;
    message += `*Endereço:* ${user?.address || 'Retirada no balcão'}\n`;
    message += `*WhatsApp:* ${user?.whatsapp || 'N/A'}\n\n`;
    message += `*ITENS:*\n`;
    
    orderItems.forEach(item => {
      message += `• ${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}\n`;
    });
    
    message += `\n*TOTAL: R$ ${orderTotal.toFixed(2)}*\n\n`;
    message += `_Pedido realizado via Cardápio Digital_`;
    
    return encodeURIComponent(message);
  };

  const handlePlaceOrder = async () => {
    if (!user) return alert('Por favor, faça login para realizar o pedido.');
    if (cart.length === 0) return;

    setIsOrdering(true);
    try {
      const order = await db.createOrder({
        items: cart,
        total,
        status: OrderStatus.NOVO,
        customerName: user.name,
        customerAddress: user.address,
        customerWhatsapp: user.whatsapp,
        customerId: user.id
      });
      
      const whatsappMsg = formatWhatsappMessage(cart, total);
      setLastOrderId(order.id);
      
      // Limpa o carrinho local e no Firestore
      setCart([]);
      if (user?.id) {
        await db.updateCart(user.id, []);
      }
      
      setShowCart(false);
      setOrderSuccess(true);

      // Se houver whatsapp configurado, oferece a opção ou redireciona
      if (businessWhatsapp) {
        const confirmWhatsapp = window.confirm('Pedido registrado! Deseja enviar o resumo via WhatsApp para agilizar o atendimento?');
        if (confirmWhatsapp) {
          window.open(`https://wa.me/${businessWhatsapp}?text=${whatsappMsg}`, '_blank');
        }
      }

      setTimeout(() => setOrderSuccess(false), 10000);
    } catch (error) {
      console.error("Erro ao fazer pedido:", error);
      alert('Erro ao processar seu pedido. Tente novamente.');
    } finally {
      setIsOrdering(false);
    }
  };

  const categories = Array.from(new Set(products.map(p => p.category)));

  const scrollToCategory = (cat: string) => {
    const element = document.getElementById(`category-${cat}`);
    if (element) {
      const headerOffset = 140;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white min-h-screen pb-32 relative">
      <div className="bg-orange-500 p-6 text-white flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl shadow-inner">🥟</div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">Hoje Pode!</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mt-1">Os melhores pastéis 🥟</p>
          </div>
        </div>
        {onLogout && (
          <button 
            onClick={onLogout}
            className="p-2 hover:bg-orange-600 rounded-full transition-colors text-lg flex items-center gap-2"
            title="Sair"
          >
            <span className="text-xs font-black uppercase tracking-widest hidden sm:block">Sair</span>
            <span>🚪</span>
          </button>
        )}
      </div>

      {/* Sticky Category Nav */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-2 py-3 overflow-x-auto no-scrollbar flex gap-2 shadow-sm">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => scrollToCategory(cat)}
            className="whitespace-nowrap px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all active:scale-95"
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-t-3xl p-4 space-y-8">
          {user && (
            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 shadow-sm">
              <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-1">Bem-vindo(a),</p>
              <h2 className="text-base font-black text-slate-800">{user.name}</h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 truncate">📍 {user.address}</p>
            </div>
          )}

          {orderSuccess && (
            <div className="bg-green-500 text-white p-6 rounded-[2rem] font-black text-center animate-bounce-in shadow-xl shadow-green-100">
              <p className="text-xl mb-1">✅ Pedido Enviado!</p>
              <p className="text-[10px] uppercase tracking-widest opacity-80">Acompanhe pelo seu WhatsApp</p>
            </div>
          )}

          <div className="space-y-10">
            {categories.map(cat => (
              <div key={cat} id={`category-${cat}`} className="space-y-4 scroll-mt-32">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">{cat}</h2>
                  <div className="h-px flex-1 bg-slate-100"></div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {products.filter(p => p.category === cat).map(product => (
                    <div key={product.id} className="flex gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-100 bg-white shadow-sm sm:shadow-none">
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
                        <img 
                          src={product.imageUrl} 
                          alt={product.name} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-0.5">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-black text-slate-800 text-sm sm:text-base leading-tight pr-2">{product.name}</h3>
                            <span className="font-black text-orange-600 text-sm whitespace-nowrap">R$ {product.price.toFixed(2)}</span>
                          </div>
                          <p className="text-[10px] sm:text-xs text-slate-400 leading-snug line-clamp-2 mt-1 font-medium">{product.description}</p>
                        </div>
                        <div className="flex justify-end mt-1">
                          <button 
                            onClick={() => addToCart(product)}
                            className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-orange-500 active:scale-95 transition-all"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="py-8 text-center space-y-4">
              <div className="inline-block p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <img 
                    src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://hojepodepastelaria.com/menu" 
                    alt="QR Code" 
                    referrerPolicy="no-referrer"
                  />
              </div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Aponte a câmera para pedir de novo</p>
          </div>
        </div>
      </div>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <button 
          onClick={() => setShowCart(true)}
          className="fixed bottom-20 right-4 bg-orange-500 text-white p-4 rounded-full shadow-2xl flex items-center gap-3 animate-bounce-in z-50 border-4 border-white"
        >
          <span className="text-2xl">🛒</span>
          <span className="font-black text-sm pr-2">R$ {total.toFixed(2)}</span>
          <span className="absolute -top-2 -right-2 bg-slate-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white">
            {cart.reduce((a, b) => a + b.quantity, 0)}
          </span>
        </button>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-800">Seu Pedido</h3>
                <button onClick={() => setShowCart(false)} className="text-slate-400 p-2">✕</button>
              </div>

              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                {cart.map(item => (
                  <div key={item.productId} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                      <p className="text-xs text-orange-600 font-black">R$ {item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <button onClick={() => updateQuantity(item.productId, -1)} className="px-3 py-1 text-slate-500 font-black">-</button>
                      <span className="px-2 py-1 font-black text-slate-900 text-sm w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)} className="px-3 py-1 text-slate-500 font-black">+</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center text-2xl font-black text-slate-800 mb-6">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total</span>
                  <span className="text-orange-600">R$ {total.toFixed(2)}</span>
                </div>

                <button 
                  onClick={handlePlaceOrder}
                  disabled={isOrdering}
                  className={`w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all ${
                    isOrdering ? 'bg-slate-200 text-slate-400' : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                  }`}
                >
                  {isOrdering ? 'Enviando...' : (businessWhatsapp ? 'Enviar via WhatsApp' : 'Confirmar Pedido')}
                </button>
                <p className="text-[9px] text-slate-400 text-center mt-4 font-bold uppercase tracking-widest">Pagamento na entrega</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; }
        @keyframes bounce-in { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-bounce-in { animation: bounce-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default CustomerMenu;
