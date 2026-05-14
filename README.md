# Nibras Frontend Integration Guide
This document is the frontend integration reference for the Nibras backend. It focuses on the student dashboard, course details, progress tracking, AI grade payloads, and submission flows.

## Authentication

All API routes below require a Bearer token.

### Base URL

| Environment | Value |
|---|---|
| Base URL | `http://localhost:3000/api` |

### Required Header

```http
Authorization: Bearer <access-token>
```

### Notes

- The token must belong to an authenticated user.
- Endpoints that fetch progress or dashboard data use the authenticated user ID on the backend.
- Some course management endpoints are restricted to instructor/admin roles.

## Endpoints

### Courses

| Method | Endpoint | Auth | Purpose | Key Response Notes |
|---|---|---:|---|---|
| GET | `/courses/my-dashboard` | Yes | Returns dashboard stats and course cards for the current student. | Returns `stats` and `courses`. Each course includes `hasStarted`, `progressPercentage`, `status`, `assignmentsCount`, `instructorName`, `level`, and `category`. |
| GET | `/courses/:courseId` | Yes | Returns full course details and section status for the sidebar. | Each section includes `status: locked | available | completed`. |
| GET | `/courses` | Yes | Lists courses with query filters. | Supports `level`, `category`, `search`, `page`, `limit`, `sortBy`, `sortOrder`. |
| GET | `/courses/level/:level` | Yes | Returns courses filtered by academic level. | Level match is case-insensitive. |
| GET | `/courses/code/:code` | Yes | Fetches a course by course code. | Case-insensitive code lookup. |
| POST | `/courses` | Yes | Creates a new course. | Instructor/admin only. |
| PATCH | `/courses/:courseId` | Yes | Updates course metadata. | Instructor/admin only. |
| DELETE | `/courses/:courseId` | Yes | Deletes a course and its associated sections. | Instructor/admin only. |
| POST | `/courses/:courseId/sections` | Yes | Adds a new section/lecture to a course. | Instructor/admin only. |

### Progress

| Method | Endpoint | Auth | Purpose | Payload / Notes |
|---|---|---:|---|---|
| GET | `/courses/:courseId/progress` | Yes | Fetches the current student progress for a course. | Returns section item states (`locked`, `available`, `completed`), overall `percentage`, and `status`. |
| POST | `/courses/:courseId/sections/:sectionId/toggle` | Yes | Marks a section as complete/incomplete. | Body: `{ "isCompleted": true/false }`. Triggers sequential unlocking and progress updates. |
| GET | `/courses/progress/global` | Yes | Returns the student’s global progress overview. | Returns average progress across all progress records for the user. |

### Assignment Submissions

| Method | Endpoint | Auth | Purpose | Notes |
|---|---|---:|---|---|
| POST | `/submissions` | Yes | Creates or updates a student assignment submission. | Expects `courseId`, `assignmentId`, and `githubLink`. The backend upserts by student/course/assignment. |
| PATCH | `/submissions/:submissionId/status` | Yes | Admin/instructor review for submission status. | If status becomes `approved`, the backend updates progress boosting logic. |

### AI Integration

| Method | Endpoint | Auth | Purpose | Notes |
|---|---|---:|---|---|
| GET | `/ai/grades` | Yes | Returns the raw grades map used by the AI recommendation flow. | Only `approved` submissions are included. Response shape: `{ success, enoughData, data: { grades: { "CourseCode": GradeValue } } }`. |

## Data Models

### Course

| Field | Type | Notes |
|---|---|---|
| `courseCode` | String | Unique course identifier, e.g. `CS106A`. |
| `title` | String | Human-readable course title. |
| `level` | String | `Beginner`, `Intermediate`, or `Advanced`. |
| `category` | String | `Core`, `Elective`, `Competitive Programming`, or `General`. |
| `instructorName` | String | Display name used by the dashboard UI. |
| `instructor` | ObjectId ref User | Instructor account reference. |
| `sections` | Array of ObjectId refs Section | Section list for sidebar / course outline. |
| `assignments` | Array | Placeholder assignments used by the UI to count course work. |
| `stats` | Object | Includes `duration`, `hoursPerWeek`, `enrolledStudents`, and `term`. |

