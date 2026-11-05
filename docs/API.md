# Growing Minds Academy — REST API Reference

This document describes the **real, implemented** HTTP API served by `server.ts`
(Express). On Vercel the same Express app is exported from `api/index.ts` as a
serverless function, so the routes below are identical in both deployment modes.

- **Base URL (local):** `http://localhost:3000`
- **Content type:** `application/json` for all request and response bodies
  (request body limit: `1mb`).
- **Version:** `1.0.0` (reported by `/api/health`).

---

## Authentication model

Two independent login flows issue JSON Web Tokens. Every protected route expects
the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

| Actor | Login endpoint | Token | Notes |
| --- | --- | --- | --- |
| Staff (admin / teacher) | `POST /api/auth/staff-login` | Supabase Auth session access token (verified against Supabase) | Signs in by email **or** a short `username` that maps to a profile email. |
| Learner | `POST /api/auth/learner-login` | Locally-signed JWT | Signed with `SUPABASE_JWT_SECRET`, 12-hour expiry (single school day). |

`requireAuth` accepts, in order: a locally-signed **learner** token, a valid
**Supabase** session token whose user has a recognized `admin`/`teacher`
profile, then a locally-signed **staff** token. Anything else is rejected with
`401`.

`requireRole([...roles])` runs after `requireAuth` and returns `403` when the
authenticated role is not in the allowed set.

### Roles

- `admin` — full control of the directory and quizzes.
- `teacher` — read-only directory access (scoped to their classes) and quiz
  authoring for their own assessments / assigned classes.
- `learner` — read published quizzes, submit attempts, view released results.

### Fail-closed behaviour

There is **no local in-memory fallback store**. When Supabase is not configured:

