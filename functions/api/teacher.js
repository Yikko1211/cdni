// Teacher: crear tareas, ver entregas, calificar
import { jsonResponse, ensureSchema, requireRole } from '../_helpers.js';

export async function onRequest({ request, env }) {
	if (!env.DB) return jsonResponse(500, { message: 'Base de datos no configurada.' });
	await ensureSchema(env.DB);

	const url = new URL(request.url);
	const action = url.searchParams.get('action') || '';
	const teacherEmail = url.searchParams.get('teacher_email') || request.headers.get('x-user-email') || '';

	const { user: teacher, error } = await requireRole(env.DB, teacherEmail.trim().toLowerCase(), ['teacher', 'admin']);
	if (error) return error;

	if (request.method === 'GET') {
		// Mis materias asignadas
		if (action === 'my_subjects') {
			const rows = await env.DB.prepare(
				`SELECT id, subject_slug, grade, group_code FROM teacher_subjects WHERE teacher_id = ? ORDER BY grade, subject_slug`
			).bind(teacher.id).all();
			return jsonResponse(200, { subjects: rows?.results || [] });
		}

		// Mis tareas
		if (action === 'my_tasks') {
			const subjectSlug = url.searchParams.get('subject') || '';
			const grade = Number(url.searchParams.get('grade') || 0);
			let q = `SELECT id, subject_slug, grade, group_code, title, description, due_date, created_at FROM tasks WHERE teacher_id = ?`;
			const binds = [teacher.id];
			if (subjectSlug) { q += ' AND subject_slug = ?'; binds.push(subjectSlug); }
			if (grade) { q += ' AND grade = ?'; binds.push(grade); }
			q += ' ORDER BY created_at DESC';
			const rows = await env.DB.prepare(q).bind(...binds).all();
			return jsonResponse(200, { tasks: rows?.results || [] });
		}

		// Entregas de una tarea
		if (action === 'submissions') {
			const taskId = Number(url.searchParams.get('task_id') || 0);
			if (!taskId) return jsonResponse(400, { message: 'task_id requerido.' });
			// Verificar que la tarea le pertenece
			const task = await env.DB.prepare('SELECT id FROM tasks WHERE id = ? AND teacher_id = ?').bind(taskId, teacher.id).first();
			if (!task && teacher.role !== 'admin') return jsonResponse(403, { message: 'Esta tarea no te pertenece.' });
			const rows = await env.DB.prepare(
				`SELECT s.id, s.user_email, s.answer_text, s.file_url, s.created_at,
				        u.name AS student_name, u.grade AS student_grade, u.group_code AS student_group
				 FROM submissions s
				 LEFT JOIN users u ON LOWER(u.email) = LOWER(s.user_email)
				 WHERE s.task_id = ?
				 ORDER BY s.created_at DESC`
			).bind(taskId).all();
			return jsonResponse(200, { submissions: rows?.results || [] });
		}

		return jsonResponse(400, { message: 'Acción GET no válida. Usa: my_subjects, my_tasks, submissions' });
	}

	if (request.method === 'POST') {
		let body;
		try { body = await request.json(); } catch { return jsonResponse(400, { message: 'JSON inválido.' }); }

		// Crear tarea
		if (action === 'create_task') {
			const subjectSlug = (body.subject_slug || '').trim().toLowerCase();
			const grade = Number(body.grade);
			const groupCode = (body.group_code || '').trim().toUpperCase() || null;
			const title = (body.title || '').trim();
			const description = (body.description || '').trim();
			const dueDate = (body.due_date || '').trim() || null;

			if (!subjectSlug || !grade || !title) {
				return jsonResponse(400, { message: 'subject_slug, grade y title son obligatorios.' });
			}

			// Verificar que el maestro tiene asignada esa materia (o es admin)
			if (teacher.role !== 'admin') {
				const assigned = await env.DB.prepare(
					`SELECT id FROM teacher_subjects WHERE teacher_id = ? AND subject_slug = ? AND grade = ? AND (group_code IS NULL OR group_code = ?)`
				).bind(teacher.id, subjectSlug, grade, groupCode).first();
				if (!assigned) return jsonResponse(403, { message: 'No tienes asignada esta materia/grado.' });
			}

			await env.DB.prepare(
				`INSERT INTO tasks (subject_slug, grade, group_code, title, description, due_date, teacher_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
			).bind(subjectSlug, grade, groupCode, title, description || null, dueDate, teacher.id).run();

			return jsonResponse(201, { message: 'Tarea creada.' });
		}

		// Eliminar tarea
		if (action === 'delete_task') {
			const taskId = Number(body.task_id);
			if (!taskId) return jsonResponse(400, { message: 'task_id requerido.' });
			const task = await env.DB.prepare('SELECT id FROM tasks WHERE id = ? AND teacher_id = ?').bind(taskId, teacher.id).first();
			if (!task && teacher.role !== 'admin') return jsonResponse(403, { message: 'No puedes eliminar esta tarea.' });
			await env.DB.prepare('DELETE FROM submissions WHERE task_id = ?').bind(taskId).run();
			await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(taskId).run();
			return jsonResponse(200, { message: 'Tarea eliminada.' });
		}

		return jsonResponse(400, { message: 'Acción POST no válida. Usa: create_task, delete_task' });
	}

	return jsonResponse(405, { message: 'Método no permitido.' });
}
