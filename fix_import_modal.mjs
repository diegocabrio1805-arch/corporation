import { readFileSync, writeFileSync } from 'fs';

// ── PATCH 1: Clients.tsx – import modal ──────────────────────────────────────
let clientsContent = readFileSync('components/Clients.tsx', 'utf8');

const modalOld = `      {showImportModal && (`;

const modalNew = `      {showImportModal && (() => {
        const lang = state.settings.language;
        const isFrM = lang === 'fr';
        const isPtM = lang === 'pt';
        const im = {
          close:           isFrM ? 'FERMER' : isPtM ? 'FECHAR' : 'CERRAR',
          title:           isFrM ? 'IMPORTATION INTELLIGENTE' : isPtM ? 'IMPORTAÇÃO INTELIGENTE' : 'IMPORTACIÓN INTELIGENTE',
          subtitle:        isFrM ? 'Reconnaissance universelle des en-têtes (ID, Montant, Intérêt, Échéances).' : isPtM ? 'Reconhecimento universal de cabeçalhos (ID, Valor, Juros, Parcelas).' : 'Reconocimiento universal de encabezados (ID, Monto, Interés, Cuotas).',
          download:        isFrM ? 'TÉLÉCHARGER MODÈLE EXEMPLE' : isPtM ? 'BAIXAR PLANILHA MODELO' : 'DESCARGAR PLANTILLA MUESTRA',
          selectCollector: isFrM ? 'SÉLECTIONNER COLLECTEUR / ROUTE' : isPtM ? 'SELECIONAR COBRADOR / ROTA' : 'SELECCIONAR COBRADOR / RUTA',
          chooseCollector: isFrM ? '-- CHOISIR UN COLLECTEUR --' : isPtM ? '-- ESCOLHA UM COBRADOR --' : '-- ELIJA UN COBRADOR --',
          analyzing:       isFrM ? 'Analyse en cours...' : isPtM ? 'Analisando...' : 'Analizando...',
          uploadLine1:     isFrM ? 'TÉLÉCHARGER FICHIER EXCEL (XLSX, XLS),' : isPtM ? 'ENVIAR PLANILHA EXCEL (XLSX, XLS),' : 'SUBIR PLANILLA EXCEL (XLSX, XLS),',
          uploadLine2:     isFrM ? 'XLSB OU FICHIER JSON' : isPtM ? 'XLSB OU ARQUIVO JSON' : 'XLSB o Archivo JSON',
          cancel:          isFrM ? "ANNULER L'OPÉRATION" : isPtM ? 'CANCELAR OPERAÇÃO' : 'CANCELAR OPERACIÓN',
        };
        return (`;

// Patch the opening tag
if (clientsContent.includes(modalOld)) {
  clientsContent = clientsContent.replace(modalOld, modalNew);
  console.log('Patched modal opening tag.');
} else {
  console.log('ERROR: Could not find modal opening tag.');
  process.exit(1);
}

// Patch the closing tag  )}
const closingOld = `      )}

      {previewData`;
const closingNew = `        );
      })()}

      {previewData`;

if (clientsContent.includes(closingOld)) {
  clientsContent = clientsContent.replace(closingOld, closingNew);
  console.log('Patched modal closing tag.');
} else {
  console.log('ERROR: Could not find modal closing tag.');
  process.exit(1);
}

// Now patch all hardcoded strings inside the modal
// We need to replace the content between the two markers
// Let's do targeted replacements

const replacements = [
  ['Cerrar\n            </button>', '{im.close}\n            </button>'],
  ['>Importación Inteligente</h3>', '>{im.title}</h3>'],
  ['Reconocimiento universal de encabezados (ID, Monto, Interés, Cuotas).', '{im.subtitle}'],
  ['onClick={() => downloadExcelTemplate()}', 'onClick={() => downloadExcelTemplate(lang)}'],
  ['<Download size={14} /> Descargar Plantilla Muestra', '<Download size={14} /> {im.download}'],
  ['>Seleccionar Cobrador / Ruta</p>', '>{im.selectCollector}</p>'],
  ['<option value="">-- ELIJA UN COBRADOR --</option>', '<option value="">{im.chooseCollector}</option>'],
  ['>Analizando...</span>', '>{im.analyzing}</span>'],
  [">Subir Planilla EXCEL (XLSX, XLS),<br/> XLSB o Archivo JSON</span>", '>{im.uploadLine1}<br/>{im.uploadLine2}</span>'],
  ['Cancelar Operación\n              </button>', '{im.cancel}\n              </button>'],
];

for (const [old, replacement] of replacements) {
  if (clientsContent.includes(old)) {
    clientsContent = clientsContent.replace(old, replacement);
    console.log(`Replaced: ${old.substring(0, 50)}...`);
  } else {
    console.warn(`WARNING: Could not find: ${old.substring(0, 80)}`);
  }
}

