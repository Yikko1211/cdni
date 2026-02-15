// Anuncios: solo admin puede crear, todos los estudiantes pueden leer
// Soporta archivos adjuntos (imágenes, videos, PDFs) via R2
import { jsonResponse, ensureSchema, requireRole } from './_helpers.js';

const ensureAnnouncementsTable = async (DB) => {
	await DB.prepare(`CREATE TABLE IF NOT EXISTS announcements (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		admin_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		body TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (admin_id) REFERENCES users(id)
	)`).run();
	try { await DB.prepare('CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC)').run(); } catch {}

	await DB.prepare(`CREATE TABLE IF NOT EXISTS announcement_files (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		announcement_id INTEGER NOT NULL,
		file_name TEXT NOT NULL,
		file_key TEXT NOT NULL,
		file_type TEXT NOT NULL,
		file_size INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (announcement_id) REFERENCES announcements(id)
	)`).run();
	try { await DB.prepare('CREATE INDEX IF NOT EXISTS idx_ann_files_ann ON announcement_files(announcement_id)').run(); } catch {}
};

// Tipos de archivo permitidos
const ALLOWED_TYPES = {
	'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
	'video/mp4': '.mp4', 'video/webm': '.webm',
	'application/pdf': '.pdf'
};
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function onRequest({ request, env }) {
	if (!env.DB) return jsonResponse(500, { message: 'Base de datos no configurada.' });
	await ensureSchema(env.DB);
	await ensureAnnouncementsTable(env.DB);

	const url = new URL(request.url);
	const action = url.searchParams.get('action') || '';
	const userEmail = (url.searchParams.get('email') || request.headers.get('x-user-email') || '').trim().toLowerCase();

	// ─── GET: leer anuncios o servir archivo ───
	if (request.method === 'GET') {

		// Servir archivo desde R2
		if (action === 'file') {
			const fileKey = url.searchParams.get('key') || '';
			if (!fileKey) return jsonResponse(400, { message: 'key requerido.' });
			if (!env.BUCKET) return jsonResponse(500, { message: 'Almacenamiento no configurado (binding BUCKET).' });

			const object = await env.BUCKET.get(fileKey);
			if (!object) return jsonResponse(404, { message: 'Archivo no encontrado.' });

			const headers = new Headers();
			headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
			headers.set('Cache-Control', 'public, max-age=86400');
			// Para PDFs e imágenes, mostrar inline; para otros, descargar
			const ct = object.httpMetadata?.contentType || '';
			if (ct.startsWith('image/') || ct === 'application/pdf') {
				headers.set('Content-Disposition', 'inline');
			} else {
				const name = fileKey.split('/').pop();
				headers.set('Content-Disposition', `attachment; filename="${name}"`);
			}
			return new Response(object.body, { headers });
		}

		// Listar anuncios (cualquier usuario autenticado)
		if (!userEmail) return jsonResponse(401, { message: 'No autenticado.' });
		const user = await env.DB.prepare('SELECT id, role FROM users WHERE email = ?').bind(userEmail).first();
		if (!user) return jsonResponse(401, { message: 'Usuario no encontrado.' });

		const rows = await env.DB.prepare(
			`SELECT a.*, u.name AS admin_name
			 FROM announcements a
			 LEFT JOIN users u ON u.id = a.admin_id
			 ORDER BY a.created_at DESC
			 LIMIT 100`
		).all();
		const announcements = rows?.results || [];

		// Adjuntar archivos a cada anuncio
		for (const ann of announcements) {
			const files = await env.DB.prepare(
				`SELECT id, file_name, file_key, file_type, file_size FROM announcement_files WHERE announcement_id = ?`
			).bind(ann.id).all();
			ann.files = files?.results || [];
		}

		return jsonResponse(200, { announcements });
	}

	// ─── POST: crear anuncio o subir archivo (solo admin) ───
	if (request.method === 'POST') {
		const { user: admin, error } = await requireRole(env.DB, userEmail, 'admin');
		if (error) return error;

		// Subir archivo a un anuncio existente
		if (action === 'upload') {
			if (!env.BUCKET) return jsonResponse(500, { message: 'Almacenamiento no configurado (binding BUCKET).' });

			const announcementId = Number(url.searchParams.get('announcement_id') || 0);
			if (!announcementId) return jsonResponse(400, { message: 'announcement_id requerido.' });

			// Verificar que el anuncio existe
			const ann = await env.DB.prepare('SELECT id FROM announcements WHERE id = ?').bind(announcementId).first();
			if (!ann) return jsonResponse(404, { message: 'Anuncio no encontrado.' });

			const contentType = request.headers.get('content-type') || '';

			// Si es multipart/form-data
			if (contentType.includes('multipart/form-data')) {
				const formData = await request.formData();
				const file = formData.get('file');
				if (!file || !file.name) return jsonResponse(400, { message: 'No se recibió archivo.' });

				const mimeType = file.type || 'application/octet-stream';
				if (!ALLOWED_TYPES[mimeType]) {
					return jsonResponse(400, { message: `Tipo de archivo no permitido: ${mimeType}. Permitidos: imágenes (JPG, PNG, GIF, WebP), videos (MP4, WebM), PDF.` });
				}
				if (file.size > MAX_FILE_SIZE) {
					return jsonResponse(400, { message: `Archivo demasiado grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024} MB.` });
				}

				const ext = ALLOWED_TYPES[mimeType] || '';
				const fileKey = `anuncios/${announcementId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

				await env.BUCKET.put(fileKey, file.stream(), {
					httpMetadata: { contentType: mimeType }
				});

				await env.DB.prepare(
					`INSERT INTO announcement_files (announcement_id, file_name, file_key, file_type, file_size) VALUES (?, ?, ?, ?, ?)`
				).bind(announcementId, file.name, fileKey, mimeType, file.size).run();

				return jsonResponse(201, { message: 'Archivo subido.', file_key: fileKey });
			}

			return jsonResponse(400, { message: 'Envía el archivo como multipart/form-data.' });
		}

		// Crear anuncio
		if (action === 'create') {
			let body;
			try { body = await request.json(); } catch { return jsonResponse(400, { message: 'JSON inválido.' }); }

			const title = (body.title || '').trim();
			const msgBody = (body.body || '').trim();

			if (!title) return jsonResponse(400, { message: 'El título es obligatorio.' });
			if (!msgBody) return jsonResponse(400, { message: 'El contenido es obligatorio.' });

			const result = await env.DB.prepare(
				`INSERT INTO announcements (admin_id, title, body) VALUES (?, ?, ?)`
			).bind(admin.id, title, msgBody).run();

			return jsonResponse(201, { message: 'Anuncio creado.', announcement_id: result.meta?.last_row_id });
		}

		// Eliminar anuncio
		if (action === 'delete') {
			let body;
			try { body = await request.json(); } catch { return jsonResponse(400, { message: 'JSON inválido.' }); }

			const annId = Number(body.announcement_id);
			if (!annId) return jsonResponse(400, { message: 'announcement_id requerido.' });

			// Eliminar archivos de R2
			if (env.BUCKET) {
				const files = await env.DB.prepare(
					`SELECT file_key FROM announcement_files WHERE announcement_id = ?`
				).bind(annId).all();
				for (const f of (files?.results || [])) {
					try { await env.BUCKET.delete(f.file_key); } catch {}
				}
			}

			await env.DB.prepare('DELETE FROM announcement_files WHERE announcement_id = ?').bind(annId).run();
			await env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(annId).run();

			return jsonResponse(200, { message: 'Anuncio eliminado.' });
		}

		// Eliminar archivo individual
		if (action === 'delete_file') {
			let body;
			try { body = await request.json(); } catch { return jsonResponse(400, { message: 'JSON inválido.' }); }

			const fileId = Number(body.file_id);
			if (!fileId) return jsonResponse(400, { message: 'file_id requerido.' });

			const file = await env.DB.prepare('SELECT file_key FROM announcement_files WHERE id = ?').bind(fileId).first();
			if (file && env.BUCKET) {
				try { await env.BUCKET.delete(file.file_key); } catch {}
			}
			await env.DB.prepare('DELETE FROM announcement_files WHERE id = ?').bind(fileId).run();

			return jsonResponse(200, { message: 'Archivo eliminado.' });
		}

		return jsonResponse(400, { message: 'Acción POST no válida. Usa: create, upload, delete, delete_file.' });
	}

	return jsonResponse(405, { message: 'Método no permitido.' });
}
