
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user?: any;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, title, activeTab, setActiveTab, user, onLogout }) => {
  const navItems = [
    { id: 'pos', label: 'Caixa', icon: '💰', roles: ['admin', 'caixa'] },
    { id: 'tables', label: 'Mesas', icon: '🪑', roles: ['admin', 'caixa'] },
    { id: 'kitchen', label: 'Cozinha', icon: '👨‍🍳', roles: ['admin', 'cozinha'] },
    { id: 'menu', label: 'Cardápio', icon: '📋', roles: ['admin', 'caixa', 'cozinha'] },
    { id: 'admin', label: 'Admin', icon: '⚙️', roles: ['admin', 'caixa'] },
    { id: 'profile', label: 'Perfil', icon: '👤', roles: ['admin', 'caixa', 'cozinha'] },
  ];

  const visibleNavItems = navItems.filter(item => !user || item.roles.includes(user.role));

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="bg-orange-500 text-white p-4 shadow-lg flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl shadow-inner">🥟</div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none">{title}</h1>
            {user && (
              <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 mt-1">
                {user.role} • {user.name}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden sm:block bg-orange-600 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
            Loja Aberta
          </div>
          {onLogout && (
            <button 
              onClick={onLogout}
              className="p-2 hover:bg-orange-600 rounded-full transition-colors text-lg"
              title="Sair"
            >
              🚪
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {children}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center p-2 rounded-2xl transition-all min-w-[64px] ${
                activeTab === item.id 
                  ? 'text-orange-600 bg-orange-50 scale-105 shadow-sm' 
                  : 'text-slate-400 hover:text-orange-400'
              }`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
