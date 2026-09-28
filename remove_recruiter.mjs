import fs from 'fs';
import path from 'path';

function findFiles(dir, ext, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!filePath.includes('node_modules') && !filePath.includes('.next')) {
        findFiles(filePath, ext, fileList);
      }
    } else if (filePath.endsWith(ext)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = findFiles('.', '.ts').concat(findFiles('.', '.tsx'));

const removalPatterns = [
  // next-auth.d.ts
  / {4}recruiterProfileId\?: string;\n/g,
  /    recruiterProfileId\?: string;\n/g,
  // lib/server/auth-context.ts
  /  recruiterProfileId\?: string \| null;\n/g,
  /    recruiterProfileId: readString\(token\?\.recruiterProfileId\),\n/g,
  // auth.ts
  /        token\.recruiterProfileId = user\.recruiterProfileId;\n/g,
  /    recruiterProfileId: user\.recruiterProfileId,\n/g,
  /  token\.recruiterProfileId = response\.user\.recruiterProfileId;\n/g,
  /  delete token\.recruiterProfileId;\n/g,
  /      session\.user\.recruiterProfileId =\n        typeof token\.recruiterProfileId === "string" \? token\.recruiterProfileId : undefined;\n/g,
  // features/auth/types.ts
  /  recruiterProfileId\?: string;\n/g,
  // features/auth/backend.ts
  /    recruiterProfileId:\n      readString\(user\.recruiterProfileId\) \?\?\n      readString\(user\.recruiterProfileID\) \?\?\n      readString\(user\.recruiterId\) \?\?\n      \(isRecord\(user\.recruiterProfile\) \? readString\(user\.recruiterProfile\.id\) : undefined\),\n/g,
  // settings
  /  recruiter\?: SettingsRecruiterProfile;\n/g,
  /  recruiter\?: SettingsRecruiterUpdateInput;\n/g,
  /  recruiter: SettingsRecruiterUpdateInput;\n/g,
  /    recruiter: {\n.*\n    },\n/g,
  /    recruiter: SettingsRecruiterUpdateInput,\n/g,
  // onboarding profile-progress
  /  if \(snapshot\.role === "individual"\) return Boolean\(snapshot\.recruiter\?\.id\);\n/g,
  // onboarding actions
  /  recruiterProfileId\?: string;\n/g,
  /      recruiterProfileId: recruiterProfileId \?\? auth\.user\.recruiterProfileId,\n/g,
  /  recruiterProfileId,\n/g,
  // onboarding types
  /  recruiter\?: OnboardingRecruiterSnapshot;\n/g,
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;

  for (const pattern of removalPatterns) {
    content = content.replace(pattern, '');
  }

  // Handle specific manual replacements
  content = content.replace(/ \| "RECRUITER_PROFILE"/g, '');
  content = content.replace(/ \| "RECRUITER"/g, '');
  content = content.replace(/, SettingsRecruiterProfile/g, '');
  content = content.replace(/, SettingsRecruiterUpdateInput/g, '');
  content = content.replace(/, OnboardingRecruiterSnapshot/g, '');
  
  // Settings / Onboarding functions that should just be commented out or removed
  // We'll let tsc catch any remaining usages (like SettingsRecruiterProfile)
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
