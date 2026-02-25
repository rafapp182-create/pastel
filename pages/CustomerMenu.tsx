
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockDatabase';
import { Product, OrderItem, OrderStatus, BusinessSettings } from '../types';
import ConfirmModal from '../components/ConfirmModal';

interface CustomerMenuProps {
  user?: any;
  onLogout?: () => void;
}

const CustomerMenu: React.FC<CustomerMenuProps> = ({ user, onLogout }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [bannerUrl, setBannerUrl] = useState('https://picsum.photos/seed/pastel-hero/800/400');
  const [businessWhatsapp, setBusinessWhatsapp] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(db.getSettings());
  const [showCart, setShowCart] = useState(false);
  const [orderType, setOrderType] = useState<'delivery' | 'pickup' | 'table'>('delivery');
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [customNotes, setCustomNotes] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [isOrdering, setIsOrdering] = useState(false);

  const handleCloseModal = () => {
    setSelectedProduct(null);
    setModalQuantity(1);
    setCustomNotes('');
    setSelectedOptions({});
  };

  useEffect(() => {
    // Tenta detectar mesa via URL (ex: ?mesa=5)
    const params = new URLSearchParams(window.location.search);
    const mesa = params.get('mesa');
    if (mesa) {
      setTableNumber(parseInt(mesa));
      setOrderType('table');
    }
  }, []);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    const update = () => {
      setProducts(db.getProducts().filter(p => p.active));
      setCategoriesList(db.getCategories().map(c => c.name));
      const sets = db.getSettings();
      setSettings(sets);
      setBusinessWhatsapp(sets.whatsapp || '');
    };
    update();
    const unsub = db.subscribe(update);

    return unsub;
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

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddToCart = async () => {
    if (!selectedProduct) return;

    // Validate required options
    if (selectedProduct.options) {
      for (const opt of selectedProduct.options) {
        if (opt.required && !selectedOptions[opt.name]) {
          return notify(`Por favor, selecione: ${opt.name}`, 'error');
        }
      }
    }

    const newCart = [...cart];
    newCart.push({ 
      productId: selectedProduct.id, 
      name: selectedProduct.name, 
      price: selectedProduct.price, 
      quantity: modalQuantity,
      notes: customNotes,
      selectedOptions: { ...selectedOptions }
    });

    setCart(newCart);
    if (user?.id) {
      await db.updateCart(user.id, newCart);
    }
    
    handleCloseModal();
    notify('Adicionado ao carrinho!');
  };

  const updateQuantity = async (productId: string, delta: number, index: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    if (!item) return;

    item.quantity = Math.max(0, item.quantity + delta);
    if (item.quantity === 0) {
      newCart.splice(index, 1);
    }

    setCart(newCart);
    if (user?.id) {
      await db.updateCart(user.id, newCart);
    }
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const finalTotal = total + (orderType === 'delivery' ? (settings.deliveryFee || 0) : 0);

  const formatWhatsappMessage = (orderItems: OrderItem[], orderTotal: number) => {
    let typeLabel = '🚀 Entrega';
    if (orderType === 'pickup') typeLabel = '🛍️ Retirada';
    if (orderType === 'table') typeLabel = `🪑 Mesa ${tableNumber}`;

    let message = `*NOVO PEDIDO - ${settings.name.toUpperCase()}* 🥟\n\n`;
    message += `*Tipo:* ${typeLabel}\n`;
    message += `*Cliente:* ${user?.name || 'Não identificado'}\n`;
    
    if (orderType === 'delivery') {
      message += `*Endereço:* ${user?.address || 'N/A'}\n`;
    }
    
    message += `*WhatsApp:* ${user?.whatsapp || 'N/A'}\n\n`;
    message += `*ITENS:*\n`;
    
    orderItems.forEach(item => {
      message += `• ${item.quantity}x ${item.name}`;
      if (item.selectedOptions && Object.entries(item.selectedOptions).length > 0) {
        const opts = Object.entries(item.selectedOptions).map(([k, v]) => `${k}: ${v}`).join(', ');
        message += ` [${opts}]`;
      }
      if (item.notes) message += ` (Obs: ${item.notes})`;
      message += ` - R$ ${(item.price * item.quantity).toFixed(2)}\n`;
    });
    
    if (orderType === 'delivery' && settings.deliveryFee > 0) {
      message += `\n*Taxa de Entrega:* R$ ${settings.deliveryFee.toFixed(2)}`;
    }
    
    message += `\n*TOTAL: R$ ${orderTotal.toFixed(2)}*\n\n`;
    message += `_Pedido realizado via Cardápio Digital_`;
    
    return encodeURIComponent(message);
  };

  const handlePlaceOrder = async () => {
    if (!user) return notify('Por favor, faça login para realizar o pedido.', 'error');
    if (cart.length === 0) return;
    
    if (orderType === 'delivery' && total < settings.minOrderValue) {
      return notify(`Pedido mínimo para entrega é de R$ ${settings.minOrderValue.toFixed(2)}`, 'error');
    }

    if (orderType === 'table' && !tableNumber) {
      return notify('Por favor, informe o número da mesa.', 'error');
    }

    if (!settings.isOpen) {
      return notify('Desculpe, a loja está fechada no momento.', 'error');
    }

    setIsOrdering(true);
    try {
      const order = await db.createOrder({
        items: cart,
        total: finalTotal,
        deliveryFee: orderType === 'delivery' ? settings.deliveryFee : 0,
        status: OrderStatus.NOVO,
        customerName: user.name,
        customerAddress: orderType === 'delivery' ? user.address : (orderType === 'table' ? `Mesa ${tableNumber}` : 'Retirada na Loja'),
        customerWhatsapp: user.whatsapp,
        customerId: user.id,
        type: orderType,
        tableNumber: orderType === 'table' ? tableNumber : undefined
      });
      
      const whatsappMsg = formatWhatsappMessage(cart, finalTotal);
      setLastOrderId(order.id);
      
      setCart([]);
      if (user?.id) {
        await db.updateCart(user.id, []);
      }
      
      setShowCart(false);
      setOrderSuccess(true);

      if (businessWhatsapp) {
        setConfirmConfig({
          isOpen: true,
          title: 'Pedido Recebido!',
          message: 'Deseja enviar o resumo via WhatsApp para agilizar o atendimento?',
          confirmLabel: 'Enviar WhatsApp',
          onConfirm: () => {
            window.open(`https://wa.me/${businessWhatsapp}?text=${whatsappMsg}`, '_blank');
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
        });
      }

      setTimeout(() => setOrderSuccess(false), 10000);
    } catch (error) {
      console.error("Erro ao fazer pedido:", error);
      notify('Erro ao processar seu pedido. Tente novamente.', 'error');
    } finally {
      setIsOrdering(false);
    }
  };

  const categories = categoriesList.filter(cat => products.some(p => p.category === cat));

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
    <div className="max-w-4xl mx-auto bg-white min-h-screen pb-32 relative">
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[250] px-6 py-3 rounded-2xl shadow-2xl font-bold text-white animate-slide-in-top ${
          notification.type === 'error' ? 'bg-red-500' : 'bg-green-600'
        }`}>
          {notification.type === 'error' ? '❌ ' : '✅ '} {notification.message}
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <div className="bg-orange-500 p-6 text-white flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl shadow-inner">🥟</div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">{settings.name}</h1>
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
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-4 py-4 overflow-x-auto no-scrollbar flex gap-3 shadow-sm">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => scrollToCategory(cat)}
            className="whitespace-nowrap px-5 py-2 rounded-2xl bg-slate-50 text-slate-500 text-[11px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all active:scale-95 border border-slate-100 shadow-sm"
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-t-3xl p-4 space-y-8">
          {user && (
            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-1">Bem-vindo(a),</p>
                  <h2 className="text-base font-black text-slate-800">{user.name}</h2>
                </div>
                <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${settings.isOpen ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {settings.isOpen ? 'Aberto' : 'Fechado'}
                </div>
              </div>
              {orderType === 'delivery' && user.address && (
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 truncate">📍 {user.address}</p>
              )}
            </div>
          )}

          {/* Order Type Selector at Top */}
          <div className="space-y-4">
            <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner">
              <button 
                onClick={() => setOrderType('delivery')}
                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${orderType === 'delivery' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}
              >
                🚀 Entrega
              </button>
              <button 
                onClick={() => setOrderType('pickup')}
                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${orderType === 'pickup' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}
              >
                🛍️ Retirada
              </button>
              <button 
                onClick={() => setOrderType('table')}
                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${orderType === 'table' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}
              >
                🪑 Mesa
              </button>
            </div>

            {orderType === 'table' && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-fade-in">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Selecione sua Mesa</label>
                  {tableNumber && <span className="text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Mesa {tableNumber}</span>}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => (
                    <button
                      key={num}
                      onClick={() => setTableNumber(num)}
                      className={`min-w-[45px] h-[45px] rounded-xl text-xs font-black transition-all flex-shrink-0 flex items-center justify-center ${tableNumber === num ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-white text-slate-400 border border-slate-100 shadow-sm'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {orderSuccess && (
            <div className="bg-green-500 text-white p-6 rounded-[2rem] font-black text-center animate-bounce-in shadow-xl shadow-green-100">
              <p className="text-xl mb-1">✅ Pedido Enviado!</p>
              <p className="text-[10px] uppercase tracking-widest opacity-80">Acompanhe pelo seu WhatsApp</p>
            </div>
          )}

          {!settings.isOpen && (
            <div className="bg-red-500 text-white p-6 rounded-[2rem] font-black text-center shadow-xl shadow-red-100 border-4 border-white">
              <p className="text-xl mb-1">🚫 Loja Fechada</p>
              <p className="text-[10px] uppercase tracking-widest opacity-80">Estamos fora do horário de atendimento: {settings.openingHours}</p>
            </div>
          )}

          <div className="space-y-16">
            {categories.map(cat => (
              <section key={cat} id={`category-${cat}`} className="scroll-mt-32 animate-fade-in">
                <div className="flex items-baseline justify-between mb-6">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                    {cat}
                  </h2>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                    {products.filter(p => p.category === cat).length} itens
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.filter(p => p.category === cat).map(product => (
                    <div 
                      key={product.id} 
                      onClick={() => setSelectedProduct(product)}
                      className="flex gap-4 p-3 rounded-3xl hover:bg-slate-50 transition-all group border border-slate-100 bg-white shadow-sm cursor-pointer active:scale-[0.98]"
                    >
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
                        <img 
                          src={product.imageUrl} 
                          alt={product.name} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-center py-1">
                        <h3 className="font-black text-slate-800 text-sm sm:text-base leading-tight pr-2">{product.name}</h3>
                        <p className="text-[10px] sm:text-xs text-slate-400 leading-snug line-clamp-2 mt-1 font-medium">{product.description}</p>
                        <div className="flex justify-between items-center mt-3">
                          <span className="font-black text-orange-600 text-sm">R$ {product.price.toFixed(2)}</span>
                          <button 
                            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-orange-500 active:scale-95 transition-all shadow-md"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* Product Customization Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
            <div className="relative h-40 sm:h-64 flex-shrink-0">
              <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
              <button onClick={handleCloseModal} className="absolute top-3 right-3 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md text-sm">✕</button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
              <div>
                <h3 className="text-xl font-black text-slate-800 leading-tight">{selectedProduct.name}</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{selectedProduct.description}</p>
                {selectedProduct.ingredients && selectedProduct.ingredients.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ingredientes:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedProduct.ingredients.map((ing, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-bold">
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex flex-col">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Subtotal</p>
                    <p className="text-lg font-black text-orange-600">R$ {(selectedProduct.price * modalQuantity).toFixed(2)}</p>
                  </div>
                  
                  <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <button 
                      onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
                      className="px-4 py-2 text-slate-600 font-black hover:bg-slate-200 transition-colors"
                    >
                      -
                    </button>
                    <span className="px-4 py-2 font-black text-slate-900 text-sm min-w-[40px] text-center">
                      {modalQuantity}
                    </span>
                    <button 
                      onClick={() => setModalQuantity(modalQuantity + 1)}
                      className="px-4 py-2 text-slate-600 font-black hover:bg-slate-200 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {selectedProduct.options?.map(opt => (
                <div key={opt.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-black text-slate-800 text-[10px] uppercase tracking-widest">{opt.name}</h4>
                    {opt.required && <span className="text-[8px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-black uppercase">Obrigatório</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {opt.choices.map(choice => (
                      <button
                        key={choice}
                        onClick={() => setSelectedOptions(prev => ({ ...prev, [opt.name]: choice }))}
                        className={`p-2.5 rounded-xl border-2 text-[10px] font-bold transition-all ${
                          selectedOptions[opt.name] === choice 
                            ? 'border-orange-500 bg-orange-50 text-orange-600' 
                            : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="space-y-2">
                <h4 className="font-black text-slate-800 text-[10px] uppercase tracking-widest">Observações</h4>
                <textarea
                  value={customNotes}
                  onChange={e => setCustomNotes(e.target.value)}
                  placeholder="Ex: Sem cebola, bem frito, etc."
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-xs outline-none focus:border-orange-500 transition-all min-h-[80px] resize-none"
                />
              </div>
            </div>

            <div className="p-5 sm:p-8 border-t border-slate-100 bg-white">
              <button 
                onClick={handleAddToCart}
                className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black text-base shadow-xl hover:bg-orange-600 active:scale-95 transition-all"
              >
                Adicionar ao Carrinho
              </button>
            </div>
          </div>
        </div>
      )}

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
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                      {item.selectedOptions && Object.entries(item.selectedOptions).length > 0 && (
                        <p className="text-[10px] text-slate-500 italic">
                          {Object.values(item.selectedOptions).join(', ')}
                        </p>
                      )}
                      {item.notes && <p className="text-[10px] text-slate-400">Obs: {item.notes}</p>}
                      <p className="text-xs text-orange-600 font-black">R$ {item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <button onClick={() => updateQuantity(item.productId, -1, idx)} className="px-3 py-1 text-slate-500 font-black">-</button>
                      <span className="px-2 py-1 font-black text-slate-900 text-sm w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1, idx)} className="px-3 py-1 text-slate-500 font-black">+</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-slate-500 font-bold text-xs uppercase tracking-widest">
                    <span>Subtotal</span>
                    <span>R$ {total.toFixed(2)}</span>
                  </div>
                  {orderType === 'delivery' && settings.deliveryFee > 0 && (
                    <div className="flex justify-between items-center text-slate-500 font-bold text-xs uppercase tracking-widest">
                      <span>Taxa de Entrega</span>
                      <span>R$ {settings.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-2xl font-black text-slate-800 pt-2">
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total</span>
                    <span className="text-orange-600">R$ {finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button 
                  onClick={handlePlaceOrder}
                  disabled={isOrdering}
                  className={`w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all mt-4 ${
                    isOrdering ? 'bg-slate-200 text-slate-400' : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                  }`}
                >
                  {isOrdering ? 'Enviando...' : (settings.whatsapp ? 'Enviar via WhatsApp' : 'Confirmar Pedido')}
                </button>
                <p className="text-[9px] text-slate-400 text-center mt-4 font-bold uppercase tracking-widest">Pagamento na entrega / retirada</p>
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
        @keyframes slide-in-top { from { transform: translate(-50%, -100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        .animate-slide-in-top { animation: slide-in-top 0.3s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default CustomerMenu;
