
import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  type = 'info'
}) => {
  if (!isOpen) return null;

  const getButtonClass = () => {
    switch (type) {
      case 'danger': return 'bg-red-500 hover:bg-red-600';
      case 'warning': return 'bg-orange-500 hover:bg-orange-600';
      default: return 'bg-slate-800 hover:bg-slate-900';
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 space-y-6 animate-bounce-in">
        <div className="text-center space-y-2">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner ${
            type === 'danger' ? 'bg-red-50 text-red-500' : 
            type === 'warning' ? 'bg-orange-50 text-orange-500' : 
            'bg-slate-50 text-slate-500'
          }`}>
            {type === 'danger' ? '⚠️' : type === 'warning' ? '🤔' : 'ℹ️'}
          </div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
          >
            {cancelLabel}
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-[1.5] py-4 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 ${getButtonClass()}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
        @keyframes bounce-in { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-bounce-in { animation: bounce-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>
    </div>
  );
};

export default ConfirmModal;
