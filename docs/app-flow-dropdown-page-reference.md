# SupplyED app flow, page, dropdown, and API reference

Review date: 23 September 2026.

This is the one-place reference for the current frontend implementation. It documents the visible page flow, dropdown/select data, validation, styling, and API calls for authentication, profile creation, job posting, job finding, and job application.

Important note: this repository is the Next.js frontend. Several dropdowns are real backend-driven data, not hard-coded in the UI. Where the backend decides the data, this file names the local route and backend endpoint instead of inventing values.

## Main Route Map

Public/auth pages:

| URL | Page/component | Purpose |
|---|---|---|
| `/login` | `LoginRouteClient`, `LoginPage` | Email/password login, social login buttons, email verification branch, 2FA branch |
| `/signup` | `SignupRouteClient`, `SignupAccessPage` | Create account, accept terms, verify email |
| `/forgot-password` | `ForgotPasswordRouteClient` | Request password reset code and set new password |
| `/onboarding` | `OnboardingRouteClient`, `OnboardingPage` | Choose/create role profile and upload required profile documents |

Signed-in workspace pages:

| URL | Role access | Component | Purpose |
|---|---|---|---|
| `/dashboard` | institution, teacher, individual | role-specific dashboard | Main workspace |
| `/post-job` | institution, individual | `PostJobPage` | Create job |
| `/post-job?jobId={id}` | institution, individual | `PostJobPage` edit mode | Edit owned job |
| `/find-jobs` | teacher | `FindJobsPage` | Browse and filter jobs |
| `/job-detail?jobId={id}` | teacher, institution, individual | `JobDetailPage` | View job, apply/invite |
| `/applications?jobId={id}` | institution, individual | `ApplicationsPage` | Review applications and matches |
| `/find-teachers` | institution, individual | `FindTeachersPage` | Browse teachers |
| `/teacher-profile?teacherId={id}` | institution, individual, teacher | `TeacherProfilePage` | Teacher profile view |
| `/settings` | all roles | `SettingsPage` | Profile and account settings |
| `/security` | all roles | `SecurityPage` | 2FA setup/manage |
| `/messaging`, `/calendar`, `/billing` | role-dependent | matching page components | Supporting workspace pages |

## Shared UI Styling

Global styling lives in `app/globals.css`.

| Element | Class/style |
|---|---|
| App background | `bg-chalk`, CSS `--chalk: #f8f8f8` |
| Brand color | CSS `--se: #008cc4`, dark `--se-dark`, tint `--se-tint` |
| Fonts | DM Sans for normal text, DM Serif Display for large headings |
| Cards | `.card`, radius `12px`, white background, light border, subtle shadow |
| Inputs | `.input`, `.select`, `.textarea`, radius `8px`, focus ring in brand blue |
| Buttons | `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger` |
| Tags | `.tag`, color variants green/amber/red/purple/ghost |
| Pills | `.pill`, compact rounded labels for selected values |
| Step indicator | `.step`, `.step.active`, `.step.done`, `.step-bar` |
| Layout | `.app-page` max width 1400px, `.two-col` main + 340px side panel |

Auth pages use a two-column split: black left rail with grid pattern, large serif/hero copy, and right-side form card. Onboarding uses a black left progress rail and white right form panel. Job pages use app shell navigation, white cards, compact form fields, tags, and preview cards.

## Dropdown Components

Two custom dropdown components are used:

| Component | File | Behavior |
|---|---|---|
| `SelectDropdown` | `components/molecules/OptionDropdowns.tsx` | Single select button/dropdown with check mark |
| `MultiSelectDropdown` | `components/molecules/OptionDropdowns.tsx` | Multi-select list, shows summary and selected count |

Native `<select>` is also used for country/city fields. Countries and cities come from `country-state-city`.

## Auth Flow

### Signup

URL: `/signup`

Page sequence:

