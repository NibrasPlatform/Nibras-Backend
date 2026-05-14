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

## Complete API Endpoint Catalog

This section documents all currently mounted API endpoints for frontend integration and backend reference.

Auth legend:
- `No`: Public endpoint.
- `Yes`: Requires authenticated user.
- `Yes*`: Requires authentication + role-based authorization.

Logic legend:
- `selectedLevel`: Uses user level preference flow.
- `reputation`: Uses reputation score/breakdown logic.

| Module | Method & Path | Functionality | Auth Required | Preserved Logic |
|---|---|---|---|---|
| Core | `GET /` | Root service status. | No | - |
| Core | `GET /health` | Liveness probe. | No | - |
| Core | `GET /ready` | Readiness probe. | No | - |
| Auth | `POST /api/auth/register` | Register with email/password. | No | - |
| Auth | `POST /api/auth/verify-otp` | Verify OTP for registration. | No | - |
| Auth | `POST /api/auth/google` | Login/signup with Google OAuth. | No | - |
| Auth | `POST /api/auth/login` | Login with credentials. | No | - |
| Auth | `POST /api/auth/refresh-tokens` | Refresh access and refresh tokens. | No | - |
| Auth | `GET /api/auth/me` | Fetch authenticated user profile. | Yes | - |
| Auth | `POST /api/auth/logout` | Logout current session. | Yes | - |
| Auth | `POST /api/auth/forgot-password` | Request reset-password flow. | No | - |
| Auth | `POST /api/auth/reset-password` | Reset password using reset token. | No | - |
| Users | `GET /api/users/me` | Fetch current user profile. | Yes | - |
| Courses | `POST /api/courses` | Create course. | Yes* | - |
| Courses | `GET /api/courses` | List courses with filters/pagination. | Yes | - |
| Courses | `GET /api/courses/my-dashboard` | Dashboard cards/stats for user. | Yes | selectedLevel |
| Courses | `PATCH /api/courses/update-level` | Update user's selected learning level. | Yes | selectedLevel |
| Courses | `GET /api/courses/level/:level` | List courses filtered by level. | Yes | selectedLevel |
| Courses | `GET /api/courses/code/:code` | Fetch course by unique code. | Yes | - |
| Courses | `POST /api/courses/:courseId/sections` | Create section in course. | Yes* | - |
| Courses | `GET /api/courses/:courseId` | Course details with section state. | Yes | - |
| Courses | `PATCH /api/courses/:courseId` | Update course metadata. | Yes* | - |
| Courses | `DELETE /api/courses/:courseId` | Delete course and related content. | Yes* | - |
| Courses | `GET /api/courses/progress/global` | Get global user progress summary. | Yes | - |
| Courses | `GET /api/courses/:courseId/progress` | Get user progress in specific course. | Yes | - |
| Courses | `POST /api/courses/:courseId/sections/:sectionId/toggle` | Toggle section completion and recalc progress. | Yes | - |
| Submissions | `POST /api/submissions` | Create/update assignment submission. | Yes | - |
| Submissions | `PATCH /api/submissions/:submissionId/status` | Review/update submission status. | Yes* | - |
| AI | `GET /api/ai/grades` | Return approved grades payload for AI logic. | Yes | - |
| Assignments | `POST /api/assignments` | Create assignment. | Yes* | - |
| Assignments | `GET /api/assignments/course/:courseId` | List assignments for course. | Yes | - |
| Assignments | `GET /api/assignments/:assignmentId` | Get assignment details. | Yes | - |
| Assignments | `PATCH /api/assignments/:assignmentId` | Update assignment. | Yes* | - |
| Assignments | `DELETE /api/assignments/:assignmentId` | Delete assignment. | Yes* | - |
| Contests | `GET /api/contests` | List contests with filters. | No | - |
| Contests | `GET /api/contests/:id` | Get contest details. | No | - |
| Contests | `POST /api/contests/sync` | Sync contests from external providers. | Yes* | - |
| Contests | `POST /api/contests/update-statuses` | Update contest statuses. | Yes* | - |
| Contests | `POST /api/contests/accounts/link` | Link competitive account. | Yes | - |
| Contests | `POST /api/contests/accounts/verify/start` | Start account verification. | Yes | - |
| Contests | `POST /api/contests/accounts/verify/check` | Check account verification. | Yes | - |
| Contests | `GET /api/contests/accounts/profile/:userId` | Get contest profile for user. | Yes | - |
| Contests | `POST /api/contests/accounts/profile/sync` | Manually sync contest profile. | Yes | - |
| Contests | `POST /api/contests/user-contests/:id/bookmark` | Bookmark contest. | Yes | - |
| Contests | `DELETE /api/contests/user-contests/:id/bookmark` | Remove contest bookmark. | Yes | - |
| Contests | `GET /api/contests/user-contests/bookmarks` | List bookmarked contests. | Yes | - |
| Contests | `POST /api/contests/user-contests/:id/join` | Join contest. | Yes | - |
| Contests | `POST /api/contests/user-contests/:id/reminder` | Set contest reminder. | Yes | - |
| Contests | `DELETE /api/contests/user-contests/:id/reminder` | Remove contest reminder. | Yes | - |
| Contests | `GET /api/contests/user-contests/reminders` | List reminders. | Yes | - |
| Contests | `GET /api/contests/user-contests/history` | Get participation history. | Yes | - |
| Problems | `GET /api/problems` | List problems with filters. | Yes | - |
| Problems | `GET /api/problems/roadmap` | Get learning/solving roadmap. | Yes | - |
| Problems | `GET /api/problems/progress` | Get progress by difficulty. | Yes | - |
| Problems | `POST /api/problems` | Create problem. | Yes* | - |
| Problems | `PATCH /api/problems/:id` | Update problem. | Yes* | - |
| Problems | `DELETE /api/problems/:id` | Delete problem. | Yes* | - |
| Problems | `PATCH /api/problems/:id/solved` | Mark problem solved/unsolved. | Yes | - |
| Community | `POST /api/community/questions` | Create question. | Yes | - |
| Community | `GET /api/community/questions` | List questions. | No | - |
| Community | `GET /api/community/questions/:id` | Get single question. | No | - |
| Community | `PATCH /api/community/questions/:id` | Update question. | Yes | - |
| Community | `DELETE /api/community/questions/:id` | Delete question. | Yes | - |
| Community | `POST /api/community/answers/:questionId` | Create answer on question. | Yes | - |
| Community | `GET /api/community/answers/question/:questionId` | List question answers. | No | - |
| Community | `GET /api/community/answers/user/:userId` | List answers by user. | No | - |
| Community | `GET /api/community/answers/:questionId/:id` | Get answer details. | No | - |
| Community | `PATCH /api/community/answers/:questionId/:id` | Update answer. | Yes | - |
| Community | `DELETE /api/community/answers/:questionId/:id` | Delete answer. | Yes | - |
| Community | `PATCH /api/community/answers/:questionId/:id/accept` | Accept answer for question. | Yes | - |
| Community | `GET /api/community/tags` | List all tags. | No | - |
| Community | `GET /api/community/tags/popular` | List most-used tags. | No | - |
| Community | `GET /api/community/tags/:id` | Get tag details. | No | - |
| Community | `POST /api/community/tags` | Create tag. | Yes* | - |
| Community | `PATCH /api/community/tags/:id` | Update tag. | Yes* | - |
| Community | `DELETE /api/community/tags/:id` | Delete tag. | Yes* | - |
| Community | `POST /api/community/threads/:courseId` | Create discussion thread. | Yes | - |
| Community | `GET /api/community/threads/course/:courseId` | List threads by course. | Yes | - |
| Community | `GET /api/community/threads/:id` | Get thread details. | Yes | - |
| Community | `PATCH /api/community/threads/:id` | Update thread. | Yes | - |
| Community | `DELETE /api/community/threads/:id` | Delete thread. | Yes | - |
| Community | `PATCH /api/community/threads/:id/pin` | Pin thread. | Yes* | - |
| Community | `PATCH /api/community/threads/:id/unpin` | Unpin thread. | Yes* | - |
| Community | `PATCH /api/community/threads/:id/close` | Close thread. | Yes | - |
| Community | `PATCH /api/community/threads/:id/open` | Reopen thread. | Yes* | - |
| Community | `POST /api/community/posts/:threadId` | Create post in thread. | Yes | - |
| Community | `GET /api/community/posts/thread/:threadId` | List posts in thread. | Yes | - |
| Community | `GET /api/community/posts/:id` | Get post details. | Yes | - |
| Community | `PATCH /api/community/posts/:id` | Update post. | Yes | - |
| Community | `DELETE /api/community/posts/:id` | Delete post. | Yes | - |
| Community | `PATCH /api/community/posts/:id/pin` | Pin post. | Yes* | - |
| Community | `PATCH /api/community/posts/:id/accept` | Accept post as resolution. | Yes | - |
| Community | `POST /api/community/votes` | Cast vote on target content. | Yes | - |
| Community | `GET /api/community/votes/:targetType/:targetId` | Get current user vote on target. | Yes | - |
| Community | `POST /api/community/chatbot/ask` | Ask chatbot question (rate-limited). | Yes | - |
| Community | `POST /api/community/chatbot/publish` | Publish chatbot answer (rate-limited). | Yes | - |
| Gamification | `POST /api/gamification/check-award` | Evaluate and award badges. | Yes | - |
| Gamification | `GET /api/gamification/all-badges` | List all badge definitions. | Yes | - |
| Gamification | `GET /api/gamification/leaderboards` | Leaderboard by filters. | Yes | - |
| Gamification | `GET /api/gamification/leaderboards/me` | Get my leaderboard rank. | Yes | - |
| Gamification | `GET /api/gamification/leaderboards/config` | Get leaderboard config metadata. | Yes | - |
| Reputation | `GET /api/reputation/me` | Get my reputation breakdown. | Yes | reputation |
| Analytics | `GET /api/analytics/dashboard/:studentId` | Dashboard analytics for student. | Yes | reputation |
| Analytics | `GET /api/analytics/student-performance/:studentId` | Student performance metrics. | Yes | - |
| Analytics | `GET /api/analytics/courses/:courseId/performance` | Course performance analytics. | Yes | - |
| Mentorship | `GET /api/mentorship/suggestions/me` | Get mentor suggestions for current user. | Yes | - |
| Mentorship | `PUT /api/mentorship/profile/me` | Update mentor profile. | Yes | - |
| Mentorship | `GET /api/mentorship/admin/profiles` | List all mentorship profiles. | Yes* | - |
| Mentorship | `PATCH /api/mentorship/admin/profiles/:userId/approve` | Approve mentorship profile. | Yes* | - |
| Mentorship | `PATCH /api/mentorship/admin/profiles/:userId/reject` | Reject mentorship profile. | Yes* | - |
| Mentorship | `PATCH /api/mentorship/admin/profiles/:userId/availability` | Update mentor availability. | Yes* | - |

### Preserved Logic Notes

- `selectedLevel` appears in course dashboard filtering and level update flow.
- `reputation` appears in reputation API and analytics dashboard aggregation.
