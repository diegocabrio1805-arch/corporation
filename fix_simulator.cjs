const fs = require('fs');

let sim = fs.readFileSync('components/Simulator.tsx', 'utf8');

// Replace the translation init
sim = sim.replace(
  /const t = getTranslation\('es'\)\.simulator;/g,
  "const trans = getTranslation(settings?.language || 'es');\n   const t = trans.simulator;"
);

// Labels
sim = sim.replace(
  />Capital<\/label>/g,
  ">{t.principal || 'Capital'}</label>"
);

sim = sim.replace(
  />Int \%<\/label>/g,
  ">{t.interest || 'Int %'}</label>"
);

sim = sim.replace(
  />Cuotas<\/label>/g,
  ">{t.installments || 'Cuotas'}</label>"
);

sim = sim.replace(
  />Frecuencia<\/label>/g,
  ">{t.frequency || 'Frecuencia'}</label>"
);

sim = sim.replace(
  />Utilidad Estimada<\/p>/g,
  ">{t.profit || 'Utilidad Estimada'}</p>"
);

sim = sim.replace(
  />Cuota Estimada<\/p>/g,
  ">{t.installmentValue || 'Cuota Estimada'}</p>"
);

sim = sim.replace(
  />Monto Total<\/p>/g,
  ">{t.totalPay || 'Monto Total'}</p>"
);

sim = sim.replace(
  />Finaliza<\/p>/g,
  ">{t.endDate || 'Finaliza'}</p>"
);

sim = sim.replace(
  />Amortizaci.n Preliminar<\/h3>/g,
  ">{t.plan || 'Amortización Preliminar'}</h3>"
);

// Frequencies inside mapping
sim = sim.replace(
  />\s*\{freq\}\s*<\/button>/g,
  ">{(trans as any).generator?.frequencies?.[freq] || freq}</button>"
);

// Frequency badge in header
sim = sim.replace(
  /\{frequency\}/g,
  "{(trans as any).generator?.frequencies?.[frequency] || frequency}"
);

// {simulation.table.length} CUOTAS
sim = sim.replace(
  /\{simulation\.table\.length\} CUOTAS/g,
  "{simulation.table.length} {t.installments || 'CUOTAS'}"
);

fs.writeFileSync('components/Simulator.tsx', sim, 'utf8');
console.log('Simulator translation complete.');
