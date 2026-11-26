import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownAZ,
  ArrowUpZA,
  Check,
  ChevronRight,
  Columns,
  Download,
  Edit2,
  FileSpreadsheet,
  List,
  Plus,
  RefreshCw,
  Save,
  Search,
  Table as TableIcon,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CustomColumn, Student } from '../types';
import { studentService } from '../services/studentService';
import {
  downloadImportTemplate,
  exportStudentsToExcel,
  ImportPreviewRow,
  parseStudentFile,
} from '../utils/excelUtils';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';

type SortField = 'name' | 'registerNumber' | 'rollNumber' | 'attendancePercentage';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'spreadsheet';

export const StudentDetailsPage: React.FC = () => {
  const { classProfile } = useAuth();
  const classId = classProfile.id;

  // Data states
  const [students, setStudents] = useState<Student[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Search, filter & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('registerNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedColumnFilter] = useState<{
    key: string;
    value: string;
  } | null>(null);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<Student | null>(null);
  const [customColsModalOpen, setCustomColsModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Form states
  const [newStudentData, setNewStudentData] = useState({
    registerNumber: '',
    name: '',
    rollNumber: '',
    email: '',
    phone: '',
    extraData: {} as Record<string, string>,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Custom Column Form
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<CustomColumn['dataType']>('text');

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importValidRows, setImportValidRows] = useState<ImportPreviewRow[]>([]);
  const [importInvalidRows, setImportInvalidRows] = useState<ImportPreviewRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Spreadsheet inline edits buffer
  const [spreadsheetEdits, setSpreadsheetEdits] = useState<Record<string, Partial<Student>>>({});
  const [isSavingSpreadsheet, setIsSavingSpreadsheet] = useState(false);

  // Load students & columns on mount
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedStudents, fetchedCols] = await Promise.all([
        studentService.getStudents(classId),
        studentService.getCustomColumns(classId),
      ]);
      setStudents(fetchedStudents);
      setCustomColumns(fetchedCols);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [classId]);

  // Derived filtered & sorted list
  const processedStudents = useMemo(() => {
    let result = [...students];

    // Search query: matches Register Number, Name, Roll Number, or any custom column value
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) => {
        const basicMatch =
          s.name.toLowerCase().includes(q) ||
          s.registerNumber.toLowerCase().includes(q) ||
          (s.rollNumber && s.rollNumber.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q));

        if (basicMatch) return true;

        // Custom column values match
        return Object.values(s.extraData || {}).some(
          (val) => val && String(val).toLowerCase().includes(q)
        );
      });
    }

    // Column filter
    if (selectedColumnFilter) {
      result = result.filter(
        (s) =>
          String(s.extraData?.[selectedColumnFilter.key] || '') === selectedColumnFilter.value
      );
    }

    // Sorting
    result.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (sortField === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortField === 'registerNumber') {
        valA = a.registerNumber.toLowerCase();
        valB = b.registerNumber.toLowerCase();
      } else if (sortField === 'rollNumber') {
        valA = (a.rollNumber || '').toLowerCase();
        valB = (b.rollNumber || '').toLowerCase();
      } else if (sortField === 'attendancePercentage') {
        valA = a.attendancePercentage || 0;
        valB = b.attendancePercentage || 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [students, searchQuery, sortField, sortOrder, selectedColumnFilter]);

  // Handle Add Student
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const reg = newStudentData.registerNumber.trim().toUpperCase();
    const name = newStudentData.name.trim();

    if (!reg) {
      setFormError('Register Number is required.');
      return;
    }
    if (!name) {
      setFormError('Student Name is required.');
      return;
    }

    // Duplicate check
    const duplicate = students.find((s) => s.registerNumber.trim().toUpperCase() === reg);
    if (duplicate) {
      setFormError(
        `Duplicate Register Number: A student named "${duplicate.name}" already has register number "${reg}".`
      );
      return;
    }

    try {
      const added = await studentService.addStudent(classId, {
        registerNumber: reg,
        name,
        rollNumber: newStudentData.rollNumber.trim().toUpperCase(),
        email: newStudentData.email.trim(),
        phone: newStudentData.phone.trim(),
        extraData: newStudentData.extraData,
      });

      setStudents((prev) => [added, ...prev]);
      setAddModalOpen(false);
      setNewStudentData({
        registerNumber: '',
        name: '',
        rollNumber: '',
        email: '',
        phone: '',
        extraData: {},
      });
      setToastMsg(`Student "${added.name}" added successfully.`);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save student.');
    }
  };

  // Handle Edit Student
  const handleEditStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent) return;
    setFormError(null);

    const reg = editStudent.registerNumber.trim().toUpperCase();
    const name = editStudent.name.trim();

    if (!reg || !name) {
      setFormError('Register Number and Name cannot be empty.');
      return;
    }

    // Duplicate check
    const duplicate = students.find(
      (s) => s.id !== editStudent.id && s.registerNumber.trim().toUpperCase() === reg
    );
    if (duplicate) {
      setFormError(
        `Duplicate Register Number: "${reg}" is already assigned to ${duplicate.name}.`
      );
      return;
    }

    try {
      const updated = await studentService.updateStudent(classId, editStudent.id, {
        registerNumber: reg,
        name,
        rollNumber: (editStudent.rollNumber || '').trim().toUpperCase(),
        email: (editStudent.email || '').trim(),
        phone: (editStudent.phone || '').trim(),
        extraData: editStudent.extraData,
      });

      setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditStudent(null);
      setToastMsg(`Updated details for "${updated.name}".`);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to update student.');
    }
  };

  // Handle Delete Student
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmStudent) return;
    try {
      await studentService.deleteStudent(classId, deleteConfirmStudent.id);
      setStudents((prev) => prev.filter((s) => s.id !== deleteConfirmStudent.id));
      setToastMsg(`Deleted student record for "${deleteConfirmStudent.name}".`);
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to delete student.');
    } finally {
      setDeleteConfirmStudent(null);
      if (viewStudent?.id === deleteConfirmStudent.id) {
        setViewStudent(null);
      }
    }
  };

  // Handle Add Custom Column
  const handleAddCustomColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;

    const key = newColName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (customColumns.some((c) => c.key === key)) {
      setToastMsg('A column with this name or key already exists.');
      return;
    }

    try {
      const created = await studentService.addCustomColumn(classId, {
        name: newColName.trim(),
        key,
        dataType: newColType,
      });
      setCustomColumns((prev) => [...prev, created]);
      setNewColName('');
      setToastMsg(`Added custom column "${created.name}".`);
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to add custom column.');
    }
  };

  // Handle Delete Custom Column
  const handleDeleteCustomColumn = async (colKey: string, colName: string) => {
    try {
      await studentService.deleteCustomColumn(classId, colKey);
      setCustomColumns((prev) => prev.filter((c) => c.key !== colKey));
      setToastMsg(`Removed column "${colName}".`);
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to delete column.');
    }
  };

  // Handle File Upload for Import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportParsing(true);
    setImportValidRows([]);
    setImportInvalidRows([]);

    try {
      const existingRegs = new Set(students.map((s) => s.registerNumber.toUpperCase()));
      const res = await parseStudentFile(file, customColumns, existingRegs);
      setImportValidRows(res.validRows);
      setImportInvalidRows(res.invalidRows);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error reading file.');
    } finally {
      setImportParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (importValidRows.length === 0) return;
    setIsImporting(true);

    try {
      const payload = importValidRows.map((r) => ({
        registerNumber: r.registerNumber,
        name: r.name,
        rollNumber: r.rollNumber,
        email: r.email,
        phone: r.phone,
        extraData: r.extraData,
      }));

      const res = await studentService.bulkImportStudents(classId, payload);
      await loadData();
      setImportModalOpen(false);
      setImportFile(null);
      setImportValidRows([]);
      setImportInvalidRows([]);
      setToastMsg(
        `Successfully imported ${res.added} students.${res.skipped > 0 ? ` (${res.skipped} skipped/duplicates)` : ''}`
      );
    } catch (err: unknown) {
      setToastMsg(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  // Spreadsheet Cell Edit Buffer
  const handleSpreadsheetCellChange = (
    studentId: string,
    field: string,
    value: string,
    isExtra = false
  ) => {
    setSpreadsheetEdits((prev) => {
      const studentEdits = prev[studentId] || {};
      if (isExtra) {
        return {
          ...prev,
          [studentId]: {
            ...studentEdits,
            extraData: {
              ...(studentEdits.extraData || {}),
              [field]: value,
            },
          },
        };
      } else {
        return {
          ...prev,
          [studentId]: {
            ...studentEdits,
            [field]: value,
          },
        };
      }
    });
  };

  // Save all spreadsheet changes
  const handleSaveSpreadsheet = async () => {
    const editEntries = Object.entries(spreadsheetEdits);
    if (editEntries.length === 0) return;

    setIsSavingSpreadsheet(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const [sId, updates] of editEntries) {
      try {
        await studentService.updateStudent(classId, sId, updates);
        successCount++;
      } catch (err: unknown) {
        errors.push(err instanceof Error ? err.message : 'Error updating row');
      }
    }

    await loadData();
    setSpreadsheetEdits({});
    setIsSavingSpreadsheet(false);

    if (errors.length > 0) {
      setToastMsg(`Saved ${successCount} rows. ${errors.length} failed with duplicates.`);
    } else {
      setToastMsg(`All ${successCount} row modifications saved successfully!`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action & Stats Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF4FC] text-[#0878D1] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Student Directory
              </h2>
              <Badge variant="primary">{students.length} Enrolled</Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {classProfile.classCode} • Shared roster managed by both class representatives
            </p>
          </div>
        </div>

        {/* Action Buttons: Add, Import, Export, Manage Columns, Toggle View */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-full border border-slate-200/80 bg-slate-100/80 p-0.5 dark:border-slate-800 dark:bg-[#0E1621]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="WhatsApp Contact List View"
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-[#0878D1] shadow-xs dark:bg-[#172434] dark:text-[#7CC4FA]'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('spreadsheet')}
              title="Spreadsheet Quick Edit Mode"
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'spreadsheet'
                  ? 'bg-white text-[#0878D1] shadow-xs dark:bg-[#172434] dark:text-[#7CC4FA]'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Spreadsheet</span>
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setCustomColsModalOpen(true)}
            leftIcon={<Columns className="h-3.5 w-3.5 text-[#0878D1]" />}
          >
            Columns ({customColumns.length})
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setImportModalOpen(true)}
            leftIcon={<Upload className="h-3.5 w-3.5 text-[#0878D1]" />}
          >
            Import
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => exportStudentsToExcel(processedStudents, customColumns, classProfile.classCode)}
            leftIcon={<Download className="h-3.5 w-3.5 text-emerald-600" />}
          >
            Export
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setFormError(null);
              setNewStudentData({
                registerNumber: '',
                name: '',
                rollNumber: '',
                email: '',
                phone: '',
                extraData: {},
              });
              setAddModalOpen(true);
            }}
            leftIcon={<UserPlus className="h-3.5 w-3.5" />}
          >
            Add Student
          </Button>
        </div>
      </div>

      {/* WhatsApp Search Bar & Filter Options */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-[#111B27]">
        {/* Rounded WhatsApp-inspired Search Bar */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student by name, register number, roll no, or batch..."
            className="h-10 w-full rounded-full border border-slate-200 bg-slate-50/80 pr-10 pl-10 text-xs text-slate-900 placeholder-slate-400 focus:border-[#0878D1] focus:bg-white focus:ring-2 focus:ring-[#0878D1]/10 focus:outline-none dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-100 dark:placeholder-slate-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute top-2.5 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sort & Quick Filter Pill Drops */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-300">
            <span className="font-medium text-slate-500">Sort:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="bg-transparent font-semibold text-[#0878D1] focus:outline-none dark:text-[#66B8FA]"
            >
              <option value="registerNumber">Register Number</option>
              <option value="name">Student Name</option>
              <option value="rollNumber">Roll Number</option>
              <option value="attendancePercentage">Attendance %</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="text-slate-500 hover:text-[#0878D1] cursor-pointer"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? (
                <ArrowDownAZ className="h-3.5 w-3.5" />
              ) : (
                <ArrowUpZA className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Quick Refresh */}
          <button
            type="button"
            onClick={loadData}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#0878D1] dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#172434] cursor-pointer"
            title="Refresh list from Supabase"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main View: WhatsApp Contact List OR Spreadsheet Quick Edit */}
      {viewMode === 'list' ? (
        /* WHATSAPP-INSPIRED CONTACT LIST */
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>
              Showing {processedStudents.length} of {students.length} Students
            </span>
            <span className="hidden sm:inline">Tap any row to view full details</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {processedStudents.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No students found
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Try adjusting your search query or add a new student.
                </p>
              </div>
            ) : (
              processedStudents.map((stu) => {
                const isBelow75 = (stu.attendancePercentage || 0) < 75;
                return (
                  <div
                    key={stu.id}
                    onClick={() => setViewStudent(stu)}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50/90 sm:px-5 dark:hover:bg-[#172434]/60 cursor-pointer"
                  >
                    {/* Left: Avatar + Names & Register Numbers */}
                    <div className="flex min-w-0 items-center gap-3.5">
                      <Avatar
                        name={stu.name}
                        size="md"
                        variant={isBelow75 ? 'absent' : 'tint'}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {stu.name}
                          </p>
                          {stu.rollNumber && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {stu.rollNumber}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono font-medium text-[#0878D1] dark:text-[#66B8FA]">
                            {stu.registerNumber}
                          </span>
                          {/* Extra data tags */}
                          {customColumns.slice(0, 2).map((col) => {
                            const val = stu.extraData?.[col.key];
                            if (!val) return null;
                            return (
                              <span
                                key={col.id}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {col.name}: <strong>{String(val)}</strong>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Right: Attendance percentage & Quick action buttons */}
                    <div
                      className="flex shrink-0 items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Badge variant={isBelow75 ? 'absent' : 'primary'}>
                        {stu.attendancePercentage || 0}%
                      </Badge>

                      <button
                        type="button"
                        onClick={() => {
                          setFormError(null);
                          setEditStudent(stu);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-[#0878D1] dark:hover:bg-slate-800 dark:hover:text-[#66B8FA] cursor-pointer"
                        title="Edit Student Information"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmStudent(stu)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 cursor-pointer"
                        title="Delete Student Record"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      ) : (
        /* SPREADSHEET-STYLE QUICK EDITING INTERFACE */
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-[#0E1621]">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <FileSpreadsheet className="h-4 w-4 text-[#0878D1]" />
              <span>Spreadsheet Mode — Edit cells directly and save batch</span>
              {Object.keys(spreadsheetEdits).length > 0 && (
                <Badge variant="warning">
                  {Object.keys(spreadsheetEdits).length} Unsaved Rows
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {Object.keys(spreadsheetEdits).length > 0 && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSaveSpreadsheet}
                  disabled={isSavingSpreadsheet}
                  leftIcon={<Save className="h-3.5 w-3.5" />}
                >
                  {isSavingSpreadsheet ? 'Saving...' : 'Save All Changes'}
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-slate-600 uppercase tracking-wider dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3 w-12 text-center">#</th>
                  <th className="px-3 py-3 min-w-[140px]">Register Number *</th>
                  <th className="px-3 py-3 min-w-[160px]">Student Name *</th>
                  <th className="px-3 py-3 min-w-[110px]">Roll No</th>
                  <th className="px-3 py-3 min-w-[180px]">Email</th>
                  <th className="px-3 py-3 min-w-[130px]">Phone</th>
                  {customColumns.map((col) => (
                    <th key={col.id} className="px-3 py-3 min-w-[140px]">
                      {col.name}
                    </th>
                  ))}
                  <th className="px-3 py-3 w-20 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {processedStudents.map((stu, index) => {
                  const studentEdits = spreadsheetEdits[stu.id] || {};
                  const currentReg =
                    studentEdits.registerNumber !== undefined
                      ? studentEdits.registerNumber
                      : stu.registerNumber;
                  const currentName =
                    studentEdits.name !== undefined ? studentEdits.name : stu.name;
                  const currentRoll =
                    studentEdits.rollNumber !== undefined
                      ? studentEdits.rollNumber
                      : stu.rollNumber || '';
                  const currentEmail =
                    studentEdits.email !== undefined ? studentEdits.email : stu.email || '';
                  const currentPhone =
                    studentEdits.phone !== undefined ? studentEdits.phone : stu.phone || '';

                  return (
                    <tr
                      key={stu.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#172434]/40"
                    >
                      <td className="px-3 py-2 text-center font-mono text-slate-400">
                        {index + 1}
                      </td>

                      {/* Register Number */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={currentReg}
                          onChange={(e) =>
                            handleSpreadsheetCellChange(stu.id, 'registerNumber', e.target.value)
                          }
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 font-mono text-xs font-semibold text-slate-900 focus:border-[#0878D1] focus:ring-1 focus:ring-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-100"
                        />
                      </td>

                      {/* Student Name */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={currentName}
                          onChange={(e) =>
                            handleSpreadsheetCellChange(stu.id, 'name', e.target.value)
                          }
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-900 focus:border-[#0878D1] focus:ring-1 focus:ring-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-100"
                        />
                      </td>

                      {/* Roll Number */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={currentRoll}
                          onChange={(e) =>
                            handleSpreadsheetCellChange(stu.id, 'rollNumber', e.target.value)
                          }
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-[#0878D1] focus:ring-1 focus:ring-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-100"
                        />
                      </td>

                      {/* Email */}
                      <td className="px-2 py-1.5">
                        <input
                          type="email"
                          value={currentEmail}
                          onChange={(e) =>
                            handleSpreadsheetCellChange(stu.id, 'email', e.target.value)
                          }
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-[#0878D1] focus:ring-1 focus:ring-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-100"
                        />
                      </td>

                      {/* Phone */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={currentPhone}
                          onChange={(e) =>
                            handleSpreadsheetCellChange(stu.id, 'phone', e.target.value)
                          }
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-[#0878D1] focus:ring-1 focus:ring-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-100"
                        />
                      </td>

                      {/* Dynamic Custom Columns */}
                      {customColumns.map((col) => {
                        const cellVal =
                          studentEdits.extraData?.[col.key] !== undefined
                            ? String(studentEdits.extraData[col.key] || '')
                            : String(stu.extraData?.[col.key] || '');

                        return (
                          <td key={col.id} className="px-2 py-1.5">
                            <input
                              type="text"
                              value={cellVal}
                              onChange={(e) =>
                                handleSpreadsheetCellChange(
                                  stu.id,
                                  col.key,
                                  e.target.value,
                                  true
                                )
                              }
                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-[#0878D1] focus:ring-1 focus:ring-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-200"
                            />
                          </td>
                        );
                      })}

                      {/* Delete Action */}
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmStudent(stu)}
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete row"
                        >
                          <Trash2 className="h-3.5 w-3.5 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD STUDENT MANUALLY                                            */}
      {/* ========================================================================= */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Student Manually"
        subtitle={`Enrolling to class ${classProfile.classCode}`}
      >
        <form onSubmit={handleAddStudentSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Register Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="REG240199"
                value={newStudentData.registerNumber}
                onChange={(e) =>
                  setNewStudentData({
                    ...newStudentData,
                    registerNumber: e.target.value.toUpperCase(),
                  })
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs uppercase focus:border-[#0878D1] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              />
              <span className="text-[10px] text-slate-400">Unique ID per student in class</span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Student Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={newStudentData.name}
                onChange={(e) =>
                  setNewStudentData({ ...newStudentData, name: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Roll Number
              </label>
              <input
                type="text"
                placeholder="24CS099"
                value={newStudentData.rollNumber}
                onChange={(e) =>
                  setNewStudentData({ ...newStudentData, rollNumber: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                College Email
              </label>
              <input
                type="email"
                placeholder="student@college.edu"
                value={newStudentData.email}
                onChange={(e) =>
                  setNewStudentData({ ...newStudentData, email: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+91 98450 00000"
                value={newStudentData.phone}
                onChange={(e) =>
                  setNewStudentData({ ...newStudentData, phone: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              />
            </div>
          </div>

          {/* Dynamic Custom Column Fields */}
          {customColumns.length > 0 && (
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Custom Class Attributes
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {customColumns.map((col) => (
                  <div key={col.id}>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {col.name}
                    </label>
                    <input
                      type="text"
                      placeholder={`Enter ${col.name}...`}
                      value={newStudentData.extraData[col.key] || ''}
                      onChange={(e) =>
                        setNewStudentData({
                          ...newStudentData,
                          extraData: {
                            ...newStudentData.extraData,
                            [col.key]: e.target.value,
                          },
                        })
                      }
                      className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" leftIcon={<UserPlus className="h-4 w-4" />}>
              Add Student
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT STUDENT INFORMATION                                        */}
      {/* ========================================================================= */}
      <Modal
        open={Boolean(editStudent)}
        onClose={() => setEditStudent(null)}
        title="Edit Student Information"
        subtitle={`Updating student details in ${classProfile.classCode}`}
      >
        {editStudent && (
          <form onSubmit={handleEditStudentSubmit} className="space-y-4">
            {formError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Register Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editStudent.registerNumber}
                  onChange={(e) =>
                    setEditStudent({
                      ...editStudent,
                      registerNumber: e.target.value.toUpperCase(),
                    })
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs uppercase focus:border-[#0878D1] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Student Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editStudent.name}
                  onChange={(e) => setEditStudent({ ...editStudent, name: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Roll Number
                </label>
                <input
                  type="text"
                  value={editStudent.rollNumber || ''}
                  onChange={(e) =>
                    setEditStudent({ ...editStudent, rollNumber: e.target.value })
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  value={editStudent.email || ''}
                  onChange={(e) =>
                    setEditStudent({ ...editStudent, email: e.target.value })
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Phone
                </label>
                <input
                  type="tel"
                  value={editStudent.phone || ''}
                  onChange={(e) =>
                    setEditStudent({ ...editStudent, phone: e.target.value })
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
                />
              </div>
            </div>

            {/* Custom columns */}
            {customColumns.length > 0 && (
              <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Custom Class Attributes
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {customColumns.map((col) => (
                    <div key={col.id}>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        {col.name}
                      </label>
                      <input
                        type="text"
                        value={String(editStudent.extraData?.[col.key] || '')}
                        onChange={(e) =>
                          setEditStudent({
                            ...editStudent,
                            extraData: {
                              ...editStudent.extraData,
                              [col.key]: e.target.value,
                            },
                          })
                        }
                        className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditStudent(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW STUDENT DETAILS CARD                                        */}
      {/* ========================================================================= */}
      <Modal
        open={Boolean(viewStudent)}
        onClose={() => setViewStudent(null)}
        title={viewStudent?.name || ''}
        subtitle={viewStudent ? `${viewStudent.registerNumber} • ${classProfile.classCode}` : ''}
      >
        {viewStudent && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-[#0E1621]">
              <div className="flex items-center gap-3">
                <Avatar
                  name={viewStudent.name}
                  size="lg"
                  variant={(viewStudent.attendancePercentage || 0) < 75 ? 'absent' : 'primary'}
                />
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Attendance Average
                  </p>
                  <p className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    {viewStudent.attendancePercentage || 0}%
                  </p>
                </div>
              </div>
              <Badge variant={(viewStudent.attendancePercentage || 0) < 75 ? 'absent' : 'primary'}>
                {viewStudent.classesAttended || 0} / {viewStudent.totalClasses || 0} Sessions
              </Badge>
            </div>

            {/* Core Info */}
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 dark:divide-slate-800 dark:border-slate-800">
              <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="text-slate-500">Register Number</span>
                <span className="font-mono font-bold text-[#0878D1] dark:text-[#66B8FA]">
                  {viewStudent.registerNumber}
                </span>
              </div>
              {viewStudent.rollNumber && (
                <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <span className="text-slate-500">Roll Number</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {viewStudent.rollNumber}
                  </span>
                </div>
              )}
              {viewStudent.email && (
                <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <span className="text-slate-500">Email</span>
                  <span className="text-slate-800 dark:text-slate-200">{viewStudent.email}</span>
                </div>
              )}
              {viewStudent.phone && (
                <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <span className="text-slate-500">Phone</span>
                  <span className="text-slate-800 dark:text-slate-200">{viewStudent.phone}</span>
                </div>
              )}
            </div>

            {/* Custom attributes display */}
            {customColumns.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Custom Attributes
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {customColumns.map((col) => {
                    const val = viewStudent.extraData?.[col.key];
                    return (
                      <div
                        key={col.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-[#0E1621]"
                      >
                        <p className="text-[10px] text-slate-500">{col.name}</p>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {val ? String(val) : '—'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteConfirmStudent(viewStudent)}
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Delete Student
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const stu = viewStudent;
                    setViewStudent(null);
                    setEditStudent(stu);
                  }}
                  leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                >
                  Edit
                </Button>
                <Button size="sm" onClick={() => setViewStudent(null)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION                                              */}
      {/* ========================================================================= */}
      <Modal
        open={Boolean(deleteConfirmStudent)}
        onClose={() => setDeleteConfirmStudent(null)}
        title="Confirm Student Deletion"
        subtitle="This action removes the record from both representatives' views."
      >
        {deleteConfirmStudent && (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Are you sure you want to delete{' '}
              <strong className="text-slate-900 dark:text-white">
                {deleteConfirmStudent.name}
              </strong>{' '}
              ({deleteConfirmStudent.registerNumber})? This student&apos;s records will be removed
              from the class roster.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteConfirmStudent(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm}>
                Yes, Delete Record
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: CUSTOM COLUMNS MANAGER                                          */}
      {/* ========================================================================= */}
      <Modal
        open={customColsModalOpen}
        onClose={() => setCustomColsModalOpen(false)}
        title="Customizable Additional Columns"
        subtitle="Add custom metadata columns like Lab Batch, Hostel, or Elective Track"
      >
        <div className="space-y-4">
          {/* List of active custom columns */}
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 dark:divide-slate-800 dark:border-slate-800">
            {customColumns.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No custom columns added yet.
              </div>
            ) : (
              customColumns.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between p-3 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{col.name}</p>
                    <p className="font-mono text-[10px] text-slate-400">Key: {col.key}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">{col.dataType}</Badge>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomColumn(col.key, col.name)}
                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Remove Column"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add new custom column form */}
          <form
            onSubmit={handleAddCustomColumn}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-[#0E1621] space-y-3"
          >
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Create New Column
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Column Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lab Batch"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#111B27] dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Data Type</label>
                <select
                  value={newColType}
                  onChange={(e) => setNewColType(e.target.value as CustomColumn['dataType'])}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#111B27] dark:text-slate-100"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Yes/No (Boolean)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button size="sm" type="submit" leftIcon={<Plus className="h-3 w-3" />}>
                Add Column
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 6: IMPORT STUDENTS VIA EXCEL / CSV                                 */}
      {/* ========================================================================= */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Students from Excel / CSV"
        subtitle="Automatic duplicate register number prevention & validation"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4">
          {/* File picker */}
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center dark:border-slate-700 dark:bg-[#0E1621]">
            <Upload className="h-8 w-8 text-[#0878D1]" />
            <p className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              Drag &amp; drop student sheet or browse
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Supports .xlsx, .xls, and .csv with Register Number &amp; Student Name
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => downloadImportTemplate(customColumns)}
                leftIcon={<Download className="h-3 w-3" />}
              >
                Download Sample Template
              </Button>
            </div>
            {importFile && (
              <p className="mt-2 text-xs font-medium text-[#0878D1]">
                Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Validation Feedback */}
          {importParsing && (
            <p className="text-center text-xs text-slate-500">Validating spreadsheet rows...</p>
          )}

          {(importValidRows.length > 0 || importInvalidRows.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-700 dark:text-emerald-300">
                  {importValidRows.length} Valid Records Ready to Import
                </span>
                {importInvalidRows.length > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {importInvalidRows.length} Records with Validation Errors
                  </span>
                )}
              </div>

              {/* Invalid Rows Warning Box */}
              {importInvalidRows.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300 space-y-1">
                  <p className="font-bold">Errors in uploaded file (will be skipped):</p>
                  {importInvalidRows.map((inv, idx) => (
                    <p key={idx} className="text-[11px]">
                      Row {inv.rowNumber}: {inv.name || 'Unknown'} — {inv.validationError}
                    </p>
                  ))}
                </div>
              )}

              {/* Valid Rows Preview Table */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 sticky top-0 text-[10px] uppercase text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="p-2">Reg No</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Roll No</th>
                      <th className="p-2">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {importValidRows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-[#172434]/40">
                        <td className="p-2 font-mono font-bold text-[#0878D1]">
                          {r.registerNumber}
                        </td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2 text-slate-500">{r.rollNumber || '—'}</td>
                        <td className="p-2 text-slate-500">{r.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setImportModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importValidRows.length === 0 || isImporting}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  {isImporting
                    ? 'Importing...'
                    : `Import ${importValidRows.length} Students`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Global Toast Message */}
      <Toast message={toastMsg} type="success" onDismiss={() => setToastMsg(null)} />
    </div>
  );
};
