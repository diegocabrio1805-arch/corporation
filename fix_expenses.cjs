const fs = require('fs');

const capitalTranslations = {
  es: {
    capitalBlock: {
      title: "Control de Capital",
      subtitle: "Gestión de flujo de caja operativo",
      loadCapitalBtn: "Cargar Capital Inicial",
      expenseBtn: "Gasto Operativo",
      workingCapital: "Capital de Trabajo",
      mainFund: "Fondo principal cargado",
      realCash: "Efectivo Real en Caja",
      basePlusCollections: "Base + Cobros:",
      deliveredPlusExpenses: "Entregado + Gastos:",
      creditsGranted: "Créditos Otorgados",
      operations: "Operaciones",
      projectedProfit: "Utilidad Proyectada",
      criticalArrears: "Mora Crítica (+60 d)",
      highRiskCapital: "Capital en alto riesgo de pérdida",
      historicalBalance: "Balance Histórico de Créditos",
      performanceAndArrears: "Rendimiento proyectado y mora de los últimos 6 meses",
      profit: "Utilidad",
      arrears: "Mora",
      renewals: "Renovaciones",
      newCredits: "C. Nuevos",
      totals: "TOTALES",
      newLabel: "NUEVOS",
      renovLabel: "RENOV.",
      expensesHistory: "Historial de Salidas (Gastos)",
      desc: "Descripción",
      category: "Categoría",
      date: "Fecha",
      amount: "Monto",
      noExpenses: "No hay gastos registrados",
      capitalBase: "Base de Capital",
      setWorkingCapital: "Establecer Capital de Trabajo",
      registerExpense: "Registrar Gasto",
      expenseDesc: "Descripción del Gasto",
      amountSign: "Monto ($)",
      save: "GUARDAR",
      updateCapital: "ACTUALIZAR CAPITAL",
      infoText: "El capital de trabajo define la base sobre la cual se calcula el flujo de caja. Sólo los superadministradores deberían alterar este valor inicial una vez establecidas las operaciones."
    }
  },
  en: {
    capitalBlock: {
      title: "Capital Control",
      subtitle: "Operational cash flow management",
      loadCapitalBtn: "Load Initial Capital",
      expenseBtn: "Operational Expense",
      workingCapital: "Working Capital",
      mainFund: "Main loaded fund",
      realCash: "Real Cash on Hand",
      basePlusCollections: "Base + Collections:",
      deliveredPlusExpenses: "Delivered + Expenses:",
      creditsGranted: "Credits Granted",
      operations: "Operations",
      projectedProfit: "Projected Profit",
      criticalArrears: "Critical Arrears (+60 d)",
      highRiskCapital: "Capital at high risk of loss",
      historicalBalance: "Historical Credit Balance",
      performanceAndArrears: "Projected performance and arrears of the last 6 months",
      profit: "Profit",
      arrears: "Arrears",
      renewals: "Renewals",
      newCredits: "New Credits",
      totals: "TOTALS",
      newLabel: "NEW",
      renovLabel: "RENEW.",
      expensesHistory: "Expenses History",
      desc: "Description",
      category: "Category",
      date: "Date",
      amount: "Amount",
      noExpenses: "No expenses registered",
      capitalBase: "Capital Base",
      setWorkingCapital: "Set Working Capital",
      registerExpense: "Register Expense",
      expenseDesc: "Expense Description",
      amountSign: "Amount ($)",
      save: "SAVE",
      updateCapital: "UPDATE CAPITAL",
      infoText: "Working capital defines the base upon which cash flow is calculated. Only super administrators should alter this initial value once operations are established."
    }
  },
  pt: {
    capitalBlock: {
      title: "Controle de Capital",
      subtitle: "Gestão do fluxo de caixa operacional",
      loadCapitalBtn: "Carregar Capital Inicial",
      expenseBtn: "Despesa Operacional",
      workingCapital: "Capital de Giro",
      mainFund: "Fundo principal carregado",
      realCash: "Dinheiro Real em Caixa",
      basePlusCollections: "Base + Cobranças:",
      deliveredPlusExpenses: "Entregue + Despesas:",
      creditsGranted: "Créditos Concedidos",
      operations: "Operações",
      projectedProfit: "Lucro Projetado",
      criticalArrears: "Atraso Crítico (+60 d)",
      highRiskCapital: "Capital em alto risco de perda",
      historicalBalance: "Balanço Histórico de Créditos",
      performanceAndArrears: "Desempenho projetado e atrasos dos últimos 6 meses",
      profit: "Lucro",
      arrears: "Atraso",
      renewals: "Renovações",
      newCredits: "C. Novos",
      totals: "TOTAIS",
      newLabel: "NOVOS",
      renovLabel: "RENOV.",
      expensesHistory: "Histórico de Saídas (Despesas)",
      desc: "Descrição",
      category: "Categoria",
      date: "Data",
      amount: "Montante",
      noExpenses: "Nenhuma despesa registrada",
      capitalBase: "Base de Capital",
      setWorkingCapital: "Definir Capital de Giro",
      registerExpense: "Registrar Despesa",
      expenseDesc: "Descrição da Despesa",
      amountSign: "Montante ($)",
      save: "SALVAR",
      updateCapital: "ATUALIZAR CAPITAL",
      infoText: "O capital de giro define a base sobre a qual o fluxo de caixa é calculado. Apenas super administradores devem alterar esse valor inicial depois que as operações estiverem estabelecidas."
    }
  },
  fr: {
    capitalBlock: {
      title: "Contrôle du Capital",
      subtitle: "Gestion des flux de trésorerie",
      loadCapitalBtn: "Charger le Capital",
      expenseBtn: "Dépense Opérationnelle",
      workingCapital: "Fonds de Roulement",
      mainFund: "Fonds principal chargé",
      realCash: "Espèces Réelles en Caisse",
      basePlusCollections: "Base + Recouvrements :",
      deliveredPlusExpenses: "Livré + Dépenses :",
      creditsGranted: "Crédits Accordés",
      operations: "Opérations",
      projectedProfit: "Bénéfice Projeté",
      criticalArrears: "Retards Critiques (+60 j)",
      highRiskCapital: "Capital à haut risque de perte",
      historicalBalance: "Bilan Historique des Crédits",
      performanceAndArrears: "Performances projetées et retards des 6 derniers mois",
      profit: "Bénéfice",
      arrears: "Retards",
      renewals: "Renouvellements",
      newCredits: "Nouv. Crédits",
      totals: "TOTAUX",
      newLabel: "NOUVEAUX",
      renovLabel: "RENOUV.",
      expensesHistory: "Historique des Dépenses",
      desc: "Description",
      category: "Catégorie",
      date: "Date",
      amount: "Montant",
      noExpenses: "Aucune dépense enregistrée",
      capitalBase: "Base de Capital",
      setWorkingCapital: "Définir le fonds de roulement",
      registerExpense: "Enregistrer une Dépense",
      expenseDesc: "Description de la Dépense",
      amountSign: "Montant ($)",
      save: "ENREGISTRER",
      updateCapital: "METTRE À JOUR",
      infoText: "Le fonds de roulement définit la base sur laquelle les flux de trésorerie sont calculés. Seuls les super administrateurs doivent modifier cette valeur initiale une fois les opérations établies."
    }
  }
};

