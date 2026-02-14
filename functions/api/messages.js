// Mensajes: admin y maestros pueden enviar mensajes a estudiantes
import { jsonResponse, ensureSchema, requireRole } from './_helpers.js';

const ensureMessagesTable = async (DB) => {
	await DB.prepare(`CREATE TABLE IF NOT EXISTS messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sender_id INTEGER NOT NULL,
		subject TEXT NOT NULL,
		body TEXT NOT NULL,
		target_type TEXT NOT NULL DEFAULT 'all',
		target_grade INTEGER,
		target_group TEXT,
		target_user_id INTEGER,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (sender_id) REFERENCES users(id)
	)`).run();
	try { await DB.prepare('CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC)').run(); } catch {}
	try { await DB.prepare('CREATE INDEX IF NOT EXISTS idx_messages_target ON messages(target_type, target_grade, target_group)').run(); } catch {}

	await DB.prepare(`CREATE TABLE IF NOT EXISTS message_reads (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		message_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		read_at TEXT NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (message_id) REFERENCES messages(id),
		FOREIGN KEY (user_id) REFERENCES users(id),
		UNIQUE(message_id, user_id)
	)`).run();
};

export async function onRequest({ request, env }) {
	if (!env.DB) return jsonResponse(500, { message: 'Base de datos no configurada.' });
	await ensureSchema(env.DB);
	await ensureMessagesTable(env.DB);

	const url = new URL(request.url);
	const action = url.searchParams.get('action') || '';
	const userEmail = (url.searchParams.get('email') || request.headers.get('x-user-email') || '').trim().toLowerCase();

	if (!userEmail) return jsonResponse(401, { message: 'No autenticado.' });

	// ─── GET: leer mensajes ───
	if (request.method === 'GET') {

		// Obtener usuario autenticado
		const user = await env.DB.prepare('SELECT id, name, email, role, grade, group_code FROM users WHERE email = ?')
			.bind(userEmail).first();
		if (!user) return jsonResponse(401, { message: 'Usuario no encontrado.' });

		// Marcar como leído
		if (action === 'mark_read') {
			const msgId = Number(url.searchParams.get('message_id') || 0);
			if (!msgId) return jsonResponse(400, { message: 'message_id requerido.' });
			await env.DB.prepare(
				`INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)`
			).bind(msgId, user.id).run();
			return jsonResponse(200, { message: 'Marcado como leído.' });
		}

		// Listar mensajes visibles para este usuario
		// Admin/Teacher ven todos los que ellos enviaron + los dirigidos a ellos
		// Estudiantes ven los dirigidos a: all, su grado, su grado+grupo, o directamente a ellos
		let rows;
		if (user.role === 'admin') {
			rows = await env.DB.prepare(
				`SELECT m.*, u.name AS sender_name, u.role AS sender_role,
				        (SELECT COUNT(1) FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?) AS is_read
				 FROM messages m
				 LEFT JOIN users u ON u.id = m.sender_id
				 ORDER BY m.created_at DESC
				 LIMIT 100`
			).bind(user.id).all();
		} else if (user.role === 'teacher') {
			rows = await env.DB.prepare(
				`SELECT m.*, u.name AS sender_name, u.role AS sender_role,
				        (SELECT COUNT(1) FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?) AS is_read
				 FROM messages m
				 LEFT JOIN users u ON u.id = m.sender_id
				 WHERE m.sender_id = ? OR m.target_user_id = ?
				 ORDER BY m.created_at DESC
				 LIMIT 100`
			).bind(user.id, user.id, user.id).all();
		} else {
			// Estudiante: ve mensajes dirigidos a todos, a su grado, a su grado+grupo, o directamente a él
			rows = await env.DB.prepare(
				`SELECT m.*, u.name AS sender_name, u.role AS sender_role,
				        (SELECT COUNT(1) FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?) AS is_read
				 FROM messages m
				 LEFT JOIN users u ON u.id = m.sender_id
				 WHERE m.target_type = 'all'
				    OR (m.target_type = 'grade' AND m.target_grade = ?)
				    OR (m.target_type = 'group' AND m.target_grade = ? AND m.target_group = ?)
				    OR (m.target_type = 'user' AND m.target_user_id = ?)
				 ORDER BY m.created_at DESC
				 LIMIT 100`
			).bind(user.id, user.grade, user.grade, user.group_code, user.id).all();
		}

		return jsonResponse(200, { messages: rows?.results || [] });
	}

	// ─── POST: enviar mensaje (solo admin o teacher) ───
	if (request.method === 'POST') {
		const { user: sender, error } = await requireRole(env.DB, userEmail, ['admin', 'teacher']);
		if (error) return error;

		let body;
		try { body = await request.json(); } catch { return jsonResponse(400, { message: 'JSON inválido.' }); }

		if (action === 'send') {
			const subject = (body.subject || '').trim();
			const msgBody = (body.body || '').trim();
			const targetType = (body.target_type || 'all').trim().toLowerCase();
			const targetGrade = body.target_grade ? Number(body.target_grade) : null;
			const targetGroup = body.target_group ? String(body.target_group).trim().toUpperCase() : null;
			const targetUserId = body.target_user_id ? Number(body.target_user_id) : null;

			if (!subject) return jsonResponse(400, { message: 'El asunto es obligatorio.' });
			if (!msgBody) return jsonResponse(400, { message: 'El cuerpo del mensaje es obligatorio.' });
			if (!['all', 'grade', 'group', 'user'].includes(targetType)) {
				return jsonResponse(400, { message: 'target_type inválido. Usa: all, grade, group, user.' });
			}
			if (targetType === 'grade' && (!targetGrade || targetGrade < 1 || targetGrade > 6)) {
				return jsonResponse(400, { message: 'Grado inválido para target_type=grade.' });
			}
			if (targetType === 'group') {
				if (!targetGrade || targetGrade < 1 || targetGrade > 6) return jsonResponse(400, { message: 'Grado requerido para target_type=group.' });
				if (!targetGroup || !['A', 'B', 'C', 'D'].includes(targetGroup)) return jsonResponse(400, { message: 'Grupo inválido (A-D).' });
			}
			if (targetType === 'user' && !targetUserId) {
				return jsonResponse(400, { message: 'target_user_id requerido para target_type=user.' });
			}

			// Si es maestro, verificar que tiene asignado ese grado/materia (opcional, menos restrictivo para mensajes)
			// Los maestros pueden enviar mensajes a cualquier estudiante de sus grados asignados
			if (sender.role === 'teacher' && targetType !== 'all') {
				if (targetType === 'grade' || targetType === 'group') {
					const assigned = await env.DB.prepare(
						`SELECT id FROM teacher_subjects WHERE teacher_id = ? AND grade = ?`
					).bind(sender.id, targetGrade).first();
					if (!assigned) return jsonResponse(403, { message: 'No tienes materias asignadas en ese grado.' });
				}
			}
			// Maestros no pueden enviar a "all" (solo admin)
			if (sender.role === 'teacher' && targetType === 'all') {
				return jsonResponse(403, { message: 'Solo administradores pueden enviar mensajes a todos los estudiantes.' });
			}

			await env.DB.prepare(
				`INSERT INTO messages (sender_id, subject, body, target_type, target_grade, target_group, target_user_id)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			).bind(sender.id, subject, msgBody, targetType, targetGrade, targetGroup, targetUserId).run();

			return jsonResponse(201, { message: 'Mensaje enviado.' });
		}

		// Eliminar mensaje (solo el remitente o admin)
		if (action === 'delete') {
			const msgId = Number(body.message_id);
			if (!msgId) return jsonResponse(400, { message: 'message_id requerido.' });

			const msg = await env.DB.prepare('SELECT id, sender_id FROM messages WHERE id = ?').bind(msgId).first();
			if (!msg) return jsonResponse(404, { message: 'Mensaje no encontrado.' });
			if (sender.role !== 'admin' && msg.sender_id !== sender.id) {
				return jsonResponse(403, { message: 'No puedes eliminar este mensaje.' });
			}

			await env.DB.prepare('DELETE FROM message_reads WHERE message_id = ?').bind(msgId).run();
			await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(msgId).run();
			return jsonResponse(200, { message: 'Mensaje eliminado.' });
		}

		return jsonResponse(400, { message: 'Acción POST no válida. Usa: send, delete.' });
	}

	return jsonResponse(405, { message: 'Método no permitido.' });
}
