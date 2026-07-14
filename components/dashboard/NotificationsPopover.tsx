"use client";

import { useState } from "react";
import { Bell } from "lucide-react";

export function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false);

  // Lista simulada de notificações rápidas
  const notifications = [
    {
      id: 1,
      title: "Monitor MT5 Ativo!",
      description: "Agora você pode plugar quantas contas quiser com a sua chave de monitoramento.",
      time: "Agora",
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-1.5 text-zinc-400 hover:bg-[#f5f5f5]/[0.04] hover:text-[#F5F5F5] transition duration-200"
      >
        <Bell className="h-5 w-5" />
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
      </button>

      {isOpen && (
        <>
          {/* Overlay invisível para fechar ao clicar fora */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="absolute right-0 mt-2.5 w-80 rounded-xl border border-[#f5f5f5]/10 bg-[#0A0A0A] p-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-[#f5f5f5]/5 pb-2 mb-2">
              <h4 className="text-xs font-bold text-[#F5F5F5] uppercase tracking-wider">
                Notificações
              </h4>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                Fechar
              </button>
            </div>
            
            <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto">
              {notifications.map((notif) => (
                <div key={notif.id} className="group rounded-lg bg-[#141414] p-2.5 hover:bg-[#1A1A1A] transition">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-bold text-blue-400">{notif.title}</span>
                    <span className="text-[9px] text-zinc-600">{notif.time}</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-normal">{notif.description}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
