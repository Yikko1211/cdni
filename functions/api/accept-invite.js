// Aceptar invitación para un usuario que YA tiene cuenta
import { jsonResponse, ensureSchema } from './_helpers.js';

export async function onRequestPost({ request, env }) {
	if (!env.DB) return jsonResponse(500, { message: 'Base de datos no configurada.' });
	await ensureSchema(env.DB);

	let body;
	try { body = await request.json(); } catch { return jsonResponse(400, { message: 'JSON inválido.' }); }

	const token = (body.token || '').trim();
	const userEmail = (body.email || '').trim().toLowerCase();

	if (!token) return jsonResponse(400, { message: 'Token requerido.' });
	if (!userEmail) return jsonResponse(400, { message: 'Email requerido.' });

	// Buscar invitación
	const inv = await env.DB.prepare(
		`SELECT id, email, role, expires_at, used_at, subject_slug, subject_grade, subject_group FROM invitations WHERE token = ?`
	).bind(token).first();

	if (!inv) return jsonResponse(404, { message: 'Invitación no encontrada.' });
	if (inv.used_at) return jsonResponse(409, { message: 'Esta invitación ya fue usada.' });
	if (new Date(inv.expires_at) < new Date()) return jsonResponse(410, { message: 'La invitación ha expirado.' });

	// La invitación puede ser para un email específico — verificar coincidencia
	if (inv.email !== userEmail) {
		return jsonResponse(403, { message: `Esta invitación es para ${inv.email}, no para ${userEmail}.` });
	}

	// Buscar usuario existente
	const user = await env.DB.prepare('SELECT id, name, email, role FROM users WHERE email = ?').bind(userEmail).first();
	if (!user) return jsonResponse(404, { message: 'No se encontró tu cuenta. Regístrate primero.' });

	// Actualizar rol
	await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(inv.role, user.id).run();

	// Marcar invitación como usada
	await env.DB.prepare('UPDATE invitations SET used_at = datetime("now") WHERE id = ?').bind(inv.id).run();

	// Si el nuevo rol es teacher, crear perfil y asignar materia
	if (inv.role === 'teacher') {
		await env.DB.prepare('INSERT OR IGNORE INTO teacher_profiles (user_id) VALUES (?)').bind(user.id).run();
		if (inv.subject_slug && inv.subject_grade) {
			await env.DB.prepare(
				'INSERT OR IGNORE INTO teacher_subjects (teacher_id, subject_slug, grade, group_code) VALUES (?, ?, ?, ?)'
			).bind(user.id, inv.subject_slug, inv.subject_grade, inv.subject_group || null).run();
		}
	}

	return jsonResponse(200, {
		message: `¡Listo! Tu cuenta ahora tiene el rol de "${inv.role}".`,
		user: { id: user.id, name: user.name, email: user.email, role: inv.role }
	});
}
