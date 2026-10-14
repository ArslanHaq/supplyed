# SupplyED settings, jobs, and two-factor API flows

Code review date: 22 September 2026.

This file documents the current frontend API flow for the settings page, job posting/editing, job fetching/matching pages, and two-factor authentication.

Backend examples are illustrative payloads that match what this frontend reads or sends. They are not captured production responses.

## Configured URLs

Current local URL configuration:

```env
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
API_BASE_URL="http://localhost:3003/api"
```

Browser pages call local Next.js routes such as `/api/jobs`. Server actions and route handlers then call the backend at `API_BASE_URL`, for example `http://localhost:3003/api/jobs`.

## Authentication and token behavior for these pages

All settings, job, and 2FA management calls require the user to already have a NextAuth session. The browser sends the app session cookie to Next.js using same-origin requests or server actions. The browser does not manually attach the backend access token.

Server-side code reads the backend tokens from the NextAuth JWT:

```json
{
  "userId": "user_123",
  "role": "institution",
  "accessToken": "backend-access-token",
  "accessTokenExpiresAt": 1790000000000,
  "refreshToken": "backend-refresh-token",
  "institutionProfileId": "inst_123"
}
```

When a server call uses `api.get`, `api.post`, `api.patch`, `api.put`, or `api.delete`, the API client:

1. Reads the current session with `getServerAuthContext()`.
2. Gets a valid backend access token with `getValidAccessToken()`.
3. Sends `Authorization: Bearer <accessToken>` to the backend.
4. If the access token is expired or the backend returns an auth failure, it calls `POST /auth/refresh` with the refresh token.
5. If refresh succeeds, it retries the original backend request with the new access token and persists the refreshed token in the NextAuth session.
6. If refresh fails, it marks the backend session expired and returns a `SESSION_EXPIRED` error. Client hooks sign the user out and redirect to `/login`.

Refresh request:

```http
POST http://localhost:3003/api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "backend-refresh-token"
}
```

Refresh success example:

```json
{
  "accessToken": "new-backend-access-token",
  "refreshToken": "new-backend-refresh-token",
  "accessTokenExpiresInSeconds": 900,
  "user": {
    "id": "user_123",
    "email": "admin@school.test",
    "role": "INSTITUTION",
    "emailVerified": true
  }
}
```

Common server action response format:

```json
{
  "ok": true,
  "data": {},
  "message": "Saved."
}
```

Common server action error format:

```json
{
  "ok": false,
  "message": "Your session expired. Sign in again to continue.",
  "code": "SESSION_EXPIRED"
}
```

Common local route error format:

```json
{
  "code": "SESSION_EXPIRED",
  "message": "Your session expired. Sign in again to continue."
}
```

## Settings page API flow

Page: `/settings`

Main files:

- `app/(app)/settings/page.tsx`
- `components/organisms/SettingsPage.tsx`
- `features/settings/use-settings.ts`
- `features/settings/queries.ts`
- `features/settings/actions.ts`
- `app/api/settings/profile/route.ts`

### Load settings screen

Browser call:

```http
GET http://localhost:3000/api/settings/profile
Cookie: next-auth session cookie
```

Next.js route:

```txt
app/api/settings/profile/route.ts
```

Backend call order:

1. `GET /auth/me`
2. Role profile lookup:
   - Teacher: `GET /instructors/me`
   - Institution: `GET /institutions/me`
   - Individual recruiter: `GET /recruiters/me`
3. Optional profile image read:
   - `GET /users/me/profile-image`

Backend URLs with current config:

```txt
GET http://localhost:3003/api/auth/me
GET http://localhost:3003/api/instructors/me
GET http://localhost:3003/api/institutions/me
GET http://localhost:3003/api/recruiters/me
GET http://localhost:3003/api/users/me/profile-image
```

All backend calls above are sent with:

```http
Authorization: Bearer <backend-access-token>
Accept: application/json
```

Success response returned to the browser:

```json
{
  "applicationStatus": "approved",
  "role": "institution",
  "user": {
    "id": "user_123",
    "email": "admin@school.test",
    "emailVerified": true,
    "name": "Admin User",
    "phone": "+441234567890",
    "phoneVerified": false,
    "role": "institution",
    "twoFactorEnabled": true,
    "createdAt": "2026-09-01T10:00:00.000Z",
    "updatedAt": "2026-09-20T10:00:00.000Z",
    "lastLogin": "2026-09-22T08:00:00.000Z"
  },
  "institution": {
    "id": "inst_123",
    "name": "SupplyED Academy",
    "domain": "supplyed.test",
    "address": "1 School Road",
    "city": "London",
    "county": "Greater London",
    "postalCode": "SW1A 1AA",
    "countryCode": "GB",
    "complianceContact": "Safeguarding Lead",
    "complianceEmail": "compliance@supplyed.test",
    "registrationId": "URN-12345",
    "safeguardingConfirmed": true,
    "staffingNeeds": "Daily cover and long-term supply",
    "typicalPupilCount": "750",
    "coverTypes": ["Daily cover", "Long-term"],
    "verified": true,
    "status": "approved",
    "imageUrl": "https://signed.example/profile.png",
    "createdAt": "2026-09-01T10:00:00.000Z",
    "updatedAt": "2026-09-20T10:00:00.000Z",
    "userId": "user_123",
    "userRole": "Admin"
  }
}
```

Error example:

```json
{
  "code": "SESSION_EXPIRED",
  "message": "Your session expired. Sign in again to continue."
}
```

### Save settings

The settings page does not call a local REST endpoint for saving. It calls the server action `updateSettingsAction(input)`.

Server action backend call order:

1. Read current profile snapshot using the load flow above.
2. `PATCH /users/me`
3. Role profile patch:
   - Teacher: `PATCH /instructors/{profileId}`
   - Institution: `PATCH /institutions/{profileId}`
   - Individual recruiter: `PATCH /recruiters/me`
4. Revalidate cached tags: `settings`, `auth`, `auth:me`, `onboarding`.
5. Reload settings snapshot and return it to the browser.

Example user patch:

```http
PATCH http://localhost:3003/api/users/me
Authorization: Bearer <backend-access-token>
Content-Type: application/json

{
  "name": "Admin User",
  "phone": "+441234567890"
}
```

Teacher profile patch example:

```http
PATCH http://localhost:3003/api/instructors/ins_123
Authorization: Bearer <backend-access-token>
Content-Type: application/json

{
  "fullName": "Aisha Khan",
  "bio": "Primary supply teacher",
  "subjects": ["Maths", "English"],
  "keyStages": ["KS1", "KS2"],
  "skills": ["SEN", "Phonics"],
  "hourlyRate": 35,
  "dailyRate": 180,
  "experience": 5,
  "maxTravelDistance": 20,
  "address": "10 Teacher Street",
  "city": "London",
  "county": "Greater London",
  "postalCode": "E1 1AA",
  "countryCode": "GB",
  "currency": "GBP"
}
```

Institution profile patch example:

```http
PATCH http://localhost:3003/api/institutions/inst_123
Authorization: Bearer <backend-access-token>
Content-Type: application/json

{
  "name": "SupplyED Academy",
  "domain": "supplyed.test",
  "address": "1 School Road",
  "city": "London",
  "county": "Greater London",
  "postalCode": "SW1A 1AA",
  "countryCode": "GB",
  "complianceContact": "Safeguarding Lead",
  "complianceEmail": "compliance@supplyed.test",
  "registrationId": "URN-12345",
  "safeguardingConfirmed": true,
  "staffingNeeds": "Daily cover",
  "typicalPupilCount": 750,
  "coverTypes": ["Daily cover"],
  "userRole": "Admin"
}
```

Individual recruiter profile patch example:

```http
PATCH http://localhost:3003/api/recruiters/me
Authorization: Bearer <backend-access-token>
Content-Type: application/json

{
  "displayName": "Parent Hiring Account",
  "bio": "Hiring tutors and specialist support",
  "address": "22 Family Road",
  "city": "Manchester",
  "county": "Greater Manchester",
  "postalCode": "M1 1AA",
  "countryCode": "GB"
}
```

Success action response:

```json
{
  "ok": true,
  "message": "Settings saved.",
  "data": {
    "applicationStatus": "approved",
    "role": "institution",
    "user": {
      "id": "user_123",
      "email": "admin@school.test",
      "name": "Admin User",
      "phone": "+441234567890",
      "role": "institution",
      "emailVerified": true,
      "phoneVerified": false,
      "twoFactorEnabled": true,
      "createdAt": "2026-09-01T10:00:00.000Z",
      "updatedAt": "2026-09-22T09:00:00.000Z",
      "lastLogin": "2026-09-22T08:00:00.000Z"
    }
  }
}
```

Validation error example:

```json
{
  "ok": false,
  "message": "Check the highlighted settings and try again.",
  "fieldErrors": {
    "name": "Enter your display name.",
    "domain": "Enter the institution domain."
  }
}
```

Backend error example:

```json
{
  "ok": false,
  "message": "Institution profile was not found."
}
```

### Upload settings profile image

The browser calls `uploadSettingsProfileImageAction(file)`. The server action validates file type and size first.

Allowed file types:

```txt
image/jpeg
image/png
image/webp
```

Maximum size:

```txt
5 MB
```

Backend call order:

1. `POST /users/me/profile-image/upload-url`
2. `PUT <signed uploadUrl>` directly to storage
3. `POST /users/me/profile-image/upload-complete`
4. Revalidate `settings`, `auth`, `auth:me`, `onboarding`

Upload URL request:

```http
POST http://localhost:3003/api/users/me/profile-image/upload-url
Authorization: Bearer <backend-access-token>
Content-Type: application/json

{
  "contentType": "image/png",
  "sizeBytes": 245000
}
```

Upload URL success:

```json
{
  "uploadUrl": "https://storage.example/signed-put-url",
  "fileKey": "profile-images/user_123/avatar.png",
  "requiredHeaders": {
    "x-amz-acl": "private"
  },
  "expiresAt": "2026-09-22T09:20:00.000Z"
}
```

Storage upload:

```http
PUT https://storage.example/signed-put-url
Content-Type: image/png
x-amz-acl: private

<binary file body>
```

Complete request:

```http
POST http://localhost:3003/api/users/me/profile-image/upload-complete
Authorization: Bearer <backend-access-token>
Content-Type: application/json

{
  "fileKey": "profile-images/user_123/avatar.png"
}
```

Action success:

```json
{
  "ok": true,
  "message": "Profile image updated.",
  "data": {
    "imageUrl": "https://signed.example/profile-images/user_123/avatar.png",
    "expiresAt": "2026-09-22T10:00:00.000Z"
  }
}
```

Action error examples:

```json
{
  "ok": false,
  "message": "Profile image must be 5 MB or smaller."
}
```

```json
{
  "ok": false,
  "message": "The backend did not return a profile image upload URL."
}
```

## Job adding and editing API flow

Pages:

- `/post-job`
- `/post-job?jobId={id}` for editing an existing job

Main files:

- `components/organisms/PostJobPage.tsx`
- `features/jobs/use-jobs.ts`
- `features/jobs/actions.ts`
- `features/jobs/schemas.ts`
- `features/jobs/types.ts`

### Create draft job

The browser calls server action `createJobAction(input)`.

Backend call:

```http
POST http://localhost:3003/api/jobs
Authorization: Bearer <backend-access-token>
Content-Type: application/json

{
  "title": "KS2 Supply Teacher",
  "description": "Cover Year 5 for two days.\n\nPosting route: Instant matching.",
  "subject": "Primary",
  "requiredSkills": ["KS2", "Classroom management"],
  "minExperienceYears": 2,
  "address": "1 School Road",
  "city": "London",
  "county": "Greater London",
  "postalCode": "SW1A 1AA",
  "countryCode": "GB",
  "startDate": "2026-10-01",
  "endDate": "2026-10-02",
  "keyStages": ["KS2"],
  "parkingInfo": "On-site parking available",
  "payAmount": 180,
  "payType": "daily",
  "expiresAt": "2026-09-30T23:59:59.000Z",
  "documentRequirementIds": ["req_dbs", "req_cv"]
}
```

The frontend removes empty strings, empty arrays, `null`, and `undefined` fields before sending the backend payload. It also trims strings, normalizes `countryCode` to uppercase, normalizes `postalCode` to uppercase, and drops invalid negative numeric values.

Backend success example:

```json
{
  "id": "job_123",
  "postedByUserId": "user_123",
  "title": "KS2 Supply Teacher",
  "description": "Cover Year 5 for two days.\n\nPosting route: Instant matching.",
  "subject": "Primary",
  "requiredSkills": ["KS2", "Classroom management"],
  "minExperienceYears": 2,
  "address": "1 School Road",
  "city": "London",
  "county": "Greater London",
  "postalCode": "SW1A 1AA",
  "countryCode": "GB",
  "startDate": "2026-10-01T00:00:00.000Z",
  "endDate": "2026-10-02T00:00:00.000Z",
  "keyStages": ["KS2"],
  "parkingInfo": "On-site parking available",
  "payAmount": 180,
  "payType": "daily",
  "status": "DRAFT",
  "expiresAt": "2026-09-30T23:59:59.000Z",
  "createdAt": "2026-09-22T09:00:00.000Z",
  "updatedAt": "2026-09-22T09:00:00.000Z"
}
```

Server action response:

```json
{
  "ok": true,
  "message": "Job saved as draft.",
  "data": {
    "id": "job_123",
    "title": "KS2 Supply Teacher",
    "school": "Hiring account",
    "city": "London",
    "county": "Greater London",
    "postalCode": "SW1A 1AA",
    "subject": "Primary",
    "keyStage": "KS2",
    "keyStages": ["KS2"],
    "requiredSkills": ["KS2", "Classroom management"],
    "rate": 180,
    "payAmount": 180,
    "payType": "daily",
    "status": "DRAFT",
    "mode": "instant",
    "date": "Thu, 1 Oct - Fri, 2 Oct",
    "postedAt": "recently",
    "urgent": false,
    "postedByUserId": "user_123",
    "description": "Cover Year 5 for two days.\n\nPosting route: Instant matching.",
    "address": "1 School Road",
    "countryCode": "GB",
    "latitude": null,
    "longitude": null,
    "parkingInfo": "On-site parking available",
    "minExperienceYears": 2,
    "startDate": "2026-10-01T00:00:00.000Z",
    "endDate": "2026-10-02T00:00:00.000Z",
    "expiresAt": "2026-09-30T23:59:59.000Z",
    "createdAt": "2026-09-22T09:00:00.000Z",
    "updatedAt": "2026-09-22T09:00:00.000Z"
  }
}
```

### Create and publish job

If the form status is `ACTIVE`, the frontend first creates the job, then activates it with a second backend call.

Backend call order:

1. `POST /jobs`
2. `PATCH /jobs/{created.id}` with `{ "status": "ACTIVE" }`
3. Revalidate `jobs`, `jobs:mine`, and `job:{id}`

Activation request:

```http
PATCH http://localhost:3003/api/jobs/job_123
Authorization: Bearer <backend-access-token>
Content-Type: application/json

{
  "status": "ACTIVE"
}
```

Action success:

```json
{
  "ok": true,
  "message": "Job published.",
  "data": {
    "id": "job_123",
    "title": "KS2 Supply Teacher",
    "status": "ACTIVE",
    "mode": "instant",
    "rate": 180
  }
}
```

### Edit job

The browser first loads owned jobs with `GET /api/jobs/mine`, finds the requested `jobId`, and fills the edit form. Saving calls `updateJobAction(input)`.

Backend call:

```http
PATCH http://localhost:3003/api/jobs/job_123
Authorization: Bearer <backend-access-token>
Content-Type: application/json

{
  "title": "Updated KS2 Supply Teacher",
  "description": "Updated description",
  "status": "ACTIVE",
  "payAmount": 190,
  "payType": "daily",
  "keyStages": ["KS2"],
  "requiredSkills": ["KS2", "SEN"]
}
```

Action success:

```json
{
  "ok": true,
  "message": "Job updated.",
  "data": {
    "id": "job_123",
    "title": "Updated KS2 Supply Teacher",
    "status": "ACTIVE",
    "rate": 190
  }
}
```

Job save error examples:

```json
{
  "ok": false,
  "message": "Job could not be saved. Check the details and try again."
}
```

```json
{
  "ok": false,
  "code": "SESSION_EXPIRED",
  "message": "Your session expired. Sign in again to continue."
}
```

## Job fetching API flow

Pages:

- `/find-jobs`
- `/job-detail?jobId={id}`
- `/applications?jobId={id}`
- Teacher dashboard recommended jobs

Main files:

- `features/jobs/use-jobs.ts`
- `features/jobs/queries.ts`
- `app/api/jobs/route.ts`
- `app/api/jobs/mine/route.ts`
- `app/api/jobs/[id]/route.ts`
- `features/matching/use-matching.ts`
- `features/matching/queries.ts`

### Public job list

Browser call:

```http
GET http://localhost:3000/api/jobs?search=maths&subject=Primary&keyStage=KS2&mode=instant&urgent=true&status=ACTIVE
Cookie: next-auth session cookie
```

Next route reads query filters and calls backend:

```http
GET http://localhost:3003/api/jobs
Authorization: Bearer <backend-access-token>
```

Filtering is applied in the frontend server after the backend returns the array. Current supported local filters:

```txt
search
subject
keyStage
mode=brief|instant
urgent=true|false
status=ACTIVE|CLOSED|DRAFT|EXPIRED
```

Browser response example:

```json
[
  {
    "id": "job_123",
    "title": "KS2 Supply Teacher",
    "description": "Cover Year 5 for two days.",
    "subject": "Primary",
    "requiredSkills": ["KS2", "Classroom management"],
    "minExperienceYears": 2,
    "address": "1 School Road",
    "city": "London",
    "county": "Greater London",
    "postalCode": "SW1A 1AA",
    "countryCode": "GB",
    "latitude": null,
    "longitude": null,
    "startDate": "2026-10-01T00:00:00.000Z",
    "endDate": "2026-10-02T00:00:00.000Z",
    "date": "Thu, 1 Oct - Fri, 2 Oct",
    "keyStage": "KS2",
    "keyStages": ["KS2"],
    "parkingInfo": "On-site parking available",
    "payAmount": 180,
    "payType": "daily",
    "rate": 180,
    "school": "Hiring account",
    "status": "ACTIVE",
    "mode": "instant",
    "postedAt": "recently",
    "postedByUserId": "user_123",
    "urgent": false,
    "expiresAt": "2026-09-30T23:59:59.000Z",
    "createdAt": "2026-09-22T09:00:00.000Z",
    "updatedAt": "2026-09-22T09:00:00.000Z"
  }
]
```

### My jobs list

Browser call:

```http
GET http://localhost:3000/api/jobs/mine?status=ACTIVE
Cookie: next-auth session cookie
```

Backend call:

```http
GET http://localhost:3003/api/jobs/mine
Authorization: Bearer <backend-access-token>
```

The same local filters are supported as `/api/jobs`.

### Job detail

Browser call:

```http
GET http://localhost:3000/api/jobs/job_123
```

Backend call:

```http
GET http://localhost:3003/api/jobs/job_123
Authorization: Bearer <backend-access-token>
```

Owner view call:

```http
GET http://localhost:3000/api/jobs/job_123?scope=mine
```

Owner view backend order:

1. `GET /jobs/mine`
2. Find matching `job_123` locally.
3. If not found, fallback to `GET /jobs/job_123`.

Not found response:

```json
{
  "message": "Job not found."
}
```

### Recommended jobs for teachers

Browser call:

```http
GET http://localhost:3000/api/matching/jobs/recommended?page=1&limit=20&minScore=0
```

Backend call:

```http
GET http://localhost:3003/api/matching/jobs/recommended?page=1&limit=20&minScore=0
Authorization: Bearer <backend-access-token>
```

Response example:

```json
{
  "jobs": [
    {
      "job": {
        "id": "job_123",
        "title": "KS2 Supply Teacher",
        "status": "ACTIVE",
        "subject": "Primary",
        "rate": 180
      },
      "match": {
        "score": 92,
        "reasons": ["Subject match", "Within travel distance"]
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false
  }
}
```

### Recommended instructors for a job

Browser call:

```http
GET http://localhost:3000/api/matching/jobs/job_123/instructors?page=1&limit=20&minScore=50
```

Backend call:

```http
GET http://localhost:3003/api/matching/jobs/job_123/instructors?page=1&limit=20&minScore=50
Authorization: Bearer <backend-access-token>
```

### Ranked applications for a job

Browser call:

```http
GET http://localhost:3000/api/matching/jobs/job_123/applications?page=1&limit=20&minScore=0
```

Backend call:

```http
GET http://localhost:3003/api/matching/jobs/job_123/applications?page=1&limit=20&minScore=0
Authorization: Bearer <backend-access-token>
```

### Job match score

Browser call:

```http
GET http://localhost:3000/api/matching/jobs/job_123/score
```

Backend call:

```http
GET http://localhost:3003/api/matching/jobs/job_123/score
Authorization: Bearer <backend-access-token>
```

## Two-factor authentication flow

2FA has two separate parts:

1. Managing 2FA from the settings/security UI after login.
2. Completing login when the password is correct and backend requires 2FA.

Main files:

- `components/organisms/SecurityPage.tsx`
- `components/organisms/LoginRouteClient.tsx`
- `components/organisms/TwoFactorChallengePage.tsx`
- `features/auth/two-factor-actions.ts`
- `features/auth/backend.ts`
- `features/auth/actions.ts`

### Load 2FA status in settings

Server action:

```txt
getTwoFactorStatusAction()
```

Backend call:

```http
GET http://localhost:3003/api/auth/2fa/status
Authorization: Bearer <backend-access-token>
```

Success:

```json
{
  "ok": true,
  "data": {
    "enabled": false,
    "recoveryCodesRemaining": 0,
    "setupPending": false
  }
}
```

Error:

```json
{
  "ok": false,
  "message": "We could not load two-factor authentication status."
}
```

### Start 2FA setup

Server action:

```txt
startTwoFactorSetupAction()
```

Backend call:

```http
POST http://localhost:3003/api/auth/2fa/setup
Authorization: Bearer <backend-access-token>
```

Success:

```json
{
  "ok": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "otpAuthUri": "otpauth://totp/SupplyED:admin@school.test?secret=JBSWY3DPEHPK3PXP&issuer=SupplyED",
    "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

The user scans the QR code or manually enters the secret into an authenticator app. This action starts setup but does not enable 2FA yet.

### Enable 2FA

The user enters a 6-digit authenticator code. Recovery codes are created only after the backend verifies the setup code.

Server action:

```txt
enableTwoFactorAction(formData)
```

Backend call:

```http
POST http://localhost:3003/api/auth/2fa/enable
Authorization: Bearer <backend-access-token>
Content-Type: application/json

{
  "code": "123456"
}
```

Success:

```json
{
  "ok": true,
  "message": "Two-factor authentication is now enabled.",
  "data": {
    "recoveryCodes": [
      "ABCD-EFGH-JKLM-NPQR",
      "2345-6789-ABCD-EFGH"
    ]
  }
}
```

Validation error before backend call:

```json
{
  "ok": false,
  "message": "Enter the 6-digit code from your authenticator app.",
  "fieldErrors": {
    "code": "Enter the 6-digit code from your authenticator app."
  }
}
```

Backend verification error:

```json
{
  "ok": false,
  "message": "Invalid two-factor code.",
  "fieldErrors": {
    "code": "Check the authenticator code and try again."
  }
}
```

### Regenerate recovery codes

The user must enter either a current 6-digit authenticator code or one valid recovery code.

Server action:

```txt
regenerateTwoFactorRecoveryCodesAction(formData)
```

Backend call:

```http
POST http://localhost:3003/api/auth/2fa/recovery-codes
Authorization: Bearer <backend-access-token>
Content-Type: application/json

{
  "code": "123456"
}
```

Recovery code input format is also accepted:

```json
{
  "code": "ABCD-EFGH-JKLM-NPQR"
}
```

Success:

```json
{
  "ok": true,
  "message": "New recovery codes generated.",
  "data": {
    "recoveryCodes": [
      "WXYZ-2345-6789-ABCD",
      "EFGH-JKLM-NPQR-STUV"
    ]
  }
}
```

### Disable 2FA

The user must enter either a current authenticator code or one recovery code.

Server action:

```txt
disableTwoFactorAction(formData)
```

Backend call:

```http
POST http://localhost:3003/api/auth/2fa/disable
Authorization: Bearer <backend-access-token>
Content-Type: application/json