1. Account creation page.
2. Email verification page.
3. Session creation through NextAuth credentials ticket.
4. Redirect to `/onboarding` unless profile/session says dashboard is ready.

Account fields:

| Field | Type | Validation/data |
|---|---|---|
| Email address | email input | Required, valid email, lowercased before submit |
| Password | password input | Required, at least 8 chars, uppercase, number, special char |
| Confirm password | password input | Must match password |
| Terms | checkbox | Required |
| Social buttons | Google/Microsoft | Shown if configured through social auth availability |

Email verification fields:

| Field | Type | Validation/data |
|---|---|---|
| Verification code | six one-digit inputs | Required 6 digits, paste supported |
| Resend code | button | Disabled until cooldown from `expiresInMinutes` |

Frontend actions:

| Action | Calls |
|---|---|
| `signupAction` | backend `POST /auth/register` |
| `verifySignupEmail` | backend `POST /auth/email/otp/verify` with `Authorization: Bearer <otpToken>` |
| `resendSignupVerification` | backend `POST /auth/email/otp/resend` |
| session creation | `signIn("credentials", { flow: "verified-email-session", ticket })` |

### Login

URL: `/login`

Page sequence:

1. Login page.
2. If backend says email unverified, switch to email verification page.
3. If backend says 2FA required, switch to 2FA challenge page.
4. Otherwise create NextAuth session and redirect.

Login fields:

| Field | Type | Validation/data |
|---|---|---|
| Email address | email input | Required valid email |
| Password | password input | Required, at least 8 characters |
| Remember this device | checkbox | UI state only in this component |
| Forgot password | button | Goes to `/forgot-password` |

Login APIs/actions:

| Action | Calls |
|---|---|
| `loginAction` | backend `POST /auth/login` |
| unverified email branch | `verifyLoginEmail`, `resendLoginVerification` |
| 2FA branch | `verifyLoginTwoFactor` |
| session creation | `signIn("credentials", { flow: "verified-email-session", ticket })` |

### 2FA Login Challenge

Screen: `TwoFactorChallengePage`

Fields:

| Field | Type | Validation/data |
|---|---|---|
| Code or recovery code | text input | Accepts 6 digits or recovery code format `XXXX-XXXX-XXXX-XXXX` |

UI details:

| Area | Detail |
|---|---|
| Left rail | Black panel, "Second step", large "Verify this sign in." heading |
| Timer | Shows `Expires in m:ss` when backend returns challenge expiry |
| Help text | Says authenticator app or saved recovery code can be used |

Backend calls:

| Step | Endpoint |
|---|---|
| Password accepted but 2FA required | `POST /auth/login` returns `twoFactorRequired`, `twoFactorToken` |
| Verify code | `POST /auth/2fa/verify` with `Authorization: Bearer <twoFactorToken>` |

### Forgot/Reset Password

URL: `/forgot-password`

Stages:

1. Request reset code.
2. Enter reset code and new password.
3. Success state with button back to login.

Fields:

| Stage | Field | Type | Validation/data |
|---|---|---|---|
| Request | Email address | email input | Required valid email |
| Reset | Reset code | six one-digit inputs | Required 6 digits |
| Reset | New password | password input | Same strong password rule as signup |
| Reset | Confirm password | password input | Must match |
| Reset | Send new code | button | Cooldown from `expiresInMinutes` |

Backend calls:

| Action | Endpoint |
|---|---|
| `requestPasswordResetAction` | `POST /auth/password/forgot` |
| `confirmPasswordResetAction` | `POST /auth/password/reset` with `Authorization: Bearer <reset otpToken>` |

### Security Page 2FA Management

URL: `/security`

Fields/data:

| Area | Field/data | Validation |
|---|---|---|
| Status | Enabled/setup pending/disabled tag | Loaded from backend |
| Setup | QR code image | From backend `qrCodeDataUrl` |
| Setup | Manual setup key | Read-only `secret` |
| Enable | Authenticator code | Exactly 6 digits |
| Recovery | Codes remaining | Number from backend |
| Regenerate | Code for new recovery codes | 6 digits or recovery code |
| Disable | Authenticator or recovery code | 6 digits or recovery code |

