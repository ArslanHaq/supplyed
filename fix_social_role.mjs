import fs from 'fs';

// 1. Fix SignupAccessPage.tsx - store role in cookie when Google is clicked
let accessPage = fs.readFileSync('components/organisms/SignupAccessPage.tsx', 'utf-8');

// Update onGoogleAuth handler to be called with role
accessPage = accessPage.replace(
  `  onGoogleAuth: () => void;\r\n  onMicrosoftAuth: () => void;`,
  `  onGoogleAuth: (role: AppRole | null) => void;\r\n  onMicrosoftAuth: (role: AppRole | null) => void;`
);

// Update the button click to pass role
accessPage = accessPage.replace(
  `          onGoogleAuth={onGoogleAuth}\n`,
  `          onGoogleAuth={() => onGoogleAuth(role)}\n`
);
accessPage = accessPage.replace(
  `          onMicrosoftAuth={onMicrosoftAuth}\n`,
  `          onMicrosoftAuth={() => onMicrosoftAuth(role)}\n`
);

fs.writeFileSync('components/organisms/SignupAccessPage.tsx', accessPage);
console.log('Updated SignupAccessPage');

// 2. Fix SignupRouteClient.tsx - update startSocialAuth to accept and use role
let routeClient = fs.readFileSync('components/organisms/SignupRouteClient.tsx', 'utf-8');

// Import AppRole type
if (!routeClient.includes('AppRole')) {
  routeClient = routeClient.replace(
    'import type { SocialAuthAvailability } from "@/types/supplyed";',
    'import type { AppRole, SocialAuthAvailability } from "@/types/supplyed";'
  );
}

// Update function signature
routeClient = routeClient.replace(
  `  function startSocialAuth(provider: "google" | "microsoft-entra-id") {\r\n    if (!isSocialProviderAvailable(provider, socialAuth)) {`,
  `  function startSocialAuth(provider: "google" | "microsoft-entra-id", role?: AppRole | null) {\r\n    if (!isSocialProviderAvailable(provider, socialAuth)) {`
);

// Store role in cookie before redirect
routeClient = routeClient.replace(
  `    startRouteLoading();\r\n    void signIn(provider, { redirectTo: "/post-auth?authSource=signup" }).catch((error) => {`,
  `    if (role) {\r\n      document.cookie = \`supplyed_signup_role=\${role}; path=/; max-age=3600; SameSite=Lax\`;\r\n    }\r\n    startRouteLoading();\r\n    void signIn(provider, { redirectTo: "/post-auth?authSource=signup" }).catch((error) => {`
);

// Update calls to pass role
routeClient = routeClient.replace(
  `          onGoogleAuth={() => startSocialAuth("google")}`,
  `          onGoogleAuth={(role) => startSocialAuth("google", role)}`
);
routeClient = routeClient.replace(
  `          onMicrosoftAuth={() => startSocialAuth("microsoft-entra-id")}`,
  `          onMicrosoftAuth={(role) => startSocialAuth("microsoft-entra-id", role)}`
);

fs.writeFileSync('components/organisms/SignupRouteClient.tsx', routeClient);
console.log('Updated SignupRouteClient');
