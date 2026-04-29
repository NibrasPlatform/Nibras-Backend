# Nibras Modular Monolith

A unified modular monolith backend for the Nibras Student Dashboard platform.

## 📁 Project Structure

```
All/
├── src/
│   ├── app.js                    # Express app setup
│   ├── server.js                 # Server entry point
│   ├── routes/index.js            # API route registration
│   │
│   ├── core/                    # Shared core modules
│   │   ├── config/               # Database, env, logger config
│   │   ├── constants/            # HTTP status, platforms
│   │   ├── middlewares/          # Auth, role, validation, error, rate limiter
│   │   └── utils/              # Error handler, token, catchAsync, logger
│   │
│   ├── modules/                 # Feature modules
│   │   ├── auth/               # Authentication & roles
│   │   ├── users/             # User management
│   │   ├── courses/           # Course management
│   │   ├── assignments/       # Assignment management
│   │   ├── contests/         # Contest platform sync
│   │   ├── problems/         # Problem tracking
│   │   ├── community/        # Q&A, threads, votes
│   │   ├── gamification/     # Badges & achievements
│   │   └── analytics/        # Dashboard data
│   │
│   ├── jobs/                   # Background jobs
│   ├── realtime/              # Socket.IO events
│   └── scripts/               # Migration & seed scripts
│
└── package.json
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB

### Installation

```bash
npm install
```

### Environment Variables

Create `.env` file:

```env
# Database
DATABASE_URL=mongodb://localhost:27017/nibras

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Email (optional)
BREVO_API_KEY=your-brevo-api-key
```

### Running

```bash
# Development
npm run st

# Production
npm start
```

### First-Time Setup

```bash
# Seed roles and default admin
npm run seed:roles
```

This creates:
- 5 permissions
- 4 roles (Super Admin, Admin, Instructor, Student)
- Default admin: ahmed.admin@nibras.com / Admin@123

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|-------|---------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/verify-otp | Verify OTP |
| POST | /api/auth/login | Login |
| POST | /api/auth/google | Google OAuth |
| POST | /api/auth/refresh-tokens | Refresh tokens |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout |

### Users
| Method | Endpoint | Description |
|-------|---------|-------------|
| GET | /api/users/:id | Get user profile |

### Courses
| Method | Endpoint | Description |
|-------|---------|-------------|
| GET | /api/courses | List courses |
| GET | /api/courses/:courseId | Get course |
| POST | /api/courses | Create course (admin) |
| PATCH | /api/courses/:courseId | Update course |
| DELETE | /api/courses/:courseId | Delete course |

### Assignments
| Method | Endpoint | Description |
|-------|---------|-------------|
| GET | /api/assignments/course/:courseId | List assignments |
| POST | /api/assignments | Create (admin) |
| PATCH | /api/assignments/:id | Update |
| DELETE | /api/assignments/:id | Delete |

### Contests
| Method | Endpoint | Description |
|-------|---------|-------------|
| GET | /api/contests | List contests |
| POST | /api/contests/sync | Sync (admin) |
| POST | /api/contests/join | Join contest |
| GET | /api/contests/bookmarked | My bookmarks |
| POST | /api/contests/:id/reminder | Set reminder |

### Accounts
| Method | Endpoint | Description |
|-------|---------|-------------|
| POST | /api/contests/accounts/link | Link platform |
| POST | /api/contests/accounts/verify | Verify account |

### Problems
| Method | Endpoint | Description |
|-------|---------|-------------|
| GET | /api/problems | List problems |
| GET | /api/problems/:id | Get problem |
| PATCH | /api/problems/:id/solved | Mark solved |

### Community
| Method | Endpoint | Description |
|-------|---------|-------------|
| GET | /api/community/questions | List questions |
| POST | /api/community/questions | Ask question |
| GET | /api/community/answers | List answers |
| POST | /api/community/answers | Answer |
| POST | /api/community/votes | Vote |
| GET | /api/community/threads | List threads |
| POST | /api/community/threads | Create thread |
| GET | /api/community/chatbot | AI chatbot |

### Gamification
| Method | Endpoint | Description |
|-------|---------|-------------|
| POST | /api/gamification/check-award | Check badges |
| GET | /api/gamification/all-badges | All badges |

### Analytics
| Method | Endpoint | Description |
|-------|---------|-------------|
| GET | /api/analytics/dashboard/:studentId | Dashboard data |

## 🔐 Authentication

All protected routes require a Bearer token:

```bash
curl -H "Authorization: Bearer <token>" https://api.example.com/api/users/me
```

## 🏢 Roles & Permissions

| Role | Permissions |
|------|-------------|
| Super Admin | All permissions |
| Admin | All except manage_users |
| Instructor | manage_courses, manage_assignments, manage_contests |
| Student | view_analytics |

## ⏰ Background Jobs

Jobs run automatically when server starts:

| Job | Schedule | Description |
|-----|----------|-------------|
| ContestSyncJob | Every 6 hours | Sync contests |
| ContestStatusUpdateJob | Every 5 min | Update status |
| ReminderNotificationJob | Every 5 min | Send reminders |
| CompetitiveProfileSyncJob | Daily | Sync profiles |
| VerificationRevalidationJob | Daily | Re-verify accounts |
| MaintenanceJob | Daily | Maintenance tasks |

Disable with `ENABLE_JOBS=false`

## 🧪 Testing

```bash
# Health check
curl http://localhost:3000/health

# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@gmail.com","password":"password123"}'
```

## 📝 Scripts

```bash
npm run st              # Start dev server
npm run seed:roles      # Seed roles & admin
npm run migrate:data   # Run data migration
```

## 🔧 Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB + Mongoose
- **Auth:** JWT + Google OAuth
- **Real-time:** Socket.IO
- **Jobs:** node-cron
- **Validation:** express-validator, Joi

## 📄 License

Proprietary - All rights reserved