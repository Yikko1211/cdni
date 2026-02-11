const json = (obj, status = 200) =>
	new Response(JSON.stringify(obj), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

const isValidEmail = (email) =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim().toLowerCase());

const normalizeUrl = (value) => {
	const s = String(value || '').trim();
	if (!s) return '';
	try {
		const u = new URL(s);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
		return u.toString();
	} catch {
		return '';
	}
};

export async function onRequest(context) {
	const { request, env } = context;

	if (request.method !== 'POST') {
		return json({ message: 'Método no permitido.' }, 405);
	}
	if (!env.DB) {
		return json({ message: 'Base de datos no configurada (binding DB).' }, 500);
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'JSON inválido.' }, 400);
	}

	const taskId = Number.parseInt(String(body?.taskId ?? ''), 10);
	const email = String(body?.email || '').trim().toLowerCase();
	const answerText = String(body?.answerText || '').trim();
	const fileUrl = normalizeUrl(body?.fileUrl);

	if (!Number.isFinite(taskId) || taskId <= 0) {
		return json({ message: 'taskId inválido.' }, 400);
	}
	if (!isValidEmail(email)) {
		return json({ message: 'Email inválido.' }, 400);
	}
	if (!answerText && !fileUrl) {
		return json({ message: 'Escribe una respuesta o pega un enlace de archivo.' }, 400);
	}

	// Schema (por si no existe todavía)
	await env.DB.exec(`
		CREATE TABLE IF NOT EXISTS tasks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			subject_slug TEXT NOT NULL,
			grade INTEGER NOT NULL,
			group_code TEXT,
			title TEXT NOT NULL,
			description TEXT,
			due_date TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE INDEX IF NOT EXISTS idx_tasks_lookup ON tasks(subject_slug, grade, group_code);

		CREATE TABLE IF NOT EXISTS submissions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			task_id INTEGER NOT NULL,
			user_email TEXT NOT NULL,
			answer_text TEXT,
			file_url TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			UNIQUE(task_id, user_email)
		);
		CREATE INDEX IF NOT EXISTS idx_submissions_task_user ON submissions(task_id, user_email);
	`);

	// Validar que la tarea exista
	const task = await env.DB.prepare(`SELECT id, due_date FROM tasks WHERE id = ?`).bind(taskId).first();
	if (!task?.id) {
		return json({ message: 'La tarea no existe.' }, 404);
	}

	// Verificar fecha límite
	if (task.due_date) {
		const deadline = new Date(task.due_date);
		if (!isNaN(deadline.getTime()) && new Date() > deadline) {
			return json({ message: 'La fecha y hora límite ya pasó. No se pueden enviar entregas.' }, 403);
		}
	}

	// Upsert: si ya entregó, actualiza; si no, inserta
	await env.DB.prepare(
		`INSERT INTO submissions (task_id, user_email, answer_text, file_url)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(task_id, user_email)
		 DO UPDATE SET answer_text = excluded.answer_text, file_url = excluded.file_url, created_at = datetime('now')`
	)
		.bind(taskId, email, answerText || null, fileUrl || null)
		.run();

	return json({ message: 'Entrega guardada.' });
}
