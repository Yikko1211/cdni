// Helpers compartidos para los API endpoints
const encoder = new TextEncoder();

export const jsonResponse = (status, payload) => new Response(JSON.stringify(payload), {
	status,
	headers: { 'Content-Type': 'application/json' }
});

export const toHex = (buffer) => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');

export const hashPassword = async (password, salt) => {
	const data = encoder.encode(`${salt}:${password}`);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return toHex(digest);
};

export const generateToken = () => {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return toHex(bytes);
};

// Migración suave: agrega columnas si no existen (no falla si ya están)
export const ensureSchema = async (DB) => {
	await DB.prepare(
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			password_salt TEXT NOT NULL,
			grade INTEGER,
			group_code TEXT,
			role TEXT NOT NULL DEFAULT 'student',
			created_at TEXT NOT NULL
		)`
	).run();
	try { await DB.prepare('ALTER TABLE users ADD COLUMN grade INTEGER').run(); } catch {}
	try { await DB.prepare('ALTER TABLE users ADD COLUMN group_code TEXT').run(); } catch {}
	try { await DB.prepare('ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT \'student\'').run(); } catch {}

	await DB.exec(`
		CREATE TABLE IF NOT EXISTS teacher_profiles (
			user_id INTEGER PRIMARY KEY,
			bio TEXT,
			photo_url TEXT,
			office_hours TEXT,
			FOREIGN KEY (user_id) REFERENCES users(id)
		);
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
		CREATE TABLE IF NOT EXISTS invitations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			token TEXT NOT NULL UNIQUE,
			email TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'teacher',
			created_by INTEGER NOT NULL,
			expires_at TEXT NOT NULL,
			used_at TEXT,
			subject_slug TEXT,
			subject_grade INTEGER,
			subject_group TEXT,
			FOREIGN KEY (created_by) REFERENCES users(id)
		);
		CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
	`);
	try { await DB.prepare('ALTER TABLE tasks ADD COLUMN teacher_id INTEGER').run(); } catch {}
	try { await DB.prepare('ALTER TABLE invitations ADD COLUMN subject_slug TEXT').run(); } catch {}
	try { await DB.prepare('ALTER TABLE invitations ADD COLUMN subject_grade INTEGER').run(); } catch {}
	try { await DB.prepare('ALTER TABLE invitations ADD COLUMN subject_group TEXT').run(); } catch {}
};

// Verifica que el usuario autenticado tenga el role esperado
// Retorna { user, error } — si error, devuélvelo como Response
export const requireRole = async (DB, email, roles) => {
	if (!email) return { user: null, error: jsonResponse(401, { message: 'No autenticado.' }) };
	const user = await DB.prepare('SELECT id, name, email, role, grade, group_code FROM users WHERE email = ?')
		.bind(email)
		.first();
	if (!user) return { user: null, error: jsonResponse(401, { message: 'Usuario no encontrado.' }) };
	const allowed = Array.isArray(roles) ? roles : [roles];
	if (!allowed.includes(user.role)) {
		return { user: null, error: jsonResponse(403, { message: 'No tienes permiso para esta acción.' }) };
	}
	return { user, error: null };
};
