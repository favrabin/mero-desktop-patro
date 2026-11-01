import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const htmlPath = path.join(projectRoot, 'documentation.html');
const pdfPath = path.join(projectRoot, 'Mero_Desktop_Patro_Documentation.pdf');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('Compiling Mero Desktop Patro Complete Documentation to PDF...');

if (!fs.existsSync(htmlPath)) {
  console.error(`Error: HTML documentation not found at ${htmlPath}`);
  process.exit(1);
}

if (!fs.existsSync(chromePath)) {
  console.error(`Error: Google Chrome not found at ${chromePath}`);
  process.exit(1);
}

console.log(`Source: ${htmlPath}`);
console.log(`Target: ${pdfPath}`);
console.log('Invoking Chrome Headless print-to-pdf engine...');

const chromeArgs = [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--no-pdf-header-footer',
  `--print-to-pdf=${pdfPath}`,
  htmlPath
];

const result = spawnSync(chromePath, chromeArgs, { stdio: 'inherit' });

if (fs.existsSync(pdfPath)) {
  const stats = fs.statSync(pdfPath);
  console.log('\n======================================================');
  console.log('SUCCESS: Documentation PDF generated successfully!');
  console.log(`File: ${pdfPath}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB (${stats.size} bytes)`);
  console.log('======================================================\n');
} else {
  console.error('Error: PDF file was not created.');
  process.exit(1);
}