Backend endpoints:

| Operation | Endpoint |
|---|---|
| Read status | `GET /auth/2fa/status` |
| Start setup | `POST /auth/2fa/setup` |
| Enable | `POST /auth/2fa/enable` |
| Regenerate recovery codes | `POST /auth/2fa/recovery-codes` |
| Disable | `POST /auth/2fa/disable` |

## Profile Creation / Onboarding

URL: `/onboarding`

Profile types:

| Role | Label in UI | Workspace purpose |
|---|---|---|
| `institution` | School / MAT | Post jobs, review matches, manage compliance |
| `teacher` | Supply teacher | Build teacher profile, find jobs, manage availability |
| `individual` | Individual hirer | Find verified teachers for a learner/hiring need |

Role cards are styled as rounded bordered buttons with icons. Selected card uses brand tint and brand border.

### Shared onboarding dropdown data

Hard-coded in `components/organisms/onboarding/constants.ts`:

| Dropdown | Values |
|---|---|
| Subjects | Maths, English, Science, Humanities, SEN, All Primary |
| Key stages | EYFS, KS1, KS2, KS3, KS4, KS5 |
| Teacher skills | Classroom management, SEN support, Safeguarding, Behaviour support, Phonics, Exam preparation |
| Cover types/staffing needs | Same-day cover, Long-term roles, Intervention groups, Exam season, SEN support |
| Currency | GBP |
| Default country code | GB |

Dynamic dropdowns:

| Dropdown | Source |
|---|---|
| Country | `country-state-city` package, all countries sorted by name |
| City | `country-state-city`, cities for selected country, sorted and de-duplicated |
| Profile document requirements | frontend `/api/onboarding/document-requirements?role={role}` -> backend profile document requirements |

### Onboarding step counts

| Role state | Steps shown |
|---|---|
| No role selected | Choose role, Role details, Verification, Review |
| Teacher | Teacher profile, Full review |
| Individual | Profile details, Full review |
| Institution | Contact details, School details, Compliance, Full review |

### Step 1: Role/account basics

Visible for institution/individual, and embedded inside teacher profile step.

Fields:

| Field | Type | Required | Validation/data |
|---|---|---|---|
| Choose account type | role card group | yes | Institution, teacher, individual |
| Full name | text input | yes | Non-empty |
| Phone | tel input | yes | Matches phone pattern `[0-9+()\\s-]{10,}` |
| Country | select | yes for teacher/individual | Dynamic country list |
| City | select | yes for teacher/individual | Dynamic city list after country |
| Postal code | text input | yes | Non-empty |

Institution does not show personal country/city in step 1; it collects school location in step 2.

### Teacher Profile Step

This is teacher step 1, after role selection.

Fields/dropdowns:

| Field | Type | Required | Data/validation |
|---|---|---|---|
| Primary subjects | multi-select | yes | Maths, English, Science, Humanities, SEN, All Primary |
| Key stages | multi-select | yes | EYFS, KS1, KS2, KS3, KS4, KS5 |
| Skills | multi-select | no | Classroom management, SEN support, Safeguarding, Behaviour support, Phonics, Exam preparation |
| Years of experience | numeric text input | yes | Non-negative number |
| Daily rate | decimal input | no | Non-negative if entered |
| Hourly rate | decimal input | no | Non-negative if entered |
| Currency | single-select | no | GBP |
| Maximum travel distance | decimal input | no | Miles, non-negative if entered |
| Teaching reference number | text input | no | No local validation |
| Teaching bio | textarea | yes | At least 40 characters |

Payload goes to teacher profile creation:

| Frontend field | Backend payload field |
|---|---|
| fullName | `fullName` |
| bio | `bio` |
| profileCity | `city` |
| profileCountryCode | `countryCode` |
| postcode | `postalCode` |
| subjects | `subjects` |
| keyStages | `keyStages` |
| skills | `skills` |
| yearsExperience | `experience` |
| hourlyRate | `hourlyRate` |
| dailyRate | `dailyRate` |
| currency | `currency` |
| maxTravelDistance | `maxTravelDistance` |

Backend calls on final create/review:

| Step | Endpoint |
|---|---|
| Save user basics | `PATCH /users/me` |
| Create teacher profile | `POST /instructors` |
| Get requirements/documents | profile document endpoints |
| Submit review when ready | `PATCH /instructors/me/status` |

### Institution Profile Steps

Step 1: contact basics, same shared fields, but no personal country/city.

Step 2: school details.

| Field | Type | Required | Validation/data |
|---|---|---|---|
| School or MAT name | text input | yes | Non-empty |
| Your role | text input | yes | Non-empty |
| School/trust domain | text input | yes | Domain format such as `greenfield.ac.uk`; strips protocol/path |
| Registration ID | text input | no | URN/company/trust ID |
| Address | text input | yes | Non-empty |
| Country | select | yes | Dynamic country list; default GB |
| City | select | yes | Dynamic city list |
| Typical pupil count | numeric text input | no | Digits only |
| Staffing needs | multi-select | yes | Same-day cover, Long-term roles, Intervention groups, Exam season, SEN support |

Step 3: compliance.

| Field | Type | Required | Validation/data |
|---|---|---|---|
| Compliance lead | text input | yes | Non-empty |
| Compliance email | email input | yes | Valid email |
| Safeguarding responsibility | checkbox | yes | Must confirm authorised school staff |

Backend calls on final create/review:

| Step | Endpoint |
|---|---|
| Save user basics | `PATCH /users/me` |
| Create institution profile | `POST /institutions` |
| Get requirements/documents | profile document endpoints |
| Submit review when ready | `PATCH /institutions/me/status` |

### Individual Profile Steps

Step 1 uses shared account basics:

| Field | Type | Required |
|---|---|---|
| Role card: Individual hirer | role card | yes |
| Full name | text input | yes |
| Phone | tel input | yes |
| Country | select | yes |
| City | select | yes |
| Postal code | text input | yes |

Step 2 is review.

Backend calls:

| Step | Endpoint |
|---|---|
| Save user basics | `PATCH /users/me` |
| Create individual/recruiter profile | `POST /recruiters` |
| Submit review when ready | `PATCH /recruiters/me/status` |

### Profile Document Upload Stage

After profile creation, if backend says profile documents are required, onboarding switches to the locked document stage.

UI behavior:

| Element | Detail |
|---|---|
| Alert card | "Profile created" with file icon |
| Requirement cards | One card per backend document requirement |
| Required label | Requirement shows required vs optional |
| File restrictions | Allowed MIME types and max file size come from backend |
| View document | Opens preview modal through local preview route |
| Submit | "Send for review" validates all required files are present |

Data source:

| Data | Source |
|---|---|
| Requirement id | backend |
| Document type name | backend |
| Requirement context | backend |
| Required/optional | backend |
| Allowed MIME types | backend |
| Max size bytes | backend |
| Existing uploaded document status | backend document list |

Frontend/local routes:

| Route/action | Purpose |
|---|---|
| `GET /api/onboarding/document-requirements?role={role}` | Load profile requirements |
| `POST /api/onboarding/documents` | Multipart upload route |
| `GET /api/onboarding/documents/{documentId}/preview?name={file}` | Stream preview |

Backend endpoints used by document pipeline:

