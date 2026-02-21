
import React, { useState } from 'react';
import { auth, firestore } from '../services/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserRole } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdminRegistration, setIsAdminRegistration] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;
      
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      
      if (!userDoc.exists()) {
        const defaultProfile = {
          name: user.displayName || user.email?.split('@')[0] || 'Usuário',
          email: cleanEmail,
          role: UserRole.CUSTOMER,
          createdAt: Date.now()
        };
        await setDoc(doc(firestore, "users", user.uid), defaultProfile);
        onLoginSuccess({
          id: user.uid,
          ...defaultProfile
        });
      } else {
        const userData = userDoc.data();
        onLoginSuccess({
          id: user.uid,
          email: user.email,
          role: userData.role || UserRole.CUSTOMER,
          name: userData.name || user.email?.split('@')[0],
          address: userData.address,
          whatsapp: userData.whatsapp
        });
      }
    } catch (err: any) {
      console.error("Erro ao logar:", err.code);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/invalid-email') {
        setError('O formato do e-mail é inválido.');
      } else {
        setError('Erro ao acessar o sistema. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      
      if (!userDoc.exists()) {
        const defaultProfile = {
          name: user.displayName || 'Usuário',
          email: user.email,
          role: UserRole.CUSTOMER,
          createdAt: Date.now()
        };
        await setDoc(doc(firestore, "users", user.uid), defaultProfile);
        onLoginSuccess({
          id: user.uid,
          ...defaultProfile
        });
      } else {
        const userData = userDoc.data();
        onLoginSuccess({
          id: user.uid,
          email: user.email,
          role: userData.role || UserRole.CUSTOMER,
          name: userData.name || user.displayName,
          address: userData.address,
          whatsapp: userData.whatsapp
        });
      }
    } catch (err: any) {
      console.error("Erro Google Login:", err);
      if (err.code === 'auth/popup-blocked') {
        setError('O popup foi bloqueado. Clique no ícone de bloqueio na barra de endereços e permita popups.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login com Google não está ativado no Firebase (Authentication > Sign-in method).');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Este domínio não está autorizado no Firebase (Authentication > Settings > Authorized domains).');
      } else if (err.code === 'auth/internal-error' || err.code === 'auth/network-request-failed') {
        setError('Erro de conexão ou cookies de terceiros bloqueados. Tente usar uma aba anônima ou outro navegador.');
      } else {
        setError(`Erro (${err.code}): ${err.message || 'Tente novamente.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Por favor, informe seu nome.');
    if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.');
    if (!address.trim()) return setError('Por favor, informe seu endereço para entregas.');
    if (!whatsapp.trim()) return setError('Por favor, informe seu WhatsApp para contato.');
    
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      const newUserProfile = {
        name: name.trim(),
        email: cleanEmail,
        role: isAdminRegistration ? UserRole.ADMIN : UserRole.CUSTOMER,
        address: address.trim(),
        whatsapp: whatsapp.trim(),
        createdAt: Date.now()
      };

      await setDoc(doc(firestore, "users", user.uid), newUserProfile);

      onLoginSuccess({
        id: user.uid,
        ...newUserProfile
      });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado.');
      } else {
        setError('Erro ao criar conta: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6 text-slate-900">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-6 sm:p-10 space-y-6 sm:space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mx-auto text-4xl shadow-inner animate-bounce-subtle">
            🥟
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            {isRegistering ? 'Criar Conta' : 'Hoje Pode!'}
          </h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
            {isRegistering ? 'Cadastre-se para fazer seu pedido' : 'Gestão Profissional de Pastelaria'}
          </p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/pjax/google.png" alt="Google" className="w-5 h-5" />
            Entrar com Google
          </button>

          <div className="flex items-center gap-4 py-2">
            <div className="h-px flex-1 bg-slate-100"></div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">ou e-mail</span>
            <div className="h-px flex-1 bg-slate-100"></div>
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            {isRegistering && (
              <>
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-2">
                  <button
                    type="button"
                    onClick={() => setIsAdminRegistration(false)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isAdminRegistration ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400'}`}
                  >
                    Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdminRegistration(true)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isAdminRegistration ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400'}`}
                  >
                    Administrador
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-100 text-slate-900 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-orange-500 transition-all font-bold"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Endereço de Entrega</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-100 text-slate-900 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-orange-500 transition-all font-bold"
                    placeholder="Rua, número, bairro"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                  <input 
                    type="tel" 
                    required
                    className="w-full bg-slate-100 text-slate-900 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-orange-500 transition-all font-bold"
                    placeholder="(00) 00000-0000"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
              <input 
                type="email" 
                required
                className="w-full bg-slate-100 text-slate-900 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-orange-500 transition-all font-bold"
                placeholder="exemplo@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
              <input 
                type="password" 
                required
                className="w-full bg-slate-100 text-slate-900 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-orange-500 transition-all font-bold"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-[11px] font-bold border border-red-100 animate-shake">
                ⚠️ {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className={`w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all mt-4 ${
                loading 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-100 active:scale-95'
              }`}
            >
              {loading ? 'Processando...' : (isRegistering ? 'Cadastrar' : 'Entrar')}
            </button>
          </form>
        </div>

        <div className="text-center">
          <button 
            onClick={() => { 
              setIsRegistering(!isRegistering); 
              setError(null); 
            }}
            className="text-[11px] text-orange-600 font-black uppercase tracking-widest hover:underline block w-full"
          >
            {isRegistering ? 'Voltar para Login' : 'Não tem conta? Cadastre-se aqui'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; }
        @keyframes bounce-subtle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-bounce-subtle { animation: bounce-subtle 3s ease-in-out infinite; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default LoginPage;
