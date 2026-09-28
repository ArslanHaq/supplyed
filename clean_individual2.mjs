import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
  }
  fs.writeFileSync(filePath, content);
}

// 1. components/organisms/SettingsPage.tsx
let settingsPage = fs.readFileSync('components/organisms/SettingsPage.tsx', 'utf-8');
// Remove the false ? () block for individual profile settings
settingsPage = settingsPage.replace(/\{false \? \([\s\S]*?\) : null\}/, '');
// Remove the false ? () block in the aside
settingsPage = settingsPage.replace(/\{false \? \([\s\S]*?\) : null\}/, '');
fs.writeFileSync('components/organisms/SettingsPage.tsx', settingsPage);

// 2. features/onboarding/actions.ts
let actionsPage = fs.readFileSync('features/onboarding/actions.ts', 'utf-8');
// find the start and end of submitIndividualOnboarding
let startIdx = actionsPage.indexOf('async function submitIndividualOnboarding(formData: FormData) {');
if (startIdx !== -1) {
  let endIdx = actionsPage.indexOf('export async function submitOnboardingAction(formData: FormData) {', startIdx);
  if (endIdx !== -1) {
    actionsPage = actionsPage.substring(0, startIdx) + actionsPage.substring(endIdx);
    fs.writeFileSync('features/onboarding/actions.ts', actionsPage);
  }
}

// 3. components/organisms/onboarding/constants.ts
replaceInFile('components/organisms/onboarding/constants.ts', [
  ['if (role === "individual") {\n    return [\n      { number: 1, title: "Individual Profile", description: "Contact details for your hiring account" },\n    ];\n  }', '']
]);

// 4. components/organisms/onboarding/useOnboardingForm.tsx
replaceInFile('components/organisms/onboarding/useOnboardingForm.tsx', [
  ['    if (activeRole === "individual") {\n      return [\n        {\n          title: "Individual Profile",\n          description: "Contact details for your hiring account",\n          icon: "user",\n          editStep: 1,\n          lines: accountLines,\n        },\n      ];\n    }\n', '']
]);

// 5. components/organisms/OnboardingRouteClient.tsx
replaceInFile('components/organisms/OnboardingRouteClient.tsx', [
  ['if (role === "individual") {\n    return { ok: false, message: "Individual hirer registration is disabled." };\n  }', '']
]);

console.log('Cleanup completed');