| Endpoint | Purpose |
|---|---|
| profile document requirements endpoint | Load required document types |
| `GET /documents?limit=100&page=1` | Load uploaded documents |
| `POST /documents` | Create/reuse document metadata |
| `POST /documents/{id}/upload-url` | Get signed upload URL |
| signed storage `PUT` | Upload bytes |
| `POST /documents/{id}/upload-complete` | Mark upload complete |
| `GET /documents/{id}/download-url` | Preview/download |

## Job Posting Flow

URL: `/post-job`

New job uses four steps:

1. Type
2. Details
3. Requirements
4. Review

Edit mode (`/post-job?jobId={id}`) loads owned jobs from `/api/jobs/mine`, finds the job, and shows all sections in one editor with a live preview.

### Step 1: Posting Type

There is no separate "long brief page" in the current code. The first screen is a two-option mode selector:

| Option | Internal value | UI text | Meaning |
|---|---|---|---|
| Instant matching | `instant` | "Best for urgent or same-day cover." | Immediate/short cover |
| Open brief | `brief` | "Best for planned, long-term, or proposal-led cover." | Planned or long-term style brief |

Styling:

| State | Style |
|---|---|
| Selected instant | Brand tint background, brand border |
| Selected brief | Purple tint background, purple border |
| Unselected | White background, standard border |

The chosen mode is not a separate backend field in the create payload. The frontend appends a generated line to the job description:

```txt
Posting route: Instant matching.
```

or:

```txt
Posting route: Open brief.
```

On read, the frontend derives `job.mode` from backend `mode`, `postingMode`, `jobType`, or that description line. If none exists, it derives mode from duration: more than 7 days becomes `brief`, otherwise `instant`.

### Step 2: Job Details

Hard-coded dropdown data in `PostJobPage.tsx`:

| Dropdown | Values |
|---|---|
| Subject | Maths, English, Science, All Primary, SEN, Humanities, Modern Languages |
| Pay basis | Daily, Hourly, Fixed |

Fields:

| Field | Type | Required for publish | Validation/data |
|---|---|---|---|
| Job title | text input | yes | Non-empty |
| Subject | single-select | no hard required check | Subject list above |
| Postcode | text input | no unless entered | UK postcode validation if entered |
| Address | text input | no | Max 250 |
| City | text input | no | Max 100 |
| County | text input | no | Max 100 |
| Country code | text input | no | 2-letter ISO code, default GB |
| Start date | date input | no | Cannot be before today |
| End date | date input | no | Cannot be before start date |
| Pay amount (GBP) | number input | no | Non-negative |
| Pay basis | single-select | no | Daily, Hourly, Fixed; internal values `daily`, `hourly`, `fixed` |
| Minimum experience | number input | no | Whole number 0+ |
| Required skills | tag input | no | User-entered tags, Enter/comma |
| Role description | textarea | yes | At least 20 characters for publish; non-empty for draft |

Role description toolbar:

| Button | Insert behavior |
|---|---|
| Heading | Inserts Markdown `## Section heading` |
| Bullet list | Inserts `- ` or converts selected lines into bullets |
| Bold | Wraps selected text in `**...**` |

### Step 3: Requirements and Publishing

Hard-coded dropdown data:

| Dropdown | Values |
|---|---|
| Key stages | EYFS, KS1, KS2, KS3, KS4, KS5 |

Backend-driven dropdown:

| Dropdown | Source | Notes |
|---|---|---|
| Application document requirements | frontend `GET /api/document-requirements/application` -> backend `GET /document-requirements/application` | Options are `{ label: requirement.name, value: requirement.id, description }`; disabled while loading, on error, or if empty |

Fields:

| Field | Type | Required | Validation/data |
|---|---|---|---|
| Key stages | multi-select | no hard required check | EYFS, KS1, KS2, KS3, KS4, KS5 |
| Listing expiry | date input | no | Cannot be before today |
| Application document requirements | multi-select | optional | Backend-driven |
| Parking/arrival notes | textarea | no | Free text |
| QTS qualified | checkbox | no | Adds generated description line `QTS requested.` |
| Mark as urgent | checkbox | no | Adds generated description line `Marked urgent by the hiring account.` |

