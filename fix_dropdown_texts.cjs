const fs = require('fs');

let lines = fs.readFileSync('components/Generator/Generator.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('alert("Máximo 8 plantillas permitidas')) {
    lines[i] = lines[i].replace(
      'alert("Máximo 8 plantillas permitidas. Elimine alguna para continuar.");',
      'alert(tg?.maxTemplates || "Máximo 8 plantillas permitidas. Elimine alguna para continuar.");'
    );
  }
  
  if (lines[i].trim() === 'Plantillas' && lines[i-1] && lines[i-1].includes('BookOpen className="w-3 h-3"')) {
    lines[i] = lines[i].replace('Plantillas', '{tg?.templates || "Plantillas"}');
  }

  if (lines[i].trim() === 'Gestionar Plantillas' && lines[i+1] && lines[i+1].includes('</button>')) {
    lines[i] = lines[i].replace('Gestionar Plantillas', '{tg?.manageTemplates || "Gestionar Plantillas"}');
  }
}

fs.writeFileSync('components/Generator/Generator.tsx', lines.join('\n'), 'utf8');
console.log('Fixed dropdown texts using precise line matching.');
