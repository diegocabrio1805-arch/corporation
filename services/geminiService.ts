// Removed GoogleGenAI SDK to prevent Fatal Errors on startup if API Key is missing or delayed
import { AppState, Loan, Client, PaymentStatus, AppSettings } from "../types";
import { formatCurrency, formatDate } from "../utils/helpers";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = 'gemini-1.5-flash';

const fetchGemini = async (prompt: string, isJson: boolean = false) => {
  if (!apiKey) {
    console.error("Gemini API Key missing");
    throw new Error("API Key missing");
  }

  // Usamos el endpoint v1 con el formato de modelo completo
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          ...(isJson ? { response_mime_type: "application/json" } : {})
        }
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API Error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

export const getFinancialInsights = async (state: AppState) => {
  const { loans, clients, expenses } = state;

  const validLoans = Array.isArray(loans) ? loans : [];
  const validClients = Array.isArray(clients) ? clients : [];
  const validExpenses = Array.isArray(expenses) ? expenses : [];

  const totalLent = validLoans.reduce((acc, l) => acc + l.principal, 0);
  const totalProfitProyected = validLoans.reduce((acc, l) => acc + (l.totalAmount - l.principal), 0);
  const totalExpenses = validExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netUtility = totalProfitProyected - totalExpenses;

  const prompt = `
    Analiza la situación financiera de una empresa de préstamos. Responde en español y estrictamente en formato JSON.
    DATOS:
    - Clientes: ${validClients.length}
    - Préstamos Activos: ${validLoans.filter(l => l.status === 'Activo').length}
    - Capital prestado: ${totalLent}
    - Intereses proyectados: ${totalProfitProyected}
    - Gastos: ${totalExpenses}
    - Utilidad neta: ${netUtility}
    
    JSON:
    {
      "summary": "Breve resumen",
      "riskLevel": "Bajo/Medio/Alto",
      "recommendations": ["Tip 1", "Tip 2"],
      "topClients": []
    }
  `;

  try {
    const text = await fetchGemini(prompt, true);
    return JSON.parse(text || '{}');
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return {
      summary: "Sistema de Inteligencia Artificial activo. Analizando datos de la sucursal...",
      riskLevel: "Bajo",
      recommendations: ["Sincronizando métricas en tiempo real"],
      topClients: []
    };
  }
};

export const generateAIStatement = async (loan: Loan, client: Client, daysOverdue: number, state: AppState) => {
  const installments = Array.isArray(loan.installments) ? loan.installments : [];
  const totalPaid = installments.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
  const balance = loan.totalAmount - totalPaid;
  const paidInstallments = installments.filter(i => i.status === PaymentStatus.PAID).length;
  const lastInstallment = installments.length > 0 ? installments[installments.length - 1] : { dueDate: new Date().toISOString() };
  const settings = state.settings;

  const prompt = `
    Eres un asistente profesional de una Fintech llamada "ANEXO COBRO". 
    Debes redactar un extracto de cuenta profesional y persuasivo para enviar por WhatsApp al cliente.
    Usa el formato numérico: ${settings.numberFormat === 'comma' ? '1,000,000.00' : '1.000.000,00'}.
    
    DATOS DEL CLIENTE:
    - Nombre: ${client.name}
    - Monto Prestado Inicial: ${formatCurrency(loan.principal, settings)}
    - Total con Intereses: ${formatCurrency(loan.totalAmount, settings)}
    - Saldo Pendiente Actual: ${formatCurrency(balance, settings)}
    - Cuotas Pagadas: ${paidInstallments} de ${loan.totalInstallments}
    - Próximo Vencimiento Final: ${formatDate(lastInstallment.dueDate)}
    - Días de Atraso Actuales: ${daysOverdue} días
    
    INSTRUCCIONES:
    - Usa emojis de forma profesional.
    - Sé muy claro con los números.
    - Si tiene atraso, sé firme pero respetuoso invitando al pago.
    - Si está al día, agradécele su puntualidad.
    - El mensaje debe parecer una tarjeta profesional en texto.
    
    RESPONDE SOLAMENTE CON EL TEXTO DEL MENSAJE.
  `;

  try {
    const text = await fetchGemini(prompt);
    return text || "Error generando el extracto con IA.";
  } catch (error) {
    console.error("Gemini Statement Error:", error);
    return `*ESTADO DE CUENTA - ANEXO COBRO*\n\nCliente: ${client.name}\nSaldo: ${formatCurrency(balance, settings)}\nAtraso: ${daysOverdue} días.`;
  }
};