writeFileSync('components/Clients.tsx', clientsContent, 'utf8');
console.log('\n✅ Clients.tsx modal patched successfully!');

// ── PATCH 2: excelHelper.ts – downloadExcelTemplate ─────────────────────────
let excelContent = readFileSync('utils/excelHelper.ts', 'utf8');

const templateOld = `export const downloadExcelTemplate = () => {
    const headers = [
        "DOCUMENTO", "NOMBRE COMPLETO", "TELEFONO", "DIRECCION", 
        "MONTO PRESTADO", "VALOR CUOTA", "TOTAL A PAGAR", "MONTO COBRADO",
        "SALDO PENDIENTE", "CUOTAS TOTALES", "CUOTAS PAGADAS", 
        "FECHA INICIO", "VENDEDOR"
    ];
    
    // Plantilla de ejemplo con matemática correcta
    const exampleData = [
        [
            "1234567", "JUAN PEREZ", "0981123456", "CALLE FALSA 123", 
            2000000, 100000, 2400000, 1200000,
            1200000, 24, 12,
            "13/03/2026", "VEND-01"
        ]
    ];

    const data = [headers, ...exampleData];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla Importacion");

    // Estilos basicos para la cabecera
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1";
        if (!worksheet[address]) continue;
        worksheet[address].s = {
            fill: { fgColor: { rgb: "0F172A" } },
            font: { color: { rgb: "FFFFFF" }, bold: true },
            alignment: { horizontal: "center" }
        };
    }

    XLSX.writeFile(workbook, "Plantilla_Anexo_Cobros.xlsx");
};`;

const templateNew = `export const downloadExcelTemplate = (lang: string = 'es') => {
    const isFr = lang === 'fr';
    const isPt = lang === 'pt';

    const headers = isFr ? [
        "DOCUMENT", "NOM COMPLET", "TÉLÉPHONE", "ADRESSE",
        "MONTANT PRÊTÉ", "VALEUR ÉCHÉANCE", "TOTAL À PAYER", "MONTANT PERÇU",
        "SOLDE RESTANT", "ÉCHÉANCES TOTALES", "ÉCHÉANCES PAYÉES",
        "DATE DÉBUT", "VENDEUR"
    ] : isPt ? [
        "DOCUMENTO", "NOME COMPLETO", "TELEFONE", "ENDEREÇO",
        "VALOR EMPRESTADO", "VALOR PARCELA", "TOTAL A PAGAR", "VALOR COBRADO",
        "SALDO PENDENTE", "PARCELAS TOTAIS", "PARCELAS PAGAS",
        "DATA INÍCIO", "VENDEDOR"
    ] : [
        "DOCUMENTO", "NOMBRE COMPLETO", "TELEFONO", "DIRECCION",
        "MONTO PRESTADO", "VALOR CUOTA", "TOTAL A PAGAR", "MONTO COBRADO",
        "SALDO PENDIENTE", "CUOTAS TOTALES", "CUOTAS PAGADAS",
        "FECHA INICIO", "VENDEDOR"
    ];

    const exampleName = isFr ? "JEAN DUPONT" : isPt ? "JOÃO SILVA" : "JUAN PEREZ";
    const exampleAddr = isFr ? "123 RUE PRINCIPALE" : isPt ? "RUA FALSA 123" : "CALLE FALSA 123";
    const sheetName = isFr ? "Modèle Importation" : isPt ? "Modelo Importação" : "Plantilla Importacion";
    const fileName = isFr ? "Modele_Anexo_Cobros.xlsx" : isPt ? "Modelo_Anexo_Cobros.xlsx" : "Plantilla_Anexo_Cobros.xlsx";

    const exampleData = [[
        "1234567", exampleName, "0981123456", exampleAddr,
        2000000, 100000, 2400000, 1200000,
        1200000, 24, 12,
        "13/03/2026", "VEND-01"
    ]];

    const data = [headers, ...exampleData];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1";
        if (!worksheet[address]) continue;
        worksheet[address].s = {
            fill: { fgColor: { rgb: "0F172A" } },
            font: { color: { rgb: "FFFFFF" }, bold: true },
            alignment: { horizontal: "center" }
        };
    }

    XLSX.writeFile(workbook, fileName);
};`;

if (excelContent.includes(templateOld)) {
  excelContent = excelContent.replace(templateOld, templateNew);
  writeFileSync('utils/excelHelper.ts', excelContent, 'utf8');
  console.log('✅ excelHelper.ts downloadExcelTemplate patched successfully!');
} else {
  console.log('ERROR: Could not find downloadExcelTemplate function in excelHelper.ts');
}
