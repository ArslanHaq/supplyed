import fs from 'fs';
import path from 'path';

const filesToClean = [
  'auth.ts',
  'types/next-auth.d.ts',
  'features/auth/types.ts',
  'features/auth/backend.ts'
];

for (const file of filesToClean) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const newLines = lines.filter(line => !line.toLowerCase().includes('recruiter'));
    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log(`Cleaned ${file}`);
  }
}
