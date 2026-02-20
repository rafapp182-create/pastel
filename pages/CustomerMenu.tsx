
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockDatabase';
import { Product, OrderItem, OrderStatus } from '../types';

interface CustomerMenuProps {
  user?: any;
}

const CustomerMenu: React.FC<CustomerMenuProps> = ({ user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [bannerUrl, setBannerUrl] = useState('https://picsum.photos/seed/pastel-hero/800/400');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  useEffect(() => {
    setProducts(db.getProducts().filter(p => p.active));
    db.getSettings().then(s => setBannerUrl(s.bannerUrl));
  }, []);

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
        price: product.price, 
        quantity: 1 
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handlePlaceOrder = async () => {
    if (!user) return alert('Por favor, faça login para realizar o pedido.');
    if (cart.length === 0) return;

    setIsOrdering(true);
    try {
      await db.createOrder({
        items: cart,
        total,
        status: OrderStatus.NOVO,
        customerName: user.name,
        customerAddress: user.address,
        customerWhatsapp: user.whatsapp,
        customerId: user.id
      });
      setCart([]);
      setShowCart(false);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 5000);
    } catch (error) {
      console.error("Erro ao fazer pedido:", error);
      alert('Erro ao processar seu pedido. Tente novamente.');
    } finally {
      setIsOrdering(false);
    }
  };

  const categories = Array.from(new Set(products.map(p => p.category)));

  return (
    <div className="max-w-2xl mx-auto bg-white min-h-screen pb-24 relative">
      <div className="relative h-48 overflow-hidden">
        <img 
          src={bannerUrl} 
          alt="Banner" 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover brightness-50"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6">
          <h1 className="text-3xl font-black italic">Hoje Pode!</h1>
          <p className="text-base opacity-90 font-medium">Os melhores pastéis da cidade 🥟</p>
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-t-3xl shadow-xl p-4 space-y-8">
          {user && (
            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
              <p className="text-xs font-black text-orange-600 uppercase tracking-widest mb-1">Bem-vindo(a),</p>
              <h2 className="text-lg font-black text-slate-800">{user.name}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Entrega em: {user.address}</p>
            </div>
          )}

          {orderSuccess && (
            <div className="bg-green-500 text-white p-4 rounded-2xl font-black text-center animate-bounce-in">
              ✅ Pedido enviado com sucesso! Aguarde o contato.
            </div>
          )}

          {categories.map(cat => (
            <div key={cat} className="space-y-3">
              <h2 className="text-lg font-black text-slate-800 border-b-2 border-orange-500 inline-block pb-0.5">{cat}</h2>
              <div className="space-y-4">
                {products.filter(p => p.category === cat).map(product => (
                  <div key={product.id} className="flex gap-3 group">
                    <img 
                      src={product.imageUrl} 
                      alt={product.name} 
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover shadow-sm"
                    />
                    <div className="flex-1 border-b border-slate-100 pb-3">
                      <div className="flex justify-between items-start mb-0.5">
                        <h3 className="font-bold text-slate-800 text-base group-hover:text-orange-600 transition-colors leading-tight">{product.name}</h3>
                        <div className="bg-orange-50 px-2 py-1 rounded-lg ml-2">
                          <span className="font-black text-orange-600 text-sm whitespace-nowrap">R$ {product.price.toFixed(2)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-snug line-clamp-2 mb-2">{product.description}</p>
                      <button 
                        onClick={() => addToCart(product)}
                        className="bg-orange-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 active:scale-95 transition-all"
                      >
                        Adicionar +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

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
          className="fixed bottom-6 right-6 bg-orange-500 text-white p-4 rounded-full shadow-2xl flex items-center gap-3 animate-bounce-in z-50"
        >
          <span className="text-2xl">🛒</span>
          <span className="font-black text-sm pr-2">R$ {total.toFixed(2)}</span>
          <span className="absolute -top-2 -right-2 bg-slate-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black">
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
                  {isOrdering ? 'Enviando...' : 'Confirmar Pedido'}
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
      `}</style>
    </div>
  );
};

export default CustomerMenu;
