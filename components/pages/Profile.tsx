'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';
import {
  User, Mail, Lock, Shield, Sparkles, Check,
  Eye, EyeOff, Save, KeyRound, Calendar,
  Loader2, Edit2, ArrowRight, X,
  RotateCw, AlertCircle, CheckCircle2, Info,
  Upload, Trash2, Camera, AlertTriangle
} from 'lucide-react';
import UserAvatar, { ANIMAL_AVATARS, TEACHER_EMOJIS, isImageUrl, getDefaultAvatar } from '@/components/UserAvatar';

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Profile form state
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [customAvatar, setCustomAvatar] = useState('');
  const [isCustomAvatar, setIsCustomAvatar] = useState(false);
  const [avatarType, setAvatarType] = useState<'upload' | 'emoji'>('emoji');
  const [emojiCategory, setEmojiCategory] = useState<'animals' | 'teacher'>('animals');
  const [googleAvatar, setGoogleAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Security form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [_isGoogleUser, setIsGoogleUser] = useState(false);

  // Delete account state & modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Account metadata
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Email change state & modal
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'request' | 'verify'>('request');
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [devOtpNotice, setDevOtpNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const openEmailModal = () => {
    setNewEmail('');
    setEmailOtp('');
    setEmailStep('request');
    setDevOtpNotice(null);
    setCountdown(0);
    setIsEmailModalOpen(true);
  };

  const handleRequestEmailOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error('กรุณาระบุที่อยู่อีเมลใหม่');
      return;
    }
    if (cleanEmail === user?.email?.toLowerCase()) {
      toast.error('อีเมลนี้ตรงกับอีเมลปัจจุบันของคุณแล้ว');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await api.post('/auth/profile/email/request', { newEmail: cleanEmail });
      toast.success(res.data.message || 'ส่งรหัส OTP เรียบร้อยแล้ว');
      if (res.data.isDevMode && res.data.devCode) {
        setDevOtpNotice(res.data.devCode);
      } else {
        setDevOtpNotice(null);
      }
      setEmailStep('verify');
      setCountdown(60);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.response?.data?.message || 'ไม่สามารถส่งรหัส OTP ได้');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = emailOtp.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      toast.error('กรุณากรอกรหัส OTP 6 หลัก');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await api.post('/auth/profile/email/verify', { code: cleanCode });
      if (res.data.user) {
        updateUser(res.data.user);
      }
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        document.cookie = `token=${res.data.token}; path=/; max-age=604800; SameSite=Lax`;
      }
      toast.success(res.data.message || 'เปลี่ยนที่อยู่อีเมลสำเร็จเรียบร้อย 🎉');
      setIsEmailModalOpen(false);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.response?.data?.message || 'การยืนยันรหัส OTP ล้มเหลว');
    } finally {
      setEmailLoading(false);
    }
  };

  // Initialize from user or fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/profile');
        const u = res.data.user;
        if (u) {
          setName(u.name || '');
          const initialAvatar = u.avatar || getDefaultAvatar(u.id);
          setSelectedAvatar(initialAvatar);
          if (isImageUrl(initialAvatar)) {
            setAvatarType('upload');
            if (initialAvatar.includes('googleusercontent.com')) {
              setGoogleAvatar(initialAvatar);
            }
          } else if (!ANIMAL_AVATARS.includes(initialAvatar) && !TEACHER_EMOJIS.includes(initialAvatar)) {
            setAvatarType('emoji');
            setIsCustomAvatar(true);
            setCustomAvatar(initialAvatar);
          } else {
            setAvatarType('emoji');
            if (TEACHER_EMOJIS.includes(initialAvatar)) {
              setEmojiCategory('teacher');
            }
          }
          if (u.createdAt) {
            setCreatedAt(u.createdAt);
          }
          setHasPassword(u.hasPassword ?? true);
          setIsGoogleUser(u.isGoogleUser ?? false);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchProfile();
  }, []);

  // Handle client-side image compression & selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WEBP, GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetSize = 256;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);

        const compressedDataUrl = canvas.toDataURL('image/webp', 0.88);
        setSelectedAvatar(compressedDataUrl);
        setAvatarType('upload');
        toast.success('เลือกรูปภาพสำเร็จ กด "บันทึกการเปลี่ยนแปลง" เพื่อใช้งาน');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    let finalAvatar = selectedAvatar;
    if (avatarType === 'emoji' && isCustomAvatar && customAvatar.trim()) {
      finalAvatar = customAvatar.trim();
    }

    setSavingProfile(true);
    try {
      const res = await api.put('/auth/profile', {
        name: name.trim(),
        avatar: finalAvatar,
      });

      if (res.data.user) {
        updateUser(res.data.user);
      }
      toast.success('อัปเดตข้อมูลส่วนตัวสำเร็จ 🎉');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.response?.data?.message || 'ไม่สามารถอัปเดตข้อมูลได้');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeletingAccount(true);
    try {
      const res = await api.delete('/auth/profile', {
        data: {
          password: deletePassword,
          confirmation: deleteConfirmation,
        },
      });
      toast.success(res.data.message || 'ลบบัญชีผู้ใช้เรียบร้อยแล้ว');
      setIsDeleteModalOpen(false);
      logout();
      router.push('/login');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.response?.data?.message || 'ไม่สามารถลบบัญชีได้');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword) {
      toast.error('กรุณากรอกรหัสผ่านใหม่');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast.success('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว 🔒');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.response?.data?.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
    } finally {
      setSavingPassword(false);
    }
  };

  // Password strength helper
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-slate-200' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score, label: 'ง่ายเกินไป', color: 'bg-rose-500' };
    if (score <= 3) return { score, label: 'ปานกลาง', color: 'bg-amber-500' };
    return { score, label: 'ปลอดภัยสูง', color: 'bg-emerald-500' };
  };

  const currentAvatarDisplay = isCustomAvatar
    ? customAvatar.trim() || selectedAvatar
    : selectedAvatar || ANIMAL_AVATARS[(user?.id || 1) % ANIMAL_AVATARS.length];

  const passStrength = getPasswordStrength(newPassword);

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-slate-500 text-sm">กำลังโหลดข้อมูลโปรไฟล์...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> ตั้งค่าบัญชี
            </span>
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {user?.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ครูผู้สอน (Teacher)'}
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold gradient-text">
            ข้อมูลส่วนตัว & ความปลอดภัย
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">
            จัดการชื่อผู้ใช้งาน รูปประจำตัว และรหัสผ่านเพื่อความปลอดภัยของบัญชี
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-white/70 backdrop-blur-md rounded-2xl border border-indigo-100 shadow-sm self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 ${activeTab === 'profile'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50'
              }`}
          >
            <User className="w-4 h-4" />
            ข้อมูลส่วนตัว
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 ${activeTab === 'security'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50'
              }`}
          >
            <Shield className="w-4 h-4" />
            ความปลอดภัย & รหัสผ่าน
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Profile Card Summary */}
        <div className="glass p-6 rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-100/30 flex flex-col items-center text-center space-y-4">
          {/* Avatar with Glow Effect */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur-md opacity-40 group-hover:opacity-75 transition duration-500 animate-pulse-glow" />
            <UserAvatar
              avatar={currentAvatarDisplay}
              name={name || user?.name}
              userId={user?.id}
              size="2xl"
              className="border-2 border-white shadow-xl transition-transform duration-300 group-hover:scale-105"
            />
            <button
              type="button"
              onClick={() => {
                setActiveTab('profile');
                setAvatarType('upload');
                fileInputRef.current?.click();
              }}
              className="absolute -bottom-1 -right-1 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl shadow-md border-2 border-white transition-transform hover:scale-110"
              title="เปลี่ยนรูปภาพประจำตัว"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-800">{name || user?.name}</h2>
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5 text-indigo-400" />
              {user?.email}
            </p>
          </div>

          <div className="w-full divider" />

          {/* Account Details Badges */}
          <div className="w-full space-y-2.5 text-left text-xs">
            <div className="flex items-center justify-between p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100/50">
              <span className="text-slate-600 font-medium flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-500" /> สิทธิ์ใช้งาน
              </span>
              <span className="font-bold text-indigo-700 uppercase">
                {user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-purple-50/60 rounded-xl border border-purple-100/50">
              <span className="text-slate-600 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-500" /> เริ่มใช้งานเมื่อ
              </span>
              <span className="font-semibold text-slate-700">
                {createdAt ? new Date(createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'ไม่ระบุ'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Active Tab Content */}
        <div className="lg:col-span-2">
          {activeTab === 'profile' ? (
            /* ================= Tab 1: Profile Form ================= */
            <div className="glass p-6 sm:p-8 rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-100/30 space-y-6">
              <div className="border-b border-indigo-100/60 pb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" /> แก้ไขข้อมูลส่วนตัว
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เปลี่ยนชื่อที่แสดงในระบบและเลือกรูปประจำตัวของคุณ
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-6">
                {/* Full Name Input */}
                <div className="space-y-2">
                  <label htmlFor="fullname-input" className="block text-xs font-semibold text-slate-700">
                    ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="fullname-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="เช่น ครูสมชาย ใจดี"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/80 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-sm text-slate-800 font-medium shadow-sm transition-all"
                    />
                  </div>
                </div>

                {/* Email (with Change Email option) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="email-display" className="block text-xs font-semibold text-slate-700">
                      ที่อยู่อีเมลเข้าสู่ระบบ
                    </label>
                    <button
                      type="button"
                      onClick={openEmailModal}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 hover:underline transition-colors"
                    >
                      <Edit2 className="w-3 h-3" /> เปลี่ยนอีเมล
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="email-display"
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100/80 border border-slate-200 text-sm text-slate-700 font-medium cursor-not-allowed select-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={openEmailModal}
                      className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs border border-indigo-200 shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      เปลี่ยนอีเมล
                    </button>
                  </div>
                  <p className="text-[0.72rem] text-slate-500">
                    อีเมลใช้สำหรับการเข้าสู่ระบบและกู้คืนรหัสผ่าน สามารถเปลี่ยนเป็นอีเมลจริงได้โดยข้อมูลเดิมยังคงอยู่ครบถ้วน
                  </p>
                </div>

                {/* Avatar Selection */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      รูปประจำตัวของคุณ (Avatar)
                    </label>
                    <span className="text-[11px] text-slate-400">เลือกอัปโหลดรูปถ่ายหรือใช้อิโมจิ</span>
                  </div>

                  {/* Mode Selector Buttons */}
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setAvatarType('upload')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${avatarType === 'upload'
                          ? 'bg-white text-indigo-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      อัปโหลดรูปภาพ
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarType('emoji')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${avatarType === 'emoji'
                          ? 'bg-white text-indigo-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      เลือกอิโมจิ
                    </button>
                    {googleAvatar && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAvatar(googleAvatar);
                          setAvatarType('upload');
                        }}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${selectedAvatar === googleAvatar
                            ? 'bg-white text-indigo-600 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        <span>🌐</span>
                        รูป Google
                      </button>
                    )}
                  </div>

                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* TAB 1: UPLOAD PHOTO */}
                  {avatarType === 'upload' && (
                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                      {isImageUrl(selectedAvatar) ? (
                        <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 bg-white rounded-2xl border border-indigo-100 shadow-xs">
                          <UserAvatar
                            avatar={selectedAvatar}
                            name={name}
                            size="xl"
                            className="border-2 border-indigo-200"
                          />
                          <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800">รูปภาพโปรไฟล์ปัจจุบัน</p>
                            <p className="text-[11px] text-slate-500">
                              รองรับไฟล์รูปภาพทั่วไป ระบบจะปรับขนาดและจัดกึ่งกลางให้อัตโนมัติ
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1 justify-center sm:justify-start">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="btn bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-xl border border-indigo-200 flex items-center gap-1.5"
                              >
                                <Camera className="w-3.5 h-3.5" /> เปลี่ยนรูปภาพใหม่
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAvatar(ANIMAL_AVATARS[0]);
                                  setAvatarType('emoji');
                                }}
                                className="btn bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> ใช้อิโมจิแทน
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="p-6 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-2xl cursor-pointer text-center space-y-2 transition-colors"
                        >
                          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <Upload className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-indigo-900">คลิกที่นี่เพื่ออัปโหลดรูปภาพประจำตัวครู</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              รองรับไฟล์ JPG, PNG, WEBP (ขนาดไม่เกิน 5MB)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: EMOJI */}
                  {avatarType === 'emoji' && (
                    <div className="space-y-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                      {/* Category selector */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => { setEmojiCategory('animals'); setIsCustomAvatar(false); }}
                            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${emojiCategory === 'animals' && !isCustomAvatar
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                              }`}
                          >
                            🐾 สัตว์น่ารัก
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEmojiCategory('teacher'); setIsCustomAvatar(false); }}
                            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${emojiCategory === 'teacher' && !isCustomAvatar
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                              }`}
                          >
                            🎓 ครู & การศึกษา
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsCustomAvatar(!isCustomAvatar)}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                        >
                          {isCustomAvatar ? '← ดูรายการอิโมจิ' : 'พิมพ์อิโมจิเอง ✏️'}
                        </button>
                      </div>

                      {isCustomAvatar ? (
                        <div className="space-y-2 p-3 bg-white rounded-2xl border border-indigo-100">
                          <p className="text-xs text-slate-600">
                            พิมพ์หรือวางตัวการ์ตูน/อิโมจิที่คุณชอบ (เช่น 🎓, 💻, 🚀, 📚)
                          </p>
                          <input
                            type="text"
                            value={customAvatar}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomAvatar(val);
                              if (val.trim()) {
                                setSelectedAvatar(val.trim());
                              }
                            }}
                            placeholder="วางหรือพิมพ์ Emoji ที่นี่..."
                            maxLength={6}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-3xl text-center shadow-sm"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded-2xl border border-slate-200">
                          {(emojiCategory === 'animals' ? ANIMAL_AVATARS : TEACHER_EMOJIS).map((avatar) => {
                            const isSelected = selectedAvatar === avatar && !isCustomAvatar;
                            return (
                              <button
                                key={avatar}
                                type="button"
                                onClick={() => {
                                  setSelectedAvatar(avatar);
                                  setIsCustomAvatar(false);
                                }}
                                className={`h-11 rounded-xl flex items-center justify-center text-2xl transition-all duration-200 relative ${isSelected
                                    ? 'bg-indigo-50 shadow-md shadow-indigo-300/40 scale-110 ring-2 ring-indigo-500 border border-indigo-200'
                                    : 'hover:bg-slate-100 hover:scale-105'
                                  }`}
                              >
                                <span>{avatar}</span>
                                {isSelected && (
                                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[8px]">
                                    <Check className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                  >
                    {savingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึก...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> บันทึกการเปลี่ยนแปลง
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ================= Tab 2: Security & Password ================= */
            <div className="space-y-6">
              <div className="glass p-6 sm:p-8 rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-100/30 space-y-6">
                <div className="border-b border-indigo-100/60 pb-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-indigo-600" /> เปลี่ยนรหัสผ่านเข้าใช้งาน
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    เพื่อความปลอดภัย แนะนำให้ใช้รหัสผ่านที่มีความยาวอย่างน้อย 8 ตัวอักษร
                  </p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-5">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <label htmlFor="current-pass" className="block text-xs font-semibold text-slate-700">
                      รหัสผ่านเดิม <span className="text-slate-400 font-normal">(ถ้ามี)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="current-pass"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="กรอกรหัสผ่านปัจจุบัน"
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-white/80 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-sm text-slate-800 font-medium shadow-sm transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <label htmlFor="new-pass" className="block text-xs font-semibold text-slate-700">
                      รหัสผ่านใหม่ <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        id="new-pass"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="กำหนดรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร"
                        required
                        minLength={6}
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-white/80 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-sm text-slate-800 font-medium shadow-sm transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {newPassword && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[0.68rem]">
                          <span className="text-slate-500">ความปลอดภัยของรหัสผ่าน:</span>
                          <span className="font-bold text-slate-700">{passStrength.label}</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex gap-1">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={`flex-1 h-full rounded-full transition-all duration-300 ${level <= passStrength.score ? passStrength.color : 'bg-slate-200'
                                }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-2">
                    <label htmlFor="confirm-pass" className="block text-xs font-semibold text-slate-700">
                      ยืนยันรหัสผ่านใหม่ <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Check className="w-4 h-4" />
                      </div>
                      <input
                        id="confirm-pass"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                        required
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-white/80 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-sm text-slate-800 font-medium shadow-sm transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-[0.7rem] text-rose-500 font-medium">
                        ⚠️ รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingPassword || (!!confirmPassword && newPassword !== confirmPassword)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                    >
                      {savingPassword ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> กำลังเปลี่ยนรหัสผ่าน...
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" /> อัปเดตรหัสผ่าน
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Danger Zone: Delete Account */}
              <div className="glass p-6 sm:p-7 rounded-3xl border border-rose-200/80 bg-rose-50/25 shadow-xl shadow-rose-100/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-rose-800 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                      พื้นที่อันตราย: ลบบัญชีผู้ใช้งาน (Delete ID)
                    </h3>
                    <p className="text-xs text-rose-700/90 leading-relaxed max-w-xl">
                      เมื่อลบบัญชี ข้อมูลทั้งหมดของคุณในระบบ เช่น ห้องเรียน ตารางสอน นักเรียน สถิติการเข้าเรียน และผลการเรียนทั้งหมดจะถูกลบออกจากระบบอย่างถาวรทันที และไม่สามารถกู้คืนได้อีก
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletePassword('');
                      setDeleteConfirmation('');
                      setIsDeleteModalOpen(true);
                    }}
                    className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-rose-500/20 flex items-center gap-1.5 shrink-0 transition-all hover:scale-105"
                  >
                    <Trash2 className="w-4 h-4" />
                    ลบบัญชีผู้ใช้
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= Email Change Modal ================= */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">
                    เปลี่ยนที่อยู่อีเมลประจำบัญชี
                  </h3>
                  <p className="text-xs text-slate-500">
                    {emailStep === 'request'
                      ? 'ขั้นตอนที่ 1/2: ระบุอีเมลใหม่เพื่อรับรหัสยืนยัน'
                      : 'ขั้นตอนที่ 2/2: ยืนยันรหัส OTP 6 หลัก'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !emailLoading && setIsEmailModalOpen(false)}
                disabled={emailLoading}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {emailStep === 'request' ? (
              /* Step 1: Request Email */
              <form onSubmit={handleRequestEmailOtp} className="mt-5 space-y-4">
                {/* Current Email Card */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">อีเมลปัจจุบัน:</span>
                  <span className="font-bold text-slate-700">{user?.email}</span>
                </div>

                {/* Assurance Alert */}
                <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-indigo-950">ข้อมูลทั้งหมดจะคงอยู่ครบถ้วน</p>
                    <p className="text-indigo-700 text-[0.72rem] leading-relaxed">
                      ตารางสอน รายชื่อนักเรียน และผลคะแนนจะไม่หาย ระบบจะส่งรหัส OTP ไปยังอีเมลใหม่เพื่อยืนยันความเป็นเจ้าของ
                    </p>
                  </div>
                </div>

                {/* New Email Input */}
                <div className="space-y-1.5">
                  <label htmlFor="modal-new-email" className="block text-xs font-semibold text-slate-700">
                    ที่อยู่อีเมลใหม่ <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="modal-new-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="เช่น yourname@gmail.com หรืออีเมลวิทยาลัย"
                      required
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50/60 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-sm text-slate-800 font-medium shadow-sm transition-all"
                    />
                  </div>
                </div>

                {/* Modal Footer Buttons */}
                <div className="pt-3 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEmailModalOpen(false)}
                    disabled={emailLoading}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={emailLoading || !newEmail.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {emailLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> กำลังส่งรหัส...
                      </>
                    ) : (
                      <>
                        ส่งรหัส OTP ยืนยัน <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Step 2: Verify OTP */
              <form onSubmit={handleVerifyEmailOtp} className="mt-5 space-y-4">
                {/* Target email badge with change button */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="text-slate-500">ส่งรหัสไปที่:</span>
                    <span className="font-bold text-slate-800 truncate">{newEmail}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailStep('request');
                      setEmailOtp('');
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold underline shrink-0 ml-2"
                  >
                    แก้ไขอีเมล
                  </button>
                </div>

                {/* Dev mode OTP fallback helper if active */}
                {devOtpNotice && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> [โหมดทดสอบ] รหัส OTP:
                      </span>
                      <button
                        type="button"
                        onClick={() => setEmailOtp(devOtpNotice)}
                        className="px-2 py-0.5 bg-amber-200/60 hover:bg-amber-200 rounded-lg font-mono font-bold text-amber-900 text-xs transition-colors"
                      >
                        กดเพื่อกรอกอัตโนมัติ
                      </button>
                    </div>
                    <p className="font-mono text-base font-extrabold text-amber-900 tracking-widest text-center">
                      {devOtpNotice}
                    </p>
                  </div>
                )}

                {/* OTP Input */}
                <div className="space-y-1.5">
                  <label htmlFor="modal-otp-input" className="block text-xs font-semibold text-slate-700 text-center">
                    กรอกรหัสยืนยัน OTP (6 หลัก) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="modal-otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    autoFocus
                    className="w-full py-3 text-center text-3xl font-mono tracking-[0.5em] rounded-2xl bg-slate-50 border-2 border-indigo-200 focus:outline-none focus:border-indigo-600 text-slate-900 font-bold shadow-inner"
                  />
                  <p className="text-[0.72rem] text-slate-400 text-center">
                    รหัสยืนยันมีอายุ 15 นาที หากไม่พบในกล่องจดหมาย กรุณาตรวจสอบในโฟลเดอร์ Junk/Spam
                  </p>
                </div>

                {/* Resend OTP */}
                <div className="text-center text-xs">
                  {countdown > 0 ? (
                    <span className="text-slate-400">
                      ขอรหัสใหม่ได้ในอีก <strong className="text-indigo-600">{countdown}</strong> วินาที
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRequestEmailOtp()}
                      disabled={emailLoading}
                      className="text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-1 hover:underline"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${emailLoading ? 'animate-spin' : ''}`} />
                      ส่งรหัส OTP ใหม่อีกครั้ง
                    </button>
                  )}
                </div>

                {/* Modal Footer Buttons */}
                <div className="pt-3 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEmailModalOpen(false)}
                    disabled={emailLoading}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={emailLoading || emailOtp.length !== 6}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {emailLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> กำลังตรวจสอบ...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> ยืนยันและเปลี่ยนอีเมล
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= Delete Account Confirmation Modal ================= */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-100 p-6 sm:p-7 space-y-5 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-rose-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    ยืนยันการลบบัญชีผู้ใช้งาน (Delete ID)
                  </h3>
                  <p className="text-xs text-rose-600 font-semibold">
                    การกระทำนี้ไม่สามารถย้อนกลับได้
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !deletingAccount && setIsDeleteModalOpen(false)}
                disabled={deletingAccount}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning Details */}
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-800 space-y-2 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5 text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                สิ่งที่จะถูกลบออกจากระบบอย่างถาวร:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[0.75rem] text-rose-700">
                <li>ข้อมูลห้องเรียนและตารางสอนทั้งหมดของคุณ</li>
                <li>รายชื่อนักเรียนและประวัติการเช็คชื่อทั้งหมด</li>
                <li>คะแนนเก็บ โครงสร้างคะแนน และเกรดที่คำนวณไว้</li>
              </ul>
            </div>

            {/* Confirmation Form */}
            <form onSubmit={handleDeleteAccount} className="space-y-4">
              {hasPassword ? (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    กรอกรหัสผ่านของคุณเพื่อยืนยัน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="รหัสผ่านปัจจุบันของคุณ"
                    required
                    autoFocus
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    พิมพ์ยืนยันด้วยอีเมล <span className="text-rose-600 font-mono select-all font-extrabold">{user?.email}</span> หรือคำว่า <span className="text-rose-600 font-mono font-extrabold">ลบบัญชี</span> <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder={user?.email || 'ลบบัญชี'}
                    required
                    autoFocus
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 text-sm"
                  />
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={deletingAccount}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={
                    deletingAccount ||
                    (hasPassword ? !deletePassword : !deleteConfirmation.trim())
                  }
                  className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-rose-500/25 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {deletingAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> กำลังลบบัญชี...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" /> ยืนยันลบบัญชีถาวร
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
