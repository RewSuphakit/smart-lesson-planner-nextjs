import api from '@/services/api';

export interface Semester {
  id: number;
  name: string;
  term_number: number;
  academic_year: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  curriculum_type: 'pvch' | 'pvs' | 'custom';
  total_weeks: number;
  classroom_count?: number;
  pvch_count?: number;
  pvs_count?: number;
  custom_count?: number;
  timetable_count?: number;
  current_week?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface SemesterDetail extends Semester {
  weeks: Array<{
    week: number;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }>;
  total_students: number;
  classrooms: Array<{
    id: number;
    name: string;
    student_count: number;
  }>;
}

export interface CreateSemesterInput {
  name: string;
  term_number: number;
  academic_year: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  curriculum_type?: 'pvch' | 'pvs' | 'custom';
  total_weeks?: number;
}

export interface UpdateSemesterInput {
  name?: string;
  term_number?: number;
  academic_year?: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  curriculum_type?: 'pvch' | 'pvs' | 'custom';
  total_weeks?: number;
}

export interface CloneSemesterInput {
  target_semester_id: number;
  include_students?: boolean;
  include_timetable?: boolean;
}

export const semesterApi = {
  /**
   * Fetch all semesters for the current authenticated user
   */
  async getSemesters(params?: { academic_year?: string; active_only?: boolean }): Promise<Semester[]> {
    const res = await api.get('/semester', { params });
    return res.data.data || [];
  },

  /**
   * Get single semester details including weeks and classrooms
   */
  async getSemester(id: number): Promise<SemesterDetail> {
    const res = await api.get(`/semester/${id}`);
    return res.data.data;
  },

  /**
   * Create a new semester
   */
  async createSemester(data: CreateSemesterInput): Promise<Semester> {
    const res = await api.post('/semester', data);
    return res.data.data;
  },

  /**
   * Update an existing semester
   */
  async updateSemester(id: number, data: UpdateSemesterInput): Promise<Semester> {
    const res = await api.put(`/semester/${id}`, data);
    return res.data.data;
  },

  /**
   * Delete a semester (cannot delete active semester)
   */
  async deleteSemester(id: number): Promise<{ message: string }> {
    const res = await api.delete(`/semester/${id}`);
    return res.data;
  },

  /**
   * Set a semester as active
   */
  async activateSemester(id: number): Promise<{ data: Semester; message: string }> {
    const res = await api.post(`/semester/${id}/activate`);
    return res.data;
  },

  /**
   * Clone classrooms, students, and timetable to a target semester
   */
  async cloneSemester(sourceId: number, data: CloneSemesterInput): Promise<{ message: string; data?: { cloned_classrooms: number; cloned_students: number; cloned_timetable: number } }> {
    const res = await api.post(`/semester/${sourceId}/clone`, data);
    return res.data;
  },
};

export default semesterApi;
