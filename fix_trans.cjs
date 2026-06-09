const fs = require('fs');
const file = 'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\utils\\\\translations.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /\s*clients: \{\s*title: '[^']+',\s*search: '[^']+',\s*(list: \{\s*newClient: '[^']+',\s*total: '[^']+',\s*viewing: '[^']+',\s*balance: '[^']+',\s*installments: '[^']+',\s*paid: '[^']+',\s*overdue: '[^']+',\s*credits: '[^']+',\s*dossier: '[^']+',\s*days: '[^']+'\s*\})\s*\},/g;

let matches = [];
let match;
while ((match = regex.exec(content)) !== null) {
  matches.push(match[1]);
}

if (matches.length === 4) {
  content = content.replace(regex, '');
  
  let i = 0;
  content = content.replace(/clients: \{\s*title:/g, (m) => {
    return `clients: {\n      ${matches[i++]},\n      title:`;
  });
  
  fs.writeFileSync(file, content);
  console.log('Fixed successfully.');
} else {
  console.log('Matches found: ' + matches.length);
}
