
import React, { useState } from 'react';
import { auth, firestore } from '../services/firebase';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

interface ProfilePageProps {
  user: any;
  onUpdateUser: (updatedUser: any) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onUpdateUser }) => {
  const [name, setName] = useState(user.name || '');
  const [address, setAddress] = useState(user.address || '');
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (auth.currentUser) {
        // Update Firebase Auth profile
        await updateProfile(auth.currentUser, { displayName: name });
        
        // Update Firestore user document
        const userRef = doc(firestore, "users", user.id);
        const updates: any = {
          name: name,
          updatedAt: Date.now()
        };

        if (user.role === 'customer') {
          updates.address = address;
          updates.whatsapp = whatsapp;
        }

        await updateDoc(userRef, updates);

        const updatedUser = { ...user, name, address, whatsapp };
        onUpdateUser(updatedUser);
        setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      }
    } catch (error: any) {
      console.error("Erro ao atualizar perfil:", error);
      setMessage({ type: 'error', text: 'Erro ao atualizar perfil. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage({ type: 'success', text: 'E-mail de redefinição enviado!' });
    } catch (error: any) {
      console.error("Erro ao enviar e-mail de redefinição:", error);
      setMessage({ type: 'error', text: 'Erro ao enviar e-mail. Tente novamente.' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden">
        <div className="bg-orange-500 p-6 sm:p-8 text-white text-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/20 rounded-full flex items-center justify-center text-4xl sm:text-5xl mx-auto mb-4 shadow-inner">
            👤
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">{user.name}</h2>
          <p className="text-orange-100 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest mt-1">
            {user.role} • {user.email}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nome de Exibição</label>
              <input 
                type="text" 
                required
                className="w-full bg-slate-50 text-slate-900 border-2 border-slate-100 rounded-2xl px-6 py-4 outline-none focus:border-orange-500 transition-all font-bold"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {user.role === 'customer' && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Endereço de Entrega</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-50 text-slate-900 border-2 border-slate-100 rounded-2xl px-6 py-4 outline-none focus:border-orange-500 transition-all font-bold"
                    placeholder="Seu endereço"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                  <input 
                    type="tel" 
                    required
                    className="w-full bg-slate-50 text-slate-900 border-2 border-slate-100 rounded-2xl px-6 py-4 outline-none focus:border-orange-500 transition-all font-bold"
                    placeholder="Seu WhatsApp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">E-mail (Não editável)</label>
              <input 
                type="email" 
                disabled
                className="w-full bg-slate-100 text-slate-400 border-2 border-slate-100 rounded-2xl px-6 py-4 outline-none font-bold cursor-not-allowed"
                value={user.email}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Cargo (Não editável)</label>
              <div className="w-full bg-slate-100 text-slate-400 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold capitalize">
                {user.role}
              </div>
            </div>

            {message && (
              <div className={`p-4 rounded-2xl text-[11px] font-bold border animate-shake ${
                message.type === 'success' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-500 border-red-100'
              }`}>
                {message.type === 'success' ? '✅' : '⚠️'} {message.text}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className={`w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all ${
                loading 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-100 active:scale-95'
              }`}
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-xl p-8">
        <h3 className="text-lg font-black text-slate-800 mb-4 tracking-tight">Segurança</h3>
        <p className="text-slate-500 text-sm font-medium mb-6">
          Para sua segurança, a alteração de senha deve ser solicitada ao administrador do sistema ou realizada via e-mail de recuperação.
        </p>
        <button 
          onClick={handleResetPassword}
          className="text-orange-600 font-black uppercase text-[10px] tracking-widest hover:underline"
        >
          Enviar e-mail de redefinição de senha
        </button>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default ProfilePage;