- Data routes return `503` (e.g. *"Production storage is unavailable. Database
  connection required."*).
- Auth routes return `503` (e.g. *"Authentication service unavailable. A
  configured Supabase connection is required to sign in."*).

### Error envelope

Errors are returned as JSON with a single `error` string field:

```json
{ "error": "Human-readable message." }
```

Status codes used across the API: `400`, `401`, `403`, `404`, `409`, `429`,
`500`, `502`, `503`. `429` is returned for rate limiting and brute-force
lockouts.

### Rate limiting / lockout

- `POST /api/auth/staff-login`: 20 requests / 60s per IP → `429`.
- `POST /api/auth/learner-login`: 10 requests / 60s per IP → `429`.
- Account lockout: 5 consecutive failed attempts → 15-minute lockout (both
  staff and learner flows).

---

## Endpoint summary

| # | Method | Path | Access |
| --- | --- | --- | --- |
| 1 | GET | `/api/health` | Public |
| 2 | POST | `/api/auth/staff-login` | Public |
| 3 | POST | `/api/auth/learner-login` | Public |
| 4 | GET | `/api/auth/me` | Auth |
| 5 | POST | `/api/staff` | Admin |
| 6 | GET | `/api/learners` | Admin, Teacher |
| 7 | POST | `/api/learners` | Admin |
| 8 | PUT | `/api/learners/:id` | Admin |
| 9 | DELETE | `/api/learners/:id` | Admin |
| 10 | GET | `/api/subjects` | Admin, Teacher |
| 11 | POST | `/api/subjects` | Admin |
| 12 | PUT | `/api/subjects/:id` | Admin |
| 13 | GET | `/api/classes` | Admin, Teacher |
| 14 | POST | `/api/classes` | Admin |
| 15 | PUT | `/api/classes/:id` | Admin |
| 16 | GET | `/api/teachers` | Admin, Teacher |
| 17 | POST | `/api/teachers` | Admin |
| 18 | PUT | `/api/teachers/:id` | Admin |
| 19 | GET | `/api/quizzes` | Auth (role-aware) |
| 20 | GET | `/api/quizzes/:id` | Auth (role-aware) |
| 21 | POST | `/api/quizzes` | Admin, Teacher |
| 22 | PUT | `/api/quizzes/:id` | Admin, Teacher |
| 23 | POST | `/api/quizzes/:id/publish` | Admin, Teacher |
| 24 | POST | `/api/quizzes/:id/close` | Admin, Teacher |
| 25 | POST | `/api/quizzes/:id/assign` | Admin, Teacher |
| 26 | DELETE | `/api/quizzes/:id` | Admin, Teacher |
| 27 | GET | `/api/quizzes/:id/submissions` | Admin, Teacher |
| 28 | PUT | `/api/submissions/:id/feedback` | Admin, Teacher |
| 29 | POST | `/api/quizzes/:id/release-results` | Admin, Teacher |
| 30 | GET | `/api/quizzes/:id/paper` | Auth (role-aware) |
| 31 | GET | `/api/quizzes/:id/answer-key` | Admin, Teacher |
| 32 | POST | `/api/submissions` | Auth (learner submits) |
| 33 | POST | `/api/submissions/sync` | Auth (offline batch) |
| 34 | GET | `/api/learners/results` | Learner |
| 35 | GET | `/api/ai/client-config` | Admin, Teacher |
| 36 | POST | `/api/ai/generate-quiz` | Admin, Teacher |

No endpoint accepts query-string parameters.

---

## 1. Health

### GET /api/health

Public liveness/configuration probe. Never exposes secrets or connection strings.

- **Auth:** none.
- **Parameters:** none.

**Example request**

```
GET /api/health
```

**Success response — `200`**

```json
{
  "status": "ok",
  "timestamp": "2026-11-05T09:00:00.000Z",
  "service": "Growing Minds Academy Assessment Backend",
  "version": "1.0.0",
  "geminiConfigured": true,
  "groqConfigured": false,
  "aiConfigured": true,
  "supabaseConfigured": true,
  "authMode": "supabase"
}
```

`aiConfigured` is `true` when at least one of Gemini/Groq is configured.
`authMode` is `"supabase"` when Supabase is configured, otherwise
`"strict-production"`. No error responses are defined for this route.

---

## 2. Auth

### POST /api/auth/staff-login

Signs in an admin/teacher. `email` accepts either an email address or a short
username mapped through `user_profiles.username`.

- **Auth:** none.
- **Body:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string | yes | Email address or staff username. |
| `password` | string | yes | Account password. |

**Example request**

```json
{
  "email": "darksyntax",
  "password": "<admin-password>"
}
```

**Success response — `200`**

```json
{
  "token": "<supabase-access-token>",
  "user": {
    "id": "00000000-0000-0000-0000-000000000001",
    "name": "Administrator darksyntax",
    "role": "admin",
    "email": "darksyntax@gma.edu",
    "schoolId": "00000000-0000-0000-0000-000000000001",
    "avatarInitial": "AD"
  }
}
```

**Error responses**

| Status | When |
| --- | --- |
| `400` | Missing/invalid `email` or missing `password`. |
| `401` | Invalid credentials (`"Invalid email or password."` / `"Invalid username or password."`). |
| `429` | IP rate limit (20/60s) exceeded, or account is locked for 15 minutes. |
| `500` | Unexpected error during Supabase verification. |
| `503` | Supabase not configured (fail-closed). |

---

### POST /api/auth/learner-login

Signs in a learner with their student number and 4-digit PIN (salted bcrypt
compared).

- **Auth:** none.
- **Body:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `studentNumber` | string | yes | e.g. `GMA-2026-0301` (trimmed, upper-cased). |
| `pin` | string | yes | Exactly 4 numeric digits. |

**Example request**

```json
{
  "studentNumber": "GMA-2026-0301",
  "pin": "0000"
}
```

**Success response — `200`**

```json
{
  "token": "<locally-signed-learner-jwt>",
  "user": {
    "id": "30000000-0000-0000-0000-000000000001",
    "name": "Thabo Nkosi",
    "role": "learner",
    "learnerId": "GMA-2026-0301",
    "grade": "Grade 3",
    "className": "Grade 3A",
    "avatarInitial": "TN"
  }
}
```

**Error responses**

| Status | When |
| --- | --- |
| `400` | `studentNumber` missing, or `pin` is not exactly 4 digits. |
| `401` | Invalid student number / PIN, or inactive learner. |
| `429` | IP rate limit (10/60s) exceeded, or account/PIN locked. |
| `500` | Server error during learner authentication. |
| `503` | Supabase not configured (fail-closed). |

---

### GET /api/auth/me

Returns the authenticated principal derived from the bearer token.

- **Auth:** `requireAuth`.
- **Parameters:** none.

**Example request**

```
GET /api/auth/me
Authorization: Bearer {{authToken}}
```

**Success response — `200`**

```json
{
  "user": {
    "id": "00000000-0000-0000-0000-000000000001",
    "role": "admin",
    "email": "darksyntax@gma.edu",
    "name": "Administrator darksyntax",
    "schoolId": "00000000-0000-0000-0000-000000000001",
    "assignedClasses": [],
    "assignedSubjects": []
  }
}
```

Learner tokens populate `studentNumber`, `classId`, and `grade` instead of
`email`. Teacher tokens include `assignedClasses` / `assignedSubjects`.

**Error responses:** `401` (`"Missing or malformed Authorization header."` or
`"Unrecognized or expired authentication token."`), and `401`
`"Account has no recognized staff profile in this school."` for a Supabase user
without a staff profile.

---

## 3. Staff / Directory

### POST /api/staff

Creates a new staff account (admin or teacher) through Supabase Auth and a
matching `user_profiles` row.

- **Auth:** `requireAuth`, `requireRole(['admin'])`.
- **Body:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string | yes | Must contain `@`. |
| `password` | string | yes | Minimum 8 characters. |
| `name` | string | yes | Non-empty full name. |
| `role` | `"teacher"` \| `"admin"` | no | Defaults to `"teacher"`. |
| `assignedClasses` | string[] | no | Defaults to `[]`. |
| `assignedSubjects` | string[] | no | Defaults to `[]`. |
| `schoolId` | string | no | Defaults to the caller's `schoolId`. |

**Example request**

```json
{
  "email": "new.teacher@gma.edu",
  "password": "<teacher-password>",
  "name": "Jane Dlamini",
  "role": "teacher"
}
```

**Success response — `201`**

```json
{
  "user": {
    "id": "<auth-user-uuid>",
    "name": "Jane Dlamini",
    "email": "new.teacher@gma.edu",
    "role": "teacher",
    "schoolId": "00000000-0000-0000-0000-000000000001"
  }
}
```

**Error responses**

| Status | When |
| --- | --- |
| `400` | Invalid email, missing name, password < 8 chars, invalid role, or Supabase rejected account creation. |
| `401` / `403` | Missing token / non-admin role (from the auth middlewares). |
| `500` | Profile insertion or unexpected error. |
| `503` | Supabase not configured (fail-closed). |

---

### GET /api/learners

Lists the learner directory for the caller's school. Teachers are restricted to
learners in their assigned classes (teachers with no assigned classes receive an
empty list).

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Parameters:** none.

**Example request**

```
GET /api/learners
Authorization: Bearer {{authToken}}
```

**Success response — `200`**

```json
{
  "learners": [
    {
      "id": "GMA-2026-0301",
      "firstName": "Thabo",
      "lastName": "Nkosi",
      "grade": "Grade 3",
      "classId": "cls-3a",
      "className": "Grade 3A",
      "pin": "",
      "isActive": true,
      "enrolledDate": "2026-01-15T00:00:00.000Z",
      "lastActive": "2026-11-05T08:00:00.000Z",
      "guardianContact": "+27 82 000 0000"
    }
  ],
  "persisted": true
}
```

`pin` is always returned empty — hashes are never exposed.

**Error responses:** `500` (`"Failed to load learners: ..."`), `503` (Supabase
not configured).

---

### POST /api/learners

Registers a new learner. The student number is auto-generated as
`GMA-<year>-<sequence>` and the PIN is bcrypt-hashed.

- **Auth:** `requireAuth`, `requireRole(['admin'])`.
- **Body:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `firstName` | string | yes | Non-empty. |
| `lastName` | string | yes | Non-empty. |
| `grade` | string | no | Grade label. |
| `classId` | string | no | Class code/UUID; `"all"` or empty means unassigned. |
| `className` | string | no | Display name. |
| `pin` | string | yes | Exactly 4 numeric digits. |
| `guardianContact` | string | no | Guardian contact. |

**Example request**

```json
{
  "firstName": "Lerato",
  "lastName": "Mokoena",
  "grade": "Grade 4",
  "classId": "cls-4a",
  "pin": "1234",
  "guardianContact": "+27 82 111 2222"
}
```

**Success response — `201`**

```json
{
  "learner": {
    "id": "GMA-2026-0304",
    "firstName": "Lerato",
    "lastName": "Mokoena",
    "grade": "Grade 4",
    "classId": "cls-4a",
    "className": "Grade 4A",
    "pin": "",
    "isActive": true,
    "enrolledDate": "2026-11-05T09:00:00.000Z"
  },
  "persisted": true
}
```

**Error responses:** `400` (missing first/last name, or PIN not 4 digits),
`500` (insert error / unexpected), `503` (Supabase not configured).

---

### PUT /api/learners/:id

Updates an existing learner. `:id` is the **student number** (e.g.
`GMA-2026-0301`), trimmed and upper-cased.

- **Auth:** `requireAuth`, `requireRole(['admin'])`.
- **Path parameter:** `id` — student number.
- **Body (all optional):**

| Field | Type | Notes |
| --- | --- | --- |
| `firstName` | string | Non-empty to apply. |
| `lastName` | string | Non-empty to apply. |
| `grade` | string | Grade label. |
| `classId` | string | Replaces class membership; `"all"`/empty clears it. |
| `className` | string | Display name. |
| `pin` | string | If provided and non-empty, must be 4 digits; resets lockout. |
| `guardianContact` | string | Trimmed; empty clears. |
| `isActive` | boolean | Activation toggle. |

**Example request**

```json
{
  "firstName": "Lerato",
  "lastName": "Mokoena",
  "classId": "cls-4a",
  "isActive": true
}
```

**Success response — `200`**

```json
{
  "learner": { "id": "GMA-2026-0301", "firstName": "Lerato", "lastName": "Mokoena", "grade": "Grade 4", "classId": "cls-4a", "className": "Grade 4A", "pin": "", "isActive": true, "enrolledDate": "2026-01-15T00:00:00.000Z" },
  "persisted": true
}
```

**Error responses:** `400` (missing identifier, or PIN not 4 digits), `404`
(`"No learner found with student number <id>."`), `500` (DB error), `503`
(Supabase not configured).

---

### DELETE /api/learners/:id

Deletes a learner by student number. **Blocked** if the learner has any
recorded submissions (to preserve assessment history).

- **Auth:** `requireAuth`, `requireRole(['admin'])`.
- **Path parameter:** `id` — student number.

**Example request**

```
DELETE /api/learners/GMA-2026-0301
Authorization: Bearer {{adminToken}}
```

**Success response — `200`**

```json
{ "success": true, "persisted": true }
```

**Error responses**

| Status | When |
| --- | --- |
| `400` | Missing learner identifier. |
| `404` | No learner found with that student number. |
| `409` | Learner has linked submissions — deactivate instead. |
| `500` | DB error. |
| `503` | Supabase not configured. |

---

### GET /api/subjects

Lists subjects for the caller's school.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Parameters:** none.

**Success response — `200`**

```json
{
  "subjects": [
    {
      "id": "subj-math",
      "name": "Mathematics",
      "code": "MATH-PRI",
      "gradeLevels": ["Grade 3", "Grade 4"],
      "topicCount": 10,
      "description": "Primary mathematics"
    }
  ],
  "persisted": true
}
```

**Error responses:** `500` (`"Failed to load subjects: ..."`), `503` (Supabase
not configured).

---

### POST /api/subjects

Creates a subject. Codes are upper-cased and unique per school.

- **Auth:** `requireAuth`, `requireRole(['admin'])`.
- **Body:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | Non-empty. |
| `code` | string | yes | Non-empty; upper-cased. |
| `topicCount` | number | no | Defaults to `10`. |
| `description` | string | no | Optional. |
| `gradeLevels` | string[] | no | Defaults to `[]`. |

**Example request**

```json
{ "name": "Integrated Science", "code": "SCI-PRI", "topicCount": 12, "gradeLevels": ["Grade 3", "Grade 4"], "description": "Primary science" }
```

**Success response — `201`**

```json
{
  "subject": { "id": "<subject-uuid>", "name": "Integrated Science", "code": "SCI-PRI", "gradeLevels": ["Grade 3", "Grade 4"], "topicCount": 12, "description": "Primary science" },
  "persisted": true
}
```

**Error responses:** `400` (missing name/code), `409` (duplicate code),
`500` (create error), `503` (Supabase not configured).

---

### PUT /api/subjects/:id

Updates a subject.

- **Auth:** `requireAuth`, `requireRole(['admin'])`.
- **Path parameter:** `id` — subject code or UUID.
- **Body (optional):** `name`, `code` (upper-cased), `topicCount`, `description`, `gradeLevels`.

**Success response — `200`**

```json
{ "subject": { "id": "subj-math", "name": "Mathematics", "code": "MATH-PRI", "gradeLevels": ["Grade 3"], "topicCount": 10, "description": "Updated" }, "persisted": true }
```

**Error responses:** `400` (missing identifier or no changes provided), `404`
(`"No matching subject was found."`), `409` (code already in use), `500` (DB
error), `503` (Supabase not configured).

---

### GET /api/classes

Lists classes/grades. Teachers only see classes they form-teach or that are in
their assignment list.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Parameters:** none.

**Success response — `200`**

```json
{
  "classes": [
    {
      "id": "cls-3a",
      "name": "Grade 3A",
      "grade": "Grade 3",
      "classTeacherId": "<teacher-uuid>",
      "classTeacherName": "Jane Dlamini",
      "subjectIds": ["subj-math", "subj-eng"],
      "learnerCount": 24,
      "room": "Room 4"
    }
  ],
  "persisted": true
}
```

**Error responses:** `500` (`"Failed to load classes: ..."`), `503` (Supabase
not configured).

---

### POST /api/classes

Creates a class.

- **Auth:** `requireAuth`, `requireRole(['admin'])`.
- **Body:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | e.g. `Grade 3C`. |
| `grade` | string | yes | Grade level. |
| `classTeacherId` | string | no | Form teacher id (resolved to an existing teacher). |
| `room` | string | no | Optional room. |
| `subjectIds` | string[] | no | Resolved to existing subjects. |

**Example request**

```json
{ "name": "Grade 3C", "grade": "Grade 3", "classTeacherId": "<teacher-uuid>", "room": "Room 5", "subjectIds": ["subj-math"] }
```

**Success response — `201`**

```json
{ "class": { "id": "<class-uuid>", "name": "Grade 3C", "grade": "Grade 3", "classTeacherId": "<teacher-uuid>", "classTeacherName": "Jane Dlamini", "subjectIds": ["subj-math"], "learnerCount": 0, "room": "Room 5" }, "persisted": true }
```

**Error responses:** `400` (missing name/grade), `409` (class name already
exists), `500` (create error), `503` (Supabase not configured).

---

### PUT /api/classes/:id

Updates a class.

- **Auth:** `requireAuth`, `requireRole(['admin'])`.
- **Path parameter:** `id` — class code or UUID.
- **Body (optional):** `name`, `grade`, `classTeacherId`, `room`, `subjectIds`.

**Success response — `200`**

```json
{ "class": { "id": "cls-3a", "name": "Grade 3A", "grade": "Grade 3", "classTeacherId": "", "classTeacherName": "Unassigned", "subjectIds": [], "learnerCount": 0 }, "persisted": true }
```

**Error responses:** `400` (missing identifier or no changes), `404`
(`"No matching class was found."`), `409` (name collision), `500` (DB error),
`503` (Supabase not configured).

---

### GET /api/teachers

Lists faculty for the caller's school.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Parameters:** none.

**Success response — `200`**

```json
{
  "teachers": [
    {
      "id": "<teacher-uuid>",
      "name": "Jane Dlamini",
      "email": "jane.dlamini@gma.edu",
      "role": "Subject Teacher",
      "assignedClasses": ["cls-3a"],
      "assignedSubjects": ["subj-math"],
      "isActive": true,
      "joinedDate": "2026-02-01T00:00:00.000Z"
    }
  ],
  "persisted": true
}
```

`role` is one of `Subject Teacher`, `Lead Teacher`, `Head of Department`
(defaults to `Subject Teacher`).

**Error responses:** `500` (`"Failed to load faculty: ..."`), `503` (Supabase
not configured).

---

### POST /api/teachers

Provisions a teacher: creates the Supabase Auth account, a `user_profiles` row,
and a `teachers` row.

- **Auth:** `requireAuth`, `requireRole(['admin'])`.
- **Body:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | Non-empty. |
| `email` | string | yes | Must contain `@`. |
| `password` | string | yes | Minimum 8 characters. |
| `role` | string | no | One of the teacher roles; defaults to `Subject Teacher`. |
| `assignedClasses` | string[] | no | Defaults to `[]`. |
| `assignedSubjects` | string[] | no | Defaults to `[]`. |

**Example request**

```json
{ "name": "Jane Dlamini", "email": "jane.dlamini@gma.edu", "password": "<teacher-password>", "role": "Lead Teacher", "assignedClasses": ["cls-3a"], "assignedSubjects": ["subj-math"] }
```

**Success response — `201`**

```json
{
  "teacher": {
    "id": "<teacher-uuid>",
    "name": "Jane Dlamini",
    "email": "jane.dlamini@gma.edu",
    "role": "Lead Teacher",
    "assignedClasses": ["cls-3a"],
    "assignedSubjects": ["subj-math"],
    "isActive": true,
    "joinedDate": "2026-11-05T09:00:00.000Z"
  },
  "persisted": true
}
```

**Error responses:** `400` (missing name/email, password < 8, or Supabase Auth
rejection), `500` (profile/teacher row failure — the auth user is rolled back),
`503` (Supabase not configured).

---

### PUT /api/teachers/:id

Updates a teacher (profile, role, assignments, active flag, password).

- **Auth:** `requireAuth`, `requireRole(['admin'])`.
- **Path parameter:** `id` — teacher id (code or UUID).
- **Body (optional):** `name`, `email`, `role`, `assignedClasses`,
  `assignedSubjects`, `isActive`, `password`.

**Success response — `200`**

```json
{ "teacher": { "id": "<teacher-uuid>", "name": "Jane Dlamini", "email": "jane.dlamini@gma.edu", "role": "Subject Teacher", "assignedClasses": [], "assignedSubjects": [], "isActive": true, "joinedDate": "2026-02-01T00:00:00.000Z" }, "persisted": true }
```

**Error responses:** `400` (missing identifier, new password < 8 chars, or email
update rejected), `404` (`"No matching faculty member was found."`), `500` (DB
error — including "updated but could not be re-read"), `503` (Supabase not
configured).

---

## 4. Quizzes

### GET /api/quizzes

Lists quizzes. Responses are role-aware:

- **Teacher:** only their own quizzes or quizzes for their assigned classes.
- **Admin:** all quizzes in the school.
- **Learner:** only quizzes with status `published`, `in_progress`, `closed`,
  or `results_released` that are class-eligible; `correctAnswer` and
  `explanation` are **stripped** from every question.

- **Auth:** `requireAuth`.
- **Parameters:** none.

**Success response — `200`**

```json
{
  "quizzes": [
    {
      "id": "quiz-1730000000000-ab12",
      "schoolId": "00000000-0000-0000-0000-000000000001",
      "title": "Grade 3 Fractions",
      "grade": "Grade 3",
      "classId": "cls-3a",
      "className": "Grade 3A",
      "subjectId": "subj-math",
      "subjectName": "Mathematics",
      "topicsCovered": ["Fractions"],
      "learningObjectives": "Understand halves and quarters.",
      "difficulty": "medium",
      "durationMinutes": 15,
      "instructions": "Answer all questions carefully.",
      "questions": [
        { "id": "q1", "type": "multiple_choice", "prompt": "What is 1/2 of 4?", "options": [{ "id": "a", "text": "2" }, { "id": "b", "text": "3" }], "marks": 2, "topic": "Fractions", "correctAnswer": "a", "explanation": "Half of 4 is 2." }
      ],
      "status": "in_progress",
      "releasePolicy": "manual",
      "allowOffline": true,
      "maxAttempts": 1,
      "dueDate": "2026-11-30T23:59:59.000Z",
      "createdAt": "2026-11-01T08:00:00.000Z",
      "publishedAt": "2026-11-01T09:00:00.000Z",
      "authorId": "<teacher-uuid>",
      "authorName": "Faculty Teacher"
    }
  ]
}
```

For learners, each question omits `correctAnswer` and `explanation`.

**Error responses:** `503` (`"Production storage is unavailable. Database
connection required."`).

---

### GET /api/quizzes/:id

Returns a single quiz. Access is enforced:

- School boundary check (`403` if the quiz belongs to another school).
- Teachers: must be the author or assigned to the quiz's class.
- Learners: draft quizzes are `403`; class-ineligible quizzes are `403`.
  Answers/explanations are stripped **unless** the quiz status is
  `results_released` **and** the learner has a submission.

- **Auth:** `requireAuth`.
- **Path parameter:** `id` — quiz identifier.

**Success response — `200`**

```json
{ "quiz": { "id": "quiz-1730000000000-ab12", "title": "Grade 3 Fractions", "classId": "cls-3a", "className": "Grade 3A", "questions": [], "status": "in_progress" } }
```

**Error responses:** `404` (`"Assessment quiz not found."`), `403` (different
school, not authorized, not published, or class mismatch), `503` (Supabase not
configured).

---

### POST /api/quizzes

Creates an assessment. When `status` is `published` or `in_progress`, the
questions are strictly validated before saving.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Body:**

| Field | Type | Required | Default |
| --- | --- | --- | --- |
| `title` | string | yes | — |
| `grade` | string | yes | — |
| `classId` | string | yes | — |
| `className` | string | no | `classId` |
| `subjectId` | string | no | `subj-general` |
| `subjectName` | string | no | `General` |
| `topicsCovered` | string[] | no | `[]` |
| `learningObjectives` | string | no | `""` |
| `difficulty` | `easy`\|`medium`\|`hard` | no | `medium` |
| `durationMinutes` | number | no | `15` |
| `instructions` | string | no | `"Answer all questions carefully."` |
| `questions` | Question[] | no | `[]` |
| `status` | `draft`\|`published`\|`in_progress` | no | `draft` |
| `releasePolicy` | `manual`\|`automatic` | no | `manual` |
| `allowOffline` | boolean | no | `true` |
| `maxAttempts` | number | no | `1` |
| `dueDate` | string (ISO) | no | — |
| `id` | string | no | generated |

**Question validation rules:** at least one question; each `prompt` non-empty;
`marks` a positive number; `multiple_choice` needs ≥ 2 options and a
`correctAnswer` matching an option id; `true_false` needs `correctAnswer` of
`"true"`/`"false"`; `short_answer` needs a non-empty `correctAnswer`.

**Example request**

```json
{
  "title": "Grade 3 Fractions",
  "grade": "Grade 3",
  "classId": "cls-3a",
  "subjectId": "subj-math",
  "subjectName": "Mathematics",
  "difficulty": "medium",
  "durationMinutes": 15,
  "status": "draft",
  "releasePolicy": "manual",
  "maxAttempts": 1,
  "questions": [
    { "id": "q1", "type": "multiple_choice", "prompt": "What is 1/2 of 4?", "options": [{ "id": "a", "text": "2" }, { "id": "b", "text": "3" }], "correctAnswer": "a", "marks": 2, "topic": "Fractions", "explanation": "Half of 4 is 2." }
  ]
}
```

**Success response — `201`**

```json
{ "quiz": { "id": "quiz-1730000000000-ab12", "title": "Grade 3 Fractions", "status": "draft", "questions": [ { "id": "q1", "type": "multiple_choice", "prompt": "What is 1/2 of 4?", "marks": 2, "topic": "Fractions", "correctAnswer": "a" } ] } }
```

**Error responses:** `400` (missing title/grade/classId, or question validation
failure), `500` (`"Failed to save assessment: ..."`), `503` (Supabase not
configured).

---

### PUT /api/quizzes/:id

Updates a quiz. Question structure/answer keys are **locked** once submissions
exist. Teachers may only modify their own assessments.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Path parameter:** `id` — quiz identifier.
- **Body:** any of the creatable fields (`title`, `grade`, `classId`,
  `className`, `subjectId`, `subjectName`, `topicsCovered`,
  `learningObjectives`, `difficulty`, `durationMinutes`, `instructions`,
  `questions`, `releasePolicy`, `allowOffline`, `maxAttempts`, `dueDate`).

**Success response — `200`**

```json
{ "quiz": { "id": "quiz-1730000000000-ab12", "title": "Grade 3 Fractions (revised)", "status": "draft", "questions": [] } }
```

**Error responses**

| Status | When |
| --- | --- |
| `400` | Questions modified while submissions exist, or question validation failure. |
| `403` | Different school, or a teacher editing another teacher's quiz. |
| `404` | Quiz not found. |
| `503` | Supabase not configured. |

---

### POST /api/quizzes/:id/publish

Publishes a quiz to its assigned cohort (sets status to `in_progress`).

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Path parameter:** `id` — quiz identifier.
- **Body:** none.

**Success response — `200`**

```json
{ "quiz": { "id": "quiz-1730000000000-ab12", "status": "in_progress", "classId": "cls-3a" }, "message": "Assessment published successfully to class cohort." }
```

**Error responses:** `400` (question validation failure, or missing `classId`),
`403` (different school / not the author), `404` (quiz not found), `503`
(Supabase not configured).

---

### POST /api/quizzes/:id/close

Closes a quiz (status → `closed`) so learners can no longer submit.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Path parameter:** `id` — quiz identifier.
- **Body:** none.

**Success response — `200`**

```json
{ "quiz": { "id": "quiz-1730000000000-ab12", "status": "closed" }, "message": "Assessment closed. Learners can no longer submit new attempts." }
```

**Error responses:** `403` (different school / not the author), `404` (quiz not
found), `503` (Supabase not configured).

---

### POST /api/quizzes/:id/assign

Assigns a quiz to a class cohort.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Path parameter:** `id` — quiz identifier.
- **Body:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `classId` | string | yes | Target class. |
| `className` | string | no | Defaults to `classId`. |

**Example request**

```json
{ "classId": "cls-3b", "className": "Grade 3B" }
```

**Success response — `200`**

```json
{ "quiz": { "id": "quiz-1730000000000-ab12", "classId": "cls-3b", "className": "Grade 3B" }, "message": "Assessment successfully assigned to Grade 3B." }
```

**Error responses:** `400` (missing `classId`), `403` (different school / not
the author), `404` (quiz not found), `503` (Supabase not configured).

---

### DELETE /api/quizzes/:id

Deletes a quiz. **Blocked** when learner submissions already exist. Teachers may
only delete their own assessments.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Path parameter:** `id` — quiz identifier.

**Success response — `200`**

```json
{ "success": true, "message": "Assessment \"Grade 3 Fractions\" was deleted successfully." }
```

**Error responses:** `400` (submissions exist), `403` (different school / not
the author), `404` (quiz not found), `500` (delete failed), `503` (Supabase not
configured).

---

### GET /api/quizzes/:id/submissions

Lists all submissions for a quiz.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Path parameter:** `id` — quiz identifier.

**Success response — `200`**

```json
{
  "quizId": "quiz-1730000000000-ab12",
  "quizTitle": "Grade 3 Fractions",
  "totalSubmissions": 1,
  "submissions": [
    {
      "id": "sub-1730000000001-xy99",
      "quizId": "quiz-1730000000000-ab12",
      "quizTitle": "Grade 3 Fractions",
      "subjectName": "Mathematics",
      "learnerId": "<learner-uuid>",
      "learnerName": "Thabo Nkosi",
      "classId": "cls-3a",
      "className": "Grade 3A",
      "answers": { "q1": "a" },
      "answerDetails": [{ "questionId": "q1", "response": "a", "isCorrect": true, "marksAwarded": 2 }],
      "score": 2,
      "totalMarks": 2,
      "percentage": 100,
      "status": "submitted",
      "syncStatus": "synced",
      "isOfflineSubmission": false,
      "submittedAt": "2026-11-05T08:30:00.000Z",
      "syncedAt": "2026-11-05T08:30:01.000Z",
      "topicsToPractise": [],
      "clientSubmissionHash": "hash-..."
    }
  ]
}
```

**Error responses:** `403` (different school, or class outside teacher's
allocation), `404` (quiz not found), `503` (Supabase not configured).

---

### PUT /api/submissions/:id/feedback

Records teacher feedback and/or adjusts a submission's score. The adjusted score
is recalculated into a percentage.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Path parameter:** `id` — submission identifier.
- **Body:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `teacherFeedback` | string | no | Trimmed feedback text. |
| `adjustedScore` | number | no | Must be between `0` and the submission's `totalMarks`. |

**Example request**

```json
{ "teacherFeedback": "Great work on fractions!", "adjustedScore": 2 }
```

**Success response — `200`**

```json
{ "submission": { "id": "sub-1730000000001-xy99", "score": 2, "percentage": 100, "teacherFeedback": "Great work on fractions!" }, "message": "Teacher feedback recorded successfully." }
```

**Error responses:** `400` (adjusted score out of range), `403` (different
school / class outside allocation), `404` (submission not found), `503`
(Supabase not configured).

---

### POST /api/quizzes/:id/release-results

Releases results (status → `results_released`) and marks all associated
submissions as `marked` so learners can view their scores.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Path parameter:** `id` — quiz identifier.
- **Body:** none.

**Success response — `200`**

```json
{ "quiz": { "id": "quiz-1730000000000-ab12", "status": "results_released" }, "message": "Results released successfully." }
```

**Error responses:** `403` (different school / class outside allocation),
`404` (quiz not found), `503` (Supabase not configured).

---

### GET /api/quizzes/:id/paper

Returns a printable examination paper. Correct answers and explanations are
always stripped. Learners get `403` for draft or class-ineligible quizzes.

- **Auth:** `requireAuth`.
- **Path parameter:** `id` — quiz identifier.

**Success response — `200`**

```json
{
  "paper": {
    "institution": "Growing Minds Academy",
    "motto": "Excellence • Integrity • Curiosity",
    "documentType": "Official Assessment Examination Paper",
    "quizId": "quiz-1730000000000-ab12",
    "title": "Grade 3 Fractions",
    "grade": "Grade 3",
    "classId": "cls-3a",
    "className": "Grade 3A",
    "subjectName": "Mathematics",
    "durationMinutes": 15,
    "totalMarks": 2,
    "questionCount": 1,
    "instructions": "Answer all questions carefully.",
    "questions": [
      { "number": 1, "id": "q1", "type": "multiple_choice", "prompt": "What is 1/2 of 4?", "marks": 2, "topic": "Fractions", "options": [{ "id": "a", "text": "2" }, { "id": "b", "text": "3" }] }
    ]
  }
}
```

**Error responses:** `403` (different school, or learner not published/class
mismatch), `404` (`"Assessment quiz not found."`), `503` (Supabase not
configured).

---

### GET /api/quizzes/:id/answer-key

Returns the confidential teacher answer key & mark scheme (including
`correctAnswer` and `explanation`). Forbidden to learners by role gate.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Path parameter:** `id` — quiz identifier.

**Success response — `200`**

```json
{
  "answerKey": {
    "institution": "Growing Minds Academy",
    "isConfidential": true,
    "confidentialityNotice": "CONFIDENTIAL — FOR AUTHORIZED TEACHING STAFF ONLY. STRICTLY PROHIBITED FROM STUDENT ACCESS.",
    "documentType": "Official Teacher Answer Key & Mark Scheme",
    "quizId": "quiz-1730000000000-ab12",
    "title": "Grade 3 Fractions",
    "grade": "Grade 3",
    "classId": "cls-3a",
    "className": "Grade 3A",
    "subjectName": "Mathematics",
    "durationMinutes": 15,
    "totalMarks": 2,
    "questionCount": 1,
    "releasePolicy": "manual",
    "authorName": "Faculty Teacher",
    "questions": [
      { "number": 1, "id": "q1", "type": "multiple_choice", "prompt": "What is 1/2 of 4?", "marks": 2, "topic": "Fractions", "options": [{ "id": "a", "text": "2" }, { "id": "b", "text": "3" }], "correctAnswer": "a", "explanation": "Half of 4 is 2." }
    ]
  }
}
```

**Error responses:** `403` (different school / class outside allocation),
`404` (`"Assessment quiz not found."`), `503` (Supabase not configured).

---

## 5. Submissions

### POST /api/submissions

Records a learner attempt. Marking is **server-side** against the author's
answer key (client-supplied marks/scores are never trusted). The submission hash
provides idempotency.

- **Auth:** `requireAuth`.
- **Body:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `quizId` | string | yes | Target quiz. |
| `answers` | object | yes | Map of `questionId` → response string. |
| `clientSubmissionHash` | string | no | Idempotency key. |
| `isOfflineSubmission` | boolean | no | Offline-origin flag. |
| `submittedAt` | string (ISO) | no | Original submit time. |
| `learnerId` | string | no | Learners may only pass their own id/student number (else `403`). |

**Example request**

```json
{
  "quizId": "quiz-1730000000000-ab12",
  "answers": { "q1": "a" },
  "clientSubmissionHash": "hash-abc123"
}
```

**Success response — `200`**

```json
{
  "submission": {
    "id": "sub-1730000000001-xy99",
    "quizId": "quiz-1730000000000-ab12",
    "quizTitle": "Grade 3 Fractions",
    "subjectName": "Mathematics",
    "learnerId": "<learner-uuid>",
    "learnerName": "Thabo Nkosi",
    "classId": "cls-3a",
    "className": "Grade 3A",
    "score": 2,
    "totalMarks": 2,
    "percentage": 100,
    "status": "submitted",
    "syncStatus": "synced",
    "isOfflineSubmission": false,
    "clientSubmissionHash": "hash-abc123",
    "submittedAt": "2026-11-05T08:30:00.000Z",
    "syncedAt": "2026-11-05T08:30:01.000Z",
    "topicsToPractise": [],
    "answers": { "q1": "a" }
  },
  "isDuplicate": false
}
```

Notes:

- If `clientSubmissionHash` was already recorded, responds `200` with
  `isDuplicate: true` and the existing submission.
- For a learner when release policy is `manual` and results are not released,
  the response is **masked**: `score: 0`, `percentage: 0`, and a
  `teacherFeedback` message; status will be `submitted`.

**Error responses**

| Status | When |
| --- | --- |
| `400` | Missing `quizId`/`answers`; quiz `draft`/`closed`; due date expired; max attempts reached. |
| `403` | Learner impersonation attempt, or class ineligible. |
| `404` | Quiz not found. |
| `503` | Supabase not configured. |

---

### POST /api/submissions/sync

Batch-syncs queued offline submissions. Each item is processed independently
with per-item validation, idempotency, and server-side auto-marking.

- **Auth:** `requireAuth`.
- **Body:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `items` | array | yes | Queued submissions. |

Each item may provide `id`, `clientSubmissionHash`, `submittedAt`, and either a
nested `submission` (`{ quizId, learnerId, answers, ... }`) or flat
`quizId`/`answers`/`learnerId` fields.

**Example request**

```json
{
  "items": [
    {
      "id": "queue-1",
      "clientSubmissionHash": "hash-abc123",
      "submission": {
        "quizId": "quiz-1730000000000-ab12",
        "learnerId": "<learner-uuid>",
        "answers": { "q1": "a" },
        "submittedAt": "2026-11-05T08:30:00.000Z"
      }
    }
  ]
}
```

**Success response — `200`**

```json
{
  "syncedCount": 1,
  "skippedDuplicates": 0,
  "rejectedCount": 0,
  "totalReceived": 1,
  "results": [
    {
      "id": "queue-1",
      "status": "synced",
      "isDuplicate": false,
      "submissionId": "sub-sync-1730000000002-zz10",
      "submission": {
        "id": "sub-sync-1730000000002-zz10",
        "quizId": "quiz-1730000000000-ab12",
        "score": 2,
        "totalMarks": 2,
        "percentage": 100,
        "status": "submitted",
        "syncStatus": "synced",
        "isOfflineSubmission": true,
        "answers": { "q1": "a" }
      }
    }
  ]
}
```

Per-item `status` is `synced` or `rejected`. Duplicate items return
`{ "status": "synced", "isDuplicate": true, "submissionId": "..." }`. Rejected
items include a `reason` (missing `quizId`, quiz not found, draft quiz, expired
deadline, impersonation, class mismatch, or attempt limit exceeded). For
learners with unreleased results the returned `submission` is masked
(`score: 0`, `percentage: 0`, `answers: {}`).

**Error responses:** `400` (`"items must be an array of queued submissions."`),
`503` (Supabase not configured).

---

## 6. Learner Results

### GET /api/learners/results

Returns the authenticated learner's own submissions. Unreleased assessments
(withheld status and no `automatic` release policy) are masked.

- **Auth:** `requireAuth`, `requireRole(['learner'])`.
- **Parameters:** none.

**Success response — `200`**

```json
{
  "submissions": [
    {
      "id": "sub-1730000000001-xy99",
      "quizId": "quiz-1730000000000-ab12",
      "quizTitle": "Grade 3 Fractions",
      "subjectName": "Mathematics",
      "learnerId": "<learner-uuid>",
      "learnerName": "Thabo Nkosi",
      "classId": "cls-3a",
      "className": "Grade 3A",
      "answers": { "q1": "a" },
      "score": 2,
      "totalMarks": 2,
      "percentage": 100,
      "status": "marked",
      "syncStatus": "synced",
      "isOfflineSubmission": false,
      "topicsToPractise": [],
      "clientSubmissionHash": "hash-abc123"
    }
  ]
}
```

Unreleased entries are masked as `score: 0`, `percentage: 0`,
`teacherFeedback: "Assessment completed. Awaiting teacher marks release."`, and
`answers: {}`.

**Error responses:** `403` (non-learner role), `503` (Supabase not configured).

---

## 7. AI

### GET /api/ai/client-config

Returns browser-usable AI provider credentials (only providers that are actually
configured). Protected so only staff can read them.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Parameters:** none.

**Success response — `200`**

```json
{
  "gemini": { "apiKey": "<gemini-api-key>", "model": "gemini-2.5-flash" },
  "groq": null
}
```

A provider is `null` when its key is not configured (placeholder keys do not
count as configured). The default models are `gemini-2.5-flash` and
`openai/gpt-oss-20b` (Groq), overridable via `GEMINI_MODEL` / `GROQ_MODEL`.

**Error responses:** `403` (non-staff role).

---

### POST /api/ai/generate-quiz

Generates quiz questions server-side via Gemini (primary) with automatic Groq
fallback, batching, cross-batch de-duplication, and no synthetic questions.

- **Auth:** `requireAuth`, `requireRole(['admin', 'teacher'])`.
- **Body:**

| Field | Type | Required | Default / limit |
| --- | --- | --- | --- |
| `grade` | string | no | `Grade 3`; max length 50. |
| `subject` | string | no | `Mathematics`; max length 100. |
| `topics` | string[] | no | `["General Knowledge"]`; 1–10 items, each ≤ 100 chars. |
| `learningObjectives` | string | no | `""`. |
| `difficulty` | `easy`\|`medium`\|`hard` | no | `medium`. |
| `questionCount` | number | no | `3`; must be 1–200. |
| `questionType` | `multiple_choice`\|`true_false`\|`short_answer` | no | — |
| `excludePrompts` | string[] | no | `[]`; prompts already generated (keeps batches unique). |

**Example request**

```json
{
  "grade": "Grade 3",
  "subject": "Mathematics",
  "topics": ["Fractions"],
  "difficulty": "medium",
  "questionCount": 5,
  "questionType": "multiple_choice"
}
```

**Success response — `200`**

```json
{
  "questions": [
    {
      "id": "gq-1",
      "type": "multiple_choice",
      "prompt": "What is 1/2 of 4?",
      "options": [{ "id": "a", "text": "2" }, { "id": "b", "text": "3" }],
      "correctAnswer": "a",
      "marks": 1,
      "topic": "Fractions",
      "explanation": "Half of 4 is 2.",
      "isAccepted": true
    }
  ],
  "isPartial": false,
  "actualCount": 1,
  "requestedCount": 5,
  "warning": null
}
```

`isPartial` is `true` (with a `warning` string) when the provider returned fewer
questions than requested.

**Error responses**

| Status | When |
| --- | --- |
| `400` | Invalid/oversized `grade`/`subject`, `topics` not 1–10 valid strings, or `questionCount` outside 1–200. |
| `502` | Generation failed on the first batches with no usable questions. |
| `500` | Unexpected error (body includes `error` and `details`). |
| `503` | Neither `GEMINI_API_KEY` nor `GROQ_API_KEY` is configured. |

---

## Notes & limitations

- The API exposes **no** query-string parameters and **no** pagination.
- All JSON is camelCase; database snake_case is mapped by
  `server/db/databaseAdapter.ts`.
- `authorName` from the adapter is always the literal `"Faculty Teacher"`.
- Teacher data isolation is enforced in code for `/api/learners`,
  `/api/classes`, and the quiz routes.
- The AI generation endpoint also exists as a direct browser call path in the
  SPA; this document covers only the server endpoint.
