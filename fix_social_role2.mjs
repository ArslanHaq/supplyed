import fs from 'fs';

// Revert SignupAccessPage.tsx - keep onGoogleAuth/onMicrosoftAuth as () => void
// but set cookie in the component before calling them
let accessPage = fs.readFileSync('components/organisms/SignupAccessPage.tsx', 'utf-8');

// Revert prop types back to () => void
accessPage = accessPage.replace(
  `  onGoogleAuth: (role: AppRole | null) => void;\r\n  onMicrosoftAuth: (role: AppRole | null) => void;`,
  `  onGoogleAuth: () => void;\r\n  onMicrosoftAuth: () => void;`
);

// Revert passthrough calls back to original
accessPage = accessPage.replace(
  `          onGoogleAuth={() => onGoogleAuth(role)}\n`,
  `          onGoogle={onGoogleAuth}\n`
);
accessPage = accessPage.replace(
  `          onMicrosoftAuth={() => onMicrosoftAuth(role)}\n`,
  `          onMicrosoft={onMicrosoftAuth}\n`
);

// The SocialAuthButtons already has onGoogle={onGoogleAuth} and onMicrosoft={onMicrosoftAuth}
// We need to intercept at the SocialAuthButtons level instead.
// Replace the SocialAuthButtons block to wrap each handler with cookie-setting logic
const oldButtons = `            <SocialAuthButtons\r\n              available={socialAuth}\r\n              disabled={pending}\r\n              intent="signup"\r\n              onGoogle={onGoogleAuth}\r\n              onMicrosoft={onMicrosoftAuth}\r\n            />`;

const newButtons = `            <SocialAuthButtons
              available={socialAuth}
              disabled={pending}
              intent="signup"
              onGoogle={() => {
                if (role) document.cookie = \`supplyed_signup_role=\${role}; path=/; max-age=3600; SameSite=Lax\`;
                onGoogleAuth();
              }}
              onMicrosoft={() => {
                if (role) document.cookie = \`supplyed_signup_role=\${role}; path=/; max-age=3600; SameSite=Lax\`;
                onMicrosoftAuth();
              }}
            />`;

accessPage = accessPage.replace(oldButtons, newButtons);
fs.writeFileSync('components/organisms/SignupAccessPage.tsx', accessPage);
console.log('Updated SignupAccessPage');

// Revert SignupRouteClient.tsx - restore original handlers (they don't need role param anymore)
let routeClient = fs.readFileSync('components/organisms/SignupRouteClient.tsx', 'utf-8');

// Remove role param from startSocialAuth
routeClient = routeClient.replace(
  `  function startSocialAuth(provider: "google" | "microsoft-entra-id", role?: AppRole | null) {\r\n    if (!isSocialProviderAvailable(provider, socialAuth)) {`,
  `  function startSocialAuth(provider: "google" | "microsoft-entra-id") {\r\n    if (!isSocialProviderAvailable(provider, socialAuth)) {`
);

// Remove cookie logic from startSocialAuth (cookie is now set in SignupAccessPage)
routeClient = routeClient.replace(
  `    if (role) {\r\n      document.cookie = \`supplyed_signup_role=\${role}; path=/; max-age=3600; SameSite=Lax\`;\r\n    }\r\n    startRouteLoading();\r\n    void signIn(provider, { redirectTo: "/post-auth?authSource=signup" }).catch((error) => {`,
  `    startRouteLoading();\r\n    void signIn(provider, { redirectTo: "/post-auth?authSource=signup" }).catch((error) => {`
);

// Revert props back to () => void
routeClient = routeClient.replace(
  `          onGoogleAuth={(role) => startSocialAuth("google", role)}`,
  `          onGoogleAuth={() => startSocialAuth("google")}`
);
routeClient = routeClient.replace(
  `          onMicrosoftAuth={(role) => startSocialAuth("microsoft-entra-id", role)}`,
  `          onMicrosoftAuth={() => startSocialAuth("microsoft-entra-id")}`
);

// Remove AppRole from imports if it was added
routeClient = routeClient.replace(
  'import type { AppRole, SocialAuthAvailability } from "@/types/supplyed";',
  'import type { SocialAuthAvailability } from "@/types/supplyed";'
);

fs.writeFileSync('components/organisms/SignupRouteClient.tsx', routeClient);
console.log('Updated SignupRouteClient');
