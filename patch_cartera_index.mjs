import { readFileSync, writeFileSync } from 'fs';

const filePath = './components/Clients.tsx';
let content = readFileSync(filePath, 'utf8');

// 1. Replace the map to include the index `idx`
const oldMap = `{(Array.isArray(carteraExcelData) ? carteraExcelData : []).slice(0, displayLimit).map(client => (\r
                      <tr key={client.id} className="hover:bg-slate-50 transition-colors">\r
                        <td className="px-6 py-4 text-slate-500 uppercase">{client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '---'}</td>`;

const newMap = `{(Array.isArray(carteraExcelData) ? carteraExcelData : []).slice(0, displayLimit).map((client, idx) => (\r
                      <tr key={client.id} className="hover:bg-slate-50 transition-colors">\r
                        <td className="px-6 py-4 text-slate-500 uppercase">\r
                          <div className="flex items-center gap-2">\r
                            <span className="text-[9px] font-black text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{idx + 1}</span>\r
                            <span>{client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '---'}</span>\r
                          </div>\r
                        </td>`;

if (content.includes(oldMap)) {
  content = content.replace(oldMap, newMap);
  writeFileSync(filePath, content, 'utf8');
  console.log('Enumeration added to CARTERA table.');
} else {
  console.log('ERROR: Could not find map code to replace.');
}
