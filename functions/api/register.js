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

	const name = (body.name || '').trim();
	const email = (body.email || '').trim().toLowerCase();
	const password = (body.password || '').trim();

	if (!name || !email || !password) {
		return jsonResponse(400, { message: 'Nombre, correo y contraseña son obligatorios.' });
	}

	if (password.length < 6) {
		return jsonResponse(400, { message: 'La contraseña debe tener al menos 6 caracteres.' });
	}

	await env.DB.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			password_salt TEXT NOT NULL,
			created_at TEXT NOT NULL
		);
	`);

	const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
	if (existing) {
		return jsonResponse(409, { message: 'Este correo ya está registrado.' });
	}

	const saltBytes = crypto.getRandomValues(new Uint8Array(16));
	const salt = toHex(saltBytes);
	const passwordHash = await hashPassword(password, salt);

	await env.DB.prepare(
		'INSERT INTO users (name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, datetime("now"))'
	)
		.bind(name, email, passwordHash, salt)
		.run();

	return jsonResponse(201, { message: 'Registro exitoso.' });
}
