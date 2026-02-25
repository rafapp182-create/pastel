
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockDatabase';
import { Product, Order, CashierSession, PaymentType, UserRole, Category, BusinessSettings } from '../types';
import { auth, firestore } from '../services/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import ConfirmModal from '../components/ConfirmModal';

interface AdminPageProps {
  user: any;
  setActiveTab: (tab: string) => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ user, setActiveTab }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [session, setSession] = useState<CashierSession | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'inventory' | 'history' | 'users' | 'settings' | 'cashier' | 'categories' | 'customers'>('stats');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [bannerUrl, setBannerUrl] = useState('');
  const [businessWhatsapp, setBusinessWhatsapp] = useState('');
  const [openingValue, setOpeningValue] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(db.getSettings());
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const isAdmin = user?.role === 'admin';

  const tabs = [
    { id: 'stats', label: 'Resumo', icon: '📊', adminOnly: false },
    { id: 'cashier', label: 'Caixa', icon: '💰', adminOnly: false },
    { id: 'inventory', label: 'Produtos', icon: '🥟', adminOnly: false },
    { id: 'categories', label: 'Categorias', icon: '🏷️', adminOnly: false },
    { id: 'history', label: 'Histórico', icon: '📜', adminOnly: false },
    { id: 'customers', label: 'Clientes', icon: '👤', adminOnly: true },
    { id: 'users', label: 'Equipe', icon: '👥', adminOnly: true },
    { id: 'settings', label: 'Ajustes', icon: '⚙️', adminOnly: true }
  ].filter(tab => !tab.adminOnly || isAdmin);
  
  const [newProduct, setNewProduct] = useState({
      name: '',
      description: '',
      category: '',
      price: '',
      imageUrl: '',
      ingredients: '',
      options: [] as ProductOption[]
  });

  useEffect(() => {
    if (categories.length > 0 && !newProduct.category) {
      setNewProduct(prev => ({ ...prev, category: categories[0].name }));
    }
  }, [categories]);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: UserRole.CAIXA
  });

  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  useEffect(() => {
    const update = () => {
      const prods = db.getProducts();
      const cats = db.getCategories();
      const ords = db.getOrders();
      const sess = db.getCurrentSession();
      const sets = db.getSettings();
      
      console.log('AdminPage Update:', { prods: prods.length, cats: cats.length, ords: ords.length });
      
      setProducts(prods);
      setCategories(cats);
      setOrders(ords);
      setSession(sess);
      setBusinessSettings(sets);
      setBannerUrl(sets.bannerUrl || '');
      setBusinessWhatsapp(sets.businessWhatsapp || '');
    };
    update();
    const unsub = db.subscribe(update);

    const unsubUsers = onSnapshot(collection(firestore, "users"), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    return () => {
      unsub();
      unsubUsers();
    };
  }, []);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newProduct.name || !newProduct.price) return notify('Preencha os campos obrigatórios.', 'error');

      const ingredientsArray = newProduct.ingredients 
        ? newProduct.ingredients.split(',').map(i => i.trim()).filter(i => i !== '')
        : [];

      if (editingProduct) {
        await db.updateProduct(editingProduct.id, {
          ...newProduct,
          price: parseFloat(newProduct.price),
          options: newProduct.options,
          ingredients: ingredientsArray
        });
        setEditingProduct(null);
        notify('Produto atualizado com sucesso!');
      } else {
        await db.addProduct({
            ...newProduct,
            price: parseFloat(newProduct.price),
            active: true,
            imageUrl: newProduct.imageUrl || `https://picsum.photos/seed/${newProduct.name}/300/200`,
            options: newProduct.options,
            ingredients: ingredientsArray
        });
        notify('Produto cadastrado com sucesso!');
      }

      setNewProduct({ name: '', description: '', category: categories[0]?.name || 'Pasteis de Carne', price: '', imageUrl: '', ingredients: '', options: [] });
  };

  const handleEditProduct = (p: Product) => {
    setEditingProduct(p);
    setNewProduct({
      name: p.name,
      description: p.description,
      category: p.category,
      price: p.price.toString(),
      imageUrl: p.imageUrl,
      ingredients: p.ingredients ? p.ingredients.join(', ') : '',
      options: p.options || []
    });
    setActiveSubTab('inventory');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.updateSettings({ bannerUrl, businessWhatsapp });
    notify('Configurações atualizadas!');
  };

  const handleClearHistory = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Limpar Todo Histórico',
      message: 'Esta ação irá apagar permanentemente todos os pedidos e vendas registrados. Deseja continuar?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await db.clearOrderHistory();
          notify('Histórico limpo com sucesso!');
        } catch (err: any) {
          notify('Erro ao limpar histórico: ' + err.message, 'error');
        }
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await db.updateSettings(businessSettings);
      notify('Configurações salvas com sucesso!');
    } catch (err: any) {
      notify('Erro ao salvar: ' + err.message, 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleAddCategory called with:', newCategoryName);
    if (!newCategoryName.trim()) return notify('Digite o nome da categoria.', 'error');
    
    setIsAddingCategory(true);
    try {
      console.log('Calling db.addCategory...');
      await db.addCategory(newCategoryName.trim());
      console.log('db.addCategory success!');
      setNewCategoryName('');
      notify('Categoria adicionada!');
    } catch (err: any) {
      console.error("Erro detalhado ao adicionar categoria:", err);
      console.log("User state during error:", user);
      notify('Erro ao adicionar categoria: ' + (err.message || 'Verifique a conexão.'), 'error');
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Categoria',
      message: 'Deseja realmente excluir esta categoria? Os produtos nela continuarão existindo mas sem categoria vinculada.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await db.deleteCategory(id);
          notify('Categoria excluída.');
        } catch (err: any) {
          notify('Erro ao excluir: ' + err.message, 'error');
        }
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password || !newUser.name) return notify('Preencha todos os campos.', 'error');
    
    setIsCreatingUser(true);
    const cleanEmail = newUser.email.trim();
    const appName = `Secondary-${Date.now()}`;
    let secondaryApp;

    try {
      secondaryApp = initializeApp(auth.app.options, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, newUser.password);
      const uid = userCredential.user.uid;

      await setDoc(doc(firestore, "users", uid), {
        name: newUser.name,
        email: cleanEmail,
        role: newUser.role,
        createdAt: Date.now()
      });

      setNewUser({ name: '', email: '', password: '', role: UserRole.CAIXA });
      notify('Usuário criado com sucesso!');
    } catch (err: any) {
      console.error("Erro ao criar usuário:", err);
      let errorMsg = 'Erro ao criar usuário.';
      if (err.code === 'auth/email-already-in-use') errorMsg = 'Este e-mail já está em uso.';
      if (err.code === 'auth/weak-password') errorMsg = 'A senha deve ter pelo menos 6 caracteres.';
      if (err.code === 'auth/invalid-email') errorMsg = 'E-mail inválido.';
      
      notify(errorMsg, 'error');
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp);
      }
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user.id) return notify('Você não pode remover seu próprio acesso.', 'error');
    
    setConfirmConfig({
      isOpen: true,
      title: 'Remover Acesso',
      message: 'Deseja realmente remover este colaborador da equipe? Ele perderá o acesso imediatamente.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(firestore, "users", userId));
          notify('Acesso removido.');
        } catch (err: any) {
          console.error("Erro ao deletar usuário:", err);
          notify('Erro ao remover: ' + err.message, 'error');
        }
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const dailyHistory = orders.reduce((acc: Record<string, { orders: Order[], total: number }>, order) => {
    const date = new Date(order.createdAt).toLocaleDateString('pt-BR');
    if (!acc[date]) acc[date] = { orders: [], total: 0 };
    acc[date].orders.push(order);
    acc[date].total += order.total;
    return acc;
  }, {});

  const sortedDates = Object.keys(dailyHistory).sort((a, b) => {
    const dateA = new Date(a.split('/').reverse().join('-')).getTime();
    const dateB = new Date(b.split('/').reverse().join('-')).getTime();
    return dateB - dateA;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {notification && (
        <div className={`fixed top-4 right-4 z-[250] px-6 py-3 rounded-2xl shadow-2xl font-bold text-white animate-bounce-in ${
          notification.type === 'error' ? 'bg-red-500' : 'bg-green-600'
        }`}>
          {notification.type === 'error' ? '❌ ' : '✅ '} {notification.message}
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Navegação por Abas */}
      <div className="flex bg-white p-1.5 rounded-3xl shadow-sm border border-slate-100 overflow-x-auto no-scrollbar mb-6">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeSubTab === tab.id ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            <span className="text-sm sm:text-base">{tab.icon}</span>
            <span className={activeSubTab === tab.id ? 'block' : 'hidden sm:block'}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ABA: RESUMO */}
      {activeSubTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Vendas Totais</p>
            <h3 className="text-2xl font-black text-slate-900">R$ {orders.reduce((a, b) => a + b.total, 0).toFixed(2)}</h3>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Pedidos</p>
            <h3 className="text-2xl font-black text-slate-900">{orders.length}</h3>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Itens Ativos</p>
            <h3 className="text-2xl font-black text-slate-900">{products.length}</h3>
          </div>

          <div className="md:col-span-3 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Vendas por Categoria</h3>
            <div className="space-y-4">
              {categories.map(cat => {
                const catSales = orders.reduce((acc, order) => {
                  const itemsInCat = order.items.filter(item => {
                    const prod = products.find(p => p.id === item.productId);
                    return prod?.category === cat.name;
                  });
                  return acc + itemsInCat.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                }, 0);
                const percentage = orders.length > 0 ? (catSales / orders.reduce((a, b) => a + b.total, 0)) * 100 : 0;
                
                return (
                  <div key={cat.id} className="space-y-2">
                    <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                      <span className="text-slate-600">{cat.name}</span>
                      <span className="text-orange-600">R$ {catSales.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 transition-all duration-1000" 
                        style={{ width: `${Math.min(100, isNaN(percentage) ? 0 : percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ABA: GESTÃO DE CAIXA */}
      {activeSubTab === 'cashier' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
            <div className="flex items-center gap-4 mb-8">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${session ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {session ? '🔓' : '🔒'}
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800">Gestão do Caixa</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Status: <span className={session ? 'text-green-600' : 'text-red-600'}>{session ? 'ABERTO' : 'FECHADO'}</span>
                </p>
              </div>
            </div>

            {!session ? (
              <div className="space-y-8 max-w-md mx-auto py-10">
                <div className="text-center space-y-4 mb-8">
                  <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto text-4xl shadow-inner">
                    🔒
                  </div>
                  <h3 className="text-2xl font-black text-slate-800">Caixa Fechado</h3>
                  <p className="text-slate-400 text-sm font-medium">Defina o fundo de caixa para iniciar o turno.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Valor de Abertura (Fundo de Caixa)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                      <input 
                        type="number"
                        placeholder="0,00"
                        value={openingValue}
                        onChange={(e) => setOpeningValue(e.target.value)}
                        className="w-full pl-12 pr-4 py-5 bg-slate-100 text-slate-900 border-none rounded-2xl outline-none font-black text-2xl focus:ring-2 focus:ring-orange-500 transition-all"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      const val = parseFloat(openingValue);
                      if (isNaN(val) || val < 0) return notify('Valor inválido', 'error');
                      setIsOpening(true);
                      try {
                        await db.openCashier(val);
                        setOpeningValue('');
                        notify('Caixa aberto com sucesso!');
                      } catch (err: any) {
                        notify('Erro ao abrir: ' + err.message, 'error');
                      } finally {
                        setIsOpening(false);
                      }
                    }}
                    disabled={isOpening}
                    className="w-full py-5 bg-orange-500 text-white font-black rounded-2xl shadow-xl hover:bg-orange-600 active:scale-95 transition-all text-xl"
                  >
                    {isOpening ? 'Abrindo...' : 'Abrir Caixa'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Aberto em</p>
                    <p className="font-bold text-slate-800">{new Date(session.startTime).toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fundo Inicial</p>
                    <p className="font-black text-orange-600 text-xl">R$ {session.initialAmount.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => {
                      setConfirmConfig({
                        isOpen: true,
                        title: 'Fechar Caixa',
                        message: 'Deseja realmente encerrar o turno atual? Certifique-se de que todas as vendas foram processadas.',
                        type: 'warning',
                        onConfirm: () => {
                          db.closeCashier();
                          notify('Caixa fechado!');
                          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                        }
                      });
                    }}
                    className="flex-1 py-5 bg-red-500 text-white font-black rounded-2xl shadow-xl hover:bg-red-600 active:scale-95 transition-all text-lg"
                  >
                    Fechar Caixa
                  </button>
                  <button 
                    onClick={() => {
                      setActiveTab('pos');
                    }}
                    className="flex-1 py-5 bg-slate-800 text-white font-black rounded-2xl shadow-xl hover:bg-slate-900 active:scale-95 transition-all text-lg"
                  >
                    Ir para Operação (PDV)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Resumo Rápido da Sessão Atual se aberta */}
          {session && (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-tight">Vendas da Sessão Atual</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Vendido</p>
                  <p className="text-2xl font-black text-slate-900">
                    R$ {orders.filter(o => o.sessionId === session.id && o.paymentType).reduce((a, b) => a + b.total, 0).toFixed(2)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedidos Pagos</p>
                  <p className="text-2xl font-black text-slate-900">
                    {orders.filter(o => o.sessionId === session.id && o.paymentType).length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedidos Pendentes</p>
                  <p className="text-2xl font-black text-orange-600">
                    {orders.filter(o => o.sessionId === session.id && o.status !== 'pago').length}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA: PRODUTOS (CADASTRO) */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🥟</span>
                <h2 className="text-xl font-black text-slate-800">{editingProduct ? 'Editar Item' : 'Cadastrar Novo Item'}</h2>
              </div>
              {editingProduct && (
                <button 
                  onClick={() => { setEditingProduct(null); setNewProduct({ name: '', description: '', category: 'Pasteis de Carne', price: '', imageUrl: '' }); }}
                  className="text-xs text-red-500 font-bold uppercase tracking-widest hover:underline"
                >
                  Cancelar Edição
                </button>
              )}
            </div>
            <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Produto</label>
                <input 
                  className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-bold border-none" 
                  value={newProduct.name} 
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
                  placeholder="Ex: Pastel de Pizza" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Preço (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-black border-none" 
                  value={newProduct.price} 
                  onChange={e => setNewProduct({...newProduct, price: e.target.value})} 
                  placeholder="0,00" 
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                <select 
                  className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-bold appearance-none border-none" 
                  value={newProduct.category} 
                  onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">URL da Imagem</label>
                <div className="flex gap-2">
                   <input 
                    className="flex-1 bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-bold border-none" 
                    value={newProduct.imageUrl} 
                    onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})} 
                    placeholder="https://suaimagem.com/foto.jpg" 
                  />
                  {newProduct.imageUrl && (
                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                      <img 
                        src={newProduct.imageUrl} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover" 
                        alt="Preview" 
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                <textarea 
                  className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 h-24 font-medium border-none" 
                  value={newProduct.description} 
                  onChange={e => setNewProduct({...newProduct, description: e.target.value})} 
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Ingredientes (separados por vírgula)</label>
                <input 
                  className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-bold border-none" 
                  value={newProduct.ingredients} 
                  onChange={e => setNewProduct({...newProduct, ingredients: e.target.value})} 
                  placeholder="Ex: Carne moída, Ovo, Azeitona" 
                />
              </div>

              {/* Opções do Produto */}
              <div className="md:col-span-2 space-y-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Opções de Personalização</h3>
                  <button 
                    type="button"
                    onClick={() => setNewProduct({
                      ...newProduct, 
                      options: [...(newProduct.options || []), { name: '', choices: [], required: false }]
                    })}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all"
                  >
                    + Adicionar Grupo
                  </button>
                </div>

                <div className="space-y-4">
                  {newProduct.options?.map((opt, optIdx) => (
                    <div key={optIdx} className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3 shadow-sm">
                      <div className="flex gap-4 items-start">
                        <div className="flex-1 space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nome do Grupo (ex: Recheio)</label>
                          <input 
                            className="w-full bg-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
                            value={opt.name}
                            onChange={e => {
                              const opts = [...newProduct.options];
                              opts[optIdx].name = e.target.value;
                              setNewProduct({ ...newProduct, options: opts });
                            }}
                          />
                        </div>
                        <div className="flex flex-col items-center gap-1 pt-6">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Obrigatório?</label>
                          <input 
                            type="checkbox"
                            checked={opt.required}
                            onChange={e => {
                              const opts = [...newProduct.options];
                              opts[optIdx].required = e.target.checked;
                              setNewProduct({ ...newProduct, options: opts });
                            }}
                            className="w-5 h-5 accent-orange-500"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const opts = [...newProduct.options];
                            opts.splice(optIdx, 1);
                            setNewProduct({ ...newProduct, options: opts });
                          }}
                          className="pt-8 text-red-400 hover:text-red-600"
                        >
                          🗑️
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Escolhas (separadas por vírgula)</label>
                        <input 
                          className="w-full bg-slate-100 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="Ex: Carne, Queijo, Frango"
                          value={opt.choices.join(', ')}
                          onChange={e => {
                            const opts = [...newProduct.options];
                            opts[optIdx].choices = e.target.value.split(',').map(s => s.trim()).filter(s => s !== '');
                            setNewProduct({ ...newProduct, options: opts });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button className="md:col-span-2 bg-orange-500 text-white font-black py-5 rounded-2xl hover:bg-orange-600 transition-all shadow-xl active:scale-95 text-lg">
                {editingProduct ? 'Salvar Alterações' : 'Salvar Item'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <h2 className="text-lg font-black p-8 border-b border-slate-50 flex items-center gap-2">
              <span>📋</span> Lista de Produtos
            </h2>
            <div className="overflow-x-auto">
              {/* Desktop Table View */}
              <table className="hidden md:table w-full text-left">
                <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-4">Foto</th>
                    <th className="px-8 py-4">Nome</th>
                    <th className="px-8 py-4">Categoria</th>
                    <th className="px-8 py-4 text-right">Preço</th>
                    <th className="px-8 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {products.filter(p => p.active !== false).map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-4">
                        <img 
                          src={p.imageUrl} 
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-lg object-cover shadow-sm" 
                          alt={p.name} 
                        />
                      </td>
                      <td className="px-8 py-4 font-bold text-slate-800">{p.name}</td>
                      <td className="px-8 py-4 text-slate-400 text-xs font-bold">{p.category}</td>
                      <td className="px-8 py-4 text-right font-black text-orange-600 text-base">R$ {p.price.toFixed(2)}</td>
                      <td className="px-8 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleEditProduct(p)} className="text-blue-400 hover:text-blue-600 p-2">✏️</button>
                          <button onClick={() => db.deleteProduct(p.id)} className="text-red-400 hover:text-red-600 p-2">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-slate-100">
                {products.filter(p => p.active !== false).map(p => (
                  <div key={p.id} className="p-4 flex items-center gap-4">
                    <img 
                      src={p.imageUrl} 
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover shadow-sm" 
                      alt={p.name} 
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-slate-800 text-sm truncate">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{p.category}</p>
                      <p className="font-black text-orange-600 text-sm mt-1">R$ {p.price.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => handleEditProduct(p)} className="bg-blue-50 text-blue-500 p-2 rounded-lg">✏️</button>
                      <button onClick={() => db.deleteProduct(p.id)} className="bg-red-50 text-red-500 p-2 rounded-lg">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA: CATEGORIAS */}
      {activeSubTab === 'categories' && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <span>🏷️</span> Nova Categoria
            </h2>
            <form onSubmit={handleAddCategory} className="flex gap-4">
              <input 
                className="flex-1 bg-slate-100 text-slate-900 border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-orange-500" 
                placeholder="Nome da Categoria (Ex: Sobremesas)" 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)} 
                disabled={isAddingCategory}
              />
              <button 
                type="submit"
                disabled={isAddingCategory}
                className={`bg-orange-500 text-white px-8 rounded-2xl font-black transition-all active:scale-95 shadow-lg ${isAddingCategory ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-600'}`}
              >
                {isAddingCategory ? '...' : 'Adicionar'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-4">Ordem</th>
                  <th className="px-8 py-4">Nome</th>
                  <th className="px-8 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, index) => (
                  <tr key={cat.id} className="border-b border-slate-50">
                    <td className="px-8 py-4 font-black text-slate-300">#{index + 1}</td>
                    <td className="px-8 py-4 font-bold text-slate-900">{cat.name}</td>
                    <td className="px-8 py-4 text-center">
                      <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400 hover:text-red-600 p-2">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA: HISTÓRICO */}
      {activeSubTab === 'history' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <span>📜</span> Vendas por Período
            </h2>
            {orders.length > 0 && (
              <button 
                onClick={handleClearHistory}
                className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-all border border-red-100"
              >
                🗑️ Limpar Tudo
              </button>
            )}
          </div>
          {sortedDates.length === 0 ? (
            <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100 text-center space-y-4">
               <div className="text-4xl">📭</div>
               <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum pedido registrado ainda.</p>
            </div>
          ) : sortedDates.map(date => (
            <div key={date} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
              <button 
                onClick={() => setExpandedDate(expandedDate === date ? null : date)}
                className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-orange-100 text-orange-600 p-3 rounded-2xl font-black">
                    {date.split('/')[0]}/{date.split('/')[1]}
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-800">{date}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{dailyHistory[date].orders.length} pedidos</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-orange-600">R$ {dailyHistory[date].total.toFixed(2)}</p>
                </div>
              </button>
              {expandedDate === date && (
                <div className="px-6 pb-6 border-t border-slate-50 animate-slide-down overflow-x-auto">
                  {/* Desktop Table */}
                  <table className="hidden sm:table w-full text-left mt-4">
                    <thead className="text-[9px] font-black uppercase text-slate-300">
                      <tr><th className="py-2">Hora</th><th>Local</th><th>Pagamento</th><th className="text-right">Total</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {dailyHistory[date].orders.map(o => (
                        <tr key={o.id} className="text-xs">
                          <td className="py-3 text-slate-400">{new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                          <td className="font-bold text-slate-900">{o.tableNumber ? `Mesa ${o.tableNumber}` : 'Balcão'}</td>
                          <td><span className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-black">{o.paymentType}</span></td>
                          <td className="text-right font-black text-slate-900">R$ {o.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Mobile List */}
                  <div className="sm:hidden divide-y divide-slate-50 mt-4">
                    {dailyHistory[date].orders.map(o => (
                      <div key={o.id} className="py-3 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{o.tableNumber ? `Mesa ${o.tableNumber}` : 'Balcão'}</p>
                          <p className="text-[10px] text-slate-400">{new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {o.paymentType}</p>
                        </div>
                        <p className="font-black text-slate-900">R$ {o.total.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ABA: EQUIPE */}
      {activeSubTab === 'users' && (
        <div className="space-y-8 animate-fade-in">
           <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100">
            <h2 className="text-xl font-black text-slate-800 mb-6">Novo Colaborador</h2>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input className="bg-slate-100 text-slate-900 border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-orange-500" placeholder="Nome Completo" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
              <input className="bg-slate-100 text-slate-900 border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-orange-500" placeholder="E-mail" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              <input type="password" className="bg-slate-100 text-slate-900 border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-orange-500" placeholder="Senha Temporária" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
              <select className="bg-slate-100 text-slate-900 border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-orange-500" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
                <option value="caixa">Caixa</option>
                <option value="cozinha">Cozinha</option>
                <option value="admin">Administrador</option>
              </select>
              <button disabled={isCreatingUser} className="md:col-span-2 bg-slate-800 text-white py-4 rounded-2xl font-black transition-all active:scale-95 shadow-lg">
                {isCreatingUser ? 'Criando Conta...' : 'Cadastrar na Equipe'}
              </button>
            </form>
          </div>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            {/* Desktop Table */}
            <table className="hidden sm:table w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <tr><th className="px-8 py-4">Nome</th><th className="px-8 py-4">Cargo</th><th className="px-8 py-4 text-center">Ações</th></tr>
              </thead>
              <tbody>
                {users.filter(u => u.role !== 'customer').map(u => (
                  <tr key={u.id} className="border-b border-slate-50">
                    <td className="px-8 py-4 font-bold text-slate-900">{u.name}</td>
                    <td className="px-8 py-4 text-xs font-black uppercase text-orange-600">{u.role}</td>
                    <td className="px-8 py-4 text-center">
                      <button onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:text-red-600 p-2">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile List */}
            <div className="sm:hidden divide-y divide-slate-50">
              {users.filter(u => u.role !== 'customer').map(u => (
                <div key={u.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900">{u.name}</p>
                    <p className="text-[10px] font-black uppercase text-orange-600">{u.role}</p>
                  </div>
                  <button onClick={() => handleDeleteUser(u.id)} className="bg-red-50 text-red-500 p-2 rounded-lg">🗑️</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ABA: CLIENTES */}
      {activeSubTab === 'customers' && (
        <div className="space-y-8 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <span>👤</span> Clientes Cadastrados
            </h2>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
              Total: {users.filter(u => u.role === 'customer').length}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-4">Nome</th>
                  <th className="px-8 py-4">E-mail</th>
                  <th className="px-8 py-4">WhatsApp</th>
                  <th className="px-8 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.role === 'customer').map(u => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedCustomer(u)}>
                    <td className="px-8 py-4 font-bold text-slate-900">{u.name}</td>
                    <td className="px-8 py-4 text-sm text-slate-500">{u.email}</td>
                    <td className="px-8 py-4 text-sm text-slate-500">{u.whatsapp || '-'}</td>
                    <td className="px-8 py-4 text-center">
                      <button className="text-orange-500 hover:text-orange-700 p-2 font-black text-[10px] uppercase tracking-widest">Ver Detalhes</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Cliente */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-bounce-in">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-3xl">
                  👤
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 leading-tight">{selectedCustomer.name}</h3>
                  <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mt-1">Cliente Registrado</p>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">E-mail de Login</p>
                    <p className="font-bold text-slate-800">{selectedCustomer.email}</p>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">WhatsApp</p>
                    <p className="font-bold text-slate-800">{selectedCustomer.whatsapp || 'Não informado'}</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Endereço Padrão</p>
                    <p className="font-bold text-slate-800 text-sm">{selectedCustomer.address || 'Não informado'}</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID do Usuário</p>
                    <p className="font-mono text-[10px] text-slate-400 break-all">{selectedCustomer.id}</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setSelectedCustomer(null)}
                className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-xl"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA: CONFIGURAÇÕES */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <span className="text-2xl">⚙️</span>
              <h2 className="text-xl font-black text-slate-800">Configurações do Negócio</h2>
            </div>
            
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Pastelaria</label>
                  <input 
                    className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-bold border-none" 
                    value={businessSettings.name} 
                    onChange={e => setBusinessSettings({...businessSettings, name: e.target.value})} 
                    placeholder="Ex: Hoje Pode Pastelaria" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp (DDI + DDD + Número)</label>
                  <input 
                    className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-bold border-none" 
                    value={businessSettings.whatsapp} 
                    onChange={e => setBusinessSettings({...businessSettings, whatsapp: e.target.value})} 
                    placeholder="Ex: 5511999999999" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Taxa de Entrega (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-bold border-none" 
                    value={businessSettings.deliveryFee} 
                    onChange={e => setBusinessSettings({...businessSettings, deliveryFee: parseFloat(e.target.value) || 0})} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Pedido Mínimo (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-bold border-none" 
                    value={businessSettings.minOrderValue} 
                    onChange={e => setBusinessSettings({...businessSettings, minOrderValue: parseFloat(e.target.value) || 0})} 
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Endereço Completo</label>
                  <input 
                    className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-bold border-none" 
                    value={businessSettings.address} 
                    onChange={e => setBusinessSettings({...businessSettings, address: e.target.value})} 
                    placeholder="Rua, Número, Bairro, Cidade" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Horário de Funcionamento</label>
                  <input 
                    className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-bold border-none" 
                    value={businessSettings.openingHours} 
                    onChange={e => setBusinessSettings({...businessSettings, openingHours: e.target.value})} 
                    placeholder="Ex: 18:00 - 23:30" 
                  />
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-sm font-bold text-slate-600">Loja Aberta?</span>
                  <button 
                    type="button"
                    onClick={() => setBusinessSettings({...businessSettings, isOpen: !businessSettings.isOpen})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${businessSettings.isOpen ? 'bg-green-500' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${businessSettings.isOpen ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
              <button 
                disabled={isSavingSettings}
                className={`w-full font-black py-5 rounded-2xl transition-all shadow-xl active:scale-95 text-lg ${isSavingSettings ? 'bg-slate-200 text-slate-400' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
              >
                {isSavingSettings ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <h2 className="text-xl font-black text-slate-800">QR Code do Cardápio</h2>
              </div>
              <button 
                onClick={() => window.print()} 
                className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                <span>🖨️</span> Imprimir QR Code
              </button>
            </div>
            
            <div className="flex flex-col items-center justify-center space-y-6 py-10 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 print:bg-white print:border-none print:p-0">
              <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 print:shadow-none print:border-none">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${window.location.origin}?mode=register`} 
                  alt="QR Code do Cardápio" 
                  className="w-48 h-48 sm:w-64 sm:h-64"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Hoje Pode Pastelaria</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Acesse nosso Cardápio & Delivery</p>
                <p className="text-[10px] text-orange-500 font-black">{window.location.origin}?mode=register</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        @keyframes slide-down { from { max-height: 0; opacity: 0; } to { max-height: 1000px; opacity: 1; } }
        .animate-slide-down { animation: slide-down 0.4s ease-out forwards; }
        @keyframes bounce-in { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-bounce-in { animation: bounce-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default AdminPage;
