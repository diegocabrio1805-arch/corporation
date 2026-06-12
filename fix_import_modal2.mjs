import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('components/Clients.tsx', 'utf8');

// Find and replace the entire import modal block
const startMarker = `{showImportModal && (\n        // ... (existing modal content)\n        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[99999] flex items-start justify-center pt-16 md:pt-24 px-4 animate-fadeIn">`;
const endMarker = `      )}

      {previewData`;

const startIdx = c.indexOf('{showImportModal && (');
if (startIdx < 0) { console.log('ERROR: modal start not found'); process.exit(1); }

const endIdx = c.indexOf('      )}\n\n      {previewData', startIdx);
if (endIdx < 0) { console.log('ERROR: modal end not found'); process.exit(1); }

const modalOld = c.substring(startIdx, endIdx + '      )}'.length);
console.log('Modal block length:', modalOld.length);
console.log('First 100 chars:', modalOld.substring(0, 100));
console.log('Last 50 chars:', modalOld.substring(modalOld.length - 50));

const modalNew = `{showImportModal && (() => {
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
        return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[99999] flex items-start justify-center pt-16 md:pt-24 px-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 w-full max-w-md shadow-2xl relative animate-scaleIn">
            <button 
              onClick={() => setShowImportModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-all font-black text-[10px] uppercase"
            >
              {im.close}
            </button>

            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 text-2xl shadow-inner mx-auto">
              <Upload />
            </div>

            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tighter text-center">{im.title}</h3>
            <p className="text-slate-500 text-[9px] font-bold mb-6 uppercase tracking-widest text-center px-4">
              {im.subtitle}
            </p>
            
            <div className="space-y-4">
              <button 
                onClick={() => downloadExcelTemplate(lang)}
                className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-[10px] flex items-center justify-center gap-2 hover:bg-slate-200 transition-all uppercase tracking-widest border border-slate-200 shadow-sm"
              >
                <Download size={14} /> {im.download}
              </button>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-800 uppercase mb-2">{im.selectCollector}</p>
                <select 
                  className="w-full bg-white border border-emerald-200 rounded-lg p-3 text-xs font-black text-emerald-900 outline-none focus:border-emerald-500 transition-all uppercase"
                  value={selectedCollectorForImport}
                  onChange={(e) => setSelectedCollectorForImport(e.target.value)}
                >
                  <option value="">{im.chooseCollector}</option>
                  {collectors.map(c => (
                    <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <label className={\`w-full py-10 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl transition-all cursor-pointer \${!selectedCollectorForImport ? 'bg-slate-50 border-slate-200 opacity-50 grayscale' : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-500'}\`}>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx, .xls, .xlsb, .json"
                  onChange={handleFileUploadMasivo}
                  disabled={!selectedCollectorForImport || isProcessingExcel}
                />
                {isProcessingExcel ? (
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCcw className="animate-spin text-emerald-600" />
                    <span className="text-[10px] font-black text-emerald-800 uppercase">{im.analyzing}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-emerald-600">
                    <i className="fa-solid fa-file-upload text-3xl mb-2"></i>
                    <span className="text-[10px] font-black uppercase tracking-widest text-center">{im.uploadLine1}<br/>{im.uploadLine2}</span>
                  </div>
                )}
              </label>

              <button 
                onClick={() => setShowImportModal(false)}
                className="w-full py-4 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-xl transition-all"
              >
                {im.cancel}
              </button>
            </div>
          </div>
        </div>
        );
      })()}`;

c = c.substring(0, startIdx) + modalNew + c.substring(startIdx + modalOld.length);
writeFileSync('components/Clients.tsx', c, 'utf8');

// Verify
const result = readFileSync('components/Clients.tsx', 'utf8');
console.log('\n✅ Modal IMPORTATION INTELLIGENTE present:', result.includes('IMPORTATION INTELLIGENTE'));
console.log('✅ im.download used:', result.includes('{im.download}'));
console.log('✅ im.cancel used:', result.includes('{im.cancel}'));
