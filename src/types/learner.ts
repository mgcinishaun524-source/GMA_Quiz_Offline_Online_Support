// Learner, Class, Subject and School Structure Types

export interface Learner {
  id: string; // e.g. "GMA-2026-0301"
  firstName: string;
  lastName: string;
  grade: string;
  classId: string;
  className: string;
  pin: string; // 4-digit PIN for tablet login
  isActive: boolean;
  enrolledDate: string;
  lastActive?: string;
  guardianContact?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  assignedClasses: string[]; // class IDs
  assignedSubjects: string[]; // subject IDs
  role: 'Subject Teacher' | 'Lead Teacher' | 'Head of Department';
  isActive: boolean;
  joinedDate: string;
}

export interface ClassGroup {
  id: string;
  name: string; // e.g. "Grade 3A"
  grade: string; // e.g. "Grade 3"
  classTeacherId: string;
  classTeacherName: string;
  subjectIds: string[];
  learnerCount: number;
  room?: string;
}

export interface Subject {
  id: string;
  name: string; // e.g. "Mathematics", "Integrated Science"
  code: string; // e.g. "MATH-PRI"
  gradeLevels: string[]; // ["Grade 3", "Grade 4", "Grade 5"]
  topicCount: number;
  description?: string;
}
