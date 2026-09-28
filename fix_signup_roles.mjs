import fs from 'fs';

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
  }
  fs.writeFileSync(filePath, content);
}

// 1. features/auth/backend.ts
let authBackend = fs.readFileSync('features/auth/backend.ts', 'utf-8');

// Add toBackendRole
if (!authBackend.includes('export function toBackendRole')) {
  authBackend = authBackend.replace(
    'export function normalizeRole',
    `export function toBackendRole(role?: AppRole | null): string | undefined {\n  if (role === "teacher") return "INSTRUCTOR";\n  if (role === "institution") return "INSTITUTION";\n  return undefined;\n}\n\nexport function normalizeRole`
  );
}

// Update createEmailAccount
authBackend = authBackend.replace(
  '  logBackendPayload(`POST ${backendAuthEndpoints.register}`, {\n    email: input.email,\n    password: input.password,\n    role: input.role,\n  });\n\n  if (backendEnabled()) {\n    return normalizeEmailVerificationChallenge(\n      await api.post<unknown>(backendAuthEndpoints.register, input, { auth: false }),\n      input.email,\n    );\n  }',
  `  const payload = { email: input.email, password: input.password, role: toBackendRole(input.role) };
  logBackendPayload(\`POST \${backendAuthEndpoints.register}\`, payload);

  if (backendEnabled()) {
    return normalizeEmailVerificationChallenge(
      await api.post<unknown>(backendAuthEndpoints.register, payload, { auth: false }),
      input.email,
    );
  }`
);

// Update exchangeOAuthAccount
authBackend = authBackend.replace(
  '  logBackendPayload(`POST ${backendAuthEndpoints.oauthGoogle}`, {\n    email: input.email,\n    image: input.image,\n    name: input.name,\n    provider: input.provider,\n    providerAccountId: input.providerAccountId,\n    providerAccessToken: input.providerAccessToken,\n    providerIdToken: input.providerIdToken,\n  });',
  `  const payload = {
    email: input.email,
    image: input.image,
    name: input.name,
    provider: input.provider,
    providerAccountId: input.providerAccountId,
    providerAccessToken: input.providerAccessToken,
    providerIdToken: input.providerIdToken,
    role: toBackendRole(input.role),
  };
  logBackendPayload(\`POST \${backendAuthEndpoints.oauthGoogle}\`, payload);`
);

authBackend = authBackend.replace(
  '      await api.post<unknown>(backendAuthEndpoints.oauthGoogle, { credential: input.providerIdToken }, { auth: false }),',
  '      await api.post<unknown>(backendAuthEndpoints.oauthGoogle, { credential: input.providerIdToken, role: toBackendRole(input.role) }, { auth: false }),'
);

fs.writeFileSync('features/auth/backend.ts', authBackend);


// 2. features/auth/types.ts
replaceInFile('features/auth/types.ts', [
  [
    '  providerIdToken?: string;\n};',
    '  providerIdToken?: string;\n  role?: AppRole | null;\n};'
  ]
]);

// 3. auth.ts
replaceInFile('auth.ts', [
  [
    'import { readUnverifiedJwtExpiresAt, readUnverifiedJwtPayload } from "@/lib/server/jwt";',
    'import { readUnverifiedJwtExpiresAt, readUnverifiedJwtPayload } from "@/lib/server/jwt";\nimport { cookies } from "next/headers";'
  ],
  [
    '            providerIdToken: account.id_token,\n          });',
    '            providerIdToken: account.id_token,\n            role: (await cookies()).get("supplyed_signup_role")?.value as any,\n          });\n          (await cookies()).delete("supplyed_signup_role");'
  ]
]);

// 4. components/organisms/SignupRouteClient.tsx
replaceInFile('components/organisms/SignupRouteClient.tsx', [
  [
    '  function startSocialAuth(provider: "google" | "microsoft-entra-id") {\n    if (!isSocialProviderAvailable(provider, socialAuth)) {',
    '  function startSocialAuth(provider: "google" | "microsoft-entra-id", role?: AppRole | null) {\n    if (!isSocialProviderAvailable(provider, socialAuth)) {'
  ],
  [
    '    startRouteLoading();\n    void signIn(provider, { redirectTo: "/post-auth?authSource=signup" }).catch((error) => {',
    '    if (role) document.cookie = `supplyed_signup_role=${role}; path=/; max-age=3600`;\n    startRouteLoading();\n    void signIn(provider, { redirectTo: "/post-auth?authSource=signup" }).catch((error) => {'
  ]
]);

// 5. components/organisms/SignupAccessPage.tsx
let accessPage = fs.readFileSync('components/organisms/SignupAccessPage.tsx', 'utf-8');

accessPage = accessPage.replace(
  '          onGoogleAuth={() => startSocialAuth("google")}',
  '          onGoogleAuth={() => startSocialAuth("google", role)}'
);
accessPage = accessPage.replace(
  '          onMicrosoftAuth={() => startSocialAuth("microsoft-entra-id")}',
  '          onMicrosoftAuth={() => startSocialAuth("microsoft-entra-id", role)}'
);
accessPage = accessPage.replace(
  '            <SocialAuthButtons\n              available={socialAuth}\n              disabled={pending}\n              intent="signup"\n              onGoogle={onGoogleAuth}\n              onMicrosoft={onMicrosoftAuth}\n            />',
  `            {role ? (
              <SocialAuthButtons
                available={socialAuth}
                disabled={pending}
                intent="signup"
                onGoogle={onGoogleAuth}
                onMicrosoft={onMicrosoftAuth}
              />
            ) : null}`
);

fs.writeFileSync('components/organisms/SignupAccessPage.tsx', accessPage);

console.log('Update completed');
