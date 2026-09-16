'use client';

import React, { useState } from 'react';

export const ANIMAL_AVATARS = [
  '🐶', '🐱', '🐭', '🐹', '🐰',
  '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵',
  '🐧', '🐥', '🦉', '🦄', '🐙',
  '🐢', '🦖', '🦕', '🦦', '🦥'
];

export const TEACHER_EMOJIS = [
  '👨‍🏫', '👩‍🏫', '🧑‍🏫', '🎓', '📚',
  '🔬', '🎨', '📐', '💻', '💡',
  '✏️', '🏆', '🌟', '🎯', '📖'
];

export function isImageUrl(str?: string | null): boolean {
  if (!str) return false;
  const s = str.trim();
  return (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('/uploads/') ||
    s.startsWith('data:image/') ||
    s.startsWith('blob:')
  );
}

export function getDefaultAvatar(userId?: number | string | null): string {
  const idNum = typeof userId === 'number' ? userId : parseInt(String(userId || '1'), 10) || 1;
  return ANIMAL_AVATARS[idNum % ANIMAL_AVATARS.length];
}

interface UserAvatarProps {
  avatar?: string | null;
  name?: string | null;
  userId?: number | string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'huge' | 'custom';
  className?: string;
  imgClassName?: string;
}

export default function UserAvatar({
  avatar,
  name,
  userId,
  size = 'md',
  className = '',
  imgClassName = '',
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const hasImage = !imgError && isImageUrl(avatar);
  const fallbackEmoji = getDefaultAvatar(userId);

  const sizeClass = {
    xs: 'w-6 h-6 text-xs rounded-lg',
    sm: 'w-8 h-8 text-base rounded-xl',
    md: 'w-10 h-10 text-xl rounded-xl',
    lg: 'w-14 h-14 text-2xl rounded-2xl',
    xl: 'w-20 h-20 text-4xl rounded-3xl',
    '2xl': 'w-24 h-24 sm:w-28 sm:h-28 text-5xl sm:text-6xl rounded-3xl',
    huge: 'w-32 h-32 text-6xl rounded-3xl',
    custom: '',
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden shrink-0 select-none bg-gradient-to-br from-indigo-100 via-white to-purple-100 border border-indigo-200/60 shadow-xs ${sizeClass} ${className}`}
    >
      {hasImage ? (
        <img
          src={avatar!}
          alt={name || 'User avatar'}
          className={`w-full h-full object-cover ${imgClassName}`}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="leading-none flex items-center justify-center pointer-events-none">
          {avatar && !isImageUrl(avatar) ? avatar : fallbackEmoji}
        </span>
      )}
    </div>
  );
}
