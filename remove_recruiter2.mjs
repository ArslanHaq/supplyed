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

const replacements = [
  '      recruiterProfileId?: string;\n',
  '    recruiterProfileId?: string;\n',
  '  recruiterProfileId?: string | null;\n',
  '    recruiterProfileId: readString(token?.recruiterProfileId),\n',
  '        token.recruiterProfileId = user.recruiterProfileId;\n',
  '    recruiterProfileId: user.recruiterProfileId,\n',
  '  token.recruiterProfileId = response.user.recruiterProfileId;\n',
  '  delete token.recruiterProfileId;\n',
  '      session.user.recruiterProfileId =\n        typeof token.recruiterProfileId === "string" ? token.recruiterProfileId : undefined;\n',
  '  recruiterProfileId?: string;\n',
  '    recruiterProfileId:\n      readString(user.recruiterProfileId) ??\n      readString(user.recruiterProfileID) ??\n      readString(user.recruiterId) ??\n      (isRecord(user.recruiterProfile) ? readString(user.recruiterProfile.id) : undefined),\n',
  '  recruiter?: SettingsRecruiterProfile;\n',
  '  recruiter?: SettingsRecruiterUpdateInput;\n',
  '  recruiter: SettingsRecruiterUpdateInput;\n',
  '    recruiter: {\n      companyName: "",\n      firstName: "",\n      lastName: "",\n      jobTitle: "",\n    },\n',
  '    recruiter: SettingsRecruiterUpdateInput,\n',
  '  if (snapshot.role === "individual") return Boolean(snapshot.recruiter?.id);\n',
  '  recruiterProfileId?: string;\n',
  '      recruiterProfileId: recruiterProfileId ?? auth.user.recruiterProfileId,\n',
  '  recruiterProfileId,\n',
  '  recruiter?: OnboardingRecruiterSnapshot;\n',
  ' | "RECRUITER_PROFILE"',
  ' | "RECRUITER"',
  ', SettingsRecruiterProfile',
  ', SettingsRecruiterUpdateInput',
  ', OnboardingRecruiterSnapshot'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;

  for (const replace of replacements) {
    content = content.split(replace).join('');
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
