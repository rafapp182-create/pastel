
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockDatabase';
import { Product, Order, CashierSession, PaymentType, UserRole } from '../types';
import { auth, firestore } from '../services/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

interface AdminPageProps {
  user: any;
  setActiveTab: (tab: string) => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ user, setActiveTab }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [session, setSession] = useState<CashierSession | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'inventory' | 'history' | 'users' | 'settings' | 'cashier'>('stats');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [bannerUrl, setBannerUrl] = useState('');
  const [businessWhatsapp, setBusinessWhatsapp] = useState('');
  const [openingValue, setOpeningValue] = useState('');
  const [isOpening, setIsOpening] = useState(false);

  const isAdmin = user?.role === 'admin';

  const tabs = [
    { id: 'stats', label: 'Resumo', icon: '📊', adminOnly: false },
    { id: 'cashier', label: 'Caixa', icon: '💰', adminOnly: false },
    { id: 'inventory', label: 'Produtos', icon: '🥟', adminOnly: false },
    { id: 'history', label: 'Histórico', icon: '📜', adminOnly: false },
    { id: 'users', label: 'Equipe', icon: '👥', adminOnly: true },
    { id: 'settings', label: 'Ajustes', icon: '⚙️', adminOnly: true }
  ].filter(tab => !tab.adminOnly || isAdmin);
  
  const [newProduct, setNewProduct] = useState({
      name: '',
      description: '',
      category: 'Pasteis de Carne',
      price: '',
      imageUrl: ''
  });

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: UserRole.CAIXA
  });

  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  useEffect(() => {
    const update = () => {
      setProducts(db.getProducts());
      setOrders(db.getOrders());
      setSession(db.getCurrentSession());
    };
    update();
    const unsub = db.subscribe(update);

    const unsubUsers = onSnapshot(collection(firestore, "users"), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    db.getSettings().then(s => {
      setBannerUrl(s.bannerUrl || '');
      setBusinessWhatsapp(s.businessWhatsapp || '');
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

      if (editingProduct) {
        await db.updateProduct(editingProduct.id, {
          ...newProduct,
          price: parseFloat(newProduct.price)
        });
        setEditingProduct(null);
        notify('Produto atualizado com sucesso!');
      } else {
        await db.addProduct({
            ...newProduct,
            price: parseFloat(newProduct.price),
            active: true,
            imageUrl: newProduct.imageUrl || `https://picsum.photos/seed/${newProduct.name}/300/200`
        });
        notify('Produto cadastrado com sucesso!');
      }

      setNewProduct({ name: '', description: '', category: 'Pasteis de Carne', price: '', imageUrl: '' });
  };

  const handleEditProduct = (p: Product) => {
    setEditingProduct(p);
    setNewProduct({
      name: p.name,
      description: p.description,
      category: p.category,
      price: p.price.toString(),
      imageUrl: p.imageUrl
    });
    setActiveSubTab('inventory');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.updateSettings({ bannerUrl, businessWhatsapp });
    notify('Configurações atualizadas!');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password || !newUser.name) return notify('Preencha todos os campos.', 'error');
    
    setIsCreatingUser(true);
    const cleanEmail = newUser.email.trim();
    const appName = `Secondary-${Date.now()}`;

    try {
      const secondaryApp = initializeApp(auth.app.options, appName);
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
      await secondaryApp.delete();
    } catch (err: any) {
      console.error("Erro ao criar usuário:", err);
      notify('Erro: ' + (err.message || 'Verifique os dados.'), 'error');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user.id) return notify('Você não pode remover seu próprio acesso.', 'error');
    if (window.confirm('Deseja remover este acesso?')) {
      try {
        await deleteDoc(doc(firestore, "users", userId));
        notify('Acesso removido.');
      } catch (err: any) {
        console.error("Erro ao deletar usuário:", err);
        notify('Erro ao remover: ' + err.message, 'error');
      }
    }
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
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Vendas Totais</p>
            <h3 className="text-3xl font-black text-slate-900">R$ {orders.reduce((a, b) => a + b.total, 0).toFixed(2)}</h3>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Pedidos</p>
            <h3 className="text-3xl font-black text-slate-900">{orders.length}</h3>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Itens Ativos</p>
            <h3 className="text-3xl font-black text-slate-900">{products.length}</h3>
          </div>
        </div>
      )}

      {/* ABA: GESTÃO DE CAIXA */}
      {activeSubTab === 'cashier' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100">
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
              <div className="space-y-6 max-w-md">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Valor de Abertura (Fundo de Caixa)</label>
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
                </div>
                <button 
                  onClick={async () => {
                    const val = parseFloat(openingValue);
                    if (isNaN(val) || val < 0) return notify('Valor inválido', 'error');
                    setIsOpening(true);
                    await db.openCashier(val);
                    setIsOpening(false);
                    setOpeningValue('');
                    notify('Caixa aberto!');
                  }}
                  disabled={isOpening}
                  className="w-full py-5 bg-orange-500 text-white font-black rounded-2xl shadow-xl hover:bg-orange-600 active:scale-95 transition-all text-lg"
                >
                  {isOpening ? 'Abrindo...' : 'Abrir Caixa'}
                </button>
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
                      if (window.confirm('Deseja realmente fechar o caixa?')) {
                        db.closeCashier();
                        notify('Caixa fechado!');
                      }
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
                    R$ {orders.filter(o => o.sessionId === session.id && o.status === 'pago').reduce((a, b) => a + b.total, 0).toFixed(2)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedidos Pagos</p>
                  <p className="text-2xl font-black text-slate-900">
                    {orders.filter(o => o.sessionId === session.id && o.status === 'pago').length}
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
                  <option>Pasteis de Carne</option>
                  <option>Pasteis de Frango</option>
                  <option>Pasteis Especiais</option>
                  <option>Bebidas</option>
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
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Descrição / Ingredientes</label>
                <textarea 
                  className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 h-24 font-medium border-none" 
                  value={newProduct.description} 
                  onChange={e => setNewProduct({...newProduct, description: e.target.value})} 
                />
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
              <table className="w-full text-left">
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
            </div>
          </div>
        </div>
      )}

      {/* ABA: HISTÓRICO */}
      {activeSubTab === 'history' && (
        <div className="space-y-6 animate-fade-in">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span>📜</span> Vendas por Período
          </h2>
          {sortedDates.map(date => (
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
                  <table className="w-full text-left mt-4">
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
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <tr><th className="px-8 py-4">Nome</th><th className="px-8 py-4">Cargo</th><th className="px-8 py-4 text-center">Ações</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
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
          </div>
        </div>
      )}

      {/* ABA: CONFIGURAÇÕES */}
      {activeSubTab === 'settings' && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">⚙️</span>
              <h2 className="text-xl font-black text-slate-800">Configurações do Cardápio</h2>
            </div>
            <form onSubmit={handleUpdateSettings} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">URL do Banner Principal</label>
                <div className="flex gap-4">
                  <input 
                    className="flex-1 bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-bold border-none" 
                    value={bannerUrl} 
                    onChange={e => setBannerUrl(e.target.value)} 
                    placeholder="https://suaimagem.com/banner.jpg" 
                  />
                  {bannerUrl && (
                    <div className="w-24 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                      <img src={bannerUrl} className="w-full h-full object-cover" alt="Banner Preview" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-medium px-2 italic">Esta imagem aparecerá no topo do cardápio digital dos clientes.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp do Estabelecimento</label>
                <input 
                  className="w-full bg-slate-100 text-slate-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-orange-500 font-bold border-none" 
                  value={businessWhatsapp} 
                  onChange={e => setBusinessWhatsapp(e.target.value)} 
                  placeholder="Ex: 5511999999999" 
                />
                <p className="text-[10px] text-slate-400 font-medium px-2 italic">Número para onde os pedidos serão enviados via WhatsApp (inclua o DDI 55).</p>
              </div>
              <button className="w-full bg-orange-500 text-white font-black py-5 rounded-2xl hover:bg-orange-600 transition-all shadow-xl active:scale-95 text-lg">
                Salvar Configurações
              </button>
            </form>
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
