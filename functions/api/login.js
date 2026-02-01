const encoder = new TextEncoder();

const jsonResponse = (status, payload) => new Response(JSON.stringify(payload), {
	status,
	headers: {
		'Content-Type': 'application/json'
	}
});

const toHex = (buffer) => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');

const hashPassword = async (password, salt) => {
	const data = encoder.encode(`${salt}:${password}`);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return toHex(digest);
};

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

	const email = (body.email || '').trim().toLowerCase();
	const password = (body.password || '').trim();

	if (!email || !password) {
		return jsonResponse(400, { message: 'Correo y contraseña son obligatorios.' });
	}

	try {
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

		// Migración suave para instalaciones existentes
		try { await env.DB.prepare('ALTER TABLE users ADD COLUMN grade INTEGER').run(); } catch {}
		try { await env.DB.prepare('ALTER TABLE users ADD COLUMN group_code TEXT').run(); } catch {}

		const user = await env.DB.prepare('SELECT id, name, email, password_hash, password_salt, grade, group_code FROM users WHERE email = ?')
			.bind(email)
			.first();

		if (!user) {
			return jsonResponse(401, { message: 'Credenciales inválidas.' });
		}

		const passwordHash = await hashPassword(password, user.password_salt);
		if (passwordHash !== user.password_hash) {
			return jsonResponse(401, { message: 'Credenciales inválidas.' });
		}

		return jsonResponse(200, {
			message: 'Inicio de sesión correcto.',
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				grade: user.grade ?? null,
				group: user.group_code ?? null
			}
		});
	} catch (error) {
		return jsonResponse(500, { message: 'Error interno al iniciar sesión.', detail: String(error) });
	}
}
