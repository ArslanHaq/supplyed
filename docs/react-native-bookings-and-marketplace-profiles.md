# React Native: bookings and marketplace profiles

This guide covers the mobile integration for latest conversations, paginated booking lists, booking filters, safe teacher/school profile views, and profile reviews.

## API conventions

The REST base path is `/api`. All endpoints in this guide require a signed-in access token:

```http
Authorization: Bearer <access-token>
Accept: application/json
```

Successful backend responses use an envelope. Read the endpoint result from `payload.data`:

```ts
export type ApiSuccess<T> = {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    path: string;
    method: string;
  };
};

export type ApiFailure = {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  data: null;
  code?: string;
};
```

Keep access and refresh tokens in the mobile app's secure credential storage. Do not put tokens in URLs, navigation parameters, logs, Redux persistence, or AsyncStorage.

## Shared request helper

```ts
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function apiGet<T>(
  path: string,
  accessToken: string,
  query: Record<string, string | number | boolean | null | undefined> = {},
): Promise<T> {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_URL}${path}${suffix}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if (!response.ok || !payload.success) {
    const message = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message;
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return payload.data;
}
```

## Paginated bookings

Use this endpoint for both teachers and schools:

```http
GET /api/bookings/me
```

Supported query parameters:

| Parameter | Accepted values | Purpose |
| --- | --- | --- |
| `page` | Integer starting at `1` | Requested page |
| `limit` | Integer from `1` to `100` | Rows per page |
| `status` | `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW` | Exact booking status |
| `search` | Up to 100 characters | Job title, teacher name, or school name |
| `jobId` | Job UUID | Bookings for one job |
| `from` | ISO date or date-time | Booking overlaps or continues after this value |
| `to` | ISO date or date-time | Booking begins on or before this value |
| `invoice` | `none`, `unpaid`, `paid` | Current invoice state |

Filters combine with AND logic. A plain `YYYY-MM-DD` value for `to` includes the full day. The API returns `400` when `from` is later than `to`.

```ts
export type BookingStatus =
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type BookingInvoiceFilter = 'none' | 'unpaid' | 'paid';

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

export type Booking = {
  id: string;
  applicationId: string;
  status: BookingStatus;
  job: {
    id: string;
    title: string;
    description: string;
    subject: string | null;
    keyStages: string[];
    address: string | null;
    city: string | null;
    county: string | null;
    postalCode: string | null;
    parkingInfo: string | null;
  };
  instructor: {
    id: string;
    fullName: string;
    imageUrl: string | null;
  };
  institution: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  startDate: string | null;
  endDate: string | null;
  payAmount: number | null;
  payType: string | null;
  invoice: {
    id: string;
    status: 'OPEN' | 'PAID' | 'UNCOLLECTIBLE';
    totalAmountPence: number;
    hostedInvoiceUrl: string | null;
    dueAt: string | null;
    paidAt: string | null;
  } | null;
};

export type BookingsPage = {
  bookings: Booking[];
  pagination: Pagination;
};
```

Example service:

```ts
export type BookingQuery = {
  page?: number;
  limit?: number;
  status?: BookingStatus;
  search?: string;
  jobId?: string;
  from?: string;
  to?: string;
  invoice?: BookingInvoiceFilter;
};

export function getMyBookings(accessToken: string, query: BookingQuery) {
  return apiGet<BookingsPage>('/api/bookings/me', accessToken, query);
}
```

When a search, status, date, job, or invoice filter changes, reset `page` to `1`. Disable Previous when `pagination.page <= 1` and disable Next when `pagination.hasNextPage` is false.

With TanStack Query, include every filter in the query key:

```ts
export function useBookings(accessToken: string, query: BookingQuery) {
  return useQuery({
    enabled: Boolean(accessToken),
    queryKey: ['bookings', 'me', query],
    queryFn: () => getMyBookings(accessToken, query),
  });
}
```

For a FlatList, replace the current rows when the filter or page changes. If mobile uses infinite scrolling instead, append later pages and use `hasNextPage` as `onEndReached`'s guard.

## Latest three conversations

Use the first page with a limit of three for the dashboard message preview:

```http
GET /api/conversations?page=1&limit=3
```

The backend orders conversations by the latest message activity, so these are the three most recently active threads. A person may appear more than once when they applied to more than one job.

```ts
export type ConversationSummary = {
  id: string;
  applicationId: string;
  applicationStatus: string;
  readOnly: boolean;
  job: { id: string; title: string };
  me: 'instructor' | 'poster';
  counterpart: {
    id: string | null;
    name: string;
    imageUrl: string | null;
    role: 'teacher' | 'school';
  };
  lastMessage: {
    body: string;
    fromMe: boolean;
    hasAttachments: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
  counterpartLastReadAt: string | null;
  lastMessageAt: string | null;
  createdAt: string;
};

export type ConversationsPage = {
  conversations: ConversationSummary[];
  pagination: Pagination;
};

export function getLatestConversations(accessToken: string) {
  return apiGet<ConversationsPage>('/api/conversations', accessToken, {
    page: 1,
    limit: 3,
  });
}
```

Use `counterpart.name` and `counterpart.imageUrl` for the identity, `lastMessage.body` for the preview, and `lastMessage.createdAt` for the time. Show an empty-thread label when `lastMessage` is `null`. Use `counterpart.id` for profile navigation only when it is non-null and choose the destination from `counterpart.role`.