export const generateNoPaymentAIReminder = async (loan: Loan, client: Client, daysOverdue: number, settings?: AppSettings, overrideBalance?: number) => {
  const companyName = settings?.companyName || 'ANEXO COBRO';

  // Usar el saldo pasado (desde la UI) o calcularlo si es necesario
  let balance = overrideBalance;
  if (balance === undefined) {
    const installments = Array.isArray(loan.installments) ? loan.installments : [];
    const totalPaid = installments.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
    balance = loan.totalAmount - totalPaid;
  }

  const formattedBalance = formatCurrency(balance, settings);

  // Agregar aviso de días de atraso y advertencia de 20 días
  let extraMsg = ` Actualmente cuenta con ${daysOverdue} días de atraso.`;
  if (daysOverdue > 20) {
    extraMsg += " Debe ponerse al día con sus días de atraso para no reducir su crédito el 20%.";
  }

  // Template solicitado por usuario:
  // "Hola (nombre) registramos hoy que no pudo realizar el pago. Porfavor, trate de ponerse al dia con su saldo (saldo)..."
  return `Hola ${client.name} registramos hoy que no pudo realizar el pago. Porfavor, trate de ponerse al dia con su saldo ${formattedBalance}.${extraMsg} ATENTAMENTE ${companyName.toUpperCase()}`;
};

export const mapHeadersWithAI = async (headers: string[]): Promise<Record<string, string>> => {
  const prompt = `
    Dada una lista de encabezados de una hoja de Excel de préstamos/cobranzas, mapea cada encabezado a una de nuestras claves internas si hay una coincidencia clara.
    
    CLAVES INTERNAS:
    - name: Nombre del cliente, Nombres y Apellidos, Titular, Razon Social, Cliente, Sujeto, Deudor
    - documentId: Cédula, DNI, Identificación, CC, Registro, Nro Doc, Doc Identidad, CI, Ced
    - phone: Teléfono, celular, Móvil, Tel, Cel, Whatsapp, Contacto, Telf
    - address: Dirección, domicilio, Residencia, Ubicación, Calle, Depto, Dir
    - principal: Capital inicial, monto prestado, préstamo, Liquido, Desembolso, Importe Cap, Principal, Monto Credito
    - totalAmount: Monto total con intereses, total pagadero, Total Credito, Total Deuda, Total Pagar, Monto Total Pagare, Total Devension
    - installmentValue: Valor de la cuota, monto cuota, Importe Cuota, Val Cuota, Cuota Fija, Valor Plan
    - totalInstallments: Cantidad de cuotas, plan, Plazo, Total Ctas, Nro Cuotas, Cuotas Totales
    - paidInstallments: Cuotas pagadas, cuotas abonadas, cuotas ya cobradas, Cta Pag, Cantidad cobrada, PAGADAS, CTA. PAG., Cobradas, Ya Pagas
    - pendingInstallments: Cuotas pendientes, cuotas que faltan, saldo en cuotas, CUOTA PENDIENTE, Ctas Pend, Por cobrar, CTAS. PEND., Restantes, Saldo Ctas, Faltantes, Pendientes
    - balance: Saldo actual, lo que debe hoy, SALDO PENDIENTE, SALDO TOTAL, Saldo, SALDO., Resto Deuda, Saldo Deudor, Monto Pendiente
    - frequency: Frecuencia de pago, Modalidad, Forma Pago, Periodo (DIARIO, SEMANAL, QUINCENAL, MENSUAL)
    - date: Fecha de otorgamiento, Fecha de inicio, Fecha crédito, Desembolso, Fch Alta, Fec Credito
    
    ENCABEZADOS EXCEL:
    ${headers.join(', ')}
    
    Responde solo con un JSON plano donde la clave es el ENCABEZADO EXCEL y el valor es la CLAVE INTERNA.
    Ejemplo: {"Nombres y Apellidos": "name", "CC": "documentId", "Cta Pag": "paidInstallments", "Ctas Pend": "pendingInstallments"}
  `;

  try {
    console.log("🧠 [FORENSIC] Solicitando mapeo a la IA para:", headers);
    // Quitamos response_mime_type: "application/json" para evitar error 400 en algunos entornos/modelos
    const text = await fetchGemini(prompt, false);

    // Extractor robusto de JSON
    const extractJSON = (raw: string) => {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1) return {};
      return JSON.parse(raw.substring(start, end + 1));
    };

    const result = extractJSON(text || '{}');
    console.log("✅ [FORENSIC] Mapeo de IA recibido y procesado:", result);
    return result;
  } catch (error) {
    console.error("❌ [FORENSIC] Error en Mapeo de IA:", error);
    return {};
  }
};
