# VITAR — Cardiac Health Wearable Platform

## Full Stack: Next.js + Neon PostgreSQL + Stripe + SendGrid

---

## Step 1 — Install dependencies
```bash
npm install
```

## Step 2 — Set up Neon database (free, 2 mins)
1. Go to **https://neon.tech** → Sign Up (free)
2. Click **New Project** → name it `vitar`
3. Copy the **connection string** (looks like `postgresql://user:pass@host/vitar?sslmode=require`)
4. Open `.env.local` and paste it as `DATABASE_URL`

## Step 3 — Run the database SQL
1. In your Neon dashboard → click **SQL Editor**
2. Open `database/setup.sql` from this project
3. Copy all the SQL → paste into Neon SQL Editor → click **Run**
4. All 12 tables will be created

## Step 4 — Generate JWT secrets
Run this in your terminal and paste both outputs into `.env.local`:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Step 5 — Stripe setup (test mode)
1. Go to **https://dashboard.stripe.com** → sign up
2. Go to **Developers → API Keys**
3. Copy `sk_test_...` → paste as `STRIPE_SECRET_KEY`
4. Copy `pk_test_...` → paste as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
5. For webhooks locally: install Stripe CLI → run `stripe listen --forward-to localhost:3000/api/payments/webhook`
6. Copy the webhook secret → paste as `STRIPE_WEBHOOK_SECRET`

## Step 6 — SendGrid (optional for email)
1. Go to **https://sendgrid.com** → sign up (free tier)
2. Settings → API Keys → Create → copy key
3. Paste as `SENDGRID_API_KEY`

## Step 7 — Run the dev server
```bash
npm run dev
```
Open **http://localhost:3000**

---

## API Endpoints (all working)

### Auth
| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/auth/signup` | Register + send OTP email |
| POST | `/api/auth/login` | Login + get JWT |
| POST | `/api/auth/verify-otp` | Verify email OTP |
| POST | `/api/auth/resend-otp` | Resend OTP (rate limited) |
| POST | `/api/auth/logout` | Clear session |
| POST | `/api/auth/forgot-password` | Send reset email |
| POST | `/api/auth/reset-password` | Set new password |
| POST | `/api/auth/refresh` | Refresh access token |

### User
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/user/me` | Get profile + device + subscription |
| PATCH | `/api/user/me` | Update profile |

### Orders & Payments
| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/orders` | Create pre-order + Stripe checkout |
| GET | `/api/orders` | List user's orders |
| POST | `/api/payments/webhook` | Stripe webhook handler |
| GET | `/api/payments/subscription` | Get subscription |
| POST | `/api/payments/subscription` | Subscribe to plan |
| DELETE | `/api/payments/subscription` | Cancel subscription |

---

## Project Structure
```
src/
├── app/
│   ├── page.tsx              ← Homepage
│   ├── layout.tsx
│   ├── globals.css           ← All styles
│   └── api/
│       ├── auth/             ← 8 auth routes (REAL — bcrypt + JWT)
│       ├── user/me/          ← Profile (protected)
│       ├── orders/           ← Orders + Stripe checkout (protected)
│       └── payments/         ← Webhook + subscriptions
├── components/               ← 17 React components
├── lib/
│   ├── db.ts                 ← Neon PostgreSQL connection
│   ├── jwt.ts                ← Token signing/verification
│   ├── email.ts              ← SendGrid email templates
│   ├── crypto.ts             ← OTP + secure token utils
│   ├── stripe.ts             ← Stripe client + price config
│   └── authMiddleware.ts     ← withAuth() + withRole() guards
└── middleware/
database/
└── setup.sql                 ← Run this in Neon SQL Editor
```

