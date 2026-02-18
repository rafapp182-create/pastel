
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockDatabase';
import { Product } from '../types';

const CustomerMenu: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    setProducts(db.getProducts().filter(p => p.active));
  }, []);

  const categories = Array.from(new Set(products.map(p => p.category)));

  return (
    <div className="max-w-2xl mx-auto bg-white min-h-screen">
      <div className="relative h-48 overflow-hidden">
        <img 
          src="https://picsum.photos/seed/pastel-hero/800/400" 
          alt="Banner" 
          className="w-full h-full object-cover brightness-50"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6">
          <h1 className="text-3xl font-black italic">Hoje Pode!</h1>
          <p className="text-base opacity-90 font-medium">Os melhores pastéis da cidade 🥟</p>
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-t-3xl shadow-xl p-4 space-y-8">
          {categories.map(cat => (
            <div key={cat} className="space-y-3">
              <h2 className="text-lg font-black text-slate-800 border-b-2 border-orange-500 inline-block pb-0.5">{cat}</h2>
              <div className="space-y-4">
                {products.filter(p => p.category === cat).map(product => (
                  <div key={product.id} className="flex gap-3 group">
                    <img 
                      src={product.imageUrl} 
                      alt={product.name} 
                      className="w-16 h-16 rounded-xl object-cover shadow-sm"
                    />
                    <div className="flex-1 border-b border-slate-100 pb-3">
                      <div className="flex justify-between items-start mb-0.5">
                        <h3 className="font-bold text-slate-800 text-base group-hover:text-orange-600 transition-colors leading-tight">{product.name}</h3>
                        <span className="font-black text-orange-600 text-sm whitespace-nowrap ml-2">R$ {product.price.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-snug line-clamp-2">{product.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="py-8 text-center space-y-4">
              <div className="inline-block p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://hojepodepastelaria.com/menu" alt="QR Code" />
              </div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Aponte a câmera para pedir de novo</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerMenu;