Important: application document requirements are only shown when creating a new job. In edit mode the document requirement selector is hidden, and update payload deliberately excludes `documentRequirementIds`.

### Step 4: Review

Review card shows:

| Data | UI |
|---|---|
| Mode | Tag: Instant matching or Open brief |
| Status preview | Green "Ready to publish" or "Current preview" |
| Urgent | Red tag |
| Title | Serif heading |
| Description | Rendered by `FormattedJobDescription` |
| Key stages/subject/location/pay/date/experience/skills/QTS/doc requirements | Pills |

Buttons:

| Button | Behavior |
|---|---|
| Back | Previous step |
| Save draft | Validates title and non-empty description, saves `DRAFT` |
| Publish job | Validates full form, creates then activates `ACTIVE` |

### Job Create/Update API

Frontend server action:

| Action | Backend behavior |
|---|---|
| `createJobAction` | `POST /jobs`; if publishing, then `PATCH /jobs/{id}` with status `ACTIVE` |
| `updateJobAction` | `PATCH /jobs/{id}` |
| `deleteJobAction` | `DELETE /jobs/{id}` |

Create payload fields:

| Frontend field | Backend payload |
|---|---|
| title | `title` |
| description + generated mode/QTS/urgent lines | `description` |
| subject | `subject` |
| requiredSkills | `requiredSkills` |
| minExperienceYears | `minExperienceYears` |
| address | `address` |
| city | `city` |
| county | `county` |
| postalCode | `postalCode` |
| countryCode | `countryCode` |
| startDate | `startDate` as ISO date |
| endDate | `endDate` as ISO date |
| keyStages | `keyStages` |
| parkingInfo | `parkingInfo` |
| payAmount | `payAmount` |
| payType | `payType` |
| expiresAt | `expiresAt` |
| documentRequirementIds | `documentRequirementIds` on create only |

Normalization:

| Rule | Detail |
|---|---|
| Empty values | Empty strings, empty arrays, null/undefined are removed before backend |
| Country/postcode | Uppercased |
| Numeric fields | Negative values dropped/rejected depending validation |
| Arrays | Trimmed and de-duplicated |

## Find and Apply Job Flow

### Find Jobs Page

URL: `/find-jobs`

Tabs:

| Tab | Data source |
|---|---|
| For you | `GET /api/matching/jobs/recommended?page=&limit=&minScore=` |
| All jobs | `GET /api/jobs` with filters |

Filter dropdowns on All jobs:

| Dropdown | Values |
|---|---|
| Role type | All jobs, Urgent only |
| Key stage | All stages, KS1, KS2, KS3, KS4, KS5 |
| Subject | All subjects, Maths, English, Science, All Primary |

Recommended tab fields:

| Field | Type | Validation/data |
|---|---|---|
| Minimum score | number input | Clamped 0 to 100 |
| Pagination | Previous/Next | Uses backend pagination |

APIs:

| Local route | Backend endpoint |
|---|---|
| `GET /api/jobs` | `GET /jobs`, then frontend filters |
| `GET /api/matching/jobs/recommended` | `GET /matching/jobs/recommended` |

### Job Detail Page

URL: `/job-detail?jobId={id}`

Data loaded:

| Data | Route |
|---|---|
| Job | `GET /api/jobs/{id}` |
| Teacher match score | `GET /api/matching/jobs/{jobId}/score` if role is teacher |

Visible sections:

| Section | Details |
|---|---|
| Header tags | Urgent, Instant/Open brief, key stage, subject |
| Title/location/meta | Job title, hiring account, location, posted time |
| Stat cards | Day rate, duration, experience |
| About this role | Formatted description |
| Requirements | Subject, key stage, experience, parking/arrival, skills |
| Right sticky card | Rate, pills, match panel, primary action |

Teacher action:

