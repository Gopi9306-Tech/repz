import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CustomColumn, Student } from '../types';
import { MOCK_STUDENTS } from '../data/mockData';

const LOCAL_STORAGE_STUDENTS_KEY = 'repz_students_cache_';
const LOCAL_STORAGE_COLS_KEY = 'repz_custom_columns_';

// Initial default custom columns
export const DEFAULT_CUSTOM_COLUMNS: CustomColumn[] = [
  { id: 'col-1', name: 'Lab Batch', key: 'lab_batch', dataType: 'text' },
  { id: 'col-2', name: 'Elective Track', key: 'elective_track', dataType: 'text' },
  { id: 'col-3', name: 'Residence', key: 'residence', dataType: 'text' },
];

/**
 * Normalizes initial mock students to include extraData
 */
function getInitialMockStudents(classId: string): Student[] {
  return MOCK_STUDENTS.map((s, idx) => ({
    ...s,
    classId,
    extraData: {
      lab_batch: idx % 2 === 0 ? 'Batch A' : 'Batch B',
      elective_track: idx % 3 === 0 ? 'AI & Machine Learning' : idx % 3 === 1 ? 'Cyber Security' : 'Cloud Computing',
      residence: idx % 4 === 0 ? 'Hostel - Block C' : 'Day Scholar',
    },
  }));
}

