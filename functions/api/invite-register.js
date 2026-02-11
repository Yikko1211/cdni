// Registro por invitación (para maestros)
import { jsonResponse, hashPassword, toHex, ensureSchema } from './_helpers.js';

export async function onRequestPost({ request, env }) {
	if (!env.DB) return jsonResponse(500, { message: 'Base de datos no configurada.' });
	await ensureSchema(env.DB);

	let body;
	try { body = await request.json(); } catch { return jsonResponse(400, { message: 'JSON inválido.' }); }

	const token = (body.token || '').trim();
	const name = (body.name || '').trim();
	const password = (body.password || '').trim();

	if (!token) return jsonResponse(400, { message: 'Token de invitación requerido.' });
	if (!name) return jsonResponse(400, { message: 'Nombre requerido.' });
	if (!password || password.length < 6) return jsonResponse(400, { message: 'Contraseña de al menos 6 caracteres requerida.' });

	const inv = await env.DB.prepare(
		`SELECT id, email, role, expires_at, used_at FROM invitations WHERE token = ?`
	).bind(token).first();

	if (!inv) return jsonResponse(404, { message: 'Invitación no encontrada.' });
	if (inv.used_at) return jsonResponse(409, { message: 'Esta invitación ya fue usada.' });
	if (new Date(inv.expires_at) < new Date()) return jsonResponse(410, { message: 'La invitación ha expirado.' });

	// Verificar que no exista ya
	const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(inv.email).first();
	if (existing) return jsonResponse(409, { message: 'Este correo ya tiene cuenta.' });

	const saltBytes = crypto.getRandomValues(new Uint8Array(16));
	const salt = toHex(saltBytes);
	const passwordHash = await hashPassword(password, salt);

	await env.DB.prepare(
		`INSERT INTO users (name, email, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
	).bind(name, inv.email, passwordHash, salt, inv.role).run();

	await env.DB.prepare('UPDATE invitations SET used_at = datetime("now") WHERE id = ?').bind(inv.id).run();

	// Si es teacher, crear perfil vacío
	if (inv.role === 'teacher') {
		const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(inv.email).first();
		if (user) {
			await env.DB.prepare('INSERT OR IGNORE INTO teacher_profiles (user_id) VALUES (?)').bind(user.id).run();
		}
	}

	return jsonResponse(201, {
		message: 'Cuenta creada exitosamente.',
		user: { email: inv.email, role: inv.role, name }
	});
}
