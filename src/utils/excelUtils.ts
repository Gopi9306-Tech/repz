import * as XLSX from 'xlsx';
import { CustomColumn, Student } from '../types';

export interface ImportPreviewRow {
  rowNumber: number;
  registerNumber: string;
  name: string;
  rollNumber?: string;
  email?: string;
  phone?: string;
  extraData: Record<string, string>;
  isValid: boolean;
  validationError?: string;
}

export interface ParseResult {
  validRows: ImportPreviewRow[];
  invalidRows: ImportPreviewRow[];
  detectedColumns: string[];
  totalRows: number;
}

/**
 * Parses an Excel (.xlsx/.xls) or CSV file into preview rows matching the class schema
 */
export async function parseStudentFile(
  file: File,
  existingCustomCols: CustomColumn[],
  existingRegNos: Set<string>
): Promise<ParseResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error('The uploaded file contains no sheets or data.');
  }

  // Parse to JSON array of objects
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
  });

  if (rawRows.length === 0) {
    throw new Error('The uploaded sheet is empty.');
  }

  const detectedColumns = Object.keys(rawRows[0] || {});

  // Identify column mappings based on common header names
  const findKey = (possibleNames: string[]): string | undefined => {
    return detectedColumns.find((col) =>
      possibleNames.some((p) => col.trim().toLowerCase() === p.toLowerCase())
    );
  };

  const regCol = findKey([
    'register number',
    'reg no',
    'regno',
    'reg_no',
    'register_number',
    'registration number',
    'reg',
  ]);
  const nameCol = findKey(['student name', 'name', 'full name', 'student_name']);
  const rollCol = findKey(['roll number', 'roll no', 'rollno', 'roll_number', 'roll']);
  const emailCol = findKey(['email', 'email address', 'student email']);
  const phoneCol = findKey(['phone', 'phone number', 'contact', 'mobile', 'mobile number']);

  const validRows: ImportPreviewRow[] = [];
  const invalidRows: ImportPreviewRow[] = [];
  const seenInBatch = new Set<string>();

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // considering 1-based index and header row
    const regValue = String(regCol ? row[regCol] : row['Register Number'] || row['Reg No'] || '').trim();
    const nameValue = String(nameCol ? row[nameCol] : row['Name'] || row['Student Name'] || '').trim();
    const rollValue = String(rollCol ? row[rollCol] : row['Roll Number'] || row['Roll No'] || '').trim();
    const emailValue = String(emailCol ? row[emailCol] : row['Email'] || '').trim();
    const phoneValue = String(phoneCol ? row[phoneCol] : row['Phone'] || '').trim();

    // Map remaining columns to extraData
    const extraData: Record<string, string> = {};
    existingCustomCols.forEach((col) => {
      const matchCol = findKey([col.name, col.key]);
      if (matchCol && row[matchCol] !== undefined) {
        extraData[col.key] = String(row[matchCol]).trim();
      }
    });

    let validationError: string | undefined;

    if (!regValue) {
      validationError = 'Missing Register Number';
    } else if (!nameValue) {
      validationError = 'Missing Student Name';
    } else if (existingRegNos.has(regValue.toUpperCase())) {
      validationError = `Register No. "${regValue}" already exists in class`;
    } else if (seenInBatch.has(regValue.toUpperCase())) {
      validationError = `Duplicate Register No. "${regValue}" within this file`;
    }

    const previewRow: ImportPreviewRow = {
      rowNumber,
      registerNumber: regValue.toUpperCase(),
      name: nameValue,
      rollNumber: rollValue,
      email: emailValue,
      phone: phoneValue,
      extraData,
      isValid: !validationError,
      validationError,
    };

    if (previewRow.isValid) {
      seenInBatch.add(regValue.toUpperCase());
      validRows.push(previewRow);
    } else {
      invalidRows.push(previewRow);
    }
  });

  return {
    validRows,
    invalidRows,
    detectedColumns,
    totalRows: rawRows.length,
  };
}

/**
 * Exports current student roster to Excel (.xlsx)
 */
export function exportStudentsToExcel(
  students: Student[],
  customColumns: CustomColumn[],
  className: string
) {
  const exportData = students.map((stu, index) => {
    const row: Record<string, string | number> = {
      'S.No': index + 1,
      'Register Number': stu.registerNumber,
      'Student Name': stu.name,
      'Roll Number': stu.rollNumber || '',
      Email: stu.email || '',
      Phone: stu.phone || '',
      'Attendance %': `${stu.attendancePercentage || 0}%`,
      'Classes Attended': stu.classesAttended || 0,
      'Total Classes': stu.totalClasses || 0,
    };

    // Append dynamic custom columns
    customColumns.forEach((col) => {
      row[col.name] = (stu.extraData?.[col.key] as string) || '';
    });

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Auto-width columns
  const colKeys = Object.keys(exportData[0] || {});
  worksheet['!cols'] = colKeys.map((key) => ({
    wch: Math.max(key.length + 4, 15),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students Roster');

  const cleanClassName = className.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `${cleanClassName}_Students_Roster_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

/**
 * Downloads a sample Excel template for representative imports
 */
export function downloadImportTemplate(customColumns: CustomColumn[]) {
  const sampleHeaders: Record<string, string> = {
    'Register Number': 'REG240101',
    'Student Name': 'Sample Student',
    'Roll Number': '24CS001',
    Email: 'student@college.edu',
    Phone: '+91 98450 00000',
  };

  customColumns.forEach((col) => {
    sampleHeaders[col.name] = `Sample ${col.name}`;
  });

  const ws = XLSX.utils.json_to_sheet([sampleHeaders]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Roster Template');

  XLSX.writeFile(wb, 'Repz_Student_Import_Template.xlsx');
}