| Button | Behavior |
|---|---|
| Apply for job | Opens modal with cover letter |
| Message school | Goes to messaging |

Institution/individual action:

| Button | Behavior |
|---|---|
| Invite candidates | Opens invite message modal; current confirm only shows toast |

### Apply Job Modal

Current apply form fields:

| Field | Type | Required | Validation/data |
|---|---|---|---|
| Cover letter | textarea | yes | Required, max 2,000 characters |

Submit behavior:

| Step | Detail |
|---|---|
| User clicks Apply for job | Modal opens |
| User enters cover letter | Local state |
| Submit | Calls `createApplicationAction({ jobId, coverLetter })` |
| Success | Modal closes, button changes to Application submitted |

Backend endpoint:

| Action | Endpoint |
|---|---|
| Create application | `POST /applications` |

Payload:

```json
{
  "jobId": "job_123",
  "coverLetter": "I am available and have relevant KS2 experience..."
}
```

Important current behavior: although job posting can select application document requirements, the current `JobDetailPage` apply modal does not show document upload fields. It only sends job ID and cover letter. Application document requirements are available to the posting form as a backend-driven dropdown, but the apply flow in this frontend has not yet rendered those requirements for the applicant.

## Application Review Flow

URL: `/applications?jobId={id}`

Data sources:

| Data | Local route | Backend endpoint |
|---|---|---|
| Owned jobs | `/api/jobs/mine` | `/jobs/mine` |
| Applications for job | `/api/applications/job/{jobId}` | `/applications/job/{jobId}` |
| Ranked applications | `/api/matching/jobs/{jobId}/applications` | `/matching/jobs/{jobId}/applications` |
| Recommended teachers | `/api/matching/jobs/{jobId}/instructors` | `/matching/jobs/{jobId}/instructors` |

Application statuses supported:

| Status |
|---|
| APPLIED |
| VIEWED |
| SHORTLISTED |
| INTERVIEW |
| HIRED |
| COMPLETED |
| REJECTED |

Status update endpoint:

| Action | Endpoint |
|---|---|
| `updateApplicationStatusAction` | `PATCH /applications/{id}/status` |

## Complete Dropdown Data Summary

### Auth pages

No dropdowns. Auth uses inputs, checkboxes, social buttons, OTP inputs, and 2FA code inputs.

### Onboarding/profile

| Form | Dropdown | Values/source |
|---|---|---|
| Role selection | Account type cards | School / MAT, Supply teacher, Individual hirer |
| Teacher | Primary subjects | Maths, English, Science, Humanities, SEN, All Primary |
| Teacher | Key stages | EYFS, KS1, KS2, KS3, KS4, KS5 |
| Teacher | Skills | Classroom management, SEN support, Safeguarding, Behaviour support, Phonics, Exam preparation |
| Teacher | Currency | GBP |
| Teacher/individual | Country | Dynamic from `country-state-city` |
| Teacher/individual | City | Dynamic from selected country |
| Institution | Institution country | Dynamic from `country-state-city` |
| Institution | Institution city | Dynamic from selected country |
| Institution | Staffing needs | Same-day cover, Long-term roles, Intervention groups, Exam season, SEN support |
| Profile documents | Document requirements | Backend-driven profile requirements |

### Job posting

| Step | Dropdown | Values/source |
|---|---|---|
| Type | Posting mode cards | Instant matching, Open brief |
| Details | Subject | Maths, English, Science, All Primary, SEN, Humanities, Modern Languages |
| Details | Pay basis | Daily, Hourly, Fixed |
| Requirements | Key stages | EYFS, KS1, KS2, KS3, KS4, KS5 |
| Requirements | Application document requirements | Backend `GET /document-requirements/application` |

### Find jobs

| Filter | Values |
|---|---|
| Role type | All jobs, Urgent only |
| Key stage | All stages, KS1, KS2, KS3, KS4, KS5 |
| Subject | All subjects, Maths, English, Science, All Primary |

