'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';

interface Order {
  id: string;
  order_number: string;
  device_model: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  stripe_session_id?: string | null;
}

interface Device {
  id: string;
  serialNumber?: string | null;
  model: string | null;
  firmwareVersion?: string | null;
  status: string | null;
  batteryLevel: number | null;
  lastSync: string | null;
}

interface HealthReading {
  id: number;
  deviceId: string;
  recordedAt: string;
  heartRate: number | null;
  spo2: number | null;
  aiRiskScore: number | null;
}

interface AlertItem {
  id: string;
  deviceId: string | null;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  emailNotifications: boolean;
  role: string;
  createdAt: string;
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string;
  } | null;
}

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string | null;
  phone: string;
  email: string | null;
  notifySms: boolean;
  notifyPush: boolean;
  priority: number;
}

interface MedicalProfile {
  id: string;
  bloodType: string | null;
  heightCm: number | null;
  weightKg: number | null;
  sex: string | null;
  medicalNotes: string | null;
  familyHistory: string | null;
  restingHeartRate: number | null;
  allergies: string[];
  medications: string[];
  conditions: string[];
  physicianName: string | null;
  physicianPhone: string | null;
  updatedAt?: string;
}

export default function DashboardPage() {
  const { user, isAuthenticated, accessToken, setUser } = useAuthStore();
  const { logout } = useLogout();
  const { showToast } = useToast();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [latestReading, setLatestReading] = useState<HealthReading | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [pairSerialNumber, setPairSerialNumber] = useState('');
  const [pairModel, setPairModel] = useState('core');

  const [ordersLoading, setOrdersLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [deviceActionLoadingId, setDeviceActionLoadingId] = useState<string | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertActionLoadingId, setAlertActionLoadingId] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState('');
  const [healthError, setHealthError] = useState('');
  const [alertsError, setAlertsError] = useState('');
  const [pairSuccess, setPairSuccess] = useState('');
  const [pairError, setPairError] = useState('');
  const [alertsInfo, setAlertsInfo] = useState('');
  const [demoMode, setDemoMode] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsSaving, setContactsSaving] = useState(false);
  const [contactsError, setContactsError] = useState('');
  const [contactsSuccess, setContactsSuccess] = useState('');
  const [contactActionLoadingId, setContactActionLoadingId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', email: '' });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactForm, setEditContactForm] = useState({
    name: '',
    relationship: '',
    phone: '',
    email: '',
    priority: 1,
    notifySms: true,
    notifyPush: true,
  });
  const [medicalProfile, setMedicalProfile] = useState<MedicalProfile | null>(null);
  const [medicalProfileLoading, setMedicalProfileLoading] = useState(false);
  const [medicalProfileSaving, setMedicalProfileSaving] = useState(false);
  const [medicalProfileError, setMedicalProfileError] = useState('');
  const [medicalProfileSuccess, setMedicalProfileSuccess] = useState('');
  const [medicalProfileForm, setMedicalProfileForm] = useState({
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

  const [demoDevice, setDemoDevice] = useState<Device>({
    id: 'demo-device',
    serialNumber: 'VTR-DEMO-001',
    model: 'pro',
    firmwareVersion: '0.9.0-demo',
    status: 'connected',
    batteryLevel: 87,
    lastSync: new Date().toISOString(),
  });

  const [demoReading, setDemoReading] = useState<HealthReading>({
    id: 1,
    deviceId: 'demo-device',
    recordedAt: new Date().toISOString(),
    heartRate: 74,
    spo2: 98,
    aiRiskScore: 0.12,
  });

  const deviceColumns = ['Serial', 'Model', 'Status', 'Battery', 'Last Sync', 'Action'] as const;
  const alertColumns = ['Type', 'Severity', 'Status', 'Created', 'Action'] as const;
  const orderColumns = ['Order #', 'Device', 'Status', 'Total', 'Date', 'Actions'] as const;

  const effectiveDevices = useMemo(() => (demoMode && devices.length === 0 ? [demoDevice] : devices), [demoMode, devices, demoDevice]);
  const effectiveReading = useMemo(() => (demoMode && !latestReading ? demoReading : latestReading), [demoMode, latestReading, demoReading]);
  const primaryDevice = useMemo(() => effectiveDevices[0] ?? null, [effectiveDevices]);
  const hasDevice = Boolean(primaryDevice);
  const deviceStatus = primaryDevice?.status ? primaryDevice.status.replace(/_/g, ' ') : 'not connected';
  const heartRateValue = effectiveReading?.heartRate ?? null;
  const spo2Value = effectiveReading?.spo2 ?? null;
  const riskScorePercent = effectiveReading?.aiRiskScore != null ? Math.round(effectiveReading.aiRiskScore * 100) : null;
  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === 'pending' || a.status === 'acknowledged'), [alerts]);
  const filteredOrders = useMemo(() => {
    const normalizedQuery = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      const statusOk = orderStatusFilter === 'all' || o.status === orderStatusFilter;
      if (!statusOk) return false;
      if (!normalizedQuery) return true;
      return (
        o.order_number.toLowerCase().includes(normalizedQuery) ||
        o.device_model.toLowerCase().includes(normalizedQuery) ||
        o.status.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [orders, orderStatusFilter, orderSearch]);
  const ordersPageSize = 8;
  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPageSize));
  const paginatedOrders = useMemo(
    () => filteredOrders.slice((orderPage - 1) * ordersPageSize, orderPage * ordersPageSize),
    [filteredOrders, orderPage]
  );
  const profileDirty = Boolean(
    profile &&
      (profile.firstName !== profileForm.firstName.trim() ||
        profile.lastName !== profileForm.lastName.trim() ||
        (profile.phone ?? '') !== profileForm.phone.trim())
  );
  const parseCsvList = (raw: string) =>
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  useEffect(() => {
    const stored = window.localStorage.getItem('vitar-demo-mode');
    if (stored === '1') setDemoMode(true);
    if (stored === '0') setDemoMode(false);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('vitar-demo-mode', demoMode ? '1' : '0');
  }, [demoMode]);

  useEffect(() => {
    setOrderPage(1);
  }, [orderStatusFilter, orderSearch]);

  useEffect(() => {
    if (orderPage > totalOrderPages) setOrderPage(totalOrderPages);
  }, [orderPage, totalOrderPages]);

  useEffect(() => {
    if (!demoMode || devices.length > 0) return;

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const interval = setInterval(() => {
      setDemoReading((prev) => {
        const heartRateBase = prev.heartRate ?? 74;
        const spo2Base = prev.spo2 ?? 98;
        const riskBase = prev.aiRiskScore ?? 0.12;

        const nextHeartRate = clamp(heartRateBase + (Math.random() < 0.5 ? -2 : 2), 62, 95);
        const nextSpo2 = clamp(spo2Base + (Math.random() < 0.5 ? -0.3 : 0.3), 96, 100);
        const nextRisk = clamp(riskBase + (Math.random() < 0.5 ? -0.01 : 0.01), 0.05, 0.25);

        return {
          ...prev,
          recordedAt: new Date().toISOString(),
          heartRate: nextHeartRate,
          spo2: Number(nextSpo2.toFixed(1)),
          aiRiskScore: Number(nextRisk.toFixed(2)),
        };
      });

      setDemoDevice((prev) => {
        const currentBattery = prev.batteryLevel ?? 87;
        const batteryDrop = Math.random() < 0.2 ? 1 : 0;
        return {
          ...prev,
          batteryLevel: clamp(currentBattery - batteryDrop, 40, 100),
          lastSync: new Date().toISOString(),
        };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [demoMode, devices.length]);

  const getAccessToken = useCallback(async () => {
    if (accessToken) return accessToken;
    if (!user) return null;

    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    const refreshJson = await refreshRes.json();
    if (!refreshRes.ok || !refreshJson?.accessToken) return null;

    setUser(user, refreshJson.accessToken);
    return refreshJson.accessToken as string;
  }, [accessToken, user, setUser]);

  const fetchOrders = useCallback(async (token: string, active = true) => {
    const ordersRes = await fetch('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ordersJson = await ordersRes.json();

    if (!ordersRes.ok) {
      if (active) setOrdersError(ordersJson?.error || 'Failed to load orders.');
      return;
    }

    if (active) setOrders(Array.isArray(ordersJson.orders) ? ordersJson.orders : []);
  }, []);

  const handleCopyOrderDetails = async (order: Order) => {
    const lines = [
      `Order: ${order.order_number}`,
      `Device: VITAR ${order.device_model}`,
      `Status: ${order.status}`,
      `Amount: $${((order.total ?? 0) / 100).toFixed(2)} ${order.currency?.toUpperCase()}`,
      `Created: ${new Date(order.created_at).toLocaleString('en-IN')}`,
      `Stripe Session: ${order.stripe_session_id ?? 'N/A'}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast({ type: 'success', title: 'Order Details Copied' });
    } catch {
      showToast({ type: 'error', title: 'Copy Failed', message: 'Could not copy order details.' });
    }
  };

  const fetchHealthData = useCallback(async (token: string, active = true) => {
    const [devicesRes, readingsRes] = await Promise.all([
      fetch('/api/devices', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/health/readings?limit=1', { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    const [devicesJson, readingsJson] = await Promise.all([devicesRes.json(), readingsRes.json()]);

    if (devicesRes.ok) {
      if (active) setDevices(Array.isArray(devicesJson.devices) ? devicesJson.devices : []);
    } else if (active) {
      setHealthError(devicesJson?.error || 'Failed to load devices.');
    }

    if (readingsRes.ok) {
      if (active) {
        const first = Array.isArray(readingsJson.readings) ? readingsJson.readings[0] : null;
        setLatestReading(first ?? null);
      }
    } else if (active) {
      setHealthError(readingsJson?.error || 'Failed to load health readings.');
    }
  }, []);

  const fetchAlerts = useCallback(async (token: string, active = true) => {
    const res = await fetch('/api/alerts?limit=10', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      if (active) setAlertsError(json?.error || 'Failed to load alerts.');
      return;
    }
    if (active) setAlerts(Array.isArray(json.alerts) ? json.alerts : []);
  }, []);

  const fetchProfile = useCallback(async (token: string, active = true) => {
    const res = await fetch('/api/user/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      if (active) setProfileError(json?.error || 'Failed to load profile.');
      return;
    }

    if (!active) return;
    const nextProfile = json?.user as UserProfile;
    setProfile(nextProfile);
    setEmailNotifications(Boolean(nextProfile?.emailNotifications));
    setProfileForm({
      firstName: nextProfile?.firstName ?? '',
      lastName: nextProfile?.lastName ?? '',
      phone: nextProfile?.phone ?? '',
    });
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    if (!user) return;

    const nextFirstName = profileForm.firstName.trim();
    const nextLastName = profileForm.lastName.trim();
    const nextPhone = profileForm.phone.trim();

    if (!nextFirstName || !nextLastName) {
      setProfileError('First name and last name are required.');
      return;
    }

    setProfileSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setProfileError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const res = await fetch('/api/user/me', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: nextFirstName,
          lastName: nextLastName,
          phone: nextPhone || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setProfileError(json?.error || 'Failed to update profile.');
        showToast({ type: 'error', title: 'Profile Update Failed', message: json?.error || 'Failed to update profile.' });
        return;
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              firstName: nextFirstName,
              lastName: nextLastName,
              phone: nextPhone || null,
            }
          : prev
      );
      setUser(
        {
          id: user.id,
          email: user.email,
          firstName: nextFirstName,
          lastName: nextLastName,
          role: user.role,
        },
        token
      );
      setProfileSuccess('Profile updated successfully.');
      showToast({ type: 'success', title: 'Profile Updated' });
    } catch {
      setProfileError('Network error while updating profile.');
      showToast({ type: 'error', title: 'Profile Update Failed', message: 'Network error while updating profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (notificationSaving) return;
    const nextValue = !emailNotifications;
    setNotificationSaving(true);
    setProfileError('');
    try {
      const token = await getAccessToken();
      if (!token) {
        setProfileError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const res = await fetch('/api/user/me', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailNotifications: nextValue }),
      });
      const json = await res.json();
      if (!res.ok) {
        setProfileError(json?.error || 'Failed to update notification settings.');
        showToast({ type: 'error', title: 'Settings Update Failed', message: json?.error || 'Failed to update notification settings.' });
        return;
      }

      setEmailNotifications(nextValue);
      setProfile((prev) => (prev ? { ...prev, emailNotifications: nextValue } : prev));
      showToast({ type: 'success', title: 'Settings Updated' });
    } catch {
      setProfileError('Network error while updating notification settings.');
      showToast({ type: 'error', title: 'Settings Update Failed', message: 'Network error while updating notification settings.' });
    } finally {
      setNotificationSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    const currentPassword = passwordForm.currentPassword;
    const newPassword = passwordForm.newPassword;
    const confirmPassword = passwordForm.confirmPassword;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setPasswordError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const res = await fetch('/api/user/change-password', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json?.error || 'Failed to change password.');
        showToast({ type: 'error', title: 'Password Change Failed', message: json?.error || 'Failed to change password.' });
        return;
      }

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSuccess('Password changed successfully.');
      showToast({ type: 'success', title: 'Password Updated' });
    } catch {
      setPasswordError('Network error while changing password.');
      showToast({ type: 'error', title: 'Password Change Failed', message: 'Network error while changing password.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const fetchEmergencyContacts = useCallback(async (token: string, active = true) => {
    const res = await fetch('/api/emergency-contacts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      if (active) setContactsError(json?.error || 'Failed to load emergency contacts.');
      return;
    }
    if (active) setEmergencyContacts(Array.isArray(json?.contacts) ? json.contacts : []);
  }, []);

  const fetchMedicalProfile = useCallback(async (token: string, active = true) => {
    const res = await fetch('/api/medical-profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      if (active) setMedicalProfileError(json?.error || 'Failed to load medical profile.');
      return;
    }
    if (!active) return;
    const profileData = (json?.profile ?? null) as MedicalProfile | null;
    setMedicalProfile(profileData);
    setMedicalProfileForm({
      bloodType: profileData?.bloodType ?? '',
      heightCm: profileData?.heightCm != null ? String(profileData.heightCm) : '',
      weightKg: profileData?.weightKg != null ? String(profileData.weightKg) : '',
      sex: profileData?.sex ?? '',
      medicalNotes: profileData?.medicalNotes ?? '',
      familyHistory: profileData?.familyHistory ?? '',
      restingHeartRate: profileData?.restingHeartRate != null ? String(profileData.restingHeartRate) : '',
      allergies: Array.isArray(profileData?.allergies) ? profileData!.allergies.join(', ') : '',
      medications: Array.isArray(profileData?.medications) ? profileData!.medications.join(', ') : '',
      conditions: Array.isArray(profileData?.conditions) ? profileData!.conditions.join(', ') : '',
      physicianName: profileData?.physicianName ?? '',
      physicianPhone: profileData?.physicianPhone ?? '',
    });
  }, []);

  const handleAddEmergencyContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactsError('');
    setContactsSuccess('');
    const payload = {
      name: contactForm.name.trim(),
      relationship: contactForm.relationship.trim() || null,
      phone: contactForm.phone.trim(),
      email: contactForm.email.trim() || null,
      notifySms: true,
      notifyPush: true,
      priority: 1,
    };

    if (!payload.name || !payload.phone) {
      setContactsError('Contact name and phone are required.');
      return;
    }

    setContactsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setContactsError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const res = await fetch('/api/emergency-contacts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setContactsError(json?.error || 'Failed to add emergency contact.');
        showToast({ type: 'error', title: 'Contact Add Failed', message: json?.error || 'Failed to add emergency contact.' });
        return;
      }

      setContactForm({ name: '', relationship: '', phone: '', email: '' });
      setEditingContactId(null);
      showToast({ type: 'success', title: 'Emergency Contact Added' });
      setContactsSuccess('Emergency contact added.');
      await fetchEmergencyContacts(token);
    } catch {
      setContactsError('Network error while adding emergency contact.');
      showToast({ type: 'error', title: 'Contact Add Failed', message: 'Network error while adding emergency contact.' });
    } finally {
      setContactsSaving(false);
    }
  };

  const handleDeleteEmergencyContact = async (id: string) => {
    setContactActionLoadingId(id);
    setContactsError('');
    setContactsSuccess('');
    try {
      const token = await getAccessToken();
      if (!token) {
        setContactsError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const res = await fetch('/api/emergency-contacts', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setContactsError(json?.error || 'Failed to delete emergency contact.');
        showToast({ type: 'error', title: 'Delete Failed', message: json?.error || 'Failed to delete emergency contact.' });
        return;
      }

      showToast({ type: 'success', title: 'Emergency Contact Deleted' });
      setContactsSuccess('Emergency contact removed.');
      if (editingContactId === id) {
        setEditingContactId(null);
      }
      await fetchEmergencyContacts(token);
    } catch {
      setContactsError('Network error while deleting emergency contact.');
      showToast({ type: 'error', title: 'Delete Failed', message: 'Network error while deleting emergency contact.' });
    } finally {
      setContactActionLoadingId(null);
    }
  };

  const startEditEmergencyContact = (contact: EmergencyContact) => {
    setContactsError('');
    setContactsSuccess('');
    setEditingContactId(contact.id);
    setEditContactForm({
      name: contact.name,
      relationship: contact.relationship ?? '',
      phone: contact.phone,
      email: contact.email ?? '',
      priority: contact.priority,
      notifySms: contact.notifySms,
      notifyPush: contact.notifyPush,
    });
  };

  const cancelEditEmergencyContact = () => {
    setEditingContactId(null);
  };

  const handleSaveEmergencyContact = async (id: string) => {
    setContactsError('');
    setContactsSuccess('');

    const payload = {
      id,
      name: editContactForm.name.trim(),
      relationship: editContactForm.relationship.trim() || null,
      phone: editContactForm.phone.trim(),
      email: editContactForm.email.trim() || null,
      priority: editContactForm.priority,
      notifySms: editContactForm.notifySms,
      notifyPush: editContactForm.notifyPush,
    };

    if (!payload.name || !payload.phone) {
      setContactsError('Contact name and phone are required.');
      return;
    }

    if (payload.priority < 1 || payload.priority > 10) {
      setContactsError('Priority must be between 1 and 10.');
      return;
    }

    setContactActionLoadingId(id);
    try {
      const token = await getAccessToken();
      if (!token) {
        setContactsError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const res = await fetch('/api/emergency-contacts', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setContactsError(json?.error || 'Failed to update emergency contact.');
        showToast({ type: 'error', title: 'Update Failed', message: json?.error || 'Failed to update emergency contact.' });
        return;
      }

      showToast({ type: 'success', title: 'Emergency Contact Updated' });
      setContactsSuccess('Emergency contact updated.');
      setEditingContactId(null);
      await fetchEmergencyContacts(token);
    } catch {
      setContactsError('Network error while updating emergency contact.');
      showToast({ type: 'error', title: 'Update Failed', message: 'Network error while updating emergency contact.' });
    } finally {
      setContactActionLoadingId(null);
    }
  };

  const handleSaveMedicalProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMedicalProfileError('');
    setMedicalProfileSuccess('');

    setMedicalProfileSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setMedicalProfileError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const payload = {
        bloodType: medicalProfileForm.bloodType.trim() || null,
        heightCm: medicalProfileForm.heightCm.trim() ? Number(medicalProfileForm.heightCm) : null,
        weightKg: medicalProfileForm.weightKg.trim() ? Number(medicalProfileForm.weightKg) : null,
        sex: medicalProfileForm.sex.trim() || null,
        medicalNotes: medicalProfileForm.medicalNotes.trim() || null,
        familyHistory: medicalProfileForm.familyHistory.trim() || null,
        restingHeartRate: medicalProfileForm.restingHeartRate.trim() ? Number(medicalProfileForm.restingHeartRate) : null,
        allergies: parseCsvList(medicalProfileForm.allergies),
        medications: parseCsvList(medicalProfileForm.medications),
        conditions: parseCsvList(medicalProfileForm.conditions),
        physicianName: medicalProfileForm.physicianName.trim() || null,
        physicianPhone: medicalProfileForm.physicianPhone.trim() || null,
      };

      const res = await fetch('/api/medical-profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setMedicalProfileError(json?.error || 'Failed to update medical profile.');
        showToast({ type: 'error', title: 'Medical Profile Failed', message: json?.error || 'Failed to update medical profile.' });
        return;
      }

      setMedicalProfile((json?.profile ?? null) as MedicalProfile | null);
      setMedicalProfileSuccess('Medical profile updated.');
      showToast({ type: 'success', title: 'Medical Profile Updated' });
    } catch {
      setMedicalProfileError('Network error while updating medical profile.');
      showToast({ type: 'error', title: 'Medical Profile Failed', message: 'Network error while updating medical profile.' });
    } finally {
      setMedicalProfileSaving(false);
    }
  };

  const triggerTestAlert = async () => {
    setAlertsInfo('');
    setAlertsError('');
    setAlertsLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setAlertsError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const body = {
        deviceId: hasDevice && primaryDevice?.id !== 'demo-device' ? primaryDevice?.id : undefined,
        alertType: 'cardiac_anomaly',
        severity: 'critical',
        healthSnapshot: {
          heartRate: heartRateValue,
          spo2: spo2Value,
          aiRiskScore: effectiveReading?.aiRiskScore ?? null,
          source: demoMode ? 'demo' : 'device',
        },
      };

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setAlertsError(json?.error || 'Failed to trigger alert.');
        showToast({ type: 'error', title: 'Alert Failed', message: json?.error || 'Failed to trigger alert.' });
        return;
      }

      setAlertsInfo('Test alert triggered.');
      showToast({ type: 'success', title: 'Alert Triggered' });
      await fetchAlerts(token);
    } catch {
      setAlertsError('Network error while triggering alert.');
      showToast({ type: 'error', title: 'Alert Failed', message: 'Network error while triggering alert.' });
    } finally {
      setAlertsLoading(false);
    }
  };

  const updateAlertStatus = async (id: string, status: 'acknowledged' | 'resolved') => {
    setAlertActionLoadingId(id);
    setAlertsInfo('');
    setAlertsError('');
    try {
      const token = await getAccessToken();
      if (!token) {
        setAlertsError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAlertsError(json?.error || 'Failed to update alert.');
        showToast({ type: 'error', title: 'Alert Update Failed', message: json?.error || 'Failed to update alert.' });
        return;
      }

      setAlertsInfo(status === 'acknowledged' ? 'Alert acknowledged.' : 'Alert resolved.');
      showToast({ type: 'success', title: status === 'acknowledged' ? 'Alert Acknowledged' : 'Alert Resolved' });
      await fetchAlerts(token);
    } catch {
      setAlertsError('Network error while updating alert.');
      showToast({ type: 'error', title: 'Alert Update Failed', message: 'Network error while updating alert.' });
    } finally {
      setAlertActionLoadingId(null);
    }
  };

  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairSuccess('');
    setPairError('');
    setHealthError('');

    const serial = pairSerialNumber.trim();
    if (!serial) {
      setPairError('Enter a serial number.');
      showToast({ type: 'error', title: 'Device Pairing', message: 'Enter a serial number.' });
      return;
    }

    setPairing(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setPairError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serialNumber: serial, model: pairModel }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPairError(json?.error || 'Failed to pair device.');
        showToast({ type: 'error', title: 'Pairing Failed', message: json?.error || 'Failed to pair device.' });
        return;
      }

      setPairSerialNumber('');
      setPairSuccess('Device paired successfully.');
      showToast({ type: 'success', title: 'Device Paired' });
      await fetchHealthData(token);
    } catch {
      setPairError('Network error while pairing device.');
      showToast({ type: 'error', title: 'Pairing Failed', message: 'Network error while pairing device.' });
    } finally {
      setPairing(false);
    }
  };

  const handleUnpairDevice = async (id: string) => {
    setDeviceActionLoadingId(id);
    setPairSuccess('');
    setPairError('');
    setHealthError('');

    try {
      const token = await getAccessToken();
      if (!token) {
        setPairError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const res = await fetch('/api/devices', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPairError(json?.error || 'Failed to unpair device.');
        showToast({ type: 'error', title: 'Unpair Failed', message: json?.error || 'Failed to unpair device.' });
        return;
      }

      setPairSuccess('Device unpaired.');
      showToast({ type: 'success', title: 'Device Unpaired' });
      await fetchHealthData(token);
    } catch {
      setPairError('Network error while unpairing device.');
      showToast({ type: 'error', title: 'Unpair Failed', message: 'Network error while unpairing device.' });
    } finally {
      setDeviceActionLoadingId(null);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    let active = true;

    const loadDashboardData = async () => {
      if (!isAuthenticated || !user) return;

      setOrdersLoading(true);
      setHealthLoading(true);
      setAlertsLoading(true);
      setProfileLoading(true);
      setContactsLoading(true);
      setMedicalProfileLoading(true);
      setOrdersError('');
      setHealthError('');
      setAlertsError('');
      setProfileError('');
      setContactsError('');
      setMedicalProfileError('');

      try {
        const token = await getAccessToken();
        if (!token) {
          if (active) {
            setOrdersError('Session expired. Please sign in again.');
            setHealthError('Session expired. Please sign in again.');
            setProfileError('Session expired. Please sign in again.');
          }
          return;
        }

        await Promise.all([fetchOrders(token, active), fetchHealthData(token, active), fetchAlerts(token, active), fetchProfile(token, active)]);
        await Promise.all([fetchEmergencyContacts(token, active), fetchMedicalProfile(token, active)]);
      } catch {
        if (active) {
          setOrdersError('Network error while loading orders.');
          setHealthError('Network error while loading health data.');
          setAlertsError('Network error while loading alerts.');
          setProfileError('Network error while loading profile.');
          setContactsError('Network error while loading emergency contacts.');
          setMedicalProfileError('Network error while loading medical profile.');
        }
      } finally {
        if (active) {
          setOrdersLoading(false);
          setHealthLoading(false);
          setAlertsLoading(false);
          setProfileLoading(false);
          setContactsLoading(false);
          setMedicalProfileLoading(false);
        }
      }
    };

    loadDashboardData();
    return () => {
      active = false;
    };
  }, [isAuthenticated, user, getAccessToken, fetchOrders, fetchHealthData, fetchAlerts, fetchProfile, fetchEmergencyContacts, fetchMedicalProfile]);

  if (!user) return null;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--deep)',
        fontFamily: "'DM Sans', sans-serif",
        color: 'var(--white)',
      }}
    >
      <nav
        style={{
          padding: '0 5%',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(13,13,15,0.9)',
          backdropFilter: 'blur(24px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '1.3rem',
            letterSpacing: '0.12em',
            color: 'var(--white)',
            textDecoration: 'none',
          }}
        >
          VITAR<span style={{ color: '#C0392B' }}>.</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            {user.firstName} {user.lastName}
          </span>
          <button
            onClick={logout}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '3px',
              padding: '0.5rem 1.2rem',
              color: 'var(--white)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div style={{ padding: '4rem 5%', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.8rem' }}>
            <button
              onClick={() => setDemoMode((v) => !v)}
              style={{
                background: demoMode ? 'rgba(26,188,156,0.18)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${demoMode ? 'rgba(26,188,156,0.45)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '20px',
                color: demoMode ? '#1ABC9C' : 'var(--muted)',
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '0.35rem 0.8rem',
                cursor: 'pointer',
              }}
            >
              Demo Mode: {demoMode ? 'On' : 'Off'}
            </button>
          </div>
          <div
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#C0392B',
              marginBottom: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <span style={{ width: '24px', height: '1px', background: '#C0392B', display: 'inline-block' }} />
            Health Dashboard
          </div>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              lineHeight: 1.1,
              marginBottom: '0.5rem',
            }}
          >
            Good to have you,
            <br />
            {user.firstName}.
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
            Your cardiac health dashboard is ready. Connect your VITAR device to begin monitoring.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          {[
            {
              label: 'Device Status',
              value: healthLoading ? 'Loading...' : hasDevice ? deviceStatus : 'Not Connected',
              unit: '',
              color: hasDevice ? 'var(--white)' : 'var(--muted)',
              icon: 'D',
            },
            {
              label: 'Heart Rate',
              value: healthLoading ? '...' : heartRateValue ?? '--',
              unit: 'BPM',
              color: heartRateValue != null ? 'var(--white)' : 'var(--muted)',
              icon: 'HR',
            },
            {
              label: 'SpO2',
              value: healthLoading ? '...' : spo2Value ?? '--',
              unit: '%',
              color: spo2Value != null ? 'var(--white)' : 'var(--muted)',
              icon: 'O2',
            },
            {
              label: 'AI Risk Score',
              value: healthLoading ? '...' : riskScorePercent != null ? riskScorePercent : '--',
              unit: riskScorePercent != null ? '%' : '',
              color: riskScorePercent != null ? 'var(--white)' : 'var(--muted)',
              icon: 'AI',
            },
          ].map((card, i) => (
            <div
              key={i}
              style={{
                background: 'var(--graphite)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1.5rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.62rem',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '0.8rem',
                }}
              >
                {card.icon} {card.label}
              </div>
              <div
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: '2rem',
                  color: card.color,
                  lineHeight: 1,
                }}
              >
                {card.value}
              </div>
              {card.unit && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.3rem' }}>{card.unit}</div>}
            </div>
          ))}
        </div>

        {healthError && (
          <div
            style={{
              background: 'rgba(192,57,43,0.1)',
              border: '1px solid rgba(192,57,43,0.3)',
              borderRadius: '6px',
              padding: '0.8rem 1rem',
              color: '#E74C3C',
              fontSize: '0.82rem',
              marginBottom: '1.2rem',
            }}
          >
            {healthError}
          </div>
        )}

        <div
          style={{
            background: 'rgba(192,57,43,0.06)',
            border: '1px solid rgba(192,57,43,0.2)',
            borderRadius: '8px',
            padding: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 500, marginBottom: '0.3rem' }}>
              {hasDevice ? `${primaryDevice?.model ?? 'VITAR'} connected` : 'No device connected'}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              {hasDevice
                ? `Status: ${deviceStatus}${primaryDevice?.batteryLevel != null ? ` | Battery: ${primaryDevice.batteryLevel}%` : ''}`
                : 'Pre-order your VITAR device to start monitoring your cardiac health'}
            </div>
          </div>
          {!hasDevice && (
            <Link
              href="/#pricing"
              style={{
                background: '#C0392B',
                color: 'var(--white)',
                textDecoration: 'none',
                padding: '0.8rem 1.8rem',
                borderRadius: '3px',
                fontSize: '0.82rem',
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Order a Device
            </Link>
          )}
        </div>

        <div
          style={{
            marginTop: '2rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--graphite)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '1.5rem',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
              Emergency Contacts
            </div>

            <form onSubmit={handleAddEmergencyContact} style={{ display: 'grid', gap: '0.6rem', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <input
                  className="f-inp"
                  placeholder="Name"
                  value={contactForm.name}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <input
                  className="f-inp"
                  placeholder="Relationship"
                  value={contactForm.relationship}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, relationship: e.target.value }))}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <input
                  className="f-inp"
                  placeholder="Phone"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
                <input
                  className="f-inp"
                  placeholder="Email (optional)"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <button
                type="submit"
                disabled={contactsSaving}
                style={{
                  background: '#C0392B',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'var(--white)',
                  fontSize: '0.76rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '0.55rem 0.75rem',
                  width: 'fit-content',
                  cursor: contactsSaving ? 'not-allowed' : 'pointer',
                  opacity: contactsSaving ? 0.7 : 1,
                }}
              >
                {contactsSaving ? 'Adding...' : 'Add Contact'}
              </button>
            </form>

            {contactsError && <div style={{ color: '#E74C3C', fontSize: '0.78rem', marginBottom: '0.6rem' }}>{contactsError}</div>}
            {contactsSuccess && <div style={{ color: '#2ECC71', fontSize: '0.78rem', marginBottom: '0.6rem' }}>{contactsSuccess}</div>}

            {contactsLoading ? (
              <div className="skeleton-stack">
                <div className="skeleton-line long" />
                <div className="skeleton-line mid" />
              </div>
            ) : emergencyContacts.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>No emergency contacts added yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                {emergencyContacts.map((contact) => (
                  <div
                    key={contact.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '0.65rem 0.75rem',
                      display: 'grid',
                      gap: '0.65rem',
                    }}
                  >
                    {editingContactId === contact.id ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                          <input
                            className="f-inp"
                            value={editContactForm.name}
                            onChange={(e) => setEditContactForm((prev) => ({ ...prev, name: e.target.value }))}
                          />
                          <input
                            className="f-inp"
                            value={editContactForm.relationship}
                            onChange={(e) => setEditContactForm((prev) => ({ ...prev, relationship: e.target.value }))}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                          <input
                            className="f-inp"
                            value={editContactForm.phone}
                            onChange={(e) => setEditContactForm((prev) => ({ ...prev, phone: e.target.value }))}
                          />
                          <input
                            className="f-inp"
                            value={editContactForm.email}
                            onChange={(e) => setEditContactForm((prev) => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', alignItems: 'center' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: 'var(--muted)' }}>
                            Priority
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={editContactForm.priority}
                              onChange={(e) =>
                                setEditContactForm((prev) => ({
                                  ...prev,
                                  priority: Number(e.target.value || 1),
                                }))
                              }
                              style={{
                                width: '64px',
                                background: 'var(--deep)',
                                border: '1px solid var(--border)',
                                borderRadius: '4px',
                                color: 'var(--white)',
                                fontSize: '0.74rem',
                                padding: '0.25rem 0.35rem',
                              }}
                            />
                          </label>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: 'var(--muted)' }}>
                            <input
                              type="checkbox"
                              checked={editContactForm.notifySms}
                              onChange={(e) => setEditContactForm((prev) => ({ ...prev, notifySms: e.target.checked }))}
                            />
                            SMS
                          </label>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: 'var(--muted)' }}>
                            <input
                              type="checkbox"
                              checked={editContactForm.notifyPush}
                              onChange={(e) => setEditContactForm((prev) => ({ ...prev, notifyPush: e.target.checked }))}
                            />
                            Push
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={cancelEditEmergencyContact}
                            disabled={contactActionLoadingId === contact.id}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              color: 'var(--muted)',
                              fontSize: '0.72rem',
                              padding: '0.3rem 0.55rem',
                              cursor: contactActionLoadingId === contact.id ? 'not-allowed' : 'pointer',
                              opacity: contactActionLoadingId === contact.id ? 0.7 : 1,
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEmergencyContact(contact.id)}
                            disabled={contactActionLoadingId === contact.id}
                            style={{
                              background: 'rgba(46,204,113,0.14)',
                              border: '1px solid rgba(46,204,113,0.35)',
                              borderRadius: '4px',
                              color: '#2ECC71',
                              fontSize: '0.72rem',
                              padding: '0.3rem 0.55rem',
                              cursor: contactActionLoadingId === contact.id ? 'not-allowed' : 'pointer',
                              opacity: contactActionLoadingId === contact.id ? 0.7 : 1,
                            }}
                          >
                            {contactActionLoadingId === contact.id ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
                        <div>
                          <div style={{ fontSize: '0.82rem' }}>{contact.name}</div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>
                            {contact.relationship || 'Contact'} • {contact.phone}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                            Priority {contact.priority} | SMS {contact.notifySms ? 'On' : 'Off'} | Push {contact.notifyPush ? 'On' : 'Off'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.45rem' }}>
                          <button
                            type="button"
                            onClick={() => startEditEmergencyContact(contact)}
                            disabled={contactActionLoadingId === contact.id}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.16)',
                              borderRadius: '4px',
                              color: 'var(--white)',
                              fontSize: '0.72rem',
                              padding: '0.3rem 0.55rem',
                              cursor: contactActionLoadingId === contact.id ? 'not-allowed' : 'pointer',
                              opacity: contactActionLoadingId === contact.id ? 0.7 : 1,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEmergencyContact(contact.id)}
                            disabled={contactActionLoadingId === contact.id}
                            style={{
                              background: 'rgba(231,76,60,0.1)',
                              border: '1px solid rgba(231,76,60,0.28)',
                              borderRadius: '4px',
                              color: '#E74C3C',
                              fontSize: '0.72rem',
                              padding: '0.3rem 0.55rem',
                              cursor: contactActionLoadingId === contact.id ? 'not-allowed' : 'pointer',
                              opacity: contactActionLoadingId === contact.id ? 0.7 : 1,
                            }}
                          >
                            {contactActionLoadingId === contact.id ? 'Removing...' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              background: 'var(--graphite)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '1.5rem',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
              Medical Profile
            </div>

            <form onSubmit={handleSaveMedicalProfile} style={{ display: 'grid', gap: '0.6rem' }}>
              <input
                className="f-inp"
                placeholder="Blood type (e.g., O+)"
                value={medicalProfileForm.bloodType}
                onChange={(e) => setMedicalProfileForm((prev) => ({ ...prev, bloodType: e.target.value }))}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
                <input
                  className="f-inp"
                  placeholder="Height (cm)"
                  value={medicalProfileForm.heightCm}
                  onChange={(e) => setMedicalProfileForm((prev) => ({ ...prev, heightCm: e.target.value }))}
                />
                <input
                  className="f-inp"
                  placeholder="Weight (kg)"
                  value={medicalProfileForm.weightKg}
                  onChange={(e) => setMedicalProfileForm((prev) => ({ ...prev, weightKg: e.target.value }))}
                />
                <input
                  className="f-inp"
                  placeholder="Resting HR"
                  value={medicalProfileForm.restingHeartRate}
                  onChange={(e) => setMedicalProfileForm((prev) => ({ ...prev, restingHeartRate: e.target.value }))}
                />
              </div>
              <select
                className="f-inp"
                value={medicalProfileForm.sex}
                onChange={(e) => setMedicalProfileForm((prev) => ({ ...prev, sex: e.target.value }))}
              >
                <option value="">Sex</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
              <input
                className="f-inp"
                placeholder="Allergies (comma separated)"
                value={medicalProfileForm.allergies}
                onChange={(e) => setMedicalProfileForm((prev) => ({ ...prev, allergies: e.target.value }))}
              />
              <input
                className="f-inp"
                placeholder="Medications (comma separated)"
                value={medicalProfileForm.medications}
                onChange={(e) => setMedicalProfileForm((prev) => ({ ...prev, medications: e.target.value }))}
              />
              <input
                className="f-inp"
                placeholder="Conditions (comma separated)"
                value={medicalProfileForm.conditions}
                onChange={(e) => setMedicalProfileForm((prev) => ({ ...prev, conditions: e.target.value }))}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <input
                  className="f-inp"
                  placeholder="Physician name"
                  value={medicalProfileForm.physicianName}
                  onChange={(e) => setMedicalProfileForm((prev) => ({ ...prev, physicianName: e.target.value }))}
                />
                <input
                  className="f-inp"
                  placeholder="Physician phone"
                  value={medicalProfileForm.physicianPhone}
                  onChange={(e) => setMedicalProfileForm((prev) => ({ ...prev, physicianPhone: e.target.value }))}
                />
              </div>
              <textarea
                className="f-inp"
                placeholder="Family cardiac history"
                value={medicalProfileForm.familyHistory}
                onChange={(e) => setMedicalProfileForm((prev) => ({ ...prev, familyHistory: e.target.value }))}
                rows={3}
                style={{ resize: 'vertical', minHeight: '90px' }}
              />
              <textarea
                className="f-inp"
                placeholder="Emergency medical notes"
                value={medicalProfileForm.medicalNotes}
                onChange={(e) => setMedicalProfileForm((prev) => ({ ...prev, medicalNotes: e.target.value }))}
                rows={3}
                style={{ resize: 'vertical', minHeight: '90px' }}
              />

              {medicalProfileError && <div style={{ color: '#E74C3C', fontSize: '0.78rem' }}>{medicalProfileError}</div>}
              {medicalProfileSuccess && <div style={{ color: '#2ECC71', fontSize: '0.78rem' }}>{medicalProfileSuccess}</div>}
              {medicalProfileLoading && <div style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>Loading profile...</div>}
              {!medicalProfileLoading && medicalProfile && (
                <div style={{ display: 'grid', gap: '0.35rem', color: 'var(--muted)', fontSize: '0.74rem' }}>
                  <div>
                    Profile summary:
                    {' '}
                    {[
                      medicalProfile.sex ? `Sex ${medicalProfile.sex}` : null,
                      medicalProfile.heightCm != null ? `${medicalProfile.heightCm} cm` : null,
                      medicalProfile.weightKg != null ? `${medicalProfile.weightKg} kg` : null,
                      medicalProfile.restingHeartRate != null ? `Resting HR ${medicalProfile.restingHeartRate}` : null,
                    ].filter(Boolean).join(' | ') || 'Basic health details not added yet.'}
                  </div>
                  <div>
                    Last updated: {medicalProfile.updatedAt ? new Date(medicalProfile.updatedAt).toLocaleDateString('en-IN') : 'recently'}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={medicalProfileSaving}
                style={{
                  background: '#C0392B',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'var(--white)',
                  fontSize: '0.76rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '0.55rem 0.75rem',
                  width: 'fit-content',
                  cursor: medicalProfileSaving ? 'not-allowed' : 'pointer',
                  opacity: medicalProfileSaving ? 0.7 : 1,
                }}
              >
                {medicalProfileSaving ? 'Saving...' : 'Save Medical Profile'}
              </button>
            </form>
          </div>
        </div>

        <div
          style={{
            marginTop: '2rem',
            background: 'var(--graphite)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
            Device Management
          </div>

          <form onSubmit={handlePairDevice} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.6rem', marginBottom: '1rem' }}>
            <input
              value={pairSerialNumber}
              onChange={(e) => setPairSerialNumber(e.target.value)}
              placeholder="Device serial number"
              style={{
                background: 'var(--deep)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '4px',
                color: 'var(--white)',
                fontSize: '0.85rem',
                padding: '0.7rem 0.8rem',
              }}
            />
            <select
              value={pairModel}
              onChange={(e) => setPairModel(e.target.value)}
              style={{
                background: 'var(--deep)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '4px',
                color: 'var(--white)',
                fontSize: '0.85rem',
                padding: '0.7rem 0.8rem',
              }}
            >
              <option value="core">Core</option>
              <option value="pro">Pro</option>
              <option value="elite">Elite</option>
            </select>
            <button
              type="submit"
              disabled={pairing}
              style={{
                background: '#C0392B',
                border: 'none',
                borderRadius: '4px',
                color: 'var(--white)',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '0.7rem 1rem',
                cursor: pairing ? 'not-allowed' : 'pointer',
                opacity: pairing ? 0.7 : 1,
              }}
            >
              {pairing ? 'Pairing...' : 'Pair Device'}
            </button>
          </form>

          {pairSuccess && <div style={{ color: '#2ECC71', fontSize: '0.82rem', marginBottom: '0.6rem' }}>{pairSuccess}</div>}
          {pairError && <div style={{ color: '#E74C3C', fontSize: '0.82rem', marginBottom: '0.6rem' }}>{pairError}</div>}
          {demoMode && devices.length === 0 && (
            <div style={{ color: '#1ABC9C', fontSize: '0.82rem', marginBottom: '0.6rem' }}>
              Demo mode is active. Showing simulated device and health data.
            </div>
          )}

          {healthLoading ? (
            <div className="skeleton-stack" style={{ marginTop: '0.4rem' }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton-row">
                  <div className="skeleton-line long" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-line short" />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table table-card" style={{ fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {deviceColumns.map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '0.7rem 0.3rem',
                          fontSize: '0.68rem',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          fontWeight: 500,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {effectiveDevices.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td data-label={deviceColumns[0]} style={{ padding: '0.8rem 0.3rem', fontFamily: 'monospace', color: 'var(--muted)' }}>{d.serialNumber ?? 'N/A'}</td>
                      <td data-label={deviceColumns[1]} style={{ padding: '0.8rem 0.3rem' }}>{d.model ?? 'N/A'}</td>
                      <td data-label={deviceColumns[2]} style={{ padding: '0.8rem 0.3rem', color: 'var(--muted)' }}>{d.status ?? 'unknown'}</td>
                      <td data-label={deviceColumns[3]} style={{ padding: '0.8rem 0.3rem', color: 'var(--muted)' }}>{d.batteryLevel != null ? `${d.batteryLevel}%` : 'N/A'}</td>
                      <td data-label={deviceColumns[4]} style={{ padding: '0.8rem 0.3rem', color: 'var(--muted)' }}>
                        {d.lastSync ? new Date(d.lastSync).toLocaleString('en-IN') : 'N/A'}
                      </td>
                      <td data-label={deviceColumns[5]} style={{ padding: '0.8rem 0.3rem' }}>
                        {d.id === 'demo-device' ? (
                          <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>Simulated</span>
                        ) : (
                          <button
                            onClick={() => handleUnpairDevice(d.id)}
                            disabled={deviceActionLoadingId === d.id}
                            style={{
                              background: 'rgba(192,57,43,0.1)',
                              border: '1px solid rgba(192,57,43,0.3)',
                              borderRadius: '3px',
                              color: '#C0392B',
                              padding: '0.35rem 0.7rem',
                              fontSize: '0.72rem',
                              cursor: deviceActionLoadingId === d.id ? 'not-allowed' : 'pointer',
                              opacity: deviceActionLoadingId === d.id ? 0.7 : 1,
                            }}
                          >
                            {deviceActionLoadingId === d.id ? 'Removing...' : 'Unpair'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {effectiveDevices.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.8rem' }}>No devices paired yet.</p>}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: '2rem',
            background: 'var(--graphite)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Alerts ({activeAlerts.length} active)
            </div>
            <button
              onClick={triggerTestAlert}
              disabled={alertsLoading}
              style={{
                background: 'rgba(231,76,60,0.14)',
                border: '1px solid rgba(231,76,60,0.35)',
                borderRadius: '4px',
                color: '#E74C3C',
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '0.5rem 0.8rem',
                cursor: alertsLoading ? 'not-allowed' : 'pointer',
                opacity: alertsLoading ? 0.7 : 1,
              }}
            >
              {alertsLoading ? 'Processing...' : 'Trigger Test Alert'}
            </button>
          </div>

          {alertsInfo && <div style={{ color: '#2ECC71', fontSize: '0.82rem', marginBottom: '0.6rem' }}>{alertsInfo}</div>}
          {alertsError && <div style={{ color: '#E74C3C', fontSize: '0.82rem', marginBottom: '0.6rem' }}>{alertsError}</div>}

          {alertsLoading && alerts.length === 0 ? (
            <div className="skeleton-stack" style={{ marginTop: '0.4rem' }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton-row">
                  <div className="skeleton-line long" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line short" />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table table-card" style={{ fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {alertColumns.map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '0.7rem 0.3rem',
                          fontSize: '0.68rem',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          fontWeight: 500,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td data-label={alertColumns[0]} style={{ padding: '0.8rem 0.3rem' }}>{a.alertType}</td>
                      <td data-label={alertColumns[1]} style={{ padding: '0.8rem 0.3rem' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '20px',
                            background:
                              a.severity === 'critical'
                                ? 'rgba(231,76,60,0.1)'
                                : a.severity === 'high'
                                ? 'rgba(243,156,18,0.1)'
                                : 'rgba(255,255,255,0.05)',
                            color: a.severity === 'critical' ? '#E74C3C' : a.severity === 'high' ? '#F39C12' : 'var(--muted)',
                            border: '1px solid rgba(255,255,255,0.12)',
                          }}
                        >
                          {a.severity}
                        </span>
                      </td>
                      <td data-label={alertColumns[2]} style={{ padding: '0.8rem 0.3rem', color: 'var(--muted)' }}>{a.status}</td>
                      <td data-label={alertColumns[3]} style={{ padding: '0.8rem 0.3rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                        {new Date(a.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td data-label={alertColumns[4]} style={{ padding: '0.8rem 0.3rem', display: 'flex', gap: '0.4rem' }}>
                        {a.status === 'pending' && (
                          <button
                            onClick={() => updateAlertStatus(a.id, 'acknowledged')}
                            disabled={alertActionLoadingId === a.id}
                            style={{
                              background: 'rgba(52,152,219,0.14)',
                              border: '1px solid rgba(52,152,219,0.35)',
                              borderRadius: '3px',
                              color: '#3498DB',
                              padding: '0.35rem 0.6rem',
                              fontSize: '0.72rem',
                              cursor: alertActionLoadingId === a.id ? 'not-allowed' : 'pointer',
                              opacity: alertActionLoadingId === a.id ? 0.7 : 1,
                            }}
                          >
                            Acknowledge
                          </button>
                        )}
                        {a.status === 'acknowledged' && (
                          <button
                            onClick={() => updateAlertStatus(a.id, 'resolved')}
                            disabled={alertActionLoadingId === a.id}
                            style={{
                              background: 'rgba(46,204,113,0.14)',
                              border: '1px solid rgba(46,204,113,0.35)',
                              borderRadius: '3px',
                              color: '#2ECC71',
                              padding: '0.35rem 0.6rem',
                              fontSize: '0.72rem',
                              cursor: alertActionLoadingId === a.id ? 'not-allowed' : 'pointer',
                              opacity: alertActionLoadingId === a.id ? 0.7 : 1,
                            }}
                          >
                            Resolve
                          </button>
                        )}
                        {(a.status === 'resolved' || a.status === 'dismissed') && (
                          <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>Closed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {alerts.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.8rem' }}>No alerts yet.</p>}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: '2rem',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)',
            gap: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--graphite)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '1.5rem',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
              Profile
            </div>

            {profileLoading ? (
              <div className="skeleton-stack">
                <div className="skeleton-line long" />
                <div className="skeleton-line mid" />
                <div className="skeleton-line mid" />
              </div>
            ) : (
              <form onSubmit={handleProfileSave} style={{ display: 'grid', gap: '0.9rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>First Name</label>
                    <input
                      className="f-inp"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      style={{ marginTop: '0.35rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Last Name</label>
                    <input
                      className="f-inp"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      style={{ marginTop: '0.35rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Phone</label>
                    <input
                      className="f-inp"
                      placeholder="+91 98765 43210"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                      style={{ marginTop: '0.35rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
                    <input className="f-inp" value={profile?.email ?? user.email} disabled style={{ marginTop: '0.35rem', opacity: 0.8 }} />
                  </div>
                </div>

                {profileError && <div style={{ color: '#E74C3C', fontSize: '0.82rem' }}>{profileError}</div>}
                {profileSuccess && <div style={{ color: '#2ECC71', fontSize: '0.82rem' }}>{profileSuccess}</div>}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {profile?.createdAt ? `Member since ${new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : 'Member'}
                  </div>
                  <button
                    type="submit"
                    disabled={profileSaving || !profileDirty}
                    style={{
                      background: '#C0392B',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '0.6rem 1rem',
                      cursor: profileSaving || !profileDirty ? 'not-allowed' : 'pointer',
                      opacity: profileSaving || !profileDirty ? 0.7 : 1,
                    }}
                  >
                    {profileSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div
            style={{
              background: 'var(--graphite)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '1.5rem',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
              Account Settings
            </div>

            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
                <div>
                  <div style={{ fontSize: '0.84rem' }}>Email Notifications</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Order and health alert emails</div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  disabled={notificationSaving}
                  style={{
                    background: emailNotifications ? 'rgba(46,204,113,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${emailNotifications ? 'rgba(46,204,113,0.35)' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: '20px',
                    color: emailNotifications ? '#2ECC71' : 'var(--muted)',
                    fontSize: '0.7rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '0.35rem 0.75rem',
                    cursor: notificationSaving ? 'not-allowed' : 'pointer',
                    opacity: notificationSaving ? 0.7 : 1,
                  }}
                >
                  {notificationSaving ? 'Saving...' : emailNotifications ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.9rem', display: 'grid', gap: '0.6rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Security</div>
                <form onSubmit={handlePasswordChange} style={{ display: 'grid', gap: '0.55rem' }}>
                  <input
                    className="f-inp"
                    type="password"
                    placeholder="Current password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  />
                  <input
                    className="f-inp"
                    type="password"
                    placeholder="New password (min 8 chars)"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  />
                  <input
                    className="f-inp"
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                  {passwordError && <div style={{ color: '#E74C3C', fontSize: '0.78rem' }}>{passwordError}</div>}
                  {passwordSuccess && <div style={{ color: '#2ECC71', fontSize: '0.78rem' }}>{passwordSuccess}</div>}
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    style={{
                      background: 'rgba(192,57,43,0.1)',
                      border: '1px solid rgba(192,57,43,0.28)',
                      borderRadius: '4px',
                      color: '#C0392B',
                      fontSize: '0.74rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '0.48rem 0.7rem',
                      width: 'fit-content',
                      cursor: passwordSaving ? 'not-allowed' : 'pointer',
                      opacity: passwordSaving ? 0.7 : 1,
                    }}
                  >
                    {passwordSaving ? 'Updating...' : 'Change password'}
                  </button>
                </form>
                <button
                  onClick={logout}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '4px',
                    color: 'var(--white)',
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '0.55rem 0.8rem',
                    width: 'fit-content',
                    cursor: 'pointer',
                  }}
                >
                  Sign Out
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.9rem', display: 'grid', gap: '0.45rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Plan</div>
                <div style={{ fontSize: '0.9rem' }}>
                  {profile?.subscription ? `${profile.subscription.plan} (${profile.subscription.status})` : 'No active subscription'}
                </div>
                {profile?.subscription?.currentPeriodEnd && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
                    Renews on {new Date(profile.subscription.currentPeriodEnd).toLocaleDateString('en-IN')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: '2rem',
            background: 'var(--graphite)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Order History
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <input
                className="f-inp"
                placeholder="Search order #, model, status"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                style={{ minWidth: '220px', padding: '0.45rem 0.7rem', fontSize: '0.8rem' }}
              />
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value as 'all' | 'pending' | 'confirmed' | 'cancelled')}
                style={{
                  background: 'var(--deep)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '4px',
                  color: 'var(--white)',
                  fontSize: '0.8rem',
                  padding: '0.45rem 0.7rem',
                }}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <Link href="/#pricing" style={{ color: '#C0392B', textDecoration: 'none', fontSize: '0.78rem' }}>
                New order
              </Link>
            </div>
          </div>

          {ordersLoading && (
            <div className="skeleton-stack" style={{ marginTop: '0.6rem' }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton-row">
                  <div className="skeleton-line long" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-line mid" />
                </div>
              ))}
            </div>
          )}

          {!ordersLoading && ordersError && (
            <div
              style={{
                background: 'rgba(192,57,43,0.1)',
                border: '1px solid rgba(192,57,43,0.3)',
                borderRadius: '6px',
                padding: '0.8rem 1rem',
                color: '#E74C3C',
                fontSize: '0.82rem',
              }}
            >
              {ordersError}
            </div>
          )}

          {!ordersLoading && !ordersError && filteredOrders.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              {orders.length === 0 ? 'No orders yet. Reserve your first device.' : 'No orders match this status filter.'}
            </p>
          )}

          {!ordersLoading && !ordersError && filteredOrders.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table table-card" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {orderColumns.map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '0.7rem 0.2rem',
                          textAlign: 'left',
                          fontSize: '0.68rem',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          fontWeight: 500,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((o) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td data-label={orderColumns[0]} style={{ padding: '0.9rem 0.2rem', fontFamily: 'monospace', color: '#C0392B', fontSize: '0.78rem' }}>
                        {o.order_number}
                      </td>
                      <td data-label={orderColumns[1]} style={{ padding: '0.9rem 0.2rem', color: 'var(--muted)' }}>VITAR {o.device_model}</td>
                      <td data-label={orderColumns[2]} style={{ padding: '0.9rem 0.2rem' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '20px',
                            background: o.status === 'confirmed' ? 'rgba(46,204,113,0.1)' : 'rgba(255,193,7,0.1)',
                            color: o.status === 'confirmed' ? '#2ECC71' : '#FFC107',
                            border: `1px solid ${o.status === 'confirmed' ? 'rgba(46,204,113,0.3)' : 'rgba(255,193,7,0.3)'}`,
                          }}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td data-label={orderColumns[3]} style={{ padding: '0.9rem 0.2rem', color: '#2ECC71', fontWeight: 500 }}>
                        ${((o.total ?? 0) / 100).toFixed(2)} {o.currency?.toUpperCase()}
                      </td>
                      <td data-label={orderColumns[4]} style={{ padding: '0.9rem 0.2rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td data-label={orderColumns[5]} style={{ padding: '0.9rem 0.2rem' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyOrderDetails(o)}
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.14)',
                            borderRadius: '4px',
                            color: 'var(--white)',
                            fontSize: '0.72rem',
                            padding: '0.3rem 0.55rem',
                            cursor: 'pointer',
                          }}
                        >
                          Copy
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!ordersLoading && !ordersError && filteredOrders.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem', gap: '0.8rem', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
                Showing {(orderPage - 1) * ordersPageSize + 1}-{Math.min(orderPage * ordersPageSize, filteredOrders.length)} of {filteredOrders.length}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={orderPage <= 1}
                  onClick={() => setOrderPage((prev) => Math.max(1, prev - 1))}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '4px',
                    color: 'var(--white)',
                    fontSize: '0.74rem',
                    padding: '0.4rem 0.65rem',
                    cursor: orderPage <= 1 ? 'not-allowed' : 'pointer',
                    opacity: orderPage <= 1 ? 0.65 : 1,
                  }}
                >
                  Prev
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  Page {orderPage} / {totalOrderPages}
                </span>
                <button
                  type="button"
                  disabled={orderPage >= totalOrderPages}
                  onClick={() => setOrderPage((prev) => Math.min(totalOrderPages, prev + 1))}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '4px',
                    color: 'var(--white)',
                    fontSize: '0.74rem',
                    padding: '0.4rem 0.65rem',
                    cursor: orderPage >= totalOrderPages ? 'not-allowed' : 'pointer',
                    opacity: orderPage >= totalOrderPages ? 0.65 : 1,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




