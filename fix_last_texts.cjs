const fs = require('fs');

let fileContent = fs.readFileSync('components/Generator/Generator.tsx', 'utf8');

fileContent = fileContent.replace(
  'alert("M\u00E1ximo 8 plantillas permitidas. Elimine alguna para continuar.");',
  'alert(tg?.maxTemplates || "M\u00E1ximo 8 plantillas permitidas. Elimine alguna para continuar.");'
);

fileContent = fileContent.replace(
  '<BookOpen className="w-3 h-3" />\n                                        Plantillas\n                                        <ChevronDown className="w-2.5 h-2.5" />',
  '<BookOpen className="w-3 h-3" />\n                                        {tg?.templates || "Plantillas"}\n                                        <ChevronDown className="w-2.5 h-2.5" />'
);

fileContent = fileContent.replace(
  '<p className="text-[8px] font-bold text-slate-400 uppercase">Sin plantillas</p>',
  '<p className="text-[8px] font-bold text-slate-400 uppercase">{tg?.noTemplates || "Sin plantillas"}</p>'
);

fileContent = fileContent.replace(
  'Gestionar Plantillas\n                                              </button>',
  '{tg?.manageTemplates || "Gestionar Plantillas"}\n                                              </button>'
);

fs.writeFileSync('components/Generator/Generator.tsx', fileContent, 'utf8');
console.log('Final missing texts replaced.');
