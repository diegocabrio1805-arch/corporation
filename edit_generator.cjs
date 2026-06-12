const fs = require('fs');

let fileContent = fs.readFileSync('components/Generator/Generator.tsx', 'utf8');

// Add import if not present
if (!fileContent.includes('getTranslation')) {
  fileContent = fileContent.replace(
    "import { AppSettings } from '../../types';",
    "import { AppSettings } from '../../types';\nimport { getTranslation } from '../../utils/translations';"
  );
}

// Add t and tg initialization
fileContent = fileContent.replace(
  "const Generator: React.FC<GeneratorProps> = ({ settings }) => {",
  "const Generator: React.FC<GeneratorProps> = ({ settings }) => {\n    const t = getTranslation(settings?.language || 'es');\n    const tg = t.generator;"
);

// Array of replacements [regex/string, replacement]
const replacements = [
  // Header / Title
  [">Generador de Pagarés</h1>", ">{tg?.title || 'Generador de Pagarés'}</h1>"],
  [">v1.1.0 Pro Standalone</p>", ">{tg?.subtitle || 'v1.1.0 Pro Standalone'}</p>"],
  
  // Sidebar Tabs
  ["Historial</button>", "{tg?.history || 'Historial'}</button>"],
  ["Plantillas</button>", "{tg?.templates || 'Plantillas'}</button>"],
  
  // Sidebar Search & Empty States
  ['placeholder="Buscar..."', 'placeholder={tg?.search || "Buscar..."}'],
  [">Sin plantillas</p>", ">{tg?.noTemplates || 'Sin plantillas'}</p>"],
  [">Guarda el texto actual como plantilla para verlo aquí.</p>", ">{tg?.saveAsTemplateTip || 'Guarda el texto actual como plantilla para verlo aquí.'}</p>"],
  [">Mis Plantillas</p>", ">{tg?.myTemplates || 'Mis Plantillas'}</p>"],
  [">Gestionar Plantillas</button>", ">{tg?.manageTemplates || 'Gestionar Plantillas'}</button>"],

  // Document Types
  [">Pagaré</button>", ">{tg?.promissoryNote || 'Pagaré'}</button>"],
  [">Recibo</button>", ">{tg?.receipt || 'Recibo'}</button>"],

  // Form Labels & Inputs
  [">Monto Principal</label>", ">{tg?.principalAmount || 'Monto Principal'}</label>"],
  ["SON: {formData.amountInWords || 'CERO'}", "{tg?.amountInWordsPrefix || 'SON'}: {formData.amountInWords || 'CERO'}"],
  [">Fechas del Documento</label>", ">{tg?.documentDates || 'Fechas del Documento'}</label>"],
  [">Fecha Emisión</label>", ">{tg?.issueDate || 'Fecha Emisión'}</label>"],
  [">Fecha Vencimiento</label>", ">{tg?.dueDate || 'Fecha Vencimiento'}</label>"],
  ['placeholder="Número de Folio / Referencia"', 'placeholder={tg?.folioRef || "Número de Folio / Referencia"}'],
  
  ["{formData.type === DocumentType.PAGARE ? 'Nombre del Deudor' : 'De (Nombre Pagador)'}", "{formData.type === DocumentType.PAGARE ? (tg?.debtorName || 'Nombre del Deudor') : (tg?.payerName || 'De (Nombre Pagador)')}"],
  ['placeholder="EJ: JUAN PÉREZ"', 'placeholder={tg?.ejJuan || "EJ: JUAN PÉREZ"}'],
  
  [">Cédula / Documento</label>", ">{tg?.documentId || 'Cédula / Documento'}</label>"],
  ['placeholder="EJ: 4.567.890"', 'placeholder={tg?.ejDoc || "EJ: 4.567.890"}'],
  
  ["{formData.type === DocumentType.PAGARE ? 'Nombre del Beneficiario' : 'Para (Nombre Quien Recibe)'}", "{formData.type === DocumentType.PAGARE ? (tg?.beneficiaryName || 'Nombre del Beneficiario') : (tg?.receiverName || 'Para (Nombre Quien Recibe)')}"],
  ['placeholder="EJ: PRESTAMASTER"', 'placeholder={tg?.ejBeneficiary || "EJ: PRESTAMASTER"}'],
  
  [">Concepto / Motivo</label>", ">{tg?.concept || 'Concepto / Motivo'}</label>"],
  ['placeholder="EJ: PRESTAMO PERSONAL"', 'placeholder={tg?.ejConcept || "EJ: PRESTAMO PERSONAL"}'],
  
  ["Redacción del Documento</label>", "{tg?.documentRedaction || 'Redacción del Documento'}</label>"],
  ["Guardar como Plantilla</button>", "{tg?.saveAsTemplate || 'Guardar como Plantilla'}</button>"],
  ['placeholder="Redacte el contenido aquí..."', 'placeholder={tg?.redactHere || "Redacte el contenido aquí..."}'],

  // Action Buttons
  ["> Generar PDF</button>", "> {tg?.generatePdf || 'Generar PDF'}</button>"],
  ["> Imprimir Ticket</button>", "> {tg?.printTicket || 'Imprimir Ticket'}</button>"],

  // Paper Sizes
  ["Papel A4</button>", "{tg?.paperA4 || 'Papel A4'}</button>"],
  ["Papel Oficio</button>", "{tg?.paperOficio || 'Papel Oficio'}</button>"],
  ["Térmico 58mm</button>", "{tg?.paperThermal || 'Térmico 58mm'}</button>"],
  ["{paperSize === 'A4' ? 'A4' : paperSize === 'Oficio' ? 'Oficio' : 'Térmico'}", "{paperSize === 'A4' ? (tg?.a4 || 'A4') : paperSize === 'Oficio' ? (tg?.oficio || 'Oficio') : (tg?.thermal || 'Térmico')}"],

  // Header specific elements
  ["title={connectedDevice ? `Conectado a: ${connectedDevice}` : 'Vincular Impresora'}", "title={connectedDevice ? `${t.settingsPage?.linked || 'Conectado a:'} ${connectedDevice}` : (t.settingsPage?.linkPrinterTitle || 'Vincular Impresora')}"],
  ["{connectedDevice ? 'Conectado' : 'Vincular'}", "{connectedDevice ? 'Conectado' : (t.settingsPage?.linkPrinterTitle?.split(' ')[0] || 'Vincular')}"],
  ["Guardar</button>", "{t.common?.save || 'Guardar'}</button>"]
];

