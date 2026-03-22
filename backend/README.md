# BacChat Backend

Backend API for BacChat application built with Express.js, PostgreSQL, and TypeScript.

## Features

- **User Authentication**
  - Email/Password signup
  - Email/Password signin
  - Email verification
  - Password reset (forgot password)
  - JWT-based authentication

- **Email Service**
  - Integration with Brevo (formerly Sendinblue)
  - Verification emails
  - Password reset emails

- **Database**
  - PostgreSQL with Prisma ORM
  - User management
  - Token management (verification & password reset)

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Email**: Brevo (sib-api-v3-sdk)
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Validation**: express-validator
- **Containerization**: Docker & Docker Compose

## Getting Started

### Prerequisites

- Node.js 20 or higher
- Docker and Docker Compose (for containerized setup)
- PostgreSQL (if running locally without Docker)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   - `DATABASE_URL`: PostgreSQL connection string
   - `JWT_SECRET`: Your JWT secret key
   - `BREVO_API_KEY`: Your Brevo API key
   - `SENDER_EMAIL`: Email address for sending emails
   - `SENDER_NAME`: Sender name for emails
   - `FRONTEND_URL`: Your frontend URL for email links

3. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

4. **Run database migrations:**
   ```bash
   npm run migrate
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

### Using Docker Compose

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f
   ```

3. **Stop services:**
   ```bash
   docker-compose down
   ```

## API Endpoints

### Authentication

#### POST `/api/auth/signup`
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "message": "User created successfully. Please check your email to verify your account.",
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": false
  }
}
```

#### POST `/api/auth/signin`
Sign in with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Signed in successfully",
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true
  }
}
```

#### POST `/api/auth/verify-email`
Verify email address with token.

**Request Body:**
```json
{
  "token": "verification-token"
}
```

**Response:**
```json
{
  "message": "Email verified successfully"
}
```

#### POST `/api/auth/resend-verification`
Resend verification email (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "message": "Verification email sent"
}
```

#### POST `/api/auth/forgot-password`
Request password reset.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

#### POST `/api/auth/reset-password`
Reset password with token.

**Request Body:**
```json
{
  "token": "reset-token",
  "password": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successfully"
}
```

#### GET `/api/auth/me`
Get current user information (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true,
    "emailVerifiedAt": "2026-02-24T10:00:00.000Z",
    "createdAt": "2026-02-24T10:00:00.000Z",
    "updatedAt": "2026-02-24T10:00:00.000Z"
  }
}
```

### Health Check

#### GET `/health`
Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

## Database Schema

### User
- `id`: UUID (primary key)
- `email`: String (unique)
- `password`: String (hashed)
- `firstName`: String (optional)
- `lastName`: String (optional)
- `isEmailVerified`: Boolean
- `emailVerifiedAt`: DateTime (optional)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### VerificationToken
- `id`: UUID (primary key)
- `token`: String (unique)
- `userId`: UUID (foreign key)
- `expiresAt`: DateTime
- `createdAt`: DateTime

### PasswordResetToken
- `id`: UUID (primary key)
- `token`: String (unique)
- `userId`: UUID (foreign key)
- `expiresAt`: DateTime
- `used`: Boolean
- `createdAt`: DateTime

## Project Structure

```
backend/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── config/
│   │   └── database.ts        # Prisma client configuration
│   ├── middleware/
│   │   ├── auth.ts            # Authentication middleware
│   │   └── validator.ts       # Validation middleware
│   ├── routes/
│   │   └── auth.ts            # Authentication routes
│   ├── services/
│   │   └── emailService.ts    # Email service (Brevo)
│   ├── utils/
│   │   ├── jwt.ts             # JWT utilities
│   │   ├── password.ts        # Password hashing
│   │   └── token.ts           # Token generation
│   └── server.ts              # Main server file
├── .env.example               # Environment variables template
├── .gitignore
├── docker-compose.yml         # Docker Compose configuration
├── Dockerfile                 # Docker configuration
├── package.json
└── tsconfig.json              # TypeScript configuration
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run migrate` - Run database migrations
- `npm run migrate:deploy` - Deploy migrations (production)
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:studio` - Open Prisma Studio

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` or `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET` | Secret key for JWT | `your-secret-key` |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `BREVO_API_KEY` | Brevo API key | `your-api-key` |
| `SENDER_EMAIL` | Email sender address | `noreply@yourdomain.com` |
| `SENDER_NAME` | Email sender name | `BacChat` |
| `FRONTEND_URL` | Frontend URL for email links | `http://localhost:3000` |

## Development

### Database Migrations

Create a new migration:
```bash
npm run migrate
```

Deploy migrations:
```bash
npm run migrate:deploy
```

View database with Prisma Studio:
```bash
npm run prisma:studio
```

### TypeScript

The project uses TypeScript with strict mode enabled. Build the project:
```bash
npm run build
```

## License

See the LICENSE file in the root of the repository.
