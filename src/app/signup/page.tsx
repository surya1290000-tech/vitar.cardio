'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSignup } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignupForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
  phone: string;
  dateOfBirth: string;
  bloodType: string;
  heightCm: string;
  weightKg: string;
  sex: string;
  medicalNotes: string;
  familyHistory: string;
  restingHeartRate: string;
  allergies: string;
  medications: string;
  conditions: string;
  physicianName: string;
  physicianPhone: string;
};

const validateSignup = (form: SignupForm) => {
  const errors: Partial<Record<keyof SignupForm, string>> = {};

  if (!form.firstName.trim()) errors.firstName = 'First name is required.';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required.';

  if (!form.email.trim()) errors.email = 'Email is required.';
  else if (!emailPattern.test(form.email.trim())) errors.email = 'Enter a valid email address.';

  if (form.phone.trim() && !/^[+\d\s()-]{7,20}$/.test(form.phone.trim())) {
    errors.phone = 'Enter a valid phone number.';
  }

  if (form.dateOfBirth) {
    const date = new Date(form.dateOfBirth);
    if (Number.isNaN(date.getTime())) {
      errors.dateOfBirth = 'Enter a valid date of birth.';
    } else if (date > new Date()) {
      errors.dateOfBirth = 'Date of birth cannot be in the future.';
    }
  }

  if (form.bloodType.trim() && !/^(A|B|AB|O)[+-]$/i.test(form.bloodType.trim())) {
    errors.bloodType = 'Use A+, A-, B+, B-, AB+, AB-, O+, or O-.';
  }

  if (form.heightCm.trim()) {
    const height = Number(form.heightCm);
    if (!Number.isFinite(height) || height <= 0 || height > 300) {
      errors.heightCm = 'Enter height in cm.';
    }
  }

  if (form.weightKg.trim()) {
    const weight = Number(form.weightKg);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
      errors.weightKg = 'Enter weight in kg.';
    }
  }

  if (form.restingHeartRate.trim()) {
    const rate = Number(form.restingHeartRate);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 250) {
      errors.restingHeartRate = 'Enter a valid resting heart rate.';
    }
  }

  if (form.physicianPhone.trim() && !/^[+\d\s()-]{7,20}$/.test(form.physicianPhone.trim())) {
    errors.physicianPhone = 'Enter a valid physician phone number.';
  }

  if (!form.password) errors.password = 'Password is required.';
  else if (form.password.length < 8) errors.password = 'Use at least 8 characters.';

  if (!form.confirm) errors.confirm = 'Please confirm your password.';
  else if (form.password !== form.confirm) errors.confirm = 'Passwords do not match.';

  return errors;
};

