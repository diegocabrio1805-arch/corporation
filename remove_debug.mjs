import { readFileSync, writeFileSync } from 'fs';

const filePath = './components/Dashboard.tsx';
let content = readFileSync(filePath, 'utf8');

const startTag = `{/* DEBUG BANNER FOR FABIAN */}`;
const endTag = `{/* AUDITORÍA DE RUTAS - Premium Table */}`;

if (content.includes(startTag)) {
  const startIndex = content.indexOf(startTag);
  const endIndex = content.indexOf(endTag) + endTag.length;
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const toRemove = content.substring(startIndex, endIndex);
    content = content.replace(toRemove, endTag);
    writeFileSync(filePath, content, 'utf8');
    console.log('Removed debug banner successfully.');
  } else {
    console.log('Could not find proper bounds for removal.');
  }
} else {
  console.log('Debug banner not found in file.');
}