let translations = fs.readFileSync('utils/translations.ts', 'utf8');

const langs = ['es', 'en', 'pt', 'fr'];
for (const lang of langs) {
  const langIndex = translations.indexOf(`  ${lang}: {`);
  if (langIndex !== -1) {
    const settingsPageIndex = translations.indexOf(`    settingsPage: {`, langIndex);
    if (settingsPageIndex !== -1) {
      let block = `    capitalBlock: {\n`;
      for (const [k, v] of Object.entries(capitalTranslations[lang].capitalBlock)) {
        block += `      ${k}: "${v.replace(/"/g, '\\"')}",\n`;
      }
      block += `    },\n`;
      translations = translations.slice(0, settingsPageIndex) + block + translations.slice(settingsPageIndex);
    }
  }
}

fs.writeFileSync('utils/translations.ts', translations, 'utf8');

let expenses = fs.readFileSync('components/Expenses.tsx', 'utf8');

// Inject import and setup
if (!expenses.includes("const t = getTranslation(")) {
  expenses = expenses.replace(
    /import \{ jsPDF \} from 'jspdf';/,
    "import { getTranslation } from '../utils/translations';\nimport { jsPDF } from 'jspdf';"
  );
  expenses = expenses.replace(
    /const dispatch = useDispatch\(\);/,
    "const dispatch = useDispatch();\n  const t = getTranslation(state.settings.language).capitalBlock;"
  );
} else {
  expenses = expenses.replace(
    /const t = getTranslation\([^)]+\)\.capitalBlock;/,
    "const t = getTranslation(state.settings.language).capitalBlock;"
  );
}

