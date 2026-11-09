'use client';

import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import {
  Plus, Edit, Trash2, X, Users as UsersIcon, Loader2, Search,
  GraduationCap, Upload, CheckCircle, FileSpreadsheet,
  Camera, Sparkles, Image as ImageIcon, GitBranch,
  Download, FileText, Info
} from 'lucide-react';
import toast from '@/lib/toast';
import dynamic from 'next/dynamic';
import Pagination from '@/components/Pagination';
const StudentExcelModal = dynamic(() => import('@/components/StudentExcelModal'), { ssr: false });
import UserAvatar, { ANIMAL_AVATARS, TEACHER_EMOJIS } from '@/components/UserAvatar';
import { compressImageFile, findMatchingStudentIndex } from '@/lib/avatarCompression';
import { combineGradeAndRoom, normalizeGradeLevel } from '@/lib/studentSections';

interface Classroom {
  id: string | number;
  name: string;
}

interface Student {
  id: string | number;
  student_code?: string;
  name: string;
  grade_level?: string;
  branch?: string | null;
  email?: string;
  classroom_id?: string | number | null;
  classroom_name?: string | null;
  avatar?: string | null;
}

interface ImportRow {
  student_code?: string;
  name: string;
  grade_level?: string;
  branch?: string;
  email?: string;
  avatar?: string | null;
}

