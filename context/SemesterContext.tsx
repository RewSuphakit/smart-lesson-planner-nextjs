'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import semesterApi, {
  Semester,
  CreateSemesterInput,
  UpdateSemesterInput,
  CloneSemesterInput,
  CloneSemesterResult
} from '@/services/semester';

interface SemesterContextType {
  semesters: Semester[];
  activeSemester: Semester | null;
  loading: boolean;
  switchSemester: (id: number) => Promise<boolean>;
  refreshSemesters: () => Promise<void>;
  createSemester: (data: CreateSemesterInput) => Promise<Semester | null>;
  updateSemester: (id: number, data: UpdateSemesterInput) => Promise<Semester | null>;
  deleteSemester: (id: number) => Promise<boolean>;
  cloneSemester: (sourceId: number, data: CloneSemesterInput) => Promise<CloneSemesterResult>;
}

const SemesterContext = createContext<SemesterContextType | null>(null);

const SEMESTER_SCOPED_QUERY_PREFIXES = new Set([
  'classrooms',
  'dashboard',
  'timetable',
  'timetable-schedule',
  'timetable-classroom-options',
  'timetable-all',
  'semesters',
  'semester-info',
  'students',
  'attendance',
  'attendance-data',
  'attendance-matrix',
  'attendance-for-scores',
  'attendance-all-class-for-scores',
  'scores',
  'scores-matrix-data',
  'grades',
  'affective',
  'affective-students',
]);

export function SemesterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [loading, setLoading] = useState(true);

  // Batch-invalidate all semester-scoped React Query caches in one pass.
  // Only active (mounted) queries are refetched immediately; inactive ones are marked stale
  // so they don't cause a background network/re-render storm during term switching.
  const invalidateAllSemesterQueries = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const rootKey = String(query.queryKey[0] ?? '');
        return SEMESTER_SCOPED_QUERY_PREFIXES.has(rootKey);
      },
      refetchType: 'active',
    });
  }, [queryClient]);

  // Fetch all semesters
  const refreshSemesters = useCallback(async () => {
    if (!user) {
      setSemesters([]);
      setActiveSemester(null);
      setLoading(false);
      return;
    }

    try {
      const data = await semesterApi.getSemesters();
      setSemesters(data);
      const active = data.find((s) => s.is_active) || (data.length > 0 ? data[0] : null);
      setActiveSemester(active);
    } catch (err) {
      console.error('Failed to load semesters:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshSemesters();
  }, [refreshSemesters]);

  // Switch active semester
  const switchSemester = useCallback(async (id: number): Promise<boolean> => {
    const target = semesters.find((s) => s.id === id);
    if (!target) return false;
    if (target.is_active) return true; // Already active

    try {
      await semesterApi.activateSemester(id);

      // Optimistically update local state
      setSemesters((prev) =>
        prev.map((s) => ({
          ...s,
          is_active: s.id === id,
        }))
      );
      setActiveSemester({ ...target, is_active: true });

      // Invalidate queries so that pages immediately fetch data for the new active semester
      invalidateAllSemesterQueries();

      toast.success(`เปลี่ยนเป็น "${target.name}" สำเร็จ`, {
        icon: '🎓',
        duration: 3000,
      });
      return true;
    } catch (err: unknown) {
      console.error('[switchSemester] full error:', err);
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      const message = axiosErr?.response?.data?.message || 'ไม่สามารถเปลี่ยนภาคเรียนได้';
      toast.error(message);
      return false;
    }
  }, [semesters, invalidateAllSemesterQueries]);

  // Create new semester
  const createSemester = useCallback(async (data: CreateSemesterInput): Promise<Semester | null> => {
    try {
      const created = await semesterApi.createSemester(data);
      await refreshSemesters();
      if (data.is_active) {
        invalidateAllSemesterQueries();
      }
      toast.success(`สร้าง "${created.name}" สำเร็จ`);
      return created;
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'ไม่สามารถสร้างภาคเรียนได้';
      toast.error(message);
      return null;
    }
  }, [refreshSemesters, invalidateAllSemesterQueries]);

  // Update semester
  const updateSemester = useCallback(async (id: number, data: UpdateSemesterInput): Promise<Semester | null> => {
    try {
      const updated = await semesterApi.updateSemester(id, data);
      await refreshSemesters();
      if (data.is_active || activeSemester?.id === id) {
        invalidateAllSemesterQueries();
      }
      toast.success(`อัปเดตข้อมูล "${updated.name}" สำเร็จ`);
      return updated;
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'ไม่สามารถอัปเดตภาคเรียนได้';
      toast.error(message);
      return null;
    }
  }, [refreshSemesters, activeSemester?.id, invalidateAllSemesterQueries]);

  // Delete semester
  const deleteSemester = useCallback(async (id: number): Promise<boolean> => {
    try {
      await semesterApi.deleteSemester(id);
      await refreshSemesters();
      toast.success('ลบภาคเรียนสำเร็จ');
      return true;
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'ไม่สามารถลบภาคเรียนได้';
      toast.error(message);
      return false;
    }
  }, [refreshSemesters]);

  // Clone semester
  const cloneSemester = useCallback(async (sourceId: number, data: CloneSemesterInput): Promise<CloneSemesterResult> => {
    try {
      const res = await semesterApi.cloneSemester(sourceId, data);
      await refreshSemesters();
      invalidateAllSemesterQueries();
      toast.success(res.message || 'คัดลอกข้อมูลภาคเรียนสำเร็จ', {
        icon: '📋',
        duration: 4000,
      });
      return { success: true };
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: {
            message?: string;
            requires_confirmation?: boolean;
            existing_classrooms?: number;
          };
        };
      };
      const resData = axiosErr?.response?.data;
      if (axiosErr?.response?.status === 409 && resData?.requires_confirmation) {
        return {
          success: false,
          requiresConfirmation: true,
          message: resData.message,
          existingClassrooms: resData.existing_classrooms,
        };
      }
      const message = resData?.message || 'ไม่สามารถคัดลอกภาคเรียนได้';
      toast.error(message);
      return { success: false, message };
    }
  }, [refreshSemesters, invalidateAllSemesterQueries]);

  const contextValue = useMemo<SemesterContextType>(
    () => ({
      semesters,
      activeSemester,
      loading,
      switchSemester,
      refreshSemesters,
      createSemester,
      updateSemester,
      deleteSemester,
      cloneSemester,
    }),
    [
      semesters,
      activeSemester,
      loading,
      switchSemester,
      refreshSemesters,
      createSemester,
      updateSemester,
      deleteSemester,
      cloneSemester,
    ]
  );

  return (
    <SemesterContext.Provider value={contextValue}>
      {children}
    </SemesterContext.Provider>
  );
}

export function useSemester() {
  const context = useContext(SemesterContext);
  if (!context) {
    throw new Error('useSemester must be used within a SemesterProvider');
  }
  return context;
}
