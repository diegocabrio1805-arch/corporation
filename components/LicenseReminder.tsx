import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';

interface LicenseReminderProps {
    currentUser: User | null;
    users: User[];
}

const LicenseReminder: React.FC<LicenseReminderProps> = ({ currentUser, users }) => {
    const [showModal, setShowModal] = useState(false);
    const [expiringItems, setExpiringItems] = useState<{ name: string; type: 'PROPIA' | 'COBRADOR'; days: number; date: string }[]>([]);

    useEffect(() => {
        if (!currentUser) return;

        const items: { name: string; type: 'PROPIA' | 'COBRADOR'; days: number; date: string }[] = [];

        // 1. Check Own License
        if (currentUser.expiryDate) {
            const days = getDaysRemaining(currentUser.expiryDate);
            if (days <= 5) {
                items.push({ name: 'TU LICENCIA (GERENTE)', type: 'PROPIA', days, date: currentUser.expiryDate });
            }
        }

        // 2. Check Collectors (Only if Manager)
        if (currentUser.role === Role.MANAGER) {
            const myCollectors = users.filter(u => u.role === Role.COLLECTOR && u.managedBy === currentUser.id);
            myCollectors.forEach(col => {
                if (col.expiryDate) {
                    const days = getDaysRemaining(col.expiryDate);
                    if (days <= 5) {
                        items.push({ name: `COBRADOR: ${col.name}`, type: 'COBRADOR', days, date: col.expiryDate });
                    }
                }
            });
        }

        if (items.length > 0) {
            setExpiringItems(items);
            setShowModal(true);
        }
    }, [currentUser, users]);

    const getDaysRemaining = (dateStr: string) => {
        const expiry = new Date(dateStr);
        expiry.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = expiry.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    if (!showModal || expiringItems.length === 0) return null;

    // Determine highest severity (lowest days)
    const minDays = Math.min(...expiringItems.map(i => i.days));
    const isCritical = minDays <= 1; // 1 day or less -> RED + ANIMATION

    return (
        <div className="fixed inset-0 z-[9999] flex items-start pt-10 md:pt-20 justify-center bg-slate-900/98 p-4 animate-fadeIn overflow-y-auto">
            <div className={`w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-4 ${isCritical ? 'border-red-600 animate-pulse-border' : 'border-yellow-400'}`}>

                {/* HEADER */}
                <div className={`p-6 text-center ${isCritical ? 'bg-red-600 text-white animate-pulse' : 'bg-yellow-400 text-yellow-900'}`}>
                    <div className="flex justify-center mb-4">
                        <i className={`fa-solid ${isCritical ? 'fa-triangle-exclamation fa-beat' : 'fa-clock'} text-5xl`}></i>
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter">
                        {isCritical ? '¡ATENCIÓN URGENTE!' : 'RECORDATORIO DE VENCIMIENTO'}
                    </h2>
                    <p className="text-xs font-bold uppercase tracking-widest mt-2 opacity-90">
                        {isCritical ? 'LICENCIAS A PUNTO DE VENCER' : 'LICENCIAS PRÓXIMAS A VENCER'}
                    </p>
                </div>

                {/* BODY */}
                <div className="p-6 bg-slate-50">
                    <div className="space-y-3">
                        {expiringItems.map((item, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border-l-4 shadow-sm flex justify-between items-center ${item.days <= 1 ? 'bg-red-50 border-red-500' : 'bg-yellow-50 border-yellow-500'}`}>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{item.type}</p>
                                    <p className="font-black text-slate-900 uppercase text-sm">{item.name}</p>
                                    <p className="text-[10px] text-slate-600 font-bold mt-1">Vence: {item.date}</p>
                                </div>
                                <div className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${item.days <= 1 ? 'bg-red-600 text-white animate-bounce' : 'bg-yellow-400 text-yellow-900'}`}>
                                    {item.days <= 0 ? 'HOY' : `${item.days} DÍAS`}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-4 bg-white border-t border-slate-100">
                    <button
                        onClick={() => setShowModal(false)}
                        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${isCritical ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'}`}
                    >
                        ENTENDIDO, CERRAR AVISO
                    </button>
                </div>

            </div>
        </div>
    );
};

export default LicenseReminder;