## Safe teacher profile

Schools open an applicant's public profile with the instructor profile ID:

```http
GET /api/instructors/profile/:instructorProfileId
```

The profile ID is available as:

- `application.instructor.id` in application and matching results
- `booking.instructor.id` in booking results
- `conversation.counterpart.id` when `conversation.counterpart.role === 'teacher'`

```ts
export type InstructorPublicProfile = {
  id: string;
  fullName: string;
  imageUrl: string | null;
  bio: string | null;
  city: string | null;
  county: string | null;
  subjects: string[];
  skills: string[];
  keyStages: string[];
  experience: number | null;
  hourlyRate: number | null;
  dailyRate: number | null;
  currency: string | null;
  ratingAverage: number;
  ratingCount: number;
  dbsVerified: boolean;
  memberSince: string | null;
};

export function getInstructorProfile(accessToken: string, profileId: string) {
  return apiGet<InstructorPublicProfile>(
    `/api/instructors/profile/${encodeURIComponent(profileId)}`,
    accessToken,
  );
}
```

On applicant-name press, navigate with the profile ID:

```tsx
<Pressable
  onPress={() => navigation.navigate('InstructorProfile', {
    instructorProfileId: application.instructor.id,
  })}
>
  <Text>{application.instructor.fullName}</Text>
</Pressable>
```

## Safe school profile

Teachers open a school's public profile with the institution profile ID:

```http
GET /api/institutions/profile/:institutionProfileId
```

The profile ID is available as:

- `job.institution.id` in current job discovery/detail results
- `booking.institution.id` in booking results
- `conversation.counterpart.id` when `conversation.counterpart.role === 'school'`

```ts
export type InstitutionPublicProfile = {
  id: string;
  name: string;
  imageUrl: string | null;
  institutionType: 'SINGLE_SCHOOL' | 'MAT_SCHOOL';
  trust: { name: string } | null;
  address: string;
  city: string;
  county: string | null;
  postalCode: string | null;
  staffingNeeds: string | null;
  coverTypes: string[];
  typicalPupilCount: number | null;
  verified: boolean;
  memberSince: string | null;
};

export function getInstitutionProfile(accessToken: string, profileId: string) {
  return apiGet<InstitutionPublicProfile>(
    `/api/institutions/profile/${encodeURIComponent(profileId)}`,
    accessToken,
  );
}
```

On school-name press from a job detail:

```tsx
<Pressable
  disabled={!job.institution?.id}
  onPress={() => navigation.navigate('InstitutionProfile', {
    institutionProfileId: job.institution!.id,
  })}
>
  <Text>{job.institution?.name ?? job.school}</Text>
</Pressable>
```

The job response's safe institution summary contains only `id`, `name`, and `imageUrl`. Fetch the full safe marketplace view from `/api/institutions/profile/:institutionProfileId` after navigation.

On school-name press from a booking:

```tsx
<Pressable
  onPress={() => navigation.navigate('InstitutionProfile', {
    institutionProfileId: booking.institution.id,
  })}
>
  <Text>{booking.institution.name}</Text>
</Pressable>
```

Do not pass `job.postedByUserId` to the institution profile endpoint. It is a user ID, while this endpoint requires `job.institution.id`, `booking.institution.id`, or a school conversation counterpart profile ID.

## Profile reviews

Load reviews beside the matching public profile:

```http
GET /api/reviews/instructor/:instructorProfileId?page=1&limit=20
GET /api/reviews/institution/:institutionProfileId?page=1&limit=20
```

```ts
export type ProfileReview = {
  id: string;
  bookingId: string;
  reviewerType: 'INSTRUCTOR' | 'INSTITUTION';
  rating: number;
  comment: string | null;
  jobTitle?: string;
  reviewerName?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewsPage = {
  reviews: ProfileReview[];
  pagination: Pagination;
};

export function getInstitutionReviews(accessToken: string, institutionProfileId: string, page = 1) {
  return apiGet<ReviewsPage>(
    `/api/reviews/institution/${encodeURIComponent(institutionProfileId)}`,
    accessToken,
    { page, limit: 20 },
  );
}
```

Use the instructor endpoint in the same way for teacher profiles. Ratings are integers from `1` through `5`. The response does not include a separate average, so calculate the displayed average from the loaded reviews, and use `pagination.total` for the overall review count. Treat each returned review as verified booking feedback because reviews can only be created against completed marketplace bookings.

## Profile visibility errors

These profile routes are authenticated marketplace views, not anonymous public pages:

- `403`: the signed-in role or profile status is not allowed to view the target
- `404`: the target does not exist or is intentionally hidden because it is inactive
- `401`: the access token is missing, expired, or invalid

Show a neutral unavailable state for `403` and `404`. On `401`, run the app's normal refresh-token flow once; if refresh fails, clear the session and return to sign-in.

## Display rules

- Treat returned dates as ISO UTC strings and format them in the device's local timezone.
- Display `invoice.totalAmountPence` by dividing by 100; it is a minor-unit amount.
- `payAmount`, `dailyRate`, and `hourlyRate` are already major currency units.
- Render only fields returned by the public-profile endpoints. Email, precise coordinates, compliance internals, and billing data are deliberately absent.
- Pass profile IDs through typed navigation parameters and refetch the profile on the destination screen.
