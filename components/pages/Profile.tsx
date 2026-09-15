'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';
import {
  User, Mail, Lock, Shield, Sparkles, Check,
  Eye, EyeOff, Save, KeyRound, Calendar,
  Loader2, BadgeCheck
} from 'lucide-react';

const ANIMAL_AVATARS = [
  '🐶', '🐱', '🐭', '🐹', '🐰',
  '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵',
  '🐧', '🐥', '🦉', '🦄', '🐙',
  '🐢', '🦖', '🦕', '🦦', '🦥'
];

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Profile form state
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [customAvatar, setCustomAvatar] = useState('');
  const [isCustomAvatar, setIsCustomAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Security form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Account metadata
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Initialize from user or fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/profile');
        const u = res.data.user;
        if (u) {
          setName(u.name || '');
          const initialAvatar = u.avatar || ANIMAL_AVATARS[(u.id || 1) % ANIMAL_AVATARS.length];
          setSelectedAvatar(initialAvatar);
          if (!ANIMAL_AVATARS.includes(initialAvatar)) {
            setIsCustomAvatar(true);
            setCustomAvatar(initialAvatar);
          }
          if (u.createdAt) {
            setCreatedAt(u.createdAt);
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    const finalAvatar = isCustomAvatar ? customAvatar.trim() || selectedAvatar : selectedAvatar;

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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 ${
              activeTab === 'profile'
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 ${
              activeTab === 'security'
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
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-indigo-100 via-white to-purple-100 border-2 border-white shadow-xl flex items-center justify-center text-5xl sm:text-6xl select-none transition-transform duration-300 group-hover:scale-105">
              {currentAvatarDisplay}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-xl shadow-md border-2 border-white">
              <BadgeCheck className="w-4 h-4" />
            </div>
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

          {/* Tips Box */}
          <div className="w-full p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl text-left">
            <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5 mb-1">
              💡 ข้อแนะนำสำหรับครู
            </p>
            <p className="text-[0.72rem] text-amber-700/90 leading-relaxed">
              การเลือกรูปประจำตัวช่วยให้นักเรียนและเพื่อนร่วมงานจดจำตารางสอนของคุณได้ง่ายขึ้น
            </p>
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

                {/* Email (Read-only) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="email-display" className="block text-xs font-semibold text-slate-700">
                      ที่อยู่อีเมล
                    </label>
                    <span className="text-[0.68rem] text-slate-400 font-medium">
                      เชื่อมต่อกับบัญชีเข้าสู่ระบบ (ไม่สามารถแก้ไขได้)
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="email-display"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100/80 border border-slate-200 text-sm text-slate-500 font-medium cursor-not-allowed select-none"
                    />
                  </div>
                </div>

                {/* Avatar Selection */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      เลือกรูปอวตารประจำตัว
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomAvatar(!isCustomAvatar)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      {isCustomAvatar ? '← กลับไปเลือกสัตว์' : 'พิมพ์อิโมจิเอง ✏️'}
                    </button>
                  </div>

                  {isCustomAvatar ? (
                    <div className="space-y-2 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                      <p className="text-xs text-slate-600">
                        พิมพ์ตัวการ์ตูนหรืออิโมจิที่คุณชอบ (เช่น 🎓, 💻, 🚀, 📚)
                      </p>
                      <input
                        type="text"
                        value={customAvatar}
                        onChange={(e) => setCustomAvatar(e.target.value)}
                        placeholder="วางหรือพิมพ์ Emoji ที่นี่..."
                        maxLength={10}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-2xl text-center shadow-sm"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 max-h-48 overflow-y-auto">
                      {ANIMAL_AVATARS.map((avatar) => {
                        const isSelected = selectedAvatar === avatar && !isCustomAvatar;
                        return (
                          <button
                            key={avatar}
                            type="button"
                            onClick={() => {
                              setSelectedAvatar(avatar);
                              setIsCustomAvatar(false);
                            }}
                            className={`h-11 rounded-xl flex items-center justify-center text-2xl transition-all duration-200 relative ${
                              isSelected
                                ? 'bg-white shadow-md shadow-indigo-300/40 scale-110 ring-2 ring-indigo-500 border border-indigo-200'
                                : 'hover:bg-white/80 hover:scale-105'
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
                            className={`flex-1 h-full rounded-full transition-all duration-300 ${
                              level <= passStrength.score ? passStrength.color : 'bg-slate-200'
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
          )}
        </div>
      </div>
    </div>
  );
}
