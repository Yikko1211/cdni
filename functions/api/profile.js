const jsonResponse = (status, payload) => new Response(JSON.stringify(payload), {
	status,
	headers: {
		'Content-Type': 'application/json'
	}
});

const parseGrade = (value) => {
	const raw = String(value ?? '').trim();
	const n = Number.parseInt(raw.replace(/[^0-9]/g, ''), 10);
	if (!Number.isFinite(n)) return { raw, grade: null };
	return { raw, grade: n };
};

const parseGroup = (value) => String(value ?? '').trim().toUpperCase();

export async function onRequestPost({ request, env }) {
	if (!env.DB) {
		return jsonResponse(500, { message: 'Falta la base de datos D1 (binding DB).' });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return jsonResponse(400, { message: 'JSON inválido.' });
	}

	const email = String(body.email ?? '').trim().toLowerCase();
	const { raw: gradeRaw, grade } = parseGrade(body.grade);
	const group = parseGroup(body.group);

	if (!email) {
		return jsonResponse(400, { message: 'Correo (email) es obligatorio.' });
	}

	if (!Number.isFinite(grade) || grade < 1 || grade > 6) {
		return jsonResponse(400, { message: `Grado inválido. Debe ser del 1 al 6. (recibido: ${gradeRaw || 'vacío'})` });
	}

	if (!['A', 'B', 'C', 'D'].includes(group)) {
		return jsonResponse(400, { message: 'Grupo inválido. Debe ser A, B, C o D.' });
	}

	try {
		// Asegurar tabla y columnas
		await env.DB.prepare(
			`CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				email TEXT NOT NULL UNIQUE,
				password_hash TEXT NOT NULL,
				password_salt TEXT NOT NULL,
				grade INTEGER,
				group_code TEXT,
				created_at TEXT NOT NULL
			)`
		).run();

		try { await env.DB.prepare('ALTER TABLE users ADD COLUMN grade INTEGER').run(); } catch {}
		try { await env.DB.prepare('ALTER TABLE users ADD COLUMN group_code TEXT').run(); } catch {}

		const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
		if (!existing) {
			return jsonResponse(404, { message: 'Usuario no encontrado.' });
		}

		await env.DB.prepare('UPDATE users SET grade = ?, group_code = ? WHERE email = ?')
			.bind(grade, group, email)
			.run();

		return jsonResponse(200, {
			message: 'Perfil actualizado.',
			user: { email, grade, group }
		});
	} catch (error) {
		return jsonResponse(500, { message: 'Error interno al actualizar perfil.', detail: String(error) });
	}
}
