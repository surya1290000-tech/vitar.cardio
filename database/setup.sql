-- =============================================================
-- VITAR DATABASE SETUP
-- Run this SQL in your Neon dashboard → SQL Editor
-- ================================================================

-- ── USERS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               VARCHAR(255) UNIQUE NOT NULL,
  password_hash       VARCHAR(255),
  first_name          VARCHAR(100) NOT NULL,
  last_name           VARCHAR(100) NOT NULL,
  phone               VARCHAR(20),
  date_of_birth       DATE,
  role                VARCHAR(20) NOT NULL DEFAULT 'user',
  is_verified         BOOLEAN NOT NULL DEFAULT false,
  oauth_provider      VARCHAR(50),
  oauth_id            VARCHAR(255),
  avatar_url          TEXT,
  stripe_customer_id  VARCHAR(255) UNIQUE,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── OTP TOKENS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_tokens (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  otp_hash    VARCHAR(64) NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── REFRESH TOKENS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── PASSWORD RESET TOKENS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(128) UNIQUE NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── MEDICAL PROFILES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blood_type       VARCHAR(5),
  allergies        TEXT[] DEFAULT '{}',
  medications      TEXT[] DEFAULT '{}',
  conditions       TEXT[] DEFAULT '{}',
  physician_name   VARCHAR(255),
  physician_phone  VARCHAR(20),
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── EMERGENCY CONTACTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  relationship  VARCHAR(100),
  phone         VARCHAR(20) NOT NULL,
  email         VARCHAR(255),
  notify_sms    BOOLEAN NOT NULL DEFAULT true,
  notify_push   BOOLEAN NOT NULL DEFAULT true,
  priority      INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── DEVICES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  serial_number    VARCHAR(100) UNIQUE NOT NULL,
  model            VARCHAR(50) NOT NULL,
  firmware_version VARCHAR(20),
  status           VARCHAR(30) NOT NULL DEFAULT 'offline',
  battery_level    INTEGER CHECK (battery_level BETWEEN 0 AND 100),
  last_sync        TIMESTAMP,
  activated_at     TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── HEALTH READINGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_readings (
  id              BIGSERIAL PRIMARY KEY,
  device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  heart_rate      INTEGER,
  spo2            DECIMAL(5,2),
  temperature     DECIMAL(5,2),
  respiratory_rate INTEGER,
  systolic_bp     INTEGER,
  diastolic_bp    INTEGER,
  hrv_ms          DECIMAL(8,2),
  ecg_data        JSONB,
  motion_x        DECIMAL(8,4),
  motion_y        DECIMAL(8,4),
  motion_z        DECIMAL(8,4),
  ai_risk_score   DECIMAL(5,2),
  anomaly_flags   TEXT[] DEFAULT '{}',
  notes           TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_user_time ON health_readings(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_device_time ON health_readings(device_id, recorded_at DESC);

-- ── ALERTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),
  device_id        UUID REFERENCES devices(id),
  alert_type       VARCHAR(50) NOT NULL,
  severity         VARCHAR(20) NOT NULL,
  message          TEXT,
  status           VARCHAR(30) NOT NULL DEFAULT 'pending',
  location_lat     DECIMAL(10,8),
  location_lng     DECIMAL(11,8),
  health_snapshot  JSONB,
  dispatched_to    TEXT[] DEFAULT '{}',
  dismissed_by     VARCHAR(50),
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alerts_user_time ON alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity, status);

-- ── ORDERS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      UUID NOT NULL REFERENCES users(id),
  order_number                 VARCHAR(50) UNIQUE NOT NULL,
  device_model                 VARCHAR(50) NOT NULL,
  status                       VARCHAR(30) NOT NULL DEFAULT 'pending',
  shipping_name                VARCHAR(255),
  shipping_addr1               TEXT,
  shipping_addr2               TEXT,
  city                         VARCHAR(100),
  state                        VARCHAR(100),
  postal_code                  VARCHAR(20),
  country                      VARCHAR(80),
  subtotal                     INTEGER NOT NULL,
  tax                          INTEGER NOT NULL DEFAULT 0,
  total                        INTEGER NOT NULL,
  currency                     VARCHAR(3) NOT NULL DEFAULT 'usd',
  stripe_session_id            VARCHAR(255),
  medical_disclaimer_accepted  BOOLEAN NOT NULL DEFAULT false,
  created_at                   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── PAYMENTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                   UUID REFERENCES orders(id),
  user_id                    UUID NOT NULL REFERENCES users(id),
  stripe_payment_intent_id   VARCHAR(255) UNIQUE,
  amount                     INTEGER NOT NULL,
  currency                   VARCHAR(3) NOT NULL DEFAULT 'usd',
  status                     VARCHAR(30) NOT NULL,
  payment_method             VARCHAR(50),
  receipt_url                TEXT,
  created_at                 TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── SUBSCRIPTIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  plan                   VARCHAR(30) NOT NULL,
  status                 VARCHAR(30) NOT NULL,
  current_period_start   TIMESTAMP,
  current_period_end     TIMESTAMP,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── CUSTOMER SUPPORT ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject      VARCHAR(200) NOT NULL,
  category     VARCHAR(40) NOT NULL DEFAULT 'general',
  priority     VARCHAR(20) NOT NULL DEFAULT 'normal',
  description  TEXT NOT NULL,
  status       VARCHAR(30) NOT NULL DEFAULT 'open',
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_time ON support_tickets(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id          BIGSERIAL PRIMARY KEY,
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_time ON support_messages(ticket_id, created_at ASC);

-- ── HEALTH ASSISTANT CHAT ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_assistant_chats (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL,
  message     TEXT NOT NULL,
  context     JSONB,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_assistant_user_time ON health_assistant_chats(user_id, created_at DESC);

-- ── NOTIFICATION LOG ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id        UUID REFERENCES alerts(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  recipient_type  VARCHAR(30),
  recipient_id    UUID,
  channel         VARCHAR(20),
  status          VARCHAR(20),
  sent_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ADMIN AUTH AUDIT LOG
CREATE TABLE IF NOT EXISTS admin_auth_log (
  id          BIGSERIAL PRIMARY KEY,
  action      VARCHAR(30) NOT NULL,
  ip_address  VARCHAR(64),
  user_agent  TEXT,
  details     TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_auth_log_created_at ON admin_auth_log(created_at DESC);

-- STRIPE WEBHOOK EVENTS (idempotency)
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id          BIGSERIAL PRIMARY KEY,
  event_id    VARCHAR(255) NOT NULL UNIQUE,
  event_type  VARCHAR(120) NOT NULL,
  payload     TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created_at ON stripe_webhook_events(created_at DESC);

-- SAFETY UPDATES FOR EXISTING DATABASES
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE health_readings
  ADD COLUMN IF NOT EXISTS temperature DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS respiratory_rate INTEGER,
  ADD COLUMN IF NOT EXISTS systolic_bp INTEGER,
  ADD COLUMN IF NOT EXISTS diastolic_bp INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS message TEXT;

CREATE INDEX IF NOT EXISTS idx_health_device_time ON health_readings(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_time ON alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity, status);

-- ================================================================
-- ALL TABLES CREATED SUCCESSFULLY
-- Database setup complete! All tables are ready to use.
-- ================================================================
