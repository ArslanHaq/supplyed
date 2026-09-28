import fs from 'fs';

const filePath = 'features/auth/backend.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// Fix createEmailAccount - replace input with proper payload using toBackendRole
const oldRegister = `export async function createEmailAccount(input: SignupInput): Promise<EmailVerificationChallenge> {\r\n  logBackendPayload(\`POST \${backendAuthEndpoints.register}\`, {\r\n    email: input.email,\r\n    password: input.password,\r\n    role: input.role,\r\n  });\r\n\r\n  if (backendEnabled()) {\r\n    return normalizeEmailVerificationChallenge(\r\n      await api.post<unknown>(backendAuthEndpoints.register, input, { auth: false }),\r\n      input.email,\r\n    );\r\n  }`;

const newRegister = `export async function createEmailAccount(input: SignupInput): Promise<EmailVerificationChallenge> {\r\n  const payload = {\r\n    email: input.email,\r\n    password: input.password,\r\n    role: toBackendRole(input.role),\r\n  };\r\n\r\n  logBackendPayload(\`POST \${backendAuthEndpoints.register}\`, payload);\r\n\r\n  if (backendEnabled()) {\r\n    return normalizeEmailVerificationChallenge(\r\n      await api.post<unknown>(backendAuthEndpoints.register, payload, { auth: false }),\r\n      input.email,\r\n    );\r\n  }`;

if (!content.includes(oldRegister)) {
  console.error('Pattern not found! Checking raw content around line 351...');
  const lines = content.split('\n');
  for (let i = 349; i < 365; i++) {
    console.log(JSON.stringify(lines[i]));
  }
  process.exit(1);
}

content = content.replace(oldRegister, newRegister);
fs.writeFileSync(filePath, content);
console.log('Fixed createEmailAccount to use toBackendRole');
