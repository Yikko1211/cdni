// Admin: gestionar maestros, invitaciones, usuarios
import { jsonResponse, hashPassword, toHex, generateToken, ensureSchema, requireRole } from './_helpers.js';

export async function onRequest({ request, env }) {
	try {
	if (!env.DB) return jsonResponse(500, { message: 'Base de datos no configurada.' });
	await ensureSchema(env.DB);

	const url = new URL(request.url);
	const action = url.searchParams.get('action') || '';
	const adminEmail = url.searchParams.get('admin_email') || request.headers.get('x-user-email') || '';

	const { user: admin, error } = await requireRole(env.DB, adminEmail.trim().toLowerCase(), 'admin');
	if (error) return error;

	// GET: listar
	if (request.method === 'GET') {
		if (action === 'teachers') {
			const rows = await env.DB.prepare(
				`SELECT u.id, u.name, u.email, u.role, u.created_at,
				        tp.bio, tp.photo_url, tp.office_hours
				 FROM users u
				 LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
				 WHERE u.role = 'teacher'
				 ORDER BY u.name`
			).all();
			return jsonResponse(200, { teachers: rows?.results || [] });
		}
		if (action === 'students') {
			const rows = await env.DB.prepare(
				`SELECT id, name, email, grade, group_code, created_at FROM users WHERE role = 'student' ORDER BY name`
			).all();
			return jsonResponse(200, { students: rows?.results || [] });
		}
		if (action === 'all_users') {
			const rows = await env.DB.prepare(
				`SELECT id, name, email, role, grade, group_code, created_at FROM users ORDER BY role, name`
			).all();
			return jsonResponse(200, { users: rows?.results || [] });
		}
		if (action === 'invitations') {
			const rows = await env.DB.prepare(
				`SELECT i.id, i.token, i.email, i.role, i.expires_at, i.used_at,
				        i.subject_slug, i.subject_grade, i.subject_group,
				        u.name AS created_by_name
				 FROM invitations i
				 LEFT JOIN users u ON u.id = i.created_by
				 ORDER BY i.id DESC`
			).all();
			return jsonResponse(200, { invitations: rows?.results || [] });
		}
		if (action === 'teacher_subjects') {
			const teacherId = url.searchParams.get('teacher_id');
			if (!teacherId) return jsonResponse(400, { message: 'teacher_id requerido.' });
			const rows = await env.DB.prepare(
				`SELECT id, subject_slug, grade, group_code FROM teacher_subjects WHERE teacher_id = ? ORDER BY grade, subject_slug`
			).bind(Number(teacherId)).all();
			return jsonResponse(200, { subjects: rows?.results || [] });
		}
		return jsonResponse(400, { message: 'Acción no válida. Usa: teachers, students, all_users, invitations, teacher_subjects' });
	}

	// POST: crear
	if (request.method === 'POST') {
		let body;
		try { body = await request.json(); } catch { return jsonResponse(400, { message: 'JSON inválido.' }); }

		if (action === 'invite') {
			const email = (body.email || '').trim().toLowerCase();
			const role = body.role || 'teacher';
			const subjectSlug = (body.subject_slug || '').trim().toLowerCase() || null;
			const subjectGrade = body.subject_grade ? Number(body.subject_grade) : null;
			const subjectGroup = (body.subject_group || '').trim().toUpperCase() || null;
			if (!email) return jsonResponse(400, { message: 'Email requerido.' });
			if (!['teacher', 'admin'].includes(role)) return jsonResponse(400, { message: 'Role inválido.' });
			const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
			if (existing) return jsonResponse(409, { message: 'Este correo ya tiene cuenta.' });
			const token = generateToken();
			const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
			await env.DB.prepare(
				`INSERT INTO invitations (token, email, role, created_by, expires_at, subject_slug, subject_grade, subject_group) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			).bind(token, email, role, admin.id, expiresAt, subjectSlug, subjectGrade, subjectGroup).run();
			return jsonResponse(201, {
				message: 'Invitación creada.',
				invitation: { token, email, role, expires_at: expiresAt, subject_slug: subjectSlug, subject_grade: subjectGrade, subject_group: subjectGroup },
				link: `/login/#invite=${token}`
			});
		}

		if (action === 'assign_subject') {
			const teacherId = Number(body.teacher_id);
			const subjectSlug = (body.subject_slug || '').trim().toLowerCase();
			const grade = Number(body.grade);
			const groupCode = (body.group_code || '').trim().toUpperCase() || null;
			if (!teacherId || !subjectSlug || !grade) return jsonResponse(400, { message: 'teacher_id, subject_slug y grade son requeridos.' });
			await env.DB.prepare(
				`INSERT OR IGNORE INTO teacher_subjects (teacher_id, subject_slug, grade, group_code) VALUES (?, ?, ?, ?)`
			).bind(teacherId, subjectSlug, grade, groupCode).run();
			return jsonResponse(201, { message: 'Materia asignada.' });
		}

		if (action === 'set_role') {
			const userId = Number(body.user_id);
			const newRole = body.role;
			if (!userId) return jsonResponse(400, { message: 'user_id requerido.' });
			if (!['admin', 'teacher', 'student'].includes(newRole)) return jsonResponse(400, { message: 'Role inválido.' });
			if (userId === admin.id) return jsonResponse(400, { message: 'No puedes cambiar tu propio role.' });
			await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(newRole, userId).run();
			// Si es admin, quitar grado y grupo
			if (newRole === 'admin') {
				await env.DB.prepare('UPDATE users SET grade = NULL, group_code = NULL WHERE id = ?').bind(userId).run();
			}
			// Create teacher_profile if promoting to teacher
			if (newRole === 'teacher') {
				await env.DB.prepare(
					`INSERT OR IGNORE INTO teacher_profiles (user_id) VALUES (?)`
				).bind(userId).run();
			}
			return jsonResponse(200, { message: `Role actualizado a "${newRole}".` });
		}

		return jsonResponse(400, { message: 'Acción POST no válida. Usa: invite, assign_subject, set_role' });
	}

	// DELETE
	if (request.method === 'DELETE') {
		if (action === 'remove_subject') {
			const id = Number(url.searchParams.get('id'));
			if (!id) return jsonResponse(400, { message: 'id requerido.' });
			await env.DB.prepare('DELETE FROM teacher_subjects WHERE id = ?').bind(id).run();
			return jsonResponse(200, { message: 'Asignación eliminada.' });
		}
		if (action === 'delete_invitation') {
			const id = Number(url.searchParams.get('id'));
			if (!id) return jsonResponse(400, { message: 'id requerido.' });
			await env.DB.prepare('DELETE FROM invitations WHERE id = ?').bind(id).run();
			return jsonResponse(200, { message: 'Invitación eliminada.' });
		}
		return jsonResponse(400, { message: 'Acción DELETE no válida.' });
	}

	return jsonResponse(405, { message: 'Método no permitido.' });
	} catch (err) {
		return jsonResponse(500, { message: 'Error interno del servidor.', detail: String(err) });
	}
}
