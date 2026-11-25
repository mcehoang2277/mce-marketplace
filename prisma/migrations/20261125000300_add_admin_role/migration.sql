-- Add a dedicated administrator role without changing existing account roles.
ALTER TYPE "UserRole" ADD VALUE 'ADMIN';
