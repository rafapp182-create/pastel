
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import POSPage from './pages/POSPage';
import KitchenPage from './pages/KitchenPage';
import TableManager from './pages/TableManager';
import AdminPage from './pages/AdminPage';
import CustomerMenu from './pages/CustomerMenu';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import { db } from './services/mockDatabase';
import { auth, firestore } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('pos');
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(firestore, "users", firebaseUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : { role: 'customer' };
        
        const loggedUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          role: userData.role || 'customer',
          name: userData.name || firebaseUser.email?.split('@')[0],
          address: userData.address,
          whatsapp: userData.whatsapp
        };
        setUser(loggedUser);
        
        // Se for cliente, a aba padrão é o cardápio
        if (loggedUser.role === 'customer') {
          setActiveTab('menu');
        }
      } else {
        setUser(null);
      }
      setLoading(false);
      // Pequeno delay para UX
      setTimeout(() => setIsReady(true), 1000);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const renderContent = () => {
    if (loading || !isReady) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-400 gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold text-[10px] uppercase tracking-widest animate-pulse">Sincronizando Pastelaria...</p>
        </div>
      );
    }

    if (!user) {
      return <LoginPage onLoginSuccess={setUser} />;
    }

    // Se for cliente, renderiza apenas o cardápio
    if (user.role === 'customer') {
      return <CustomerMenu user={user} />;
    }

    switch (activeTab) {
      case 'pos': return <POSPage />;
      case 'tables': return <TableManager />;
      case 'kitchen': return <KitchenPage />;
      case 'menu': return <CustomerMenu user={user} />;
      case 'admin': return <AdminPage />;
      case 'profile': return <ProfilePage user={user} onUpdateUser={setUser} />;
      default: return <POSPage />;
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'pos': return 'Frente de Caixa';
      case 'tables': return 'Comanda & Mesas';
      case 'kitchen': return 'Cozinha';
      case 'menu': return 'Cardápio Digital';
      case 'admin': return 'Administração';
      case 'profile': return 'Meu Perfil';
      default: return 'Hoje Pode!';
    }
  };

  // Se não houver usuário ou for cliente, renderiza apenas o conteúdo
  if (!user || user.role === 'customer') {
    return renderContent();
  }

  return (
    <Layout 
      title={getTitle()} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      user={user}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