{
  "code": "123456"
}
```

Success:

```json
{
  "ok": true,
  "message": "Two-factor authentication is disabled.",
  "data": {
    "enabled": false,
    "recoveryCodesRemaining": 0,
    "setupPending": false
  }
}
```

### Login with 2FA enabled

Login starts with the normal email/password action.

Backend call:

```http
POST http://localhost:3003/api/auth/login
Content-Type: application/json

{
  "email": "admin@school.test",
  "password": "CorrectHorseBatteryStaple1!"
}
```

If 2FA is enabled, the backend does not return normal access/refresh tokens yet. It returns a 2FA challenge:

```json
{
  "twoFactorRequired": true,
  "twoFactorToken": "temporary-two-factor-token",
  "expiresInMinutes": 5
}
```

Frontend action response:

```json
{
  "ok": true,
  "message": "Enter your authenticator or recovery code to finish signing in.",
  "data": {
    "code": "TWO_FACTOR_REQUIRED",
    "email": "admin@school.test",
    "twoFactorRequired": true,
    "twoFactorToken": "temporary-two-factor-token",
    "expiresInMinutes": 5
  }
}
```

The login page switches to the two-factor challenge screen. The user enters either a 6-digit authenticator code or a recovery code.

2FA login verify backend call:

```http
POST http://localhost:3003/api/auth/2fa/verify
Authorization: Bearer temporary-two-factor-token
Content-Type: application/json

{
  "code": "123456"
}
```

2FA login verify backend success:

```json
{
  "accessToken": "backend-access-token",
  "refreshToken": "backend-refresh-token",
  "accessTokenExpiresInSeconds": 900,
  "user": {
    "id": "user_123",
    "email": "admin@school.test",
    "emailVerified": true,
    "role": "INSTITUTION",
    "institutionProfileId": "inst_123",
    "applicationStatus": "approved"
  }
}
```

After successful verification, the frontend:

1. Normalizes the backend user role and profile status.
2. Creates a temporary verified email session ticket.
3. Calls NextAuth credentials sign-in with that ticket.
4. Stores backend access token and refresh token in the NextAuth JWT.
5. Redirects using `getAuthenticatedEntryHref()`.

Frontend action response after 2FA verification:

```json
{
  "ok": true,
  "message": "Two-factor authentication verified.",
  "data": {
    "nextHref": "/dashboard",
    "ticket": "verified-email-session-ticket"
  }
}
```

2FA login validation error:

```json
{
  "ok": false,
  "message": "Enter a 6-digit authenticator code or a valid recovery code.",
  "fieldErrors": {
    "code": "Enter a 6-digit authenticator code or a valid recovery code."
  }
}
```

Expired challenge error:

```json
{
  "ok": false,
  "message": "Sign in again before entering your two-factor code.",
  "fieldErrors": {
    "code": "Sign in again before entering your two-factor code."
  }
}
```

## Source map

Settings:

- `app/api/settings/profile/route.ts`
- `features/settings/queries.ts`
- `features/settings/actions.ts`
- `features/settings/use-settings.ts`
- `features/settings/types.ts`

Jobs:

- `app/api/jobs/route.ts`
- `app/api/jobs/mine/route.ts`
- `app/api/jobs/[id]/route.ts`
- `features/jobs/actions.ts`
- `features/jobs/queries.ts`
- `features/jobs/schemas.ts`
- `features/jobs/use-jobs.ts`
- `features/jobs/types.ts`

Matching and job fetching:

- `features/matching/queries.ts`
- `features/matching/use-matching.ts`
- `app/api/matching/jobs/recommended/route.ts`
- `app/api/matching/jobs/[jobId]/applications/route.ts`
- `app/api/matching/jobs/[jobId]/instructors/route.ts`
- `app/api/matching/jobs/[jobId]/score/route.ts`

Two-factor:

- `features/auth/two-factor-actions.ts`
- `features/auth/backend.ts`
- `features/auth/actions.ts`
- `components/organisms/SecurityPage.tsx`
- `components/organisms/LoginRouteClient.tsx`
- `components/organisms/TwoFactorChallengePage.tsx`

Shared auth/token infrastructure:

- `lib/server/api-client.ts`
- `lib/server/auth-context.ts`
- `lib/server/token-refresh.ts`
- `lib/server/action-response.ts`
- `lib/server/route-error.ts`