replacements.forEach(([search, replace]) => {
  fileContent = fileContent.replace(search, replace);
});

// Printer Modal Replacements
fileContent = fileContent.replace(
  ">Vincular Impresora</h3>",
  ">{t.settingsPage?.linkPrinterTitle || 'Vincular Impresora'}</h3>"
);

fileContent = fileContent.replace(
  "> BUSCANDO...</>",
  "> {t.settingsPage?.searching || 'BUSCANDO...'}</>"
);

fileContent = fileContent.replace(
  "> BUSCAR VINCULADOS</>",
  "> {t.settingsPage?.searchLinkedBtn || 'BUSCAR VINCULADOS'}</>"
);

fileContent = fileContent.replace(
  ">No se encontraron dispositivos</p>",
  ">{t.settingsPage?.noDevicesFound || 'No se encontraron dispositivos'}</p>"
);

fileContent = fileContent.replace(
  ">Asegúrate de haber vinculado tu impresora en los ajustes del sistema.</p>",
  ">{t.settingsPage?.printerBluetoothHint || 'Asegúrate de haber vinculado tu impresora en los ajustes del sistema.'}</p>"
);

fileContent = fileContent.replace(
  "{dev.name || 'Desconocido'}",
  "{dev.name || (t.settingsPage?.unknownDevice || 'Desconocido')}"
);

fs.writeFileSync('components/Generator/Generator.tsx', fileContent, 'utf8');
console.log('Generator.tsx updated successfully.');