export default function SignupPage() {
  const { signup, loading, error, setError } = useSignup();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirm: '',
    phone: '',
    dateOfBirth: '',
    bloodType: '',
    heightCm: '',
    weightKg: '',
    sex: '',
    medicalNotes: '',
    familyHistory: '',
    restingHeartRate: '',
    allergies: '',
    medications: '',
    conditions: '',
    physicianName: '',
    physicianPhone: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SignupForm, string>>>({});
  const [touched, setTouched] = useState<Record<keyof SignupForm, boolean>>({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    confirm: false,
    phone: false,
    dateOfBirth: false,
    bloodType: false,
    heightCm: false,
    weightKg: false,
    sex: false,
    medicalNotes: false,
    familyHistory: false,
    restingHeartRate: false,
    allergies: false,
    medications: false,
    conditions: false,
    physicianName: false,
    physicianPhone: false,
  });

  const parseCsvList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target as { name: keyof SignupForm; value: string };
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      setFieldErrors(validateSignup(next));
      return next;
    });
    setError(null);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name } = e.target as { name: keyof SignupForm };
    setTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors(validateSignup(form));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateSignup(form);
    setFieldErrors(errors);
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      confirm: true,
      phone: true,
      dateOfBirth: true,
      bloodType: true,
      heightCm: true,
      weightKg: true,
      sex: true,
      medicalNotes: true,
      familyHistory: true,
      restingHeartRate: true,
      allergies: true,
      medications: true,
      conditions: true,
      physicianName: true,
      physicianPhone: true,
    });
    if (Object.keys(errors).length > 0) return;

    await signup({
      firstName: form.firstName,
      lastName:  form.lastName,
      email:     form.email,
      password:  form.password,
      phone: form.phone.trim() || null,
      dateOfBirth: form.dateOfBirth || null,
      bloodType: form.bloodType.trim().toUpperCase() || null,
      heightCm: form.heightCm.trim() ? Number(form.heightCm) : null,
      weightKg: form.weightKg.trim() ? Number(form.weightKg) : null,
      sex: form.sex.trim() || null,
      medicalNotes: form.medicalNotes.trim() || null,
      familyHistory: form.familyHistory.trim() || null,
      restingHeartRate: form.restingHeartRate.trim() ? Number(form.restingHeartRate) : null,
      allergies: parseCsvList(form.allergies),
      medications: parseCsvList(form.medications),
      conditions: parseCsvList(form.conditions),
      physicianName: form.physicianName.trim() || null,
      physicianPhone: form.physicianPhone.trim() || null,
    });
  };

  const resolveInputStyle = (name: keyof SignupForm) => {
    const hasError = touched[name] && Boolean(fieldErrors[name]);
    const isValid = touched[name] && !fieldErrors[name] && form[name].trim().length > 0;
    return {
      ...inputStyle,
      border: hasError
        ? '1px solid rgba(231,76,60,0.55)'
        : isValid
        ? '1px solid rgba(46,204,113,0.55)'
        : inputStyle.border,
      boxShadow: hasError
        ? '0 0 0 2px rgba(231,76,60,0.15)'
        : isValid
        ? '0 0 0 2px rgba(46,204,113,0.12)'
        : 'none',
    } as React.CSSProperties;
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0D0D0F',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Logo */}
        <Link href="/" style={{
          fontFamily: "'DM Serif Display', serif", fontSize: '1.5rem',
          letterSpacing: '0.12em', color: '#F9F8F6', textDecoration: 'none',
          display: 'block', marginBottom: '2.5rem',
        }}>
          VITAR<span style={{ color: '#C0392B' }}>.</span>
        </Link>

        {/* Card */}
        <div style={{
          background: '#1A1A1C', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px', padding: '2.5rem',
        }}>
          <h1 style={{
            fontFamily: "'DM Serif Display', serif", fontSize: '1.8rem',
            color: '#F9F8F6', marginBottom: '0.4rem',
          }}>Create your account</h1>
          <p style={{ fontSize: '0.82rem', color: '#8A8A8E', marginBottom: '2rem' }}>
            Join thousands protecting their hearts with VITAR
          </p>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)',
              borderRadius: '4px', padding: '0.8rem 1rem',
              fontSize: '0.82rem', color: '#E74C3C', marginBottom: '1.2rem',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input
                  name="firstName" value={form.firstName} onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Jordan" required style={resolveInputStyle('firstName')}
                />
                {touched.firstName && fieldErrors.firstName && <div style={fieldErrorStyle}>{fieldErrors.firstName}</div>}
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input
                  name="lastName" value={form.lastName} onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Smith" required style={resolveInputStyle('lastName')}
                />
                {touched.lastName && fieldErrors.lastName && <div style={fieldErrorStyle}>{fieldErrors.lastName}</div>}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                name="email" type="email" value={form.email} onChange={handleChange}
                onBlur={handleBlur}
                placeholder="you@example.com" required style={resolveInputStyle('email')}
              />
              {touched.email && fieldErrors.email && <div style={fieldErrorStyle}>{fieldErrors.email}</div>}
              {touched.email && !fieldErrors.email && form.email.trim().length > 0 && <div style={fieldOkStyle}>Email format looks good.</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div>
                <label style={labelStyle}>Phone</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="+91 98765 43210"
                  style={resolveInputStyle('phone')}
                />
                {touched.phone && fieldErrors.phone && <div style={fieldErrorStyle}>{fieldErrors.phone}</div>}
              </div>
              <div>
                <label style={labelStyle}>Date Of Birth</label>
                <input
                  name="dateOfBirth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  style={resolveInputStyle('dateOfBirth')}
                />
                {touched.dateOfBirth && fieldErrors.dateOfBirth && <div style={fieldErrorStyle}>{fieldErrors.dateOfBirth}</div>}
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Health Profile</div>
              <p style={sectionSubStyle}>
                Add health context now so your dashboard, alerts, and care center start with the right baseline. These fields are optional.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={labelStyle}>Blood Type</label>
                  <input
                    name="bloodType"
                    value={form.bloodType}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="O+"
                    style={resolveInputStyle('bloodType')}
                  />
                  {touched.bloodType && fieldErrors.bloodType && <div style={fieldErrorStyle}>{fieldErrors.bloodType}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Sex</label>
                  <select
                    name="sex"
                    value={form.sex}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    style={resolveInputStyle('sex')}
                  >
                    <option value="">Select</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={labelStyle}>Height (cm)</label>
                  <input
                    name="heightCm"
                    value={form.heightCm}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="170"
                    style={resolveInputStyle('heightCm')}
                  />
                  {touched.heightCm && fieldErrors.heightCm && <div style={fieldErrorStyle}>{fieldErrors.heightCm}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Weight (kg)</label>
                  <input
                    name="weightKg"
                    value={form.weightKg}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="68"
                    style={resolveInputStyle('weightKg')}
                  />
                  {touched.weightKg && fieldErrors.weightKg && <div style={fieldErrorStyle}>{fieldErrors.weightKg}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Resting HR</label>
                  <input
                    name="restingHeartRate"
                    value={form.restingHeartRate}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="62"
                    style={resolveInputStyle('restingHeartRate')}
                  />
                  {touched.restingHeartRate && fieldErrors.restingHeartRate && <div style={fieldErrorStyle}>{fieldErrors.restingHeartRate}</div>}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Physician Name</label>
                <input
                  name="physicianName"
                  value={form.physicianName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Dr. Priya Menon"
                  style={resolveInputStyle('physicianName')}
                />
              </div>

              <div>
                <label style={labelStyle}>Physician Phone</label>
                <input
                  name="physicianPhone"
                  value={form.physicianPhone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="+91 99887 77665"
                  style={resolveInputStyle('physicianPhone')}
                />
                {touched.physicianPhone && fieldErrors.physicianPhone && <div style={fieldErrorStyle}>{fieldErrors.physicianPhone}</div>}
              </div>

              <div>
                <label style={labelStyle}>Allergies</label>
                <input
                  name="allergies"
                  value={form.allergies}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Penicillin, Peanuts"
                  style={resolveInputStyle('allergies')}
                />
                <div style={fieldHintStyle}>Use commas to separate multiple items.</div>
              </div>

              <div>
                <label style={labelStyle}>Current Medications</label>
                <input
                  name="medications"
                  value={form.medications}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Aspirin, Metoprolol"
                  style={resolveInputStyle('medications')}
                />
              </div>

              <div>
                <label style={labelStyle}>Known Conditions</label>
                <input
                  name="conditions"
                  value={form.conditions}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Hypertension, Arrhythmia"
                  style={resolveInputStyle('conditions')}
                />
              </div>

              <div>
                <label style={labelStyle}>Family Cardiac History</label>
                <textarea
                  name="familyHistory"
                  value={form.familyHistory}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Father had a cardiac event at age 58..."
                  rows={3}
                  style={{ ...resolveInputStyle('familyHistory'), resize: 'vertical', minHeight: '92px' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Emergency Medical Notes</label>
                <textarea
                  name="medicalNotes"
                  value={form.medicalNotes}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Any notes responders or clinicians should know..."
                  rows={3}
                  style={{ ...resolveInputStyle('medicalNotes'), resize: 'vertical', minHeight: '92px' }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input
                name="password" type="password" value={form.password} onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Min. 8 characters" required minLength={8} style={resolveInputStyle('password')}
              />
              {touched.password && fieldErrors.password && <div style={fieldErrorStyle}>{fieldErrors.password}</div>}
              {form.password.length > 0 && form.password.length < 8 && <div style={fieldHintStyle}>Use at least 8 characters for better security.</div>}
            </div>

            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                name="confirm" type="password" value={form.confirm} onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Repeat your password" required style={resolveInputStyle('confirm')}
              />
              {touched.confirm && fieldErrors.confirm && <div style={fieldErrorStyle}>{fieldErrors.confirm}</div>}
              {touched.confirm && !fieldErrors.confirm && form.confirm.length > 0 && <div style={fieldOkStyle}>Passwords match.</div>}
            </div>

            <Button variant="primary" size="md" type="submit" disabled={loading} style={{
              width: '100%',
              borderRadius: '3px',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'wait' : 'pointer',
              marginTop: '0.5rem',
            }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#8A8A8E', fontSize: '0.75rem' }}>
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              or
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* OAuth buttons */}
            <div style={{ display: 'flex', gap: '0.7rem' }}>
              <button type="button" style={oauthStyle}>🍎 Apple</button>
              <button type="button" style={oauthStyle}>🔵 Google</button>
            </div>
          </form>
        </div>

        {/* Sign in link */}
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.82rem', color: '#8A8A8E' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#C0392B', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>

        {/* Disclaimer */}
        <p style={{
          textAlign: 'center', marginTop: '1rem', fontSize: '0.68rem',
          color: 'rgba(255,255,255,0.3)', lineHeight: '1.5',
        }}>
          Your health data is encrypted end-to-end and never shared.
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em',
  textTransform: 'uppercase', color: '#8A8A8E', marginBottom: '0.4rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0D0D0F',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px',
  padding: '0.85rem 1rem', color: '#F9F8F6',
  fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem',
  outline: 'none', boxSizing: 'border-box',
};

const fieldErrorStyle: React.CSSProperties = {
  marginTop: '0.45rem',
  color: '#E74C3C',
  fontSize: '0.74rem',
  lineHeight: 1.4,
};

const fieldOkStyle: React.CSSProperties = {
  marginTop: '0.45rem',
  color: '#2ECC71',
  fontSize: '0.74rem',
  lineHeight: 1.4,
};

const fieldHintStyle: React.CSSProperties = {
  marginTop: '0.45rem',
  color: '#8A8A8E',
  fontSize: '0.72rem',
  lineHeight: 1.4,
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  padding: '1rem',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.02)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#F9F8F6',
  fontWeight: 500,
};

const sectionSubStyle: React.CSSProperties = {
  marginTop: '-0.4rem',
  color: '#8A8A8E',
  fontSize: '0.78rem',
  lineHeight: 1.6,
};

const oauthStyle: React.CSSProperties = {
  flex: 1, padding: '0.8rem', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px',
  color: '#F9F8F6', fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.82rem', cursor: 'pointer',
};
