import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT || 3000;

// Fail fast on missing or insecure secrets — refuse to start a vulnerable server
function validateEnv(): void {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    console.error('FATAL: JWT_SECRET must be set and at least 32 characters long.');
    console.error('Generate one with: openssl rand -base64 64');
    process.exit(1);
  }
  if (secret.includes('change_me') || secret === 'your_secret_here') {
    console.error('FATAL: JWT_SECRET still set to a placeholder. Rotate it before starting.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL is required.');
    process.exit(1);
  }
}

validateEnv();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Swagger UI:   http://localhost:${PORT}/api/docs`);
});

export default app;
