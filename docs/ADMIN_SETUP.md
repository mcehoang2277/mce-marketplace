# MCE Marketplace — Admin account setup

This procedure creates a real backend administrator account. It does not create a frontend-only demo identity.

## Security model

- ADMIN is a database enum role; public registration still accepts only WORKER, POSTER, or BOTH.
- Passwords are hashed with bcrypt (12 rounds). The seed never prints the password or hash.
- The seed reads credentials only from environment variables. Do not commit .env or share its contents.
- Admin API middleware verifies the JWT and then reads the current role from PostgreSQL on every admin request. Changing an account's role takes effect immediately for already-issued tokens.
- Admin APIs currently expose dashboard counts and a paginated user directory. This is not yet a complete moderation console.

## 1. Configure local environment

In the repository root, add these entries to the existing .env file (do not overwrite other required settings):

```env
ADMIN_PHONE="YOUR_ADMIN_PHONE"
ADMIN_FULL_NAME="MCE Administrator"
ADMIN_PASSWORD="REPLACE_WITH_A_UNIQUE_RANDOM_PASSWORD_AT_LEAST_14_CHARACTERS"
ADMIN_BOOTSTRAP_CONFIRM="YES_I_UNDERSTAND"
```

Use a phone number in international or local digit format (9–15 digits, optional leading +). Use a unique password of at least 14 characters. Generate it with a password manager. Do not use the example text above as a password.

## 2. Apply schema and migration

From the repository root:

```powershell
npx prisma generate
npx prisma migrate deploy
```

The migration adds ADMIN to the existing PostgreSQL UserRole enum. It does not alter existing users.

## 3. Create or update the admin account

Run this explicit command from the repository root:

```powershell
npm run db:seed:admin
```

The seed requires ADMIN_BOOTSTRAP_CONFIRM=YES_I_UNDERSTAND. It creates the account if absent. If the phone already belongs to a non-admin user, it fails rather than promoting a customer account. Re-running it for an existing ADMIN rotates that administrator password to the current ADMIN_PASSWORD. The account receives a zero-balance wallet if it does not already have one.

The command prints the admin name, phone and role only. It never prints the password.

## 4. Sign in

Request:

```http
POST /api/auth/login
Content-Type: application/json

{
  "phone": "YOUR_ADMIN_PHONE",
  "password": "YOUR_ADMIN_PASSWORD"
}
```

Keep the returned JWT private. Send it as Authorization: Bearer <token> for admin endpoints.

## 5. Verify admin authorization

- GET /api/admin/overview — dashboard counts.
- GET /api/admin/users?page=1&limit=20 — paginated user directory.

Expected behavior:
- no token: HTTP 401;
- a normal worker/poster token: HTTP 403;
- current admin token: HTTP 200.

## Operational cautions

- Never put admin credentials in source code, GitHub Actions logs, screenshots, or chat.
- Keep the admin password in a password manager and restrict access to the machine and database.
- Do not run the seed against production until the production database and credentials have been reviewed.
- The admin APIs are read-only at this stage. User suspension, dispute resolution, payouts, and other privileged mutations need separate audited workflows before production use.
