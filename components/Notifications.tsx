
import React, { useMemo, useEffect } from 'react';
import { AppState, PaymentStatus, LoanStatus } from '../types';
import { formatCurrency, formatDate, generateNoPaymentReceiptText, ReceiptData, getDaysOverdue } from '../utils/helpers';
import { getTranslation } from '../utils/translations';

interface NotificationsProps {
  state: AppState;
}

const Notifications: React.FC<NotificationsProps> = ({ state }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = getTranslation(state.settings.language);

  const alerts = useMemo(() => {
    const pendingAlerts: any[] = [];
    (Array.isArray(state.loans) ? state.loans : []).filter(l => l.status === LoanStatus.ACTIVE).forEach(loan => {
      const client = (Array.isArray(state.clients) ? state.clients : []).find(c => c.id === loan.clientId);
      if (!client) return;
      const mDays = getDaysOverdue(loan, state.settings);

      (Array.isArray(loan.installments) ? loan.installments : []).forEach(inst => {
        const dueDate = new Date(inst.dueDate + 'T00:00:00');
        dueDate.setHours(0, 0, 0, 0);
        if (inst.status !== PaymentStatus.PAID && (dueDate <= today || mDays > 0)) {
          pendingAlerts.push({
            id: `${loan.id}-${inst.number}`,
            client,
            loan,
            installment: inst,
            isOverdue: mDays > 0,
            daysDiff: mDays
          });
        }
      });
    });
    return pendingAlerts.sort((a, b) => (b.isOverdue ? 1 : 0) - (a.isOverdue ? 1 : 0));
  }, [state.loans, state.clients]);

  const sendOverdueSupport = (alert: any) => {
    const { client, loan, installment, daysDiff } = alert;
    const cleanPhone = client.phone.replace(/\D/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone;

    const installments = Array.isArray(loan.installments) ? loan.installments : [];
    const lastInst = installments[installments.length - 1];
    const paidBefore = installments.reduce((acc: number, inst: any) => acc + (inst.paidAmount || 0), 0);
    const paidCount = installments.filter((i: any) => i.status === PaymentStatus.PAID).length;

    const data: ReceiptData = {
      clientName: client.name,
      amountPaid: 0,
      previousBalance: loan.totalAmount - paidBefore,
      loanId: loan.id,
      startDate: loan.createdAt,
      expiryDate: lastInst ? lastInst.dueDate : loan.createdAt,
      daysOverdue: daysDiff,
      remainingBalance: loan.totalAmount - paidBefore,
      paidInstallments: paidCount,
      totalInstallments: loan.totalInstallments
    };

    const remainingBalance = loan.totalAmount - paidBefore;
    const msg = `Hola ${client.name}, te informamos que hoy no se registró tu pago. Tu saldo pendiente es de ${formatCurrency(remainingBalance, state.settings)} y cuentas con ${daysDiff} días de atraso. Por favor, ponte al día para evitar inconvenientes gracias`;
    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <i className="fa-solid fa-bell text-blue-600 animate-swing"></i>
            {t.notifications.title}
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t.notifications.subtitle}</p>
        </div>
        <div className="bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100">
          <span className="text-sm font-black text-blue-600">{alerts.length} {t.notifications.pending}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {alerts.length === 0 ? (
          <div className="bg-white py-20 rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-400">
            <i className="fa-solid fa-circle-check text-5xl mb-4 text-green-200"></i>
            <p className="text-lg font-bold">{t.notifications.clean}</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-md transition-all border-l-4 ${alert.isOverdue ? 'border-l-red-500' : 'border-l-amber-500'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${alert.isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {alert.isOverdue ? `MORA: ${alert.daysDiff} ${t.notifications.daysLate}` : t.notifications.overdue}
                  </span>
                </div>
                <h4 className="font-black text-xl text-slate-800 uppercase tracking-tighter truncate">{alert.client.name}</h4>
                <p className="text-sm font-black text-blue-600 mt-2">{formatCurrency(alert.installment.amount, state.settings)} ({state.settings.language === 'fr' ? 'Échéance #' : state.settings.language === 'pt' ? 'Parcela #' : 'Cuota #'}{alert.installment.number})</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <button
                  onClick={() => sendOverdueSupport(alert)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all active:scale-95"
                >
                  <i className="fa-solid fa-file-invoice text-sm"></i>
                  {t.notifications.support}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
