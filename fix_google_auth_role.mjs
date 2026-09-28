import fs from 'fs';

const filePath = 'auth.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the exchangeOAuthAccount call to include role from cookie
const oldExchange = `        try {\r\n          const response = await exchangeOAuthAccount({\r\n            email,\r\n            image: user?.image ?? token.picture ?? null,\r\n            name: user?.name ?? token.name ?? null,\r\n            provider,\r\n            providerAccessToken: account.access_token,\r\n            providerAccountId: account.providerAccountId,\r\n            providerIdToken: account.id_token,\r\n          });`;

const newExchange = `        try {\r\n          const cookieStore = await cookies();\r\n          const signupRole = (cookieStore.get("supplyed_signup_role")?.value as import("@/types/supplyed").AppRole | undefined) ?? null;\r\n          if (signupRole) cookieStore.delete("supplyed_signup_role");\r\n          const response = await exchangeOAuthAccount({\r\n            email,\r\n            image: user?.image ?? token.picture ?? null,\r\n            name: user?.name ?? token.name ?? null,\r\n            provider,\r\n            providerAccessToken: account.access_token,\r\n            providerAccountId: account.providerAccountId,\r\n            providerIdToken: account.id_token,\r\n            role: signupRole,\r\n          });`;

if (!content.includes(oldExchange)) {
  console.error('Pattern not found!');
  const lines = content.split('\n');
  for (let i = 198; i < 215; i++) {
    console.log(i, JSON.stringify(lines[i]));
  }
  process.exit(1);
}

content = content.replace(oldExchange, newExchange);
fs.writeFileSync(filePath, content);
console.log('Fixed Google OAuth exchange to pass role from cookie');