### Apply job

No dropdowns in the current apply modal. It only has a cover letter textarea.

## Key API Inventory

### Auth

| Method | Backend path | Purpose |
|---|---|---|
| POST | `/auth/register` | Signup |
| POST | `/auth/email/otp/resend` | Resend verification |
| POST | `/auth/email/otp/verify` | Verify email |
| POST | `/auth/login` | Login |
| POST | `/auth/2fa/verify` | Verify 2FA login |
| POST | `/auth/password/forgot` | Request reset code |
| POST | `/auth/password/reset` | Reset password |
| GET | `/auth/me` | Current user |
| POST | `/auth/refresh` | Refresh backend token |

### Profile/onboarding

| Method | Backend/local path | Purpose |
|---|---|---|
| PATCH | `/users/me` | Save user basics |
| POST | `/instructors` | Create teacher |
| POST | `/institutions` | Create school/MAT |
| POST | `/recruiters` | Create individual hirer |
| PATCH | `/instructors/me/status` | Submit teacher review |
| PATCH | `/institutions/me/status` | Submit institution review |
| PATCH | `/recruiters/me/status` | Submit individual review |
| GET | `/api/onboarding/document-requirements?role={role}` | Local route for requirements |
| POST | `/api/onboarding/documents` | Local upload route |

### Jobs/applications/matching

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/jobs` | Browser fetch all jobs |
| GET | `/api/jobs/mine` | Browser fetch owned jobs |
| GET | `/api/jobs/{id}` | Browser fetch job detail |
| POST | backend `/jobs` | Create job |
| PATCH | backend `/jobs/{id}` | Update/activate job |
| DELETE | backend `/jobs/{id}` | Delete job |
| GET | `/api/document-requirements/application` | Browser load application doc requirement options |
| POST | backend `/applications` | Apply for job |
| GET | `/api/applications/job/{jobId}` | Browser load applications for job |
| PATCH | backend `/applications/{id}/status` | Update application status |
| GET | `/api/matching/jobs/recommended` | Teacher recommended jobs |
| GET | `/api/matching/jobs/{jobId}/score` | Teacher match score for one job |
| GET | `/api/matching/jobs/{jobId}/applications` | Ranked applications |
| GET | `/api/matching/jobs/{jobId}/instructors` | Recommended instructors |

## Source Files

| Area | Files |
|---|---|
| Auth UI | `components/organisms/LoginRouteClient.tsx`, `LoginPage.tsx`, `SignupRouteClient.tsx`, `SignupAccessPage.tsx`, `SignupVerifyPage.tsx`, `ForgotPasswordRouteClient.tsx`, `TwoFactorChallengePage.tsx` |
| Auth backend integration | `features/auth/backend.ts`, `features/auth/actions.ts`, `features/auth/schemas.ts`, `features/auth/two-factor-actions.ts` |
| Onboarding UI | `components/organisms/OnboardingRouteClient.tsx`, `OnboardingPage.tsx`, `components/organisms/onboarding/*` |
| Onboarding logic/API | `features/onboarding/actions.ts`, `features/onboarding/queries.ts`, `features/onboarding/documents.ts` |
| Job posting | `components/organisms/PostJobPage.tsx`, `features/jobs/actions.ts`, `features/jobs/queries.ts`, `features/jobs/schemas.ts`, `features/jobs/use-jobs.ts` |
| Job apply | `components/organisms/JobDetailPage.tsx`, `features/applications/actions.ts`, `features/applications/queries.ts`, `features/applications/use-applications.ts` |
| Find jobs/matching | `components/organisms/FindJobsPage.tsx`, `features/matching/queries.ts`, `features/matching/use-matching.ts` |
| Dropdown components | `components/molecules/OptionDropdowns.tsx`, `components/organisms/onboarding/CountryCityFields.tsx` |
| Styling | `app/globals.css`, `tailwind.config.ts` |



