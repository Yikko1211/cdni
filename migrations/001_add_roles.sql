-- Migración: Agregar roles (admin/teacher/student) al sistema
-- Ejecutar en D1 con: npx wrangler d1 execute prepa_db --file=./migrations/001_add_roles.sql

-- 1) Agregar columna role a users (si no existe)
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student';

-- 2) Tabla de perfiles de maestros
CREATE TABLE IF NOT EXISTS teacher_profiles (
    user_id INTEGER PRIMARY KEY,
    bio TEXT,
    photo_url TEXT,
    office_hours TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3) Tabla de asignaciones maestro ↔ materia ↔ grado/grupo
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    subject_slug TEXT NOT NULL,
    grade INTEGER NOT NULL,
    group_code TEXT,
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    UNIQUE(teacher_id, subject_slug, grade, group_code)
);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher ON teacher_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject ON teacher_subjects(subject_slug, grade, group_code);

-- 4) Tabla de invitaciones para maestros
CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher',
    created_by INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

-- 5) Agregar teacher_id a tasks para saber qué maestro creó la tarea
ALTER TABLE tasks ADD COLUMN teacher_id INTEGER;
