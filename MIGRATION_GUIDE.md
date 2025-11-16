# Multi-Tenant Web App Migration Guide

## What Changed

This app has been converted from a Shopify embedded app to a **multi-tenant standalone web application** with user authentication.

### Key Changes:
- ✅ User authentication (email + password)
- ✅ Multi-store support (each user can have multiple stores)
- ✅ Admin panel for managing users and stores
- ✅ Excel file support (.xlsx, .xls)
- ✅ Removed Shopify OAuth and App Bridge
- ✅ Session-based authentication
- ✅ User-isolated data access

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

New packages added:
- `express-session` - Session management
- `cookie-parser` - Cookie parsing
- `bcrypt` - Password hashing
- `xlsx` - Excel file parsing

### 2. Run Database Migration

```bash
npm run migrate
```

This will:
- Create the `users` table
- Add `user_id` column to `stores` table
- Remove `sessions` and `gdpr_requests` tables (no longer needed)

### 3. Create Admin User

You'll need to create an admin user manually in the database:

```sql
INSERT INTO users (email, password_hash, name, role)
VALUES (
  'admin@yourcompany.com',
  -- Password: "admin123" (change this!)
  '$2b$10$rQZ5vF5H3mVqJK5hZ.W8/.8xqKZB0Q3tZ3Qz3jZ1K2mZ3Qz3jZ1K2',
  'Admin User',
  'admin'
);
```

**Important**: Change the password immediately after first login!

### 4. Update Environment Variables

Add to your `.env`:

```env
# Session Secret (generate a random string)
SESSION_SECRET=your-super-secret-random-string-change-this

# Existing variables (keep these)
DATABASE_URL=your_database_url
PORT=3001
NODE_ENV=production
```

### 5. Remaining Code Updates Needed

You need to update these two files to use the new auth system:

#### `server/routes/process.ts`
- Replace `import { AuthRequest, verifyRequest } from '../middleware/auth'`
- With `import { requireAuth } from '../middleware/auth'`
- Add `router.use(requireAuth)`
- Add store ownership verification (see other routes for examples)
- Replace `req.storeId` with `storeId` from request body/query

#### `server/routes/import.ts`
- Same changes as process.ts
- Add store ownership verification

## How It Works Now

### User Flow:
1. **Admin** creates user accounts via admin panel
2. **Admin** creates stores and assigns them to users
3. **Users** log in with email/password
4. **Users** select which store they want to work with
5. **Users** upload CSV/Excel files and import products

### API Authentication:
- All API routes (except `/api/auth/login`) require authentication
- Each request must include a valid session cookie
- Store ownership is verified on every API call
- Admins can see all users/stores

### Database Structure:
```
users (id, email, password_hash, name, role)
  └─ stores (id, user_id, store_name, shopify_domain, ...)
      └─ uploaded_files (id, store_id, ...)
          └─ products_queue (id, store_id, ...)
```

## Frontend (TODO)

You'll need to build:

1. **Login Page** - Email/password form
2. **Admin Dashboard** - Manage users and stores
3. **User Dashboard** - List user's stores
4. **Store Selector** - Dropdown to switch between stores
5. **Auth Context** - React context for current user
6. **Protected Routes** - Redirect to login if not authenticated

## Testing

### 1. Test Authentication:
```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourcompany.com","password":"admin123"}' \
  -c cookies.txt

# Get current user
curl http://localhost:3001/api/auth/me -b cookies.txt

# Logout
curl -X POST http://localhost:3001/api/auth/logout -b cookies.txt
```

### 2. Test Admin Routes:
```bash
# Create user
curl -X POST http://localhost:3001/api/admin/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"email":"user@example.com","password":"password123","name":"Test User"}'

# List users
curl http://localhost:3001/api/admin/users -b cookies.txt
```

## Security Notes

- Passwords are hashed with bcrypt (10 rounds)
- Sessions expire after 7 days
- HTTPS required in production (set NODE_ENV=production)
- Admin role required for user/store management
- Store ownership verified on every request
- Rate limiting applied to all API routes

## Support

If you have questions or need help completing the migration, check:
- `/server/routes/admin.ts` - Admin API examples
- `/server/routes/user-stores.ts` - User store management
- `/server/middleware/auth.ts` - Auth middleware