### Section

| Field | Type | Notes |
|---|---|---|
| `title` | String | Section title shown in the sidebar. |
| `courseId` | ObjectId ref Course | Parent course. |
| `order` | Number | Used for sequential unlocking. |

### Progress

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId ref User | Student owner of the progress record. |
| `courseId` | ObjectId ref Course | Course tracked by the record. |
| `completedSections` | Array of ObjectId refs Section | Completed sections. |
| `items` | Array | Per-item state with `locked`, `available`, or `completed`. |
| `percentage` | Number | Course progress percentage. |
| `status` | String | `not_started`, `in_progress`, or `completed`. |
| `weightedGrade` | Number | Weighted grade computed from category scores. |

### Submission

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId ref User | Student submitting the work. |
| `courseId` | ObjectId ref Course | Course that owns the assignment. |
| `assignmentId` | ObjectId | Assignment identifier. |
| `githubLink` | String | GitHub repository or submission link. |
| `status` | String | `pending`, `approved`, or `needs_changes`. |
| `grade` | Number | Reviewer-assigned grade. |

## Dashboard Payload

`GET /courses/my-dashboard` returns a response in this shape:

```json
{
  "success": true,
  "data": {
  "stats": {
  "coursesEnrolled": 3,
  "overallProgress": 42
  },
  "courses": [
  {
  "_id": "...",
  "title": "Programming Methodology",
  "instructorName": "AbdallahRT",
  "level": "Beginner",
  "category": "Core",
  "progressPercentage": 0,
  "status": "not_started",
  "assignmentsCount": 3,
  "hasStarted": false
  }
  ]
  }
}
```

### UI Behavior

- Use `hasStarted` to decide between **Start Learning** and **Continue Learning**.
- Use `progressPercentage` to render the progress bar.
- Use `status` to support course card state and filtering.
- The backend returns all level-matching courses even if the student has not started them yet, so the frontend can show the full dashboard grid.

## Course Details Sidebar Behavior

`GET /courses/:courseId` returns course details plus section states for the sidebar.

### Section Status

| Status | UI Treatment |
|---|---|
| `locked` | Render lock icon `🔒` and disable access. |
| `available` | Render as clickable / available. |
| `completed` | Render checkmark `✅`. |

### Level Locking

- The backend enforces a prerequisite lock.
- If a student tries to open an `Intermediate` course before finishing all `Beginner` courses, the API returns `403 Forbidden` with a descriptive message.

## AI Grades Response

`GET /ai/grades` returns only approved grades.

```json
{
  "success": true,
  "enoughData": true,
  "data": {
  "grades": {
  "CS106A": 90,
  "MATH18": 85
  }
  }
}
```

### Notes

- Only submissions with `status = approved` are included.
- If there are no approved records yet, the backend returns `enoughData: false` with a clear message.

## Error Codes

| HTTP Code | Meaning | Typical Scenario |
|---|---|---|
| `401 Unauthorized` | Missing or invalid token. | Authorization header is absent or token is invalid. |
| `403 Forbidden` | Authenticated but not allowed. | Role restriction, ownership rule, or level lock. |
| `404 Not Found` | Resource does not exist. | Invalid course, section, or submission ID. |
| `409 Conflict` | Duplicate or conflicting record. | Submission uniqueness or similar constraint. |
| `422 Unprocessable Entity` | Validation failed. | Bad payload shape or invalid field value. |
| `500 Internal Server Error` | Unexpected server issue. | Unhandled backend failure. |
| `502 Bad Gateway` | Upstream AI failure. | External AI server returned an error. |
| `504 Gateway Timeout` | Upstream AI timeout. | AI server did not respond in time. |

## Quick Testing Checklist

1. Log in and copy the bearer token.
2. Call `GET /courses/my-dashboard` and confirm the dashboard cards render with `hasStarted` and `progressPercentage`.
3. Call `GET /courses/:courseId` and verify the sidebar can show `locked`, `available`, and `completed` sections.