// Replace static text with translations
expenses = expenses.replace(
  />Control de Capital<\/h2>/g,
  ">{t?.title || 'Control de Capital'}</h2>"
);
expenses = expenses.replace(
  />Gesti.n de flujo de caja operativo<\/p>/g,
  ">{t?.subtitle || 'Gestión de flujo de caja operativo'}</p>"
);
expenses = expenses.replace(
  />Cargar Capital Inicial<\/span>/g,
  ">{t?.loadCapitalBtn || 'Cargar Capital Inicial'}</span>"
);
expenses = expenses.replace(
  />Gasto Operativo<\/span>/g,
  ">{t?.expenseBtn || 'Gasto Operativo'}</span>"
);
expenses = expenses.replace(
  />Capital de Trabajo<\/p>/g,
  ">{t?.workingCapital || 'Capital de Trabajo'}</p>"
);
expenses = expenses.replace(
  />Fondo principal cargado<\/p>/g,
  ">{t?.mainFund || 'Fondo principal cargado'}</p>"
);
expenses = expenses.replace(
  />Efectivo Real en Caja<\/p>/g,
  ">{t?.realCash || 'Efectivo Real en Caja'}</p>"
);
expenses = expenses.replace(
  />BASE \+ COBROS:<\/p>/g,
  ">{t?.basePlusCollections || 'BASE + COBROS:'}</p>"
);
expenses = expenses.replace(
  />ENTREGADO \+ GASTOS:<\/p>/g,
  ">{t?.deliveredPlusExpenses || 'ENTREGADO + GASTOS:'}</p>"
);
expenses = expenses.replace(
  />Cr.ditos Otorgados<\/p>/g,
  ">{t?.creditsGranted || 'Créditos Otorgados'}</p>"
);
expenses = expenses.replace(
  />OPERACIONES<\/p>/g,
  ">{t?.operations || 'OPERACIONES'}</p>"
);
expenses = expenses.replace(
  />UTILIDAD PROYECTADA<\/p>/g,
  ">{t?.projectedProfit || 'UTILIDAD PROYECTADA'}</p>"
);
expenses = expenses.replace(
  />Mora Cr.tica \(\+60 d\)<\/p>/g,
  ">{t?.criticalArrears || 'Mora Crítica (+60 d)'}</p>"
);
expenses = expenses.replace(
  />Capital en alto riesgo de p.rdida<\/p>/g,
  ">{t?.highRiskCapital || 'Capital en alto riesgo de pérdida'}</p>"
);
expenses = expenses.replace(
  />Balance Hist.rico de Cr.ditos<\/h3>/g,
  ">{t?.historicalBalance || 'Balance Histórico de Créditos'}</h3>"
);
expenses = expenses.replace(
  />Rendimiento proyectado y mora de los .ltimos 6 meses<\/p>/g,
  ">{t?.performanceAndArrears || 'Rendimiento proyectado y mora de los últimos 6 meses'}</p>"
);
expenses = expenses.replace(
  />UTILIDAD<\/span>/g,
  ">{t?.profit || 'UTILIDAD'}</span>"
);
expenses = expenses.replace(
  />MORA<\/span>/g,
  ">{t?.arrears || 'MORA'}</span>"
);
expenses = expenses.replace(
  />RENOVACIONES<\/span>/g,
  ">{t?.renewals || 'RENOVACIONES'}</span>"
);
expenses = expenses.replace(
  />C\. NUEVOS<\/span>/g,
  ">{t?.newCredits || 'C. NUEVOS'}</span>"
);
expenses = expenses.replace(
  /\} TOTALES<\/p>/g,
  "} {t?.totals || 'TOTALES'}</p>"
);
expenses = expenses.replace(
  /\} NUEVOS<\/span>/g,
  "} {t?.newLabel || 'NUEVOS'}</span>"
);
expenses = expenses.replace(
  /\} RENOV\.<\/span>/g,
  "} {t?.renovLabel || 'RENOV.'}</span>"
);
expenses = expenses.replace(
  />Historial de Salidas \(Gastos\)<\/h3>/g,
  ">{t?.expensesHistory || 'Historial de Salidas (Gastos)'}</h3>"
);
expenses = expenses.replace(
  />Descripci.n<\/th>/g,
  ">{t?.desc || 'Descripción'}</th>"
);
expenses = expenses.replace(
  />Categor.a<\/th>/g,
  ">{t?.category || 'Categoría'}</th>"
);
expenses = expenses.replace(
  />Fecha<\/th>/g,
  ">{t?.date || 'Fecha'}</th>"
);
expenses = expenses.replace(
  />Monto<\/th>/g,
  ">{t?.amount || 'Monto'}</th>"
);
expenses = expenses.replace(
  />No hay gastos registrados<\/p>/g,
  ">{t?.noExpenses || 'No hay gastos registrados'}</p>"
);
expenses = expenses.replace(
  />Base de Capital<\/h3>/g,
  ">{t?.capitalBase || 'Base de Capital'}</h3>"
);
expenses = expenses.replace(
  />Establecer Capital de Trabajo<\/p>/g,
  ">{t?.setWorkingCapital || 'Establecer Capital de Trabajo'}</p>"
);
expenses = expenses.replace(
  />El capital de trabajo define la base sobre la cual se calcula el flujo de caja\. S.lo los superadministradores deber.an alterar este valor inicial una vez establecidas las operaciones\.<\/p>/g,
  ">{t?.infoText || 'El capital de trabajo define la base...'}  </p>" // simplified regex handling
);
expenses = expenses.replace(
  />ACTUALIZAR CAPITAL<\/button>/g,
  ">{t?.updateCapital || 'ACTUALIZAR CAPITAL'}</button>"
);
expenses = expenses.replace(
  />Registrar Gasto<\/h3>/g,
  ">{t?.registerExpense || 'Registrar Gasto'}</h3>"
);
expenses = expenses.replace(
  />Descripci.n del Gasto<\/label>/g,
  ">{t?.expenseDesc || 'Descripción del Gasto'}</label>"
);
expenses = expenses.replace(
  />Categor.a<\/label>/g,
  ">{t?.category || 'Categoría'}</label>"
);
expenses = expenses.replace(
  />Monto \(\$\)<\/label>/g,
  ">{t?.amountSign || 'Monto ($)'}</label>"
);
expenses = expenses.replace(
  />Fecha<\/label>/g,
  ">{t?.date || 'Fecha'}</label>"
);
expenses = expenses.replace(
  />GUARDAR<\/button>/g,
  ">{t?.save || 'GUARDAR'}</button>"
);

// We need to also translate month names. The months are in `last6Months` which uses `Intl.DateTimeFormat(undefined, { month: 'short' })`
// Let's modify `last6Months` to use `state.settings.language`
expenses = expenses.replace(
  /new Intl\.DateTimeFormat\(undefined, \{ month: 'short' \}\)\.format\(d\)/g,
  "new Intl.DateTimeFormat(state.settings.language || 'es', { month: 'short' }).format(d)"
);

fs.writeFileSync('components/Expenses.tsx', expenses, 'utf8');

// Also modify infoText properly
let expFixed = fs.readFileSync('components/Expenses.tsx', 'utf8');
expFixed = expFixed.replace(
  />El capital de trabajo define la base sobre la cual se calcula el flujo de caja\. S.lo los superadministradores deber.an alterar este valor inicial una vez establecidas las operaciones\.<\/p>/g,
  ">{t?.infoText || 'El capital de trabajo define la base sobre la cual se calcula el flujo de caja. Sólo los superadministradores deberían alterar este valor inicial una vez establecidas las operaciones.'}</p>"
);
fs.writeFileSync('components/Expenses.tsx', expFixed, 'utf8');

console.log('Expenses.tsx localized.');
