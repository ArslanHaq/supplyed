import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
  }
  fs.writeFileSync(filePath, content);
}

// 1. components/organisms/AppChrome.tsx
replaceInFile('components/organisms/AppChrome.tsx', [
  ['state.role === "teacher" ? teacherNav : individualNav;', 'teacherNav;'],
  ['state.role === "teacher" ? "Instructor" : "Hirer";', '"Instructor";'],
  ['state.role === "individual" ? "Search teachers..." : "Search teachers...";', '"Search teachers...";'],
]);

// 2. components/organisms/FindTeachersPage.tsx
replaceInFile('components/organisms/FindTeachersPage.tsx', [
  ['const isIndividual = role === "individual";', 'const isIndividual = false;'],
]);

// 3. components/organisms/MessagingPage.tsx
replaceInFile('components/organisms/MessagingPage.tsx', [
  [': role === "individual"', ''],
]);

// 4. components/organisms/onboarding/constants.ts
replaceInFile('components/organisms/onboarding/constants.ts', [
  ['if (role === "individual") {\n    return [\n      { number: 1, title: "Individual Profile", description: "Contact details for your hiring account" },\n    ];\n  }', ''],
]);

// 5. components/organisms/onboarding/useOnboardingForm.tsx
replaceInFile('components/organisms/onboarding/useOnboardingForm.tsx', [
  ['role === "individual" ? "individual" : "institution";', '"institution";'],
  ['    if (activeRole === "individual") {\n      return [\n        {\n          title: "Individual Profile",\n          description: "Contact details for your hiring account",\n          icon: "user",\n          editStep: 1,\n          lines: accountLines,\n        },\n      ];\n    }\n', '']
]);

// 6. components/organisms/OnboardingRouteClient.tsx
replaceInFile('components/organisms/OnboardingRouteClient.tsx', [
  ['export type SignupRole = Extract<AppRole, "institution" | "teacher" | "individual">;', 'export type SignupRole = Extract<AppRole, "institution" | "teacher">;'],
  ['if (role === "individual") return "individual";', ''],
  ['if (role === "individual") {\n    return { ok: false, message: "Individual hirer registration is disabled." };\n  }', '']
]);

// 7. components/organisms/PostJobPage.tsx
replaceInFile('components/organisms/PostJobPage.tsx', [
  ['role === "individual" ? "Post a hiring role" : "Post a new role"', '"Post a new role"'],
]);

// 8. components/organisms/SettingsPage.tsx
replaceInFile('components/organisms/SettingsPage.tsx', [
  ['if (role === "individual") return form.recruiter.imageUrl;', ''],
  ['if (role === "individual") return "Individual";', ''],
  ['if (snapshot.role === "individual") return snapshot.recruiter?.displayName || snapshot.user.name;', ''],
  ['if (role === "individual") return { ...current, recruiter: { ...current.recruiter, imageUrl: value } };', ''],
  ['recruiter: role === "individual" ? form.recruiter : undefined,', ''],
  ['{role === "individual" ? (', '{false ? ('],
]);

// 9. components/organisms/TeacherProfilePage.tsx
replaceInFile('components/organisms/TeacherProfilePage.tsx', [
  ['const isIndividual = role === "individual";', 'const isIndividual = false;'],
]);

// 10. features/onboarding/actions.ts
// I'll just remove the whole submitIndividualOnboarding function and its references
replaceInFile('features/onboarding/actions.ts', [
  ['if (role === "individual") {\n      if (!profile.recruiter) throw new Error("Individual profile not found");\n      return { snapshot: { ...profile, requirementDocuments: docs }, applicationStatus: "none" };\n    }', ''],
  ['snapshot: emptySnapshot("individual", readFormString(formData, "email")),', 'snapshot: emptySnapshot("teacher", readFormString(formData, "email")),'],
  ['if (sessionAuth.user.role && sessionAuth.user.role !== "individual") {\n      throw new Error(`Account already has a role set to ${sessionAuth.user.role}.`);\n    }', ''],
  ['if (!recruiter) throw new Error("The backend did not return the saved individual profile.");', ''],
  ['const documentState = await getDocumentState("individual", sessionAuth.accessToken);', ''],
  ['role: "individual",', 'role: "teacher",'], // just as a fallback
  ['"Your individual profile was created."', '""'],
  ['if (role === "individual") return submitIndividualOnboarding(formData);', ''],
]);

// 11. features/onboarding/document-requirements.ts
replaceInFile('features/onboarding/document-requirements.ts', [
  ['if (role === "individual") return "RECRUITER_PROFILE";', ''],
]);

// 12. features/onboarding/document-utils.ts
replaceInFile('features/onboarding/document-utils.ts', [
  ['if (role === "individual") return "RECRUITER";', ''],
]);

// 13. features/settings/actions.ts
replaceInFile('features/settings/actions.ts', [
  ['if (input.role === "individual") {\n    const recruiter = current.recruiter ? { ...current.recruiter, ...input.recruiter } : input.recruiter;\n    payload.recruiter = recruiter;\n  }', ''],
  ['input.role === "individual" && input.recruiter && current.recruiter\n        ? { ...current.recruiter, ...input.recruiter }\n        : ', ''],
  ['if (input.role === "individual") {\n      if (!input.recruiter?.displayName) return { ok: false, message: "Display name is required." };\n    }', ''],
]);

// 14. features/settings/queries.ts
replaceInFile('features/settings/queries.ts', [
  ['if (role === "individual" && profile.recruiter) {\n    return { profile: profile.recruiter, ok: true };\n  }', ''],
  ['if (role === "individual") return profile.recruiter?.status ?? "none";', ''],
  ['if (role === "individual") {\n    return { snapshot: { ...baseSnapshot, recruiter: result.data.profile }, ok: true };\n  }', ''],
]);

// 15. features/settings/use-settings.ts
replaceInFile('features/settings/use-settings.ts', [
  ['if (snapshot.role === "individual" && snapshot.recruiter) {\n    return createForm(snapshot.recruiter);\n  }', ''],
]);

// 16. proxy.ts
replaceInFile('proxy.ts', [
  ['const appRoles = new Set<AppRole>(["institution", "teacher", "individual"]);', 'const appRoles = new Set<AppRole>(["institution", "teacher"]);'],
]);

console.log('Cleanup completed');