export const studentService = {
  /**
   * Fetch custom columns for a class
   */
  async getCustomColumns(classId: string): Promise<CustomColumn[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('class_custom_columns')
          .select('*')
          .eq('class_id', classId)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            name: d.name,
            key: d.key,
            dataType: d.data_type,
            options: d.options || [],
          }));
        }
      } catch (err) {
        console.warn('Error fetching custom columns from Supabase, using cached/default:', err);
      }
    }

    // LocalStorage fallback
    const saved = localStorage.getItem(LOCAL_STORAGE_COLS_KEY + classId);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }

    localStorage.setItem(LOCAL_STORAGE_COLS_KEY + classId, JSON.stringify(DEFAULT_CUSTOM_COLUMNS));
    return DEFAULT_CUSTOM_COLUMNS;
  },

  /**
   * Save a new custom column
   */
  async addCustomColumn(classId: string, col: Omit<CustomColumn, 'id'>): Promise<CustomColumn> {
    const newCol: CustomColumn = {
      id: `col-${Date.now()}`,
      ...col,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('class_custom_columns')
          .insert({
            class_id: classId,
            name: col.name,
            key: col.key,
            data_type: col.dataType,
            options: col.options || [],
          })
          .select()
          .single();

        if (!error && data) {
          newCol.id = data.id;
        }
      } catch (err) {
        console.warn('Supabase addCustomColumn error, saving locally:', err);
      }
    }

    const current = await this.getCustomColumns(classId);
    const updated = [...current, newCol];
    localStorage.setItem(LOCAL_STORAGE_COLS_KEY + classId, JSON.stringify(updated));
    return newCol;
  },

  /**
   * Delete custom column
   */
  async deleteCustomColumn(classId: string, columnKey: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('class_custom_columns')
          .delete()
          .eq('class_id', classId)
          .eq('key', columnKey);
      } catch (err) {
        console.warn('Supabase deleteCustomColumn error:', err);
      }
    }

    const current = await this.getCustomColumns(classId);
    const updated = current.filter((c) => c.key !== columnKey);
    localStorage.setItem(LOCAL_STORAGE_COLS_KEY + classId, JSON.stringify(updated));
  },

  /**
   * Fetch all students for a class
   */
  async getStudents(classId: string): Promise<Student[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('class_id', classId)
          .order('register_number', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            classId: d.class_id,
            registerNumber: d.register_number,
            name: d.name,
            rollNumber: d.roll_number || '',
            email: d.email || '',
            phone: d.phone || '',
            attendancePercentage: 88, // Default baseline for new entries
            classesAttended: 70,
            totalClasses: 80,
            recentStreak: ['present', 'present', 'present', 'present', 'present'],
            extraData: d.extra_data || {},
          }));
        }
      } catch (err) {
        console.warn('Error fetching students from Supabase, loading fallback:', err);
      }
    }

    // Local cache check
    const saved = localStorage.getItem(LOCAL_STORAGE_STUDENTS_KEY + classId);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }

    const initial = getInitialMockStudents(classId);
    localStorage.setItem(LOCAL_STORAGE_STUDENTS_KEY + classId, JSON.stringify(initial));
    return initial;
  },

  /**
   * Add a single student with duplicate register number check
   */
  async addStudent(classId: string, studentData: Omit<Student, 'id'>): Promise<Student> {
    const existing = await this.getStudents(classId);
    const normalizedRegNo = studentData.registerNumber.trim().toUpperCase();

    // Check duplicate register number
    const duplicate = existing.find(
      (s) => s.registerNumber.trim().toUpperCase() === normalizedRegNo
    );
    if (duplicate) {
      throw new Error(
        `Duplicate Register Number: A student named "${duplicate.name}" already has register number "${duplicate.registerNumber}".`
      );
    }

    const newStudent: Student = {
      id: `stu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      classId,
      ...studentData,
      registerNumber: normalizedRegNo,
      attendancePercentage: studentData.attendancePercentage ?? 100,
      classesAttended: studentData.classesAttended ?? 1,
      totalClasses: studentData.totalClasses ?? 1,
      recentStreak: studentData.recentStreak ?? ['present'],
      extraData: studentData.extraData || {},
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('students')
          .insert({
            class_id: classId,
            register_number: normalizedRegNo,
            name: studentData.name.trim(),
            roll_number: studentData.rollNumber?.trim() || '',
            email: studentData.email?.trim() || '',
            phone: studentData.phone?.trim() || '',
            extra_data: studentData.extraData || {},
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error(`Register number "${normalizedRegNo}" is already registered in this class.`);
          }
          throw error;
        }

        if (data) {
          newStudent.id = data.id;
        }
      } catch (err: unknown) {
        console.warn('Supabase addStudent error:', err);
        if (err instanceof Error && err.message.includes('already registered')) {
          throw err;
        }
      }
    }

    const updated = [newStudent, ...existing];
    localStorage.setItem(LOCAL_STORAGE_STUDENTS_KEY + classId, JSON.stringify(updated));
    return newStudent;
  },

  /**
   * Update student information
   */
  async updateStudent(classId: string, studentId: string, updates: Partial<Student>): Promise<Student> {
    const existing = await this.getStudents(classId);
    const target = existing.find((s) => s.id === studentId);
    if (!target) {
      throw new Error('Student record not found.');
    }

    // If register number is changed, ensure no conflict
    if (updates.registerNumber) {
      const normalizedReg = updates.registerNumber.trim().toUpperCase();
      const conflict = existing.find(
        (s) => s.id !== studentId && s.registerNumber.trim().toUpperCase() === normalizedReg
      );
      if (conflict) {
        throw new Error(
          `Duplicate Register Number: "${normalizedReg}" is already assigned to ${conflict.name}.`
        );
      }
    }

    const updatedStudent: Student = {
      ...target,
      ...updates,
      registerNumber: updates.registerNumber ? updates.registerNumber.trim().toUpperCase() : target.registerNumber,
      name: updates.name ? updates.name.trim() : target.name,
      extraData: {
        ...target.extraData,
        ...(updates.extraData || {}),
      },
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('students')
          .update({
            register_number: updatedStudent.registerNumber,
            name: updatedStudent.name,
            roll_number: updatedStudent.rollNumber || '',
            email: updatedStudent.email || '',
            phone: updatedStudent.phone || '',
            extra_data: updatedStudent.extraData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', studentId);

        if (error) throw error;
      } catch (err) {
        console.warn('Supabase updateStudent error:', err);
      }
    }

    const updatedList = existing.map((s) => (s.id === studentId ? updatedStudent : s));
    localStorage.setItem(LOCAL_STORAGE_STUDENTS_KEY + classId, JSON.stringify(updatedList));
    return updatedStudent;
  },

  /**
   * Delete student record
   */
  async deleteStudent(classId: string, studentId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('students').delete().eq('id', studentId);
        if (error) throw error;
      } catch (err) {
        console.warn('Supabase deleteStudent error:', err);
      }
    }

    const existing = await this.getStudents(classId);
    const updated = existing.filter((s) => s.id !== studentId);
    localStorage.setItem(LOCAL_STORAGE_STUDENTS_KEY + classId, JSON.stringify(updated));
  },

  /**
   * Bulk import students (from Excel / CSV) with duplicate check & error reporting
   */
  async bulkImportStudents(
    classId: string,
    importedList: Array<{
      registerNumber: string;
      name: string;
      rollNumber?: string;
      email?: string;
      phone?: string;
      extraData?: Record<string, string | number | boolean | null>;
    }>
  ): Promise<{ added: number; skipped: number; errors: string[] }> {
    const existing = await this.getStudents(classId);
    const existingRegNos = new Set(existing.map((s) => s.registerNumber.trim().toUpperCase()));

    const newlyAdded: Student[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (const item of importedList) {
      const reg = (item.registerNumber || '').trim().toUpperCase();
      const name = (item.name || '').trim();

      if (!reg || !name) {
        errors.push(`Row skipped: Missing Register Number or Name.`);
        skipped++;
        continue;
      }

      if (existingRegNos.has(reg)) {
        errors.push(`Duplicate Register No: "${reg}" already exists. Skipped.`);
        skipped++;
        continue;
      }

      existingRegNos.add(reg);
      const studentObj: Student = {
        id: `stu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        classId,
        registerNumber: reg,
        name,
        rollNumber: item.rollNumber?.trim() || '',
        email: item.email?.trim() || '',
        phone: item.phone?.trim() || '',
        attendancePercentage: 100,
        classesAttended: 1,
        totalClasses: 1,
        recentStreak: ['present'],
        extraData: item.extraData || {},
      };
      newlyAdded.push(studentObj);
    }

    if (newlyAdded.length > 0) {
      if (isSupabaseConfigured && supabase) {
        try {
          const insertPayload = newlyAdded.map((s) => ({
            class_id: classId,
            register_number: s.registerNumber,
            name: s.name,
            roll_number: s.rollNumber || '',
            email: s.email || '',
            phone: s.phone || '',
            extra_data: s.extraData || {},
          }));
          await supabase.from('students').insert(insertPayload);
        } catch (err) {
          console.warn('Supabase bulk insert warning, persisted locally:', err);
        }
      }

      const finalList = [...newlyAdded, ...existing];
      localStorage.setItem(LOCAL_STORAGE_STUDENTS_KEY + classId, JSON.stringify(finalList));
    }

    return {
      added: newlyAdded.length,
      skipped,
      errors,
    };
  },
};
