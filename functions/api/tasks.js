export async function onRequest(context) {
	const { request, env } = context;
	const url = new URL(request.url);

	if (request.method !== 'GET') {
		return new Response(JSON.stringify({ message: 'Método no permitido.' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const subject = (url.searchParams.get('subject') || '').trim().toLowerCase();
	const gradeRaw = (url.searchParams.get('grade') || '').trim();
	const groupRaw = (url.searchParams.get('group') || '').trim().toUpperCase();
	const email = (url.searchParams.get('email') || '').trim().toLowerCase();

	const grade = Number.parseInt(gradeRaw, 10);
	const group = groupRaw && ['A', 'B', 'C', 'D'].includes(groupRaw) ? groupRaw : null;

	if (!subject || !/^[a-z0-9-]+$/.test(subject)) {
		return new Response(JSON.stringify({ message: 'Materia inválida.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}
	if (!Number.isFinite(grade) || grade < 1 || grade > 6) {
		return new Response(JSON.stringify({ message: 'Grado inválido.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (!env.DB) {
		return new Response(JSON.stringify({ message: 'Base de datos no configurada (binding DB).' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Schema
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

	// Lazy seed: si no hay tareas para esta materia+grado, insertar 1 de ejemplo
	const existing = await env.DB.prepare(
		`SELECT COUNT(1) AS c FROM tasks WHERE subject_slug = ? AND grade = ? AND (group_code IS NULL OR group_code = ?)`
	)
		.bind(subject, grade, group)
		.first();

	if ((existing?.c ?? 0) === 0) {
		const title = `Actividad 1 (${subject.replace(/-/g, ' ')})`;
		const description =
			'Lee el tema indicado por tu profesor y entrega tu evidencia como enlace (por ejemplo, Google Drive).';
		await env.DB.prepare(
			`INSERT INTO tasks (subject_slug, grade, group_code, title, description, due_date) VALUES (?, ?, ?, ?, ?, ?)`
		)
			.bind(subject, grade, group, title.toUpperCase(), description, null)
			.run();
	}

	// Obtener tareas (para grade y opcionalmente group)
	let rows;
	if (email) {
		rows = await env.DB.prepare(
			`SELECT
				t.id,
				t.subject_slug,
				t.grade,
				t.group_code,
				t.title,
				t.description,
				t.due_date,
				t.created_at,
				s.created_at AS submitted_at,
				s.answer_text AS submitted_text,
				s.file_url AS submitted_file_url
			FROM tasks t
			LEFT JOIN submissions s
				ON s.task_id = t.id AND s.user_email = ?
			WHERE t.subject_slug = ?
				AND t.grade = ?
				AND (t.group_code IS NULL OR t.group_code = ?)
			ORDER BY t.created_at DESC, t.id DESC`
		)
			.bind(email, subject, grade, group)
			.all();
	} else {
		rows = await env.DB.prepare(
			`SELECT id, subject_slug, grade, group_code, title, description, due_date, created_at
			FROM tasks
			WHERE subject_slug = ?
				AND grade = ?
				AND (group_code IS NULL OR group_code = ?)
			ORDER BY created_at DESC, id DESC`
		)
			.bind(subject, grade, group)
			.all();
	}

	return new Response(
		JSON.stringify({
			message: 'OK',
			tasks: rows?.results || [],
			meta: { subject, grade, group }
		}),
		{ headers: { 'Content-Type': 'application/json' } }
	);
}
