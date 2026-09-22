'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import semesterApi, {
  Semester,
  CreateSemesterInput,
  UpdateSemesterInput,
  CloneSemesterInput
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
  cloneSemester: (sourceId: number, data: CloneSemesterInput) => Promise<boolean>;
}

const SemesterContext = createContext<SemesterContextType | null>(null);

export function SemesterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [loading, setLoading] = useState(true);

  // Invalidate all related React Query caches when semester changes
  const invalidateAllSemesterQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['timetable'] });
    queryClient.invalidateQueries({ queryKey: ['timetable-classroom-options'] });
    queryClient.invalidateQueries({ queryKey: ['semesters'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['scores'] });
    queryClient.invalidateQueries({ queryKey: ['grades'] });
    queryClient.invalidateQueries({ queryKey: ['affective'] });
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
  const switchSemester = async (id: number): Promise<boolean> => {
    const target = semesters.find((s) => s.id === id);
    if (!target) return false;
    if (target.is_active) return true; // Already active

    try {
      await semesterApi.activateSemester(id);

      // Optimistically update local state
      const updated = semesters.map((s) => ({
        ...s,
        is_active: s.id === id,
      }));
      setSemesters(updated);
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
      console.error('[switchSemester] response status:', axiosErr?.response?.status);
      console.error('[switchSemester] response data:', axiosErr?.response?.data);
      const message = axiosErr?.response?.data?.message || 'ไม่สามารถเปลี่ยนภาคเรียนได้';
      toast.error(message);
      return false;
    }
  };

  // Create new semester
  const createSemester = async (data: CreateSemesterInput): Promise<Semester | null> => {
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
  };

  // Update semester
  const updateSemester = async (id: number, data: UpdateSemesterInput): Promise<Semester | null> => {
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
  };

  // Delete semester
  const deleteSemester = async (id: number): Promise<boolean> => {
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
  };

  // Clone semester
  const cloneSemester = async (sourceId: number, data: CloneSemesterInput): Promise<boolean> => {
    try {
      const res = await semesterApi.cloneSemester(sourceId, data);
      await refreshSemesters();
      invalidateAllSemesterQueries();
      toast.success(res.message || 'คัดลอกข้อมูลภาคเรียนสำเร็จ', {
        icon: '📋',
        duration: 4000,
      });
      return true;
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'ไม่สามารถคัดลอกภาคเรียนได้';
      toast.error(message);
      return false;
    }
  };

  return (
    <SemesterContext.Provider
      value={{
        semesters,
        activeSemester,
        loading,
        switchSemester,
        refreshSemesters,
        createSemester,
        updateSemester,
        deleteSemester,
        cloneSemester,
      }}
    >
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