export default function Students() {
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [editing, setEditing] = useState<string | number | null>(null);
  const [search, setSearch] = useState('');
  const [filterClassroomId, setFilterClassroomId] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterGradeLevel, setFilterGradeLevel] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Array<string | number>>([]);
  const [bulkAssignClassroomId, setBulkAssignClassroomId] = useState('');
  const [bulkGradeLevel, setBulkGradeLevel] = useState('');
  const [bulkBranch, setBulkBranch] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const emptyForm = { name: '', student_code: '', grade_level: '', branch: '', email: '', classroom_id: '', avatar: '', remove_avatar: false };
  const [form, setForm] = useState(emptyForm);

  // Single student photo & emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isCompressingSingle, setIsCompressingSingle] = useState(false);
  const singlePhotoInputRef = useRef<HTMLInputElement>(null);

  // Bulk Import states
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importClassroomId, setImportClassroomId] = useState('');
  const [isMatchingPhotos, setIsMatchingPhotos] = useState(false);
  const bulkPhotoInputRef = useRef<HTMLInputElement>(null);
  const [exampleFormatTab, setExampleFormatTab] = useState<'split' | 'single'>('split');

  // â”€â”€â”€ Query: à¸”à¸¶à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™ â”€â”€â”€
  const { data: students = [], isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await api.get('/students?include_avatar=true');
      return res.data.data || [];
    },
  });

  // â”€â”€â”€ Query: à¸”à¸¶à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ (shared cache) â”€â”€â”€
  const { data: classrooms = [], isLoading: loadingClassrooms } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: async () => {
      const res = await api.get('/classrooms');
      return res.data.data || [];
    },
  });

  // â”€â”€â”€ Query: à¸”à¸¶à¸‡à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸ªà¸²à¸‚à¸²à¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¸‹à¹‰à¸³ â”€â”€â”€
  const { data: branches = [] } = useQuery<string[]>({
    queryKey: ['student-branches'],
    queryFn: async () => {
      const res = await api.get('/students/branches');
      return res.data.data || [];
    },
  });

  // â”€â”€â”€ Query: à¸”à¸¶à¸‡à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™à¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¸‹à¹‰à¸³ â”€â”€â”€
  const { data: gradeLevels = [] } = useQuery<string[]>({
    queryKey: ['student-grade-levels'],
    queryFn: async () => {
      const res = await api.get('/students/grade-levels');
      return res.data.data || [];
    },
  });

  const isLoading = loadingStudents || loadingClassrooms;

  // â”€â”€â”€ Mutation: à¸ªà¸£à¹‰à¸²à¸‡/à¹à¸à¹‰à¹„à¸‚à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™ â”€â”€â”€
  const saveMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const formattedPayload = {
        name: payload.name.trim(),
        student_code: payload.student_code?.trim() || null,
        grade_level: payload.grade_level?.trim() || null,
        branch: payload.branch?.trim() || null,
        email: payload.email?.trim() || null,
        classroom_id: payload.classroom_id ? Number(payload.classroom_id) : null,
        avatar: payload.remove_avatar ? null : (payload.avatar || null),
        remove_avatar: payload.remove_avatar,
      };

      if (editing) {
        return api.put('/students/' + editing, formattedPayload);
      } else {
        return api.post('/students', formattedPayload);
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'à¸­à¸±à¸›à¹€à¸”à¸•à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢' : 'à¹€à¸žà¸´à¹ˆà¸¡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢');
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-branches'] });
      queryClient.invalidateQueries({ queryKey: ['student-grade-levels'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: (err: { response?: { data?: { message?: string; errors?: Array<{ message: string }> } } }) => {
      const firstError = err.response?.data?.errors?.[0]?.message;
      toast.error(firstError || err.response?.data?.message || 'à¸šà¸±à¸™à¸—à¸¶à¸à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    },
  });

  // â”€â”€â”€ Mutation: à¸¥à¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸£à¸²à¸¢à¸„à¸™ â”€â”€â”€
  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => api.delete('/students/' + id),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'à¸¥à¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-branches'] });
      queryClient.invalidateQueries({ queryKey: ['student-grade-levels'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'à¸¥à¸šà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    },
  });

  // â”€â”€â”€ Mutation: à¸¢à¹‰à¸²à¸¢à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¹à¸šà¸š bulk â”€â”€â”€
  const bulkAssignMutation = useMutation({
    mutationFn: () => api.put('/students/bulk-classroom', {
      studentIds: selectedStudents,
      classroomId: bulkAssignClassroomId === 'null' ? null : bulkAssignClassroomId
    }),
    onSuccess: () => {
      toast.success('à¸¢à¹‰à¸²à¸¢à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢');
      setSelectedStudents([]);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: () => {
      toast.error('à¸¢à¹‰à¸²à¸¢à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    },
  });

  // â”€â”€â”€ Mutation: à¸à¸³à¸«à¸™à¸”à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™/à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢ & à¸ªà¸²à¸‚à¸²à¹à¸šà¸š bulk â”€â”€â”€
  const bulkMetaMutation = useMutation({
    mutationFn: (payload: { student_ids: number[]; grade_level?: string | null; branch?: string | null }) =>
      api.patch('/students', payload),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'à¸­à¸±à¸›à¹€à¸”à¸•à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢à¹à¸¥à¸°à¸ªà¸²à¸‚à¸²à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢');
      setSelectedStudents([]);
      setBulkGradeLevel('');
      setBulkBranch('');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-branches'] });
      queryClient.invalidateQueries({ queryKey: ['student-grade-levels'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'à¸­à¸±à¸›à¹€à¸”à¸•à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢/à¸ªà¸²à¸‚à¸²à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    },
  });

  // â”€â”€â”€ Mutation: à¸¥à¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸ (bulk) â”€â”€â”€
  const bulkDeleteMutation = useMutation({
    mutationFn: () => api.delete(`/students?ids=${selectedStudents.join(',')}`),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'à¸¥à¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§');
      setSelectedStudents([]);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-branches'] });
      queryClient.invalidateQueries({ queryKey: ['student-grade-levels'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'à¸¥à¸šà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    },
  });

  // â”€â”€â”€ Mutation: à¸¥à¸šà¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” â”€â”€â”€
  const deleteAllMutation = useMutation({
    mutationFn: (classroomId?: string) => {
      const url = classroomId ? `/students?classroom_id=${classroomId}` : '/students?all=true';
      return api.delete(url);
    },
    onSuccess: (res) => {
      toast.success(res.data?.message || 'à¸¥à¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§');
      setSelectedStudents([]);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-branches'] });
      queryClient.invalidateQueries({ queryKey: ['student-grade-levels'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'à¸¥à¸šà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    },
  });

  // â”€â”€â”€ Mutation: à¸™à¸³à¹€à¸‚à¹‰à¸² bulk â”€â”€â”€
  const importMutation = useMutation({
    mutationFn: async (payload: Array<ImportRow & { classroom_id: string | null }>) => {
      return api.post('/students/bulk', { students: payload });
    },
    onSuccess: (res) => {
      toast.success(res.data.message || 'à¸™à¸³à¹€à¸‚à¹‰à¸²à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
      setShowImportForm(false);
      setImportData([]);
      setImportClassroomId('');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-branches'] });
      queryClient.invalidateQueries({ queryKey: ['student-grade-levels'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['scores-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'à¸™à¸³à¹€à¸‚à¹‰à¸²à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    },
  });

  const isMutating = saveMutation.isPending || deleteMutation.isPending || bulkAssignMutation.isPending || bulkMetaMutation.isPending || bulkDeleteMutation.isPending || deleteAllMutation.isPending || importMutation.isPending;

  const _handleExport = async () => {
    if (filtered.length === 0) {
      toast.error('à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸ªà¸³à¸«à¸£à¸±à¸šà¸ªà¹ˆà¸‡à¸­à¸­à¸');
      return;
    }

    const XLSX = await import('xlsx');
    const exportData = filtered.map(s => ({
      'à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™': s.student_code || '',
      'à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥': s.name || '',
      'à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™': s.grade_level || '',
      'à¸ªà¸²à¸‚à¸²': s.branch || '',
      'à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™': classrooms.find(c => String(c.id) === String(s.classroom_id))?.name || s.classroom_name || 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸',
      'à¸­à¸µà¹€à¸¡à¸¥': s.email || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");

    const className = filterClassroomId ? classrooms.find(c => String(c.id) === String(filterClassroomId))?.name : 'à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”';
    const fileName = `à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™_${className}_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(wb, fileName);
    toast.success('à¸ªà¹ˆà¸‡à¸­à¸­à¸à¹„à¸Ÿà¸¥à¹Œà¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const handleSinglePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œà¸£à¸¹à¸›à¸ à¸²à¸ž (JPG, PNG, WebP)');
      return;
    }

    setIsCompressingSingle(true);
    try {
      const compressed = await compressImageFile(file, 160, 0.78);
      setForm(prev => ({ ...prev, avatar: compressed, remove_avatar: false }));
      toast.success('à¸šà¸µà¸šà¸­à¸±à¸”à¸£à¸¹à¸›à¸ à¸²à¸žà¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢ (~4KB)');
    } catch {
      toast.error('à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¸£à¸¹à¸›à¸ à¸²à¸žà¹„à¸”à¹‰');
    } finally {
      setIsCompressingSingle(false);
      e.target.value = '';
    }
  };

  const handleBulkPhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || importData.length === 0) return;

    setIsMatchingPhotos(true);
    try {
      const fileList = Array.from(files);
      const updated = [...importData];
      let matchedCount = 0;

      for (const file of fileList) {
        if (!file.type.startsWith('image/')) continue;
        const matchIdx = findMatchingStudentIndex(file.name, updated);
        if (matchIdx !== -1) {
          try {
            const compressed = await compressImageFile(file, 160, 0.78);
            updated[matchIdx] = {
              ...updated[matchIdx],
              avatar: compressed,
            };
            matchedCount++;
          } catch (compressErr) {
            console.error('Failed to compress photo:', file.name, compressErr);
          }
        }
      }

      setImportData(updated);
      if (matchedCount > 0) {
        toast.success(`à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹à¸¥à¸°à¸šà¸µà¸šà¸­à¸±à¸”à¸£à¸¹à¸›à¸ à¸²à¸žà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ ${matchedCount} à¸„à¸™ (~4KB/à¸£à¸¹à¸›) ðŸŽ‰`);
      } else {
        toast.error('à¹„à¸¡à¹ˆà¸žà¸šà¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œà¸£à¸¹à¸›à¸—à¸µà¹ˆà¸•à¸£à¸‡à¸à¸±à¸šà¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸«à¸£à¸·à¸­à¸Šà¸·à¹ˆà¸­à¹ƒà¸™à¸£à¸²à¸¢à¸à¸²à¸£');
      }
    } catch {
      toast.error('à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¸£à¸¹à¸›à¸ à¸²à¸ž');
    } finally {
      setIsMatchingPhotos(false);
      e.target.value = '';
    }
  };

  const handleEdit = async (s: Student) => {
    // List responses expose avatars as lightweight URLs; load the real value only when editing
    let avatar = s.avatar || '';
    if (avatar.startsWith('/api/students/')) {
      try {
        const res = await api.get('/students/' + s.id);
        avatar = res.data?.data?.avatar || '';
      } catch {
        avatar = '';
      }
    }
    setForm({
      name: s.name,
      student_code: s.student_code || '',
      grade_level: s.grade_level || '',
      branch: s.branch || '',
      email: s.email || '',
      classroom_id: s.classroom_id ? String(s.classroom_id) : '',
      avatar,
      remove_avatar: false
    });
    setEditing(s.id);
    setShowEmojiPicker(false);
    setShowForm(true);
  };

  const handleDelete = (id: string | number) => {
    if (!window.confirm('à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸¥à¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸„à¸™à¸™à¸µà¹‰à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ?')) return;
    deleteMutation.mutate(id);
  };

  const handleToggleSelect = (id: string | number) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === filtered.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filtered.map(s => s.id));
    }
  };

  const handleBulkAssign = () => {
    if (!bulkAssignClassroomId) {
      toast.error('à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¸›à¸¥à¸²à¸¢à¸—à¸²à¸‡');
      return;
    }
    bulkAssignMutation.mutate();
  };

  const handleBulkMetaSave = () => {
    const trimmedGrade = normalizeGradeLevel(bulkGradeLevel);
    const trimmedBranch = bulkBranch.trim();

    if (!trimmedGrade && !trimmedBranch) {
      toast.error('à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™/à¸«à¹‰à¸­à¸‡ (à¹€à¸Šà¹ˆà¸™ à¸›à¸§à¸Š.1/1) à¸«à¸£à¸·à¸­à¸ªà¸²à¸‚à¸²à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸à¸³à¸«à¸™à¸”');
      return;
    }

    const payload: { student_ids: number[]; grade_level?: string | null; branch?: string | null } = {
      student_ids: selectedStudents.map(Number).filter(n => !isNaN(n)),
    };
    if (trimmedGrade) payload.grade_level = trimmedGrade;
    if (trimmedBranch) payload.branch = trimmedBranch;

    bulkMetaMutation.mutate(payload);
  };

  const handleBulkDelete = () => {
    if (selectedStudents.length === 0) return;
    if (!window.confirm(`à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸¥à¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” ${selectedStudents.length} à¸„à¸™à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ? (à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸„à¸°à¹à¸™à¸™à¹à¸¥à¸°à¸à¸²à¸£à¸›à¸£à¸°à¹€à¸¡à¸´à¸™à¸‚à¸­à¸‡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸ˆà¸°à¸–à¸¹à¸à¸¥à¸šà¹„à¸›à¸”à¹‰à¸§à¸¢)`)) return;
    bulkDeleteMutation.mutate();
  };

  const handleDeleteAll = () => {
    const isFiltered = !!filterClassroomId;
    const targetClassName = isFiltered ? classrooms.find(c => String(c.id) === String(filterClassroomId))?.name || 'à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸' : 'à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”';
    const msg = isFiltered
      ? `à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸¥à¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹ƒà¸™à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ "${targetClassName}" à¹ƒà¸Šà¹ˆà¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ? (à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸„à¸°à¹à¸™à¸™à¹à¸¥à¸°à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸à¸²à¸£à¸›à¸£à¸°à¹€à¸¡à¸´à¸™à¸‚à¸­à¸‡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸ˆà¸°à¸–à¸¹à¸à¸¥à¸šà¹„à¸›à¸”à¹‰à¸§à¸¢)`
      : `à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸¥à¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” (${students.length} à¸„à¸™) à¹ƒà¸Šà¹ˆà¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ? à¸à¸²à¸£à¸à¸£à¸°à¸—à¸³à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¢à¹‰à¸­à¸™à¸à¸¥à¸±à¸šà¹„à¸”à¹‰!`;

    if (!window.confirm(msg)) return;
    deleteAllMutation.mutate(isFiltered ? filterClassroomId : undefined);
  };

  // â”€â”€â”€ Download Sample Excel (.xlsx) Template â”€â”€â”€
  const handleDownloadExcelTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = ['à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™', 'à¸„à¸³à¸™à¸³à¸«à¸™à¹‰à¸²', 'à¸Šà¸·à¹ˆà¸­', 'à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥', 'à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™/à¸«à¹‰à¸­à¸‡', 'à¸ªà¸²à¸‚à¸²à¸§à¸´à¸Šà¸²', 'à¸­à¸µà¹€à¸¡à¸¥'];
      const rows = [
        ['67209010001', 'à¸™à¸²à¸¢', 'à¸ªà¸¡à¸Šà¸²à¸¢', 'à¹ƒà¸ˆà¸”à¸µ', 'à¸›à¸§à¸Š.1/1', 'à¹€à¸—à¸„à¹‚à¸™à¹‚à¸¥à¸¢à¸µà¸ªà¸²à¸£à¸ªà¸™à¹€à¸—à¸¨', 'somchai.jai@example.com'],
        ['67209010002', 'à¸™à¸²à¸‡à¸ªà¸²à¸§', 'à¸ªà¸¡à¸«à¸à¸´à¸‡', 'à¸£à¸±à¸à¹€à¸£à¸µà¸¢à¸™', 'à¸›à¸§à¸Š.1/1', 'à¹€à¸—à¸„à¹‚à¸™à¹‚à¸¥à¸¢à¸µà¸ªà¸²à¸£à¸ªà¸™à¹€à¸—à¸¨', 'somying.rak@example.com'],
        ['67209010003', 'à¸™à¸²à¸¢', 'à¸à¸´à¸•à¸•à¸´à¸¨à¸±à¸à¸”à¸´à¹Œ', 'à¸žà¸²à¸à¹€à¸žà¸µà¸¢à¸£', 'à¸›à¸§à¸Š.1/2', 'à¸Šà¹ˆà¸²à¸‡à¸­à¸´à¹€à¸¥à¹‡à¸à¸—à¸£à¸­à¸™à¸´à¸à¸ªà¹Œ', 'kittisak.pak@example.com'],
        ['67209010004', 'à¸™à¸²à¸‡à¸ªà¸²à¸§', 'à¸à¸¡à¸¥à¸§à¸£à¸£à¸“', 'à¸ªà¸”à¹ƒà¸ª', 'à¸›à¸§à¸Š.1/2', 'à¸Šà¹ˆà¸²à¸‡à¸­à¸´à¹€à¸¥à¹‡à¸à¸—à¸£à¸­à¸™à¸´à¸à¸ªà¹Œ', 'kamonwan.sod@example.com'],
        ['66309010005', 'à¸™à¸²à¸¢', 'à¸˜à¸™à¸²à¸à¸£', 'à¸¡à¸±à¹ˆà¸™à¸„à¸‡', 'à¸›à¸§à¸ª.1/1', 'à¹€à¸—à¸„à¹‚à¸™à¹‚à¸¥à¸¢à¸µà¸˜à¸¸à¸£à¸à¸´à¸ˆà¸”à¸´à¸ˆà¸´à¸—à¸±à¸¥', 'thanakorn.man@example.com'],
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 16 }, // à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™
        { wch: 10 }, // à¸„à¸³à¸™à¸³à¸«à¸™à¹‰à¸²
        { wch: 18 }, // à¸Šà¸·à¹ˆà¸­
        { wch: 18 }, // à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥
        { wch: 16 }, // à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™/à¸«à¹‰à¸­à¸‡
        { wch: 24 }, // à¸ªà¸²à¸‚à¸²à¸§à¸´à¸Šà¸²
        { wch: 28 }, // à¸­à¸µà¹€à¸¡à¸¥
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™');
      XLSX.writeFile(wb, 'à¹€à¸—à¸¡à¹€à¸žà¸¥à¸•_à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™.xlsx');
      toast.success('à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡ Excel à¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    } catch (err) {
      console.error('Download template error:', err);
      toast.error('à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡ Excel à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    }
  };

  // â”€â”€â”€ Download Sample CSV (.csv) Template â”€â”€â”€
  const handleDownloadCsvTemplate = () => {
    try {
      const headers = ['à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™', 'à¸„à¸³à¸™à¸³à¸«à¸™à¹‰à¸²', 'à¸Šà¸·à¹ˆà¸­', 'à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥', 'à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™/à¸«à¹‰à¸­à¸‡', 'à¸ªà¸²à¸‚à¸²à¸§à¸´à¸Šà¸²', 'à¸­à¸µà¹€à¸¡à¸¥'];
      const rows = [
        ['67209010001', 'à¸™à¸²à¸¢', 'à¸ªà¸¡à¸Šà¸²à¸¢', 'à¹ƒà¸ˆà¸”à¸µ', 'à¸›à¸§à¸Š.1/1', 'à¹€à¸—à¸„à¹‚à¸™à¹‚à¸¥à¸¢à¸µà¸ªà¸²à¸£à¸ªà¸™à¹€à¸—à¸¨', 'somchai.jai@example.com'],
        ['67209010002', 'à¸™à¸²à¸‡à¸ªà¸²à¸§', 'à¸ªà¸¡à¸«à¸à¸´à¸‡', 'à¸£à¸±à¸à¹€à¸£à¸µà¸¢à¸™', 'à¸›à¸§à¸Š.1/1', 'à¹€à¸—à¸„à¹‚à¸™à¹‚à¸¥à¸¢à¸µà¸ªà¸²à¸£à¸ªà¸™à¹€à¸—à¸¨', 'somying.rak@example.com'],
        ['67209010003', 'à¸™à¸²à¸¢', 'à¸à¸´à¸•à¸•à¸´à¸¨à¸±à¸à¸”à¸´à¹Œ', 'à¸žà¸²à¸à¹€à¸žà¸µà¸¢à¸£', 'à¸›à¸§à¸Š.1/2', 'à¸Šà¹ˆà¸²à¸‡à¸­à¸´à¹€à¸¥à¹‡à¸à¸—à¸£à¸­à¸™à¸´à¸à¸ªà¹Œ', 'kittisak.pak@example.com'],
        ['67209010004', 'à¸™à¸²à¸‡à¸ªà¸²à¸§', 'à¸à¸¡à¸¥à¸§à¸£à¸£à¸“', 'à¸ªà¸”à¹ƒà¸ª', 'à¸›à¸§à¸Š.1/2', 'à¸Šà¹ˆà¸²à¸‡à¸­à¸´à¹€à¸¥à¹‡à¸à¸—à¸£à¸­à¸™à¸´à¸à¸ªà¹Œ', 'kamonwan.sod@example.com'],
        ['66309010005', 'à¸™à¸²à¸¢', 'à¸˜à¸™à¸²à¸à¸£', 'à¸¡à¸±à¹ˆà¸™à¸„à¸‡', 'à¸›à¸§à¸ª.1/1', 'à¹€à¸—à¸„à¹‚à¸™à¹‚à¸¥à¸¢à¸µà¸˜à¸¸à¸£à¸à¸´à¸ˆà¸”à¸´à¸ˆà¸´à¸—à¸±à¸¥', 'thanakorn.man@example.com'],
      ];

      const escapeCsv = (val: string | number) => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvContent = '\uFEFF' + [
        headers.map(escapeCsv).join(','),
        ...rows.map(r => r.map(escapeCsv).join(','))
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'à¹€à¸—à¸¡à¹€à¸žà¸¥à¸•_à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡ CSV à¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    } catch (err) {
      console.error('Download CSV template error:', err);
      toast.error('à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡ CSV à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    }
  };

  // --- Bulk Import ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('à¸‚à¸™à¸²à¸”à¹„à¸Ÿà¸¥à¹Œà¹€à¸à¸´à¸™à¸à¸³à¸«à¸™à¸” (à¸ªà¸¹à¸‡à¸ªà¸¸à¸”à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ 5MB)');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        if (typeof bstr !== 'string') return;
        const XLSX = await import('xlsx');
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

        const mappedData = data.map((row: Record<string, string>) => {
          const prefix = row['à¸„à¸³à¸™à¸³à¸«à¸™à¹‰à¸²'] || '';
          const firstName = row['à¸Šà¸·à¹ˆà¸­'] || row['name'] || '';
          const lastName = row['à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥'] || '';

          let fullName = row['à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥'] || '';
          if (!fullName && firstName) {
            fullName = `${prefix} ${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
          }

          const rawAvatar = row['à¸£à¸¹à¸›à¸ à¸²à¸ž'] || row['à¸£à¸¹à¸›à¸–à¹ˆà¸²à¸¢'] || row['à¸£à¸¹à¸›'] || row['photo'] || row['image'] || row['avatar'] || row['picture'] || row['url'] || row['image_url'] || '';
          const rawGrade = row['à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™/à¸«à¹‰à¸­à¸‡'] || row['à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™'] || row['à¸Šà¸±à¹‰à¸™'] || row['grade_level'] || '';
          const rawRoom = row['à¸«à¹‰à¸­à¸‡'] || row['à¸à¸¥à¸¸à¹ˆà¸¡'] || row['à¸à¸¥à¸¸à¹ˆà¸¡à¹€à¸£à¸µà¸¢à¸™'] || row['à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢'] || row['à¸—à¸±à¸š'] || row['room'] || row['section'] || row['group'] || '';

          return {
            student_code: String(row['à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™'] || row['à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¸¨à¸¶à¸à¸©à¸²'] || row['student_code'] || ''),
            name: String(fullName),
            grade_level: combineGradeAndRoom(String(rawGrade), String(rawRoom)),
            branch: String(row['à¸ªà¸²à¸‚à¸²'] || row['à¸ªà¸²à¸‚à¸²à¸§à¸´à¸Šà¸²'] || row['à¹à¸œà¸™à¸'] || row['à¹à¸œà¸™à¸à¸§à¸´à¸Šà¸²'] || row['branch'] || row['department'] || '').trim(),
            email: String(row['à¸­à¸µà¹€à¸¡à¸¥'] || row['email'] || ''),
            avatar: rawAvatar ? String(rawAvatar).trim() : null,
          };
        }).filter((item: { name: string }) => item.name);

        setImportData(mappedData);
      } catch {
        toast.error('à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¹„à¸”à¹‰ à¸à¸£à¸¸à¸“à¸²à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸£à¸¹à¸›à¹à¸šà¸šà¹„à¸Ÿà¸¥à¹Œ');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportSubmit = () => {
    if (importData.length === 0) return;
    const payload = importData.map(d => ({
      ...d,
      classroom_id: importClassroomId || null
    }));
    importMutation.mutate(payload);
  };

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) || s.student_code?.toLowerCase().includes(search.toLowerCase());
      const matchClass = filterClassroomId ? String(s.classroom_id) === String(filterClassroomId) : true;
      const matchBranch = filterBranch ? (s.branch || '') === filterBranch : true;
      const matchGradeLevel = filterGradeLevel ? (s.grade_level || '') === filterGradeLevel : true;
      return matchSearch && matchClass && matchBranch && matchGradeLevel;
    });
  }, [students, search, filterClassroomId, filterBranch, filterGradeLevel]);

  // Group students by branch for summary display
  const branchGroups = useMemo(() => {
    const groups = new Map<string, number>();
    for (const s of students) {
      const b = s.branch || 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸ªà¸²à¸‚à¸²';
      groups.set(b, (groups.get(b) || 0) + 1);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], 'th'));
  }, [students]);

  // Group students by grade level (within selected branch, or all students)
  const gradeLevelGroups = useMemo(() => {
    const pool = filterBranch
      ? students.filter(s => (s.branch || '') === filterBranch)
      : students;
    const groups = new Map<string, number>();
    for (const s of pool) {
      const g = s.grade_level || 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸£à¸°à¸”à¸±à¸š';
      groups.set(g, (groups.get(g) || 0) + 1);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], 'th'));
  }, [students, filterBranch]);

  // Paginated subset
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change â€” derived from useMemo instead of useEffect
  const prevFilterKey = `${search}|${filterClassroomId}|${filterBranch}|${filterGradeLevel}`;
  const [lastFilterKey, setLastFilterKey] = useState(prevFilterKey);
  if (prevFilterKey !== lastFilterKey) {
    setLastFilterKey(prevFilterKey);
    setCurrentPage(1);
  }

  if (isLoading) return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™</h1>
          <p className="text-slate-500 text-sm">à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” {students.length} à¸„à¸™</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {students.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={isMutating}
              className="btn bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 flex-1 sm:flex-none flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>à¸¥à¸šà¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</span>
            </button>
          )}
          <button
            onClick={() => setShowExportModal(true)}
            className="btn bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 font-bold text-xs"
            title="à¸žà¸£à¸µà¸§à¸´à¸§à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸•à¸²à¸£à¸²à¸‡ Excel à¸à¹ˆà¸­à¸™à¸ªà¹ˆà¸‡à¸­à¸­à¸"
          >
            <FileSpreadsheet className="w-4 h-4" /> à¸žà¸£à¸µà¸§à¸´à¸§ & à¸ªà¹ˆà¸‡à¸­à¸­à¸ Excel
          </button>
          <button
            onClick={() => { setShowImportForm(true); setImportData([]); setImportClassroomId(''); }}
            className="btn bg-white hover:bg-indigo-50 text-slate-800 border border-slate-200/80 flex-1 sm:flex-none flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all font-bold text-xs"
            title="à¸™à¸³à¹€à¸‚à¹‰à¸²à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸ˆà¸²à¸à¹„à¸Ÿà¸¥à¹Œ Excel / CSV à¹à¸¥à¸°à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹€à¸—à¸¡à¹€à¸žà¸¥à¸•à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡"
          >
            <Upload className="w-4 h-4 text-indigo-600" /> à¸™à¸³à¹€à¸‚à¹‰à¸²à¹„à¸Ÿà¸¥à¹Œ & à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡
          </button>
          <button onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(true); }} className="btn btn-primary flex-1 sm:flex-none" id="add-student-btn">
            <Plus className="w-4 h-4" /> à¹€à¸žà¸´à¹ˆà¸¡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-11"
            placeholder="à¸„à¹‰à¸™à¸«à¸²à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™..."
            id="student-search"
            aria-label="à¸„à¹‰à¸™à¸«à¸²à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™"
          />
        </div>
        <select
          value={filterClassroomId}
          onChange={e => setFilterClassroomId(e.target.value)}
          className="form-input w-full sm:w-64"
          id="filter-classroom"
          aria-label="à¸à¸£à¸­à¸‡à¸•à¸²à¸¡à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™"
        >
          <option value="">-- à¸—à¸¸à¸à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ --</option>
          {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>


      </div>

      {/* Branch Summary Cards (when no branch selected) */}
      {branchGroups.length > 1 && !filterBranch && (
        <div className="space-y-1.5 animate-fade-in-up">
          <div className="flex flex-wrap gap-2">
            {branchGroups.map(([branch, count]) => (
              <button
                key={branch}
                onClick={() => {
                  setFilterBranch(branch === 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸ªà¸²à¸‚à¸²' ? '' : branch);
                  setFilterGradeLevel('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:scale-105 hover:shadow-sm bg-white/80 border-indigo-100 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300"
              >
                <GitBranch className="w-3 h-3 text-indigo-500" />
                {branch}
                <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold ml-0.5">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Branch & Grade Level Drill-Down Bar (when branch is selected) */}
      {filterBranch && (
        <div className="glass p-3.5 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-white space-y-2.5 animate-fade-in-up">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">à¸ªà¸²à¸‚à¸²à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                <GitBranch className="w-3.5 h-3.5" />
                {filterBranch}
              </span>
              <button
                onClick={() => {
                  setFilterBranch('');
                  setFilterGradeLevel('');
                }}
                className="text-xs text-slate-500 hover:text-red-500 underline transition-colors flex items-center gap-1"
                title="à¸¢à¸à¹€à¸¥à¸´à¸à¸à¸²à¸£à¹€à¸¥à¸·à¸­à¸à¸ªà¸²à¸‚à¸²"
              >
                <X className="w-3 h-3" /> à¹à¸ªà¸”à¸‡à¸—à¸¸à¸à¸ªà¸²à¸‚à¸²
              </button>
            </div>

            {filterGradeLevel && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">à¸£à¸°à¸”à¸±à¸šà¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {filterGradeLevel}
                </span>
                <button
                  onClick={() => setFilterGradeLevel('')}
                  className="text-xs text-slate-500 hover:text-red-500 transition-colors p-0.5"
                  title="à¸¥à¹‰à¸²à¸‡à¸à¸²à¸£à¹€à¸¥à¸·à¸­à¸à¸£à¸°à¸”à¸±à¸š"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Sub-level chips: "à¸žà¸­à¸à¸”à¸à¸£à¸­à¸à¸•à¸²à¸¡à¸ªà¸²à¸‚à¸²à¹à¸¥à¹‰à¸§à¸­à¸¢à¸²à¸à¹ƒà¸«à¹‰à¸¡à¸µà¸à¸£à¸­à¸à¸•à¸²à¸¡à¸£à¸°à¸”à¸±à¸š à¸­à¸µà¸" */}
          {gradeLevelGroups.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-indigo-100/60">
              <span className="text-xs font-medium text-slate-600 mr-1 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-600" /> à¸£à¸°à¸”à¸±à¸šà¹ƒà¸™à¸ªà¸²à¸‚à¸²à¸™à¸µà¹‰:
              </span>
              <button
                onClick={() => setFilterGradeLevel('')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${!filterGradeLevel
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20 font-semibold'
                  : 'bg-white/80 text-slate-600 hover:bg-purple-50 border border-slate-200'
                  }`}
              >
                à¸—à¸¸à¸à¸£à¸°à¸”à¸±à¸š
              </button>
              {gradeLevelGroups.map(([grade, count]) => {
                const actualGrade = grade === 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸£à¸°à¸”à¸±à¸š' ? '' : grade;
                const isSelected = filterGradeLevel === actualGrade;
                return (
                  <button
                    key={grade}
                    onClick={() => setFilterGradeLevel(isSelected ? '' : actualGrade)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isSelected
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 font-bold scale-105'
                      : 'bg-white/90 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300'
                      }`}
                  >
                    <GraduationCap className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />
                    {grade}
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isSelected ? 'bg-emerald-700 text-white' : 'bg-emerald-100/80 text-emerald-700'
                      }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* When no branch is selected but a grade level is selected via dropdown */}
      {!filterBranch && filterGradeLevel && (
        <div className="flex items-center gap-2 animate-fade-in-up">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white">
            <GraduationCap className="w-3.5 h-3.5" />
            à¸£à¸°à¸”à¸±à¸š {filterGradeLevel}
          </span>
          <button
            onClick={() => setFilterGradeLevel('')}
            className="text-xs text-slate-500 hover:text-emerald-600 underline transition-colors"
          >
            à¹à¸ªà¸”à¸‡à¸—à¸¸à¸à¸£à¸°à¸”à¸±à¸š
          </button>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedStudents.length > 0 && (
        <div className="glass p-4 rounded-2xl space-y-3 border border-indigo-200 bg-indigo-500/5 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-xs">
                à¹€à¸¥à¸·à¸­à¸à¹à¸¥à¹‰à¸§ {selectedStudents.length} à¸„à¸™
              </span>
              <button
                onClick={() => setSelectedStudents([])}
                className="text-slate-600 hover:text-slate-800 text-xs font-medium underline"
              >
                à¸¢à¸à¹€à¸¥à¸´à¸à¸à¸²à¸£à¹€à¸¥à¸·à¸­à¸
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={bulkAssignClassroomId}
                onChange={e => setBulkAssignClassroomId(e.target.value)}
                className="form-input py-1.5 text-xs flex-1 sm:flex-none sm:w-52"
                id="bulk-assign-classroom"
                aria-label="à¹€à¸¥à¸·à¸­à¸à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¹€à¸›à¹‰à¸²à¸«à¸¡à¸²à¸¢à¸ªà¸³à¸«à¸£à¸±à¸šà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸"
              >
                <option value="">-- à¸¢à¹‰à¸²à¸¢à¹„à¸›à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™/à¸§à¸´à¸Šà¸² --</option>
                <option value="null">à¹„à¸¡à¹ˆà¸¡à¸µà¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ (à¸¥à¸­à¸¢à¹à¸ž)</option>
                {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={isMutating}
                className="btn btn-primary py-1.5 px-3 text-xs flex-1 sm:flex-none"
              >
                {bulkAssignMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'à¸¢à¹‰à¸²à¸¢à¸«à¹‰à¸­à¸‡'}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isMutating}
                className="btn bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 py-1.5 px-3 text-xs flex-1 sm:flex-none flex items-center justify-center gap-1.5"
              >
                {bulkDeleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>à¸¥à¸šà¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸</span>
              </button>
            </div>
          </div>

          {/* Bulk Assign Sub-room / Grade Level & Branch (à¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸£à¸“à¸µà¹€à¸£à¸µà¸¢à¸™à¸£à¸§à¸¡à¸«à¸¥à¸²à¸¢à¸«à¹‰à¸­à¸‡ à¹€à¸Šà¹ˆà¸™ à¸›à¸§à¸Š.1/1 à¸à¸±à¸š à¸›à¸§à¸Š.1/2) */}
          <div className="pt-2.5 border-t border-indigo-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <span className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5 shrink-0">
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              <span>à¸à¸³à¸«à¸™à¸”à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢ / à¸ªà¸²à¸‚à¸² (à¹ƒà¸Šà¹‰à¹à¸¢à¸à¸«à¹‰à¸­à¸‡à¸•à¸­à¸™à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­):</span>
            </span>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={bulkGradeLevel}
                onChange={e => setBulkGradeLevel(e.target.value)}
                placeholder="à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™/à¸«à¹‰à¸­à¸‡ à¹€à¸Šà¹ˆà¸™ à¸›à¸§à¸Š.1/1"
                list="bulk-grade-suggestions"
                className="form-input py-1.5 text-xs flex-1 sm:w-44 bg-white"
                aria-label="à¸à¸³à¸«à¸™à¸”à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™à¸«à¸£à¸·à¸­à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢à¹à¸šà¸šà¸à¸¥à¸¸à¹ˆà¸¡"
              />
              {gradeLevels.length > 0 && (
                <datalist id="bulk-grade-suggestions">
                  {gradeLevels.map(g => <option key={g} value={g} />)}
                </datalist>
              )}
              <input
                type="text"
                value={bulkBranch}
                onChange={e => setBulkBranch(e.target.value)}
                placeholder="à¸ªà¸²à¸‚à¸² à¹€à¸Šà¹ˆà¸™ à¸„à¸­à¸¡à¸žà¸´à¸§à¹€à¸•à¸­à¸£à¹Œ"
                list="bulk-branch-suggestions"
                className="form-input py-1.5 text-xs flex-1 sm:w-44 bg-white"
                aria-label="à¸à¸³à¸«à¸™à¸”à¸ªà¸²à¸‚à¸²à¸§à¸´à¸Šà¸²à¹à¸šà¸šà¸à¸¥à¸¸à¹ˆà¸¡"
              />
              {branches.length > 0 && (
                <datalist id="bulk-branch-suggestions">
                  {branches.map(b => <option key={b} value={b} />)}
                </datalist>
              )}
              <button
                type="button"
                onClick={handleBulkMetaSave}
                disabled={isMutating}
                className="btn bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3.5 text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 w-full sm:w-auto"
              >
                {bulkMetaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                <span>à¸šà¸±à¸™à¸—à¸¶à¸à¸«à¹‰à¸­à¸‡à¸¢à¹ˆà¸­à¸¢/à¸ªà¸²à¸‚à¸²</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select All Checkbox (Only if there are students) */}
      {filtered.length > 0 && (
        <div className="flex items-center px-2 py-1 gap-3">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={selectedStudents.length === filtered.length}
              onChange={handleSelectAll}
              aria-label="à¹€à¸¥à¸·à¸­à¸à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸šà¸™à¸«à¸™à¹‰à¸²à¸ˆà¸­à¸™à¸µà¹‰"
            />
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all peer-focus:ring-2 peer-focus:ring-indigo-500 ${selectedStudents.length === filtered.length ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 group-hover:border-indigo-400 bg-indigo-50'}`}>
              {selectedStudents.length === filtered.length && <CheckCircle className="w-3.5 h-3.5 text-slate-800" />}
            </div>
            <span className="text-sm text-slate-600 group-hover:text-slate-700">à¹€à¸¥à¸·à¸­à¸à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸šà¸™à¸«à¸™à¹‰à¸²à¸ˆà¸­à¸™à¸µà¹‰</span>
          </label>
        </div>
      )}

      {/* Students List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="glass p-14 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
              <UsersIcon className="w-7 h-7 text-slate-700" />
            </div>
            <p className="text-slate-500 text-sm font-medium">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™</p>
            <p className="text-slate-600 text-xs mt-1">à¹€à¸žà¸´à¹ˆà¸¡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹€à¸žà¸·à¹ˆà¸­à¹€à¸£à¸´à¹ˆà¸¡à¸šà¸±à¸™à¸—à¸¶à¸à¸œà¸¥à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸™</p>
          </div>
        ) : paginatedStudents.map((student) => (
          <div
            key={student.id}
            className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-slate-700 overflow-hidden transition-colors duration-150 ${selectedStudents.includes(student.id) ? 'border-indigo-500/60 bg-indigo-50/40 dark:bg-indigo-950/20' : ''}`}
          >
            <div className="p-4 flex items-center gap-4">
              <label className="cursor-pointer group flex-shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={selectedStudents.includes(student.id)}
                  onChange={() => handleToggleSelect(student.id)}
                  aria-label={`à¹€à¸¥à¸·à¸­à¸à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™ ${student.name}`}
                />
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all peer-focus:ring-2 peer-focus:ring-indigo-500 ${selectedStudents.includes(student.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 group-hover:border-indigo-400 bg-indigo-50'}`}>
                  {selectedStudents.includes(student.id) && <CheckCircle className="w-3.5 h-3.5 text-slate-800" />}
                </div>
              </label>
              <UserAvatar
                avatar={student.avatar}
                name={student.name}
                userId={student.id}
                size="lg"
                className="rounded-2xl border border-indigo-100 shadow-sm shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-[0.95rem]">{student.name}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                  {student.student_code && <span>à¸£à¸«à¸±à¸ª: {student.student_code}</span>}
                  {student.grade_level && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                      <GraduationCap className="w-3 h-3" />à¸£à¸°à¸”à¸±à¸š {student.grade_level}
                    </span>
                  )}
                  {student.branch && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100 font-medium">
                      <GitBranch className="w-3 h-3" />{student.branch}
                    </span>
                  )}
                  {student.classroom_id && (() => {
                    const roomName = classrooms.find(c => String(c.id) === String(student.classroom_id))?.name || student.classroom_name;
                    return roomName ? <span>à¸«à¹‰à¸­à¸‡: {roomName}</span> : null;
                  })()}
                  {student.email && <span>{student.email}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(student)}
                  className="p-2.5 rounded-xl hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-700 transition-all"
                  title="à¹à¸à¹‰à¹„à¸‚"
                  aria-label={`à¹à¸à¹‰à¹„à¸‚à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸‚à¸­à¸‡ ${student.name}`}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(student.id)}
                  className="p-2.5 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
                  title="à¸¥à¸š"
                  aria-label={`à¸¥à¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸‚à¸­à¸‡ ${student.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setItemsPerPage(size); setCurrentPage(1); }}
        />
      )}

      {/* Student Form Modal */}
      {showForm && createPortal(
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-7 animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">{editing ? 'à¹à¸à¹‰à¹„à¸‚à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™' : 'à¹€à¸žà¸´à¹ˆà¸¡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹ƒà¸«à¸¡à¹ˆ'}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-indigo-50 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            {/* Avatar Section for Single Student */}
            <div className="flex flex-col items-center justify-center gap-2.5 pb-4 mb-4 border-b border-indigo-100/70">
              <div className="relative group">
                <UserAvatar
                  avatar={form.avatar}
                  name={form.name || 'à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™'}
                  userId={editing || 1}
                  size="xl"
                  className="rounded-3xl border-2 border-indigo-200 shadow-md transition-transform duration-200 group-hover:scale-105"
                />
                <button
                  type="button"
                  onClick={() => singlePhotoInputRef.current?.click()}
                  disabled={isCompressingSingle}
                  className="absolute -bottom-1 -right-1 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl shadow-md border-2 border-white transition-transform hover:scale-110"
                  title="à¹€à¸¥à¸·à¸­à¸à¸£à¸¹à¸›à¸ à¸²à¸žà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™"
                >
                  {isCompressingSingle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={singlePhotoInputRef}
                type="file"
                accept="image/*"
                onChange={handleSinglePhotoChange}
                className="hidden"
              />

              {/* Photo & Emoji Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => singlePhotoInputRef.current?.click()}
                  disabled={isCompressingSingle}
                  className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 inline-flex items-center gap-1 transition-colors"
                >
                  <Upload className="w-3 h-3" /> à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¸£à¸¹à¸›à¸ à¸²à¸ž
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold border border-purple-200 inline-flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3" /> à¹€à¸¥à¸·à¸­à¸à¸­à¸´à¹‚à¸¡à¸ˆà¸´
                </button>
                {form.avatar && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, avatar: '', remove_avatar: true }))}
                    className="px-2 py-1 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 text-xs font-semibold transition-colors"
                    title="à¸¥à¸šà¸£à¸¹à¸›à¹à¸¥à¸°à¹ƒà¸Šà¹‰à¸­à¸´à¹‚à¸¡à¸ˆà¸´à¸•à¸²à¸¡à¸¥à¸³à¸”à¸±à¸š"
                  >
                    <Trash2 className="w-3 h-3" /> à¸¥à¸šà¸£à¸¹à¸› (à¹ƒà¸Šà¹‰à¸­à¸´à¹‚à¸¡à¸ˆà¸´à¹€à¸”à¸´à¸¡)
                  </button>
                )}
              </div>

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="w-full p-3 bg-slate-50 border border-indigo-100 rounded-2xl animate-fade-in-up space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>à¹€à¸¥à¸·à¸­à¸à¸­à¸´à¹‚à¸¡à¸ˆà¸´à¸›à¸£à¸°à¸ˆà¸³à¸•à¸±à¸§:</span>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
                    {[...ANIMAL_AVATARS, ...TEACHER_EMOJIS].map((emoji, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setForm(prev => ({ ...prev, avatar: emoji, remove_avatar: false }));
                          setShowEmojiPicker(false);
                        }}
                        className="w-7 h-7 flex items-center justify-center text-lg rounded-lg hover:bg-indigo-50 hover:scale-125 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label" htmlFor="student-name">à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="form-input"
                  required
                  id="student-name"
                  placeholder="à¸à¸£à¸­à¸à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="student-code">à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™</label>
                <input
                  value={form.student_code}
                  onChange={e => setForm({ ...form, student_code: e.target.value })}
                  className="form-input"
                  id="student-code"
                  placeholder="à¹€à¸Šà¹ˆà¸™ 65010001"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="student-grade">à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™ / à¸«à¹‰à¸­à¸‡ (à¸à¸¥à¸¸à¹ˆà¸¡à¹€à¸£à¸µà¸¢à¸™)</label>
                <input
                  value={form.grade_level}
                  onChange={e => setForm({ ...form, grade_level: e.target.value })}
                  className="form-input"
                  id="student-grade"
                  placeholder="à¹€à¸Šà¹ˆà¸™ à¸›à¸§à¸Š.1/1, à¸›à¸§à¸Š.1/2 à¸«à¸£à¸·à¸­ à¸¡.3/1"
                  list="grade-level-suggestions"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  à¸«à¸²à¸à¹€à¸£à¸µà¸¢à¸™à¸£à¸§à¸¡à¸«à¸¥à¸²à¸¢à¸«à¹‰à¸­à¸‡à¹ƒà¸™à¸§à¸´à¸Šà¸²à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™ à¹ƒà¸«à¹‰à¸£à¸°à¸šà¸¸à¸—à¸±à¸šà¸«à¹‰à¸­à¸‡ à¹€à¸Šà¹ˆà¸™ à¸›à¸§à¸Š.1/1, à¸›à¸§à¸Š.1/2 à¹€à¸žà¸·à¹ˆà¸­à¹à¸¢à¸à¸«à¹‰à¸­à¸‡à¸•à¸­à¸™à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­
                </p>
                {gradeLevels.length > 0 && (
                  <datalist id="grade-level-suggestions">
                    {gradeLevels.map(g => <option key={g} value={g} />)}
                  </datalist>
                )}
              </div>
              <div>
                <label className="form-label" htmlFor="student-branch">à¸ªà¸²à¸‚à¸²</label>
                <input
                  value={form.branch}
                  onChange={e => setForm({ ...form, branch: e.target.value })}
                  className="form-input"
                  id="student-branch"
                  placeholder="à¹€à¸Šà¹ˆà¸™ à¸ªà¸²à¸‚à¸²à¸„à¸­à¸¡à¸žà¸´à¸§à¹€à¸•à¸­à¸£à¹Œ, à¸ªà¸²à¸‚à¸²à¸šà¸±à¸à¸Šà¸µ"
                  list="branch-suggestions"
                />
                {branches.length > 0 && (
                  <datalist id="branch-suggestions">
                    {branches.map(b => <option key={b} value={b} />)}
                  </datalist>
                )}
              </div>
              <div>
                <label className="form-label" htmlFor="student-email">à¸­à¸µà¹€à¸¡à¸¥</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="form-input"
                  id="student-email"
                  placeholder="student@email.com (à¹„à¸¡à¹ˆà¸šà¸±à¸‡à¸„à¸±à¸š)"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="student-classroom">à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™</label>
                <select
                  value={form.classroom_id}
                  onChange={e => setForm({ ...form, classroom_id: e.target.value })}
                  className="form-input"
                  id="student-classroom"
                >
                  <option value="">-- à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ --</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={saveMutation.isPending || isCompressingSingle} className="btn btn-primary w-full py-3" id="student-save-btn">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'à¸­à¸±à¸›à¹€à¸”à¸•' : <><Plus className="w-4 h-4" /> à¹€à¸žà¸´à¹ˆà¸¡à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™</>}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Import Form Modal */}
      {showImportForm && createPortal(
        <div className="modal-overlay" onClick={() => setShowImportForm(false)}>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl p-6 sm:p-7 animate-fade-in-up max-h-[90vh] overflow-y-auto space-y-5" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-indigo-100/70 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">à¸™à¸³à¹€à¸‚à¹‰à¸²à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¹à¸¥à¸°à¸£à¸¹à¸›à¸ à¸²à¸žà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™</h2>
                  <p className="text-xs text-slate-500">à¸£à¸­à¸‡à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ Excel (.xlsx, .xls) à¹à¸¥à¸° CSV à¸žà¸£à¹‰à¸­à¸¡à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸£à¸¹à¸›à¹à¸šà¸šà¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸•à¸£à¸§à¸ˆà¸ˆà¸±à¸šà¹„à¸”à¹‰à¸—à¸±à¸™à¸—à¸µ</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportForm(false)}
                className="p-2 hover:bg-indigo-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="à¸›à¸´à¸”à¸«à¸™à¹‰à¸²à¸•à¹ˆà¸²à¸‡"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Download & Structure Example Section */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-slate-50 border border-indigo-100/90 space-y-3.5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                    à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸£à¸¹à¸›à¹à¸šà¸šà¹„à¸Ÿà¸¥à¹Œ Excel / CSV à¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸£à¸­à¸‡à¸£à¸±à¸š
                  </h3>
                  <p className="text-xs text-slate-500">
                    à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¹€à¸—à¸¡à¹€à¸žà¸¥à¸•à¹€à¸žà¸·à¹ˆà¸­à¸™à¸³à¹„à¸›à¸à¸£à¸­à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ à¸«à¸£à¸·à¸­à¸ˆà¸±à¸”à¸£à¸¹à¸›à¹à¸šà¸šà¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¸•à¸²à¸¡à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡
                  </p>
                </div>

                {/* Template Download Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    className="btn bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs transition-all hover:border-emerald-300"
                    title="à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸£à¸¹à¸›à¹à¸šà¸š Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>à¹€à¸—à¸¡à¹€à¸žà¸¥à¸• Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="btn bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs transition-all hover:border-slate-300"
                    title="à¸”à¸²à¸§à¸™à¹Œà¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œà¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸£à¸¹à¸›à¹à¸šà¸š CSV (.csv)"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    <span>à¹€à¸—à¸¡à¹€à¸žà¸¥à¸• CSV (.csv)</span>
                  </button>
                </div>
              </div>

              {/* Format Tabs Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-indigo-100/60">
                <span className="text-[11px] font-semibold text-slate-600">à¹€à¸¥à¸·à¸­à¸à¸”à¸¹à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œ:</span>
                <div className="inline-flex rounded-xl bg-slate-200/70 p-1 border border-slate-300/60 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setExampleFormatTab('split')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      exampleFormatTab === 'split'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    à¹à¸šà¸šà¹à¸¢à¸à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œ (à¸„à¸³à¸™à¸³à¸«à¸™à¹‰à¸² + à¸Šà¸·à¹ˆà¸­ + à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExampleFormatTab('single')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      exampleFormatTab === 'single'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    à¹à¸šà¸šà¸£à¸§à¸¡à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œ (à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥)
                  </button>
                </div>
              </div>

              {/* Mockup Preview Table */}
              <div className="overflow-x-auto rounded-xl border border-indigo-100/90 bg-white shadow-2xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-indigo-50/80 text-indigo-950 font-bold border-b border-indigo-100">
                      <th className="p-2 border-r border-indigo-100/80 font-mono w-28 text-center">à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™</th>
                      {exampleFormatTab === 'split' ? (
                        <>
                          <th className="p-2 border-r border-indigo-100/80 w-20 text-center">à¸„à¸³à¸™à¸³à¸«à¸™à¹‰à¸²</th>
                          <th className="p-2 border-r border-indigo-100/80 w-28">à¸Šà¸·à¹ˆà¸­</th>
                          <th className="p-2 border-r border-indigo-100/80 w-28">à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥</th>
                        </>
                      ) : (
                        <th className="p-2 border-r border-indigo-100/80 min-w-[150px]">à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥</th>
                      )}
                      <th className="p-2 border-r border-indigo-100/80 w-24 text-center">
                        {exampleFormatTab === 'split' ? 'à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™/à¸«à¹‰à¸­à¸‡' : 'à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™'}
                      </th>
                      {exampleFormatTab === 'single' && (
                        <th className="p-2 border-r border-indigo-100/80 w-16 text-center">à¸«à¹‰à¸­à¸‡</th>
                      )}
                      <th className="p-2 border-r border-indigo-100/80 min-w-[130px]">à¸ªà¸²à¸‚à¸²à¸§à¸´à¸Šà¸²</th>
                      <th className="p-2 text-slate-500 min-w-[140px]">à¸­à¸µà¹€à¸¡à¸¥ (à¹„à¸¡à¹ˆà¸šà¸±à¸‡à¸„à¸±à¸š)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {exampleFormatTab === 'split' ? (
                      <>
                        <tr className="bg-white hover:bg-indigo-50/20">
                          <td className="p-2 text-slate-700 border-r border-slate-100 font-mono text-center">67209010001</td>
                          <td className="p-2 text-slate-600 border-r border-slate-100 text-center">à¸™à¸²à¸¢</td>
                          <td className="p-2 text-slate-800 border-r border-slate-100 font-semibold">à¸ªà¸¡à¸Šà¸²à¸¢</td>
                          <td className="p-2 text-slate-800 border-r border-slate-100">à¹ƒà¸ˆà¸”à¸µ</td>
                          <td className="p-2 text-slate-700 border-r border-slate-100 text-center font-mono">à¸›à¸§à¸Š.1/1</td>
                          <td className="p-2 text-slate-600 border-r border-slate-100">à¹€à¸—à¸„à¹‚à¸™à¹‚à¸¥à¸¢à¸µà¸ªà¸²à¸£à¸ªà¸™à¹€à¸—à¸¨</td>
                          <td className="p-2 text-slate-500 font-mono text-[11px]">somchai@example.com</td>
                        </tr>
                        <tr className="bg-slate-50/40 hover:bg-indigo-50/20">
                          <td className="p-2 text-slate-700 border-r border-slate-100 font-mono text-center">67209010002</td>
                          <td className="p-2 text-slate-600 border-r border-slate-100 text-center">à¸™à¸²à¸‡à¸ªà¸²à¸§</td>
                          <td className="p-2 text-slate-800 border-r border-slate-100 font-semibold">à¸ªà¸¡à¸«à¸à¸´à¸‡</td>
                          <td className="p-2 text-slate-800 border-r border-slate-100">à¸£à¸±à¸à¹€à¸£à¸µà¸¢à¸™</td>
                          <td className="p-2 text-slate-700 border-r border-slate-100 text-center font-mono">à¸›à¸§à¸Š.1/1</td>
                          <td className="p-2 text-slate-600 border-r border-slate-100">à¹€à¸—à¸„à¹‚à¸™à¹‚à¸¥à¸¢à¸µà¸ªà¸²à¸£à¸ªà¸™à¹€à¸—à¸¨</td>
                          <td className="p-2 text-slate-500 font-mono text-[11px]">somying@example.com</td>
                        </tr>
                        <tr className="bg-white hover:bg-indigo-50/20">
                          <td className="p-2 text-slate-700 border-r border-slate-100 font-mono text-center">67209010003</td>
                          <td className="p-2 text-slate-600 border-r border-slate-100 text-center">à¸™à¸²à¸¢</td>
                          <td className="p-2 text-slate-800 border-r border-slate-100 font-semibold">à¸à¸´à¸•à¸•à¸´à¸¨à¸±à¸à¸”à¸´à¹Œ</td>
                          <td className="p-2 text-slate-800 border-r border-slate-100">à¸žà¸²à¸à¹€à¸žà¸µà¸¢à¸£</td>
                          <td className="p-2 text-slate-700 border-r border-slate-100 text-center font-mono">à¸›à¸§à¸Š.1/2</td>
                          <td className="p-2 text-slate-600 border-r border-slate-100">à¸Šà¹ˆà¸²à¸‡à¸­à¸´à¹€à¸¥à¹‡à¸à¸—à¸£à¸­à¸™à¸´à¸à¸ªà¹Œ</td>
                          <td className="p-2 text-slate-500 font-mono text-[11px]">kittisak@example.com</td>
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr className="bg-white hover:bg-indigo-50/20">
                          <td className="p-2 text-slate-700 border-r border-slate-100 font-mono text-center">67209010001</td>
                          <td className="p-2 text-slate-800 border-r border-slate-100 font-semibold">à¸™à¸²à¸¢à¸ªà¸¡à¸Šà¸²à¸¢ à¹ƒà¸ˆà¸”à¸µ</td>
                          <td className="p-2 text-slate-700 border-r border-slate-100 text-center font-mono">à¸›à¸§à¸Š.1</td>
                          <td className="p-2 text-slate-700 border-r border-slate-100 text-center font-mono">1</td>
                          <td className="p-2 text-slate-600 border-r border-slate-100">à¹€à¸—à¸„à¹‚à¸™à¹‚à¸¥à¸¢à¸µà¸ªà¸²à¸£à¸ªà¸™à¹€à¸—à¸¨</td>
                          <td className="p-2 text-slate-500 font-mono text-[11px]">somchai@example.com</td>
                        </tr>
                        <tr className="bg-slate-50/40 hover:bg-indigo-50/20">
                          <td className="p-2 text-slate-700 border-r border-slate-100 font-mono text-center">67209010002</td>
                          <td className="p-2 text-slate-800 border-r border-slate-100 font-semibold">à¸™à¸²à¸‡à¸ªà¸²à¸§à¸ªà¸¡à¸«à¸à¸´à¸‡ à¸£à¸±à¸à¹€à¸£à¸µà¸¢à¸™</td>
                          <td className="p-2 text-slate-700 border-r border-slate-100 text-center font-mono">à¸›à¸§à¸Š.1</td>
                          <td className="p-2 text-slate-700 border-r border-slate-100 text-center font-mono">1</td>
                          <td className="p-2 text-slate-600 border-r border-slate-100">à¹€à¸—à¸„à¹‚à¸™à¹‚à¸¥à¸¢à¸µà¸ªà¸²à¸£à¸ªà¸™à¹€à¸—à¸¨</td>
                          <td className="p-2 text-slate-500 font-mono text-[11px]">somying@example.com</td>
                        </tr>
                        <tr className="bg-white hover:bg-indigo-50/20">
                          <td className="p-2 text-slate-700 border-r border-slate-100 font-mono text-center">67209010003</td>
                          <td className="p-2 text-slate-800 border-r border-slate-100 font-semibold">à¸™à¸²à¸¢à¸à¸´à¸•à¸•à¸´à¸¨à¸±à¸à¸”à¸´à¹Œ à¸žà¸²à¸à¹€à¸žà¸µà¸¢à¸£</td>
                          <td className="p-2 text-slate-700 border-r border-slate-100 text-center font-mono">à¸›à¸§à¸Š.1</td>
                          <td className="p-2 text-slate-700 border-r border-slate-100 text-center font-mono">2</td>
                          <td className="p-2 text-slate-600 border-r border-slate-100">à¸Šà¹ˆà¸²à¸‡à¸­à¸´à¹€à¸¥à¹‡à¸à¸—à¸£à¸­à¸™à¸´à¸à¸ªà¹Œ</td>
                          <td className="p-2 text-slate-500 font-mono text-[11px]">kittisak@example.com</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Supported column chips / tips */}
              <div className="pt-1 space-y-1">
                <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-600" />
                  à¸Šà¸·à¹ˆà¸­à¸«à¸±à¸§à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œà¸—à¸µà¹ˆà¸£à¸°à¸šà¸šà¸•à¸£à¸§à¸ˆà¸ˆà¸±à¸šà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´:
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <span className="px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">
                    <strong>à¸£à¸«à¸±à¸ª:</strong> à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™, à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¸¨à¸¶à¸à¸©à¸², student_code
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">
                    <strong>à¸Šà¸·à¹ˆà¸­:</strong> à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥ à¸«à¸£à¸·à¸­à¹à¸¢à¸ à¸„à¸³à¸™à¸³à¸«à¸™à¹‰à¸² + à¸Šà¸·à¹ˆà¸­ + à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">
                    <strong>à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™/à¸«à¹‰à¸­à¸‡:</strong> à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™/à¸«à¹‰à¸­à¸‡ (à¹€à¸Šà¹ˆà¸™ à¸›à¸§à¸Š.1/1) à¸«à¸£à¸·à¸­à¹à¸¢à¸ à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™ + à¸«à¹‰à¸­à¸‡/à¸à¸¥à¸¸à¹ˆà¸¡
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">
                    <strong>à¸ªà¸²à¸‚à¸²:</strong> à¸ªà¸²à¸‚à¸²à¸§à¸´à¸Šà¸², à¸ªà¸²à¸‚à¸², à¹à¸œà¸™à¸à¸§à¸´à¸Šà¸², à¹à¸œà¸™à¸
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">
                    <strong>à¸£à¸¹à¸›à¸ à¸²à¸ž:</strong> URL à¹ƒà¸™à¸„à¸­à¸¥à¸±à¸¡à¸™à¹Œ à¸£à¸¹à¸›à¸ à¸²à¸ž à¸«à¸£à¸·à¸­à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œà¸£à¸¹à¸›à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡à¹€à¸žà¸·à¹ˆà¸­à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´
                  </span>
                </div>
              </div>
            </div>

            {/* Step 1: Select / Drop Excel or CSV File */}
            <div className="space-y-4">
              {importData.length === 0 ? (
                <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 hover:bg-indigo-50/50 rounded-2xl p-6 text-center transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    id="import-file-input"
                    aria-label="à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¹„à¸Ÿà¸¥à¹Œ Excel à¸«à¸£à¸·à¸­ CSV"
                  />
                  <FileSpreadsheet className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                  <p className="text-slate-800 font-bold text-sm">à¸„à¸¥à¸´à¸à¹€à¸žà¸·à¹ˆà¸­à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œ Excel / CSV à¸«à¸£à¸·à¸­à¸¥à¸²à¸à¹„à¸Ÿà¸¥à¹Œà¸¡à¸²à¸§à¸²à¸‡à¸—à¸µà¹ˆà¸™à¸µà¹ˆ</p>
                  <p className="text-slate-500 text-xs mt-1">
                    à¸£à¸­à¸‡à¸£à¸±à¸šà¹„à¸Ÿà¸¥à¹Œ .xlsx, .xls, .csv (à¸‚à¸™à¸²à¸”à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ 5MB)
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-900">à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸žà¸£à¹‰à¸­à¸¡à¸™à¸³à¹€à¸‚à¹‰à¸²</p>
                      <p className="text-[11px] text-emerald-700">à¸•à¸£à¸§à¸ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” {importData.length} à¸£à¸²à¸¢à¸à¸²à¸£</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImportData([])}
                    className="btn bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs px-3 py-1.5 rounded-xl font-semibold shadow-2xs"
                  >
                    à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œà¹ƒà¸«à¸¡à¹ˆ
                  </button>
                </div>
              )}

              {importData.length > 0 && (
                <div className="space-y-4 animate-fade-in-up">
                  {/* Step 2: Optional Bulk Photos Upload */}
                  <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-indigo-100/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                        à¹à¸™à¸šà¹„à¸Ÿà¸¥à¹Œà¸£à¸¹à¸›à¸ à¸²à¸žà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™ (à¸«à¸¥à¸²à¸¢à¹„à¸Ÿà¸¥à¹Œà¸žà¸£à¹‰à¸­à¸¡à¸à¸±à¸™)
                      </h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        à¸£à¸°à¸šà¸šà¸ˆà¸°à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¸ˆà¸²à¸à¸Šà¸·à¹ˆà¸­à¹„à¸Ÿà¸¥à¹Œ (à¹€à¸Šà¹ˆà¸™ <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-200">65010001.jpg</span> à¸«à¸£à¸·à¸­à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™) à¸žà¸£à¹‰à¸­à¸¡à¸šà¸µà¸šà¸­à¸±à¸”à¹€à¸›à¹‡à¸™ WebP (~4KB/à¸£à¸¹à¸›) à¸—à¸±à¸™à¸—à¸µ
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        ref={bulkPhotoInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleBulkPhotosUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => bulkPhotoInputRef.current?.click()}
                        disabled={isMatchingPhotos}
                        className="btn bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold px-3.5 py-2 rounded-xl border border-indigo-200 shadow-xs flex items-center gap-1.5 transition-all"
                      >
                        {isMatchingPhotos ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> à¸à¸³à¸¥à¸±à¸‡à¸šà¸µà¸šà¸­à¸±à¸”à¸ à¸²à¸ž...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" /> à¹€à¸¥à¸·à¸­à¸à¹„à¸Ÿà¸¥à¹Œà¸£à¸¹à¸›à¸ à¸²à¸žà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Summary & Classroom Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> à¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥ {importData.length} à¸£à¸²à¸¢à¸à¸²à¸£
                      </span>
                      <span className="text-slate-400">|</span>
                      <span className="font-medium text-indigo-700">
                        à¸¡à¸µà¸£à¸¹à¸›à¸–à¹ˆà¸²à¸¢à¹à¸¥à¹‰à¸§ {importData.filter(d => d.avatar).length} à¸„à¸™
                      </span>
                      <span className="text-slate-500">
                        (à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸¹à¸› {importData.filter(d => !d.avatar).length} à¸„à¸™ à¸ˆà¸°à¹ƒà¸Šà¹‰à¸­à¸´à¹‚à¸¡à¸ˆà¸´)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-600 shrink-0" htmlFor="import-classroom">
                        à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™:
                      </label>
                      <select
                        value={importClassroomId}
                        onChange={e => setImportClassroomId(e.target.value)}
                        className="form-input py-1.5 text-xs w-44"
                        id="import-classroom"
                      >
                        <option value="">-- à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸«à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™ --</option>
                        {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="bg-white rounded-2xl max-h-64 overflow-y-auto border border-indigo-100 shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-50 border-b border-indigo-100 z-10">
                        <tr>
                          <th className="p-2.5 font-bold text-slate-700 w-14 text-center">à¸£à¸¹à¸›</th>
                          <th className="p-2.5 font-bold text-slate-700 w-28">à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™</th>
                          <th className="p-2.5 font-bold text-slate-700">à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥</th>
                          <th className="p-2.5 font-bold text-slate-700 w-28">à¸£à¸°à¸”à¸±à¸šà¸Šà¸±à¹‰à¸™/à¸«à¹‰à¸­à¸‡</th>
                          <th className="p-2.5 font-bold text-slate-700 w-28">à¸ªà¸²à¸‚à¸²</th>
                          <th className="p-2.5 font-bold text-slate-700 w-24 text-center">à¸ªà¸–à¸²à¸™à¸°à¸£à¸¹à¸›</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importData.slice(0, 50).map((s, i) => (
                          <tr key={i} className="hover:bg-indigo-50/40 transition-colors">
                            <td className="p-2 text-center">
                              <UserAvatar
                                avatar={s.avatar}
                                name={s.name}
                                userId={i + 1}
                                size="xs"
                                className="mx-auto border border-indigo-100 rounded-lg"
                              />
                            </td>
                            <td className="p-2.5 text-slate-600 font-mono">{s.student_code || '-'}</td>
                            <td className="p-2.5 text-slate-800 font-semibold">{s.name}</td>
                            <td className="p-2.5 text-slate-600">{s.grade_level || '-'}</td>
                            <td className="p-2.5 text-slate-600">{s.branch || '-'}</td>
                            <td className="p-2 text-center">
                              {s.avatar ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                  âœ“ à¸¡à¸µà¸£à¸¹à¸›
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                  à¸­à¸´à¹‚à¸¡à¸ˆà¸´
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importData.length > 50 && (
                      <div className="p-2 text-center text-[11px] text-slate-500 bg-slate-50 border-t border-slate-100">
                        à¹à¸ªà¸”à¸‡à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡ 50 à¸£à¸²à¸¢à¸à¸²à¸£à¹à¸£à¸ à¸ˆà¸²à¸à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” {importData.length} à¸£à¸²à¸¢à¸à¸²à¸£
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleImportSubmit}
                    disabled={importMutation.isPending || isMatchingPhotos}
                    className="btn btn-primary w-full py-3 text-sm font-bold shadow-md shadow-indigo-500/20"
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> à¸à¸³à¸¥à¸±à¸‡à¸™à¸³à¹€à¸‚à¹‰à¸²à¸‚à¹‰à¸­à¸¡à¸¹à¸¥...
                      </>
                    ) : (
                      `à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸™à¸³à¹€à¸‚à¹‰à¸²à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™ ${importData.length} à¸„à¸™`
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Student Excel Preview & Export Modal */}
      <StudentExcelModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        students={filtered}
        classrooms={classrooms}
        filterClassroomId={filterClassroomId}
        selectedStudentIds={selectedStudents}
      />

    </div>
  );
}
