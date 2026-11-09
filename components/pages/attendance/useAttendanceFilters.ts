'use client';

import { useState, useCallback } from 'react';
import { ClassFilter } from './types';

export function useAttendanceFilters() {
  const [searchQuery, setSearchQuery] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('all');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [teachingDays, setTeachingDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [matrixStartDate, setMatrixStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14); // Default to last 14 days
    return d.toISOString().split('T')[0];
  });
  const [matrixEndDate, setMatrixEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const toggleSectionCollapse = useCallback((sectionKey: string) => {
    setCollapsedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    classSearch,
    setClassSearch,
    classFilter,
    setClassFilter,
    selectedSectionKey,
    setSelectedSectionKey,
    collapsedSections,
    setCollapsedSections,
    toggleSectionCollapse,
    teachingDays,
    setTeachingDays,
    matrixStartDate,
    setMatrixStartDate,
    matrixEndDate,
    setMatrixEndDate,
  };
}
