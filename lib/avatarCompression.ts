/**
 * High-performance client-side avatar image compression utility.
 * Resizes images to compact square dimensions (default 160x160px)
 * and compresses to WebP (~3-8 KB per image) to guarantee ultra-fast page loads
 * and zero performance penalty on tables with dozens of student avatars.
 */

export async function compressImageFile(
  fileOrBlob: Blob | File,
  maxDimension = 160,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('รูปภาพเสียหายหรือไม่รองรับ'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = maxDimension;
          canvas.height = maxDimension;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('ไม่สามารถประมวลผล Canvas ได้'));
          }

          // Use high quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Square center crop calculation
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, maxDimension, maxDimension);

          // Try WebP first for optimal compression (~3-8 KB)
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            // Fallback to JPEG if WebP is unsupported
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Match a photo file name to a student by student_code or name.
 * e.g., '65010001.jpg', '65010001_somchai.png', 'somchai.webp'
 */
export function findMatchingStudentIndex(
  fileName: string,
  students: Array<{ student_code?: string; name: string }>
): number {
  // Strip file extension and sanitize
  const baseName = fileName.replace(/\.[^/.]+$/, '').trim().toLowerCase();
  if (!baseName) return -1;

  // 1. Try exact student_code match (most common in schools)
  const exactCodeIndex = students.findIndex((s) => {
    const code = s.student_code?.trim().toLowerCase();
    return code && (code === baseName || baseName.includes(code));
  });
  if (exactCodeIndex !== -1) return exactCodeIndex;

  // 2. Try clean name match
  const cleanBase = baseName.replace(/[^a-z0-9\u0E00-\u0E7F]/gi, '');
  const nameIndex = students.findIndex((s) => {
    const cleanName = s.name.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/gi, '');
    return cleanName && (cleanBase.includes(cleanName) || cleanName.includes(cleanBase));
  });
  return nameIndex;
}
