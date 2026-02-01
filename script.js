
// Inicializar animaciones
if (window.AOS) {
	AOS.init({
		duration: 1000, // Duración de la animación en milisegundos
		once: true,     // La animación solo ocurre una vez al bajar
		offset: 100     // Offset (en px) desde el borde inferior original para activar la animación
	});
}

// Efecto Navbar transparente a sólido
window.addEventListener('scroll', function() {
	const header = document.querySelector('header');
	if (window.scrollY > 50) {
		header.style.padding = '0.5rem 5%';
		header.style.backgroundColor = 'rgba(10, 31, 68, 0.95)';
	} else {
		header.style.padding = '1rem 5%';
		header.style.backgroundColor = '#0a1f44';
	}
});

const getCookie = (name) => {
	const part = document.cookie
		.split(';')
		.map((x) => x.trim())
		.find((x) => x.startsWith(`${encodeURIComponent(name)}=`));
	if (!part) return '';
	return decodeURIComponent(part.split('=').slice(1).join('='));
};

const safeLocalGet = (key) => {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
};

const normalizeGrade = (value) => {
	const n = Number.parseInt(String(value ?? '').trim(), 10);
	if (!Number.isFinite(n)) return null;
	if (n < 1 || n > 6) return null;
	return n;
};

const normalizeGroup = (value) => {
	const s = String(value ?? '').trim().toUpperCase();
	if (!['A', 'B', 'C', 'D'].includes(s)) return null;
	return s;
};

const getStoredProfile = () => {
	const grade = normalizeGrade(safeLocalGet('userGrade'));
	const group = normalizeGroup(safeLocalGet('userGroup'));
	return { grade, group };
};

const formatDateTime = (value) => {
	const s = String(value || '').trim();
	if (!s) return '';
	// D1 devuelve strings tipo "2026-02-01 12:34:56".
	const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return s;
	return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
};

// Control de sesión simple
const isAuthenticated = () => {
	const cookieAuth = (getCookie('auth') || '').trim().toLowerCase();
	const authFlag = (safeLocalGet('auth') || '').trim().toLowerCase();
	const hasUser = Boolean(
		(safeLocalGet('userEmail') || '').trim() || (safeLocalGet('userName') || '').trim()
	);
	return authFlag === '1' || authFlag === 'true' || cookieAuth === '1' || hasUser;
};

document.addEventListener('DOMContentLoaded', () => {
	const urls = { home: '/', login: '/login/', aula: '/aula' };
	const authed = isAuthenticated();
	if (authed) {
		document.body.classList.add('is-auth');
	} else {
		document.body.classList.remove('is-auth');
	}

	// Renderizar acciones del header según sesión (evita que se vean botones incorrectos)
	const navActions = document.querySelector('.nav-actions');
	if (navActions) {
		navActions.innerHTML = '';
		if (authed) {
			navActions.insertAdjacentHTML(
				'beforeend',
				`<a class="btn btn-outline btn-aula" href="${urls.aula}">Aula</a>`
			);
			navActions.insertAdjacentHTML(
				'beforeend',
				'<a class="btn btn-outline btn-logout" href="#">Cerrar Sesión</a>'
			);
		} else {
			navActions.insertAdjacentHTML(
				'beforeend',
				`<a class="btn btn-outline btn-login" href="${urls.login}">Iniciar Sesión</a>`
			);
			navActions.insertAdjacentHTML(
				'beforeend',
				`<a class="btn btn-solid btn-register" href="${urls.login}#register">Registrarse</a>`
			);
		}
	}

	// Logout (después de renderizar botones)
	document.querySelectorAll('.btn-logout').forEach((btn) => {
		btn.addEventListener('click', (event) => {
			event.preventDefault();
			try {
				localStorage.removeItem('auth');
				localStorage.removeItem('authBool');
				localStorage.removeItem('userName');
				localStorage.removeItem('userEmail');
				localStorage.removeItem('userGrade');
				localStorage.removeItem('userGroup');
			} catch {
				// ignore
			}
			const expire = 'auth=; Path=/; Max-Age=0; SameSite=Lax';
			document.cookie = expire;
			if (window.location.protocol === 'https:') {
				document.cookie = `${expire}; secure`;
			}
			document.body.classList.remove('is-auth');
			window.location.href = urls.home;
		});
	});

	// Mostrar bienvenida en aula
	const welcomeEl = document.getElementById('welcomeUser');
	if (welcomeEl) {
		const name = (localStorage.getItem('userName') || '').trim();
		const email = (localStorage.getItem('userEmail') || '').trim();
		const { grade, group } = getStoredProfile();
		const label = name || email;
		const extra = (grade && group) ? ` · ${grade}° ${group}` : '';
		welcomeEl.textContent = label ? `Sesión iniciada como: ${label}${extra}` : '';
	}

	// Completar perfil si faltan datos (solo dentro de /aula/*)
	const path = window.location.pathname;
	if (authed && path.startsWith('/aula') && !path.startsWith('/aula/perfil')) {
		const email = (safeLocalGet('userEmail') || '').trim();
		if (!email) {
			window.location.href = '/login/';
			return;
		}
		const { grade, group } = getStoredProfile();
		if (!grade || !group) {
			window.location.href = '/aula/perfil/';
			return;
		}
	}

	// Formulario de perfil (/aula/perfil/)
	const profileForm = document.getElementById('profileForm');
	if (profileForm) {
		const msgEl = document.getElementById('profileMessage');
		const gradeEl = document.getElementById('profileGrade');
		const groupEl = document.getElementById('profileGroup');
		// Prefill desde localStorage si existe
		const stored = getStoredProfile();
		if (gradeEl && stored.grade) gradeEl.value = String(stored.grade);
		if (groupEl && stored.group) groupEl.value = stored.group;

		const setMsg = (text, type) => {
			if (!msgEl) return;
			msgEl.textContent = text;
			msgEl.classList.remove('success', 'error');
			if (type) msgEl.classList.add(type);
		};

		profileForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			setMsg('', null);
			const email = (safeLocalGet('userEmail') || '').trim().toLowerCase();
			const grade = normalizeGrade(gradeEl?.value);
			const group = normalizeGroup(groupEl?.value);
			if (!email) {
				setMsg('No se encontró tu correo. Vuelve a iniciar sesión.', 'error');
				return;
			}
			if (!grade || !group) {
				setMsg('Selecciona tu grado (1 a 6) y grupo (A a D).', 'error');
				return;
			}
			try {
				const res = await fetch('/api/profile', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, grade, group })
				});
				const text = await res.text();
				let data;
				try { data = JSON.parse(text); } catch { data = { message: null, raw: text }; }
				if (!res.ok) {
					setMsg(data?.message || `No se pudo guardar (HTTP ${res.status}).`, 'error');
					return;
				}
				try {
					localStorage.setItem('userGrade', String(grade));
					localStorage.setItem('userGroup', group);
				} catch {
					// ignore
				}
				setMsg('Perfil guardado. Redirigiendo…', 'success');
				setTimeout(() => { window.location.href = '/aula'; }, 250);
			} catch {
				setMsg('Error de conexión. Intenta más tarde.', 'error');
			}
		});
	}

	// Render de materias en /aula/tareas (según grado)
	const tasksContainer = document.getElementById('tasksByClass');
	if (tasksContainer) {
		const { grade } = getStoredProfile();
		const slugify = (text) => String(text)
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/\./g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.replace(/-+/g, '-');
		const subjectsByGrade = {
			1: [
				'CIENCIAS SOCIALES',
				'INGLES 1',
				'ALGEBRA',
				'TALLER DE LECTURA Y REDACCION',
				'TEC. DE LA INFORMACION 1',
				'QUIMICA INORGANICA',
				'ORIENTACION Y TUTORIAS 1',
				'LOGICA',
				'BIOLOGIA 1'
			],
			2: [
				'TALLER DE LECTURA Y REDACCION 2',
				'ORIENTACION Y TUTORIAS 2',
				'GEOMETRIA Y TRIGONOMETRIA',
				'BIOLOGIA 2',
				'TEC. DE LA INFORMACION 2',
				'QUIMICA ORGANICA',
				'HISTORIA UNIVERSAL',
				'METODOLOGIA DE LA INVESTIGACION',
				'INGLES 2'
			],
			3: [
				'LITERATURA',
				'ECOLOGIA',
				'FISICA 1',
				'ETICA',
				'ORIENTACION Y TUTORIAS 3',
				'GEOMETRIA ANALITICA',
				'INGLES 3',
				'HISTORIA DE MEXICO 1',
				'COMUNICACION'
			],
			4: [
				'GEOMETRIA',
				'FISICA 2',
				'HISTORIA DE MEXICO 2',
				'PROBABILIDAD Y ESTADISTICA',
				'ESTRUCTURA DE MEXICO',
				'FILOSOFIA',
				'INGLES 4',
				'CULTURA DIGITAL',
				'ORIENTACION Y TUTORIAS 4'
			],
			5: [
				'ANATOMIA HUMANA',
				'CALCULO DIFERENCIAL',
				'PSICOLOGIA',
				'ORIENTACION Y TUTORIAS 5',
				'SOCIOLOGIA',
				'CONTABILIDAD',
				'INGLES 5',
				'LITERATURA MEXICANA'
			],
			6: [
				'PROYECTOS INTERDISC.',
				'LITERATURA UNIVERSAL',
				'INGLES 6',
				'CALCULO INTEGRAL',
				'ADMINISTRACION',
				'DERECHO',
				'ORIENTACION Y TUTORIAS 6',
				'FISIOLOGIA HUMANA'
			]
		};

		tasksContainer.innerHTML = '';
		const noticeEl = document.getElementById('taskNotice');
		if (!Number.isFinite(grade) || !subjectsByGrade[grade]) {
			if (noticeEl) {
				noticeEl.textContent = 'No se encontró tu grado. Completa tu perfil para ver tus materias.';
			}
		} else {
			if (noticeEl) {
				noticeEl.textContent = `Mostrando materias para ${grade}°.`;
			}
			subjectsByGrade[grade].forEach((subject) => {
				const a = document.createElement('a');
				const slug = slugify(subject);
				a.href = `/aula/tareas/${slug}/`;
				a.className = 'class-btn';
				a.textContent = subject;
				tasksContainer.appendChild(a);
			});
		}
	}

	// Plantilla de materia: /aula/tareas/<slug>/ (rewrite a /aula/tareas/materia/)
	const subjectTitleEl = document.getElementById('subjectTitle');
	if (subjectTitleEl && window.location.pathname.includes('/aula/tareas/')) {
		const parts = window.location.pathname.split('/').filter(Boolean);
		// e.g. ['aula','tareas','ingles-1']
		const slug = parts[2] || '';
		const slugToSubject = {
			// 1ro
			'ciencias-sociales': 'CIENCIAS SOCIALES',
			'ingles-1': 'INGLES 1',
			'algebra': 'ALGEBRA',
			'taller-de-lectura-y-redaccion': 'TALLER DE LECTURA Y REDACCION',
			'tec-de-la-informacion-1': 'TEC. DE LA INFORMACION 1',
			'quimica-inorganica': 'QUIMICA INORGANICA',
			'orientacion-y-tutorias-1': 'ORIENTACION Y TUTORIAS 1',
			'logica': 'LOGICA',
			'biologia-1': 'BIOLOGIA 1',
			// 2do
			'taller-de-lectura-y-redaccion-2': 'TALLER DE LECTURA Y REDACCION 2',
			'orientacion-y-tutorias-2': 'ORIENTACION Y TUTORIAS 2',
			'geometria-y-trigonometria': 'GEOMETRIA Y TRIGONOMETRIA',
			'biologia-2': 'BIOLOGIA 2',
			'tec-de-la-informacion-2': 'TEC. DE LA INFORMACION 2',
			'quimica-organica': 'QUIMICA ORGANICA',
			'historia-universal': 'HISTORIA UNIVERSAL',
			'metodologia-de-la-investigacion': 'METODOLOGIA DE LA INVESTIGACION',
			'ingles-2': 'INGLES 2',
			// 3ro
			'literatura': 'LITERATURA',
			'ecologia': 'ECOLOGIA',
			'fisica-1': 'FISICA 1',
			'etica': 'ETICA',
			'orientacion-y-tutorias-3': 'ORIENTACION Y TUTORIAS 3',
			'geometria-analitica': 'GEOMETRIA ANALITICA',
			'ingles-3': 'INGLES 3',
			'historia-de-mexico-1': 'HISTORIA DE MEXICO 1',
			'comunicacion': 'COMUNICACION',
			// 4to
			'geometria': 'GEOMETRIA',
			'fisica-2': 'FISICA 2',
			'historia-de-mexico-2': 'HISTORIA DE MEXICO 2',
			'probabilidad-y-estadistica': 'PROBABILIDAD Y ESTADISTICA',
			'estructura-de-mexico': 'ESTRUCTURA DE MEXICO',
			'filosofia': 'FILOSOFIA',
			'ingles-4': 'INGLES 4',
			'cultura-digital': 'CULTURA DIGITAL',
			'orientacion-y-tutorias-4': 'ORIENTACION Y TUTORIAS 4',
			// 5to
			'anatomia-humana': 'ANATOMIA HUMANA',
			'calculo-diferencial': 'CALCULO DIFERENCIAL',
			'psicologia': 'PSICOLOGIA',
			'orientacion-y-tutorias-5': 'ORIENTACION Y TUTORIAS 5',
			'sociologia': 'SOCIOLOGIA',
			'contabilidad': 'CONTABILIDAD',
			'ingles-5': 'INGLES 5',
			'literatura-mexicana': 'LITERATURA MEXICANA',
			// 6to
			'proyectos-interdisc': 'PROYECTOS INTERDISC.',
			'literatura-universal': 'LITERATURA UNIVERSAL',
			'ingles-6': 'INGLES 6',
			'calculo-integral': 'CALCULO INTEGRAL',
			'administracion': 'ADMINISTRACION',
			'derecho': 'DERECHO',
			'orientacion-y-tutorias-6': 'ORIENTACION Y TUTORIAS 6',
			'fisiologia-humana': 'FISIOLOGIA HUMANA'
		};

		const subject = slugToSubject[slug] || 'Materia';
		subjectTitleEl.innerHTML = '<i class="fas fa-book" style="margin-right:8px;"></i>' + subject;
		const metaEl = document.getElementById('subjectMeta');
		if (metaEl) {
			metaEl.textContent = slug ? `Código: ${slug}` : '';
		}
		if (subject && subject !== 'Materia') {
			document.title = `${subject} | Aula Virtual`;
		}

		// Cargar tareas reales
		const tasksHost = document.getElementById('subjectTasks');
		const tasksMsg = document.getElementById('tasksMessage');
		const { grade, group } = getStoredProfile();
		const email = (safeLocalGet('userEmail') || '').trim().toLowerCase();

		const setTasksMsg = (text) => {
			if (!tasksMsg) return;
			tasksMsg.textContent = text || '';
		};

		const createBadge = (text, type) => {
			const b = document.createElement('span');
			b.className = `badge ${type}`;
			b.textContent = text;
			return b;
		};

		const renderTasks = (tasks) => {
			if (!tasksHost) return;
			tasksHost.innerHTML = '';
			if (!Array.isArray(tasks) || tasks.length === 0) {
				setTasksMsg('No hay tareas aún para esta materia.');
				return;
			}
			setTasksMsg('');
			tasks.forEach((t) => {
				const item = document.createElement('div');
				item.className = 'task-item';

				const h3 = document.createElement('h3');
				h3.textContent = t.title || 'Tarea';
				item.appendChild(h3);

				if (t.description) {
					const p = document.createElement('p');
					p.textContent = t.description;
					item.appendChild(p);
				}

				const meta = document.createElement('div');
				meta.className = 'task-meta';
				if (t.submitted_at) {
					meta.appendChild(createBadge('Entregado', 'ok'));
					const when = document.createElement('span');
					when.className = 'badge warn';
					when.textContent = `Enviado: ${formatDateTime(t.submitted_at)}`;
					meta.appendChild(when);
				} else {
					meta.appendChild(createBadge('Pendiente', 'warn'));
				}
				item.appendChild(meta);

				if (t.submitted_file_url) {
					const link = document.createElement('a');
					link.href = t.submitted_file_url;
					link.target = '_blank';
					link.rel = 'noopener noreferrer';
					link.textContent = 'Ver enlace entregado';
					link.style.display = 'inline-block';
					link.style.marginTop = '8px';
					item.appendChild(link);
				}

				if (!t.submitted_at) {
					const form = document.createElement('form');
					form.className = 'deliver';

					const ta = document.createElement('textarea');
					ta.placeholder = 'Escribe tu respuesta (opcional)';
					form.appendChild(ta);

					const url = document.createElement('input');
					url.type = 'url';
					url.placeholder = 'Enlace de tu archivo (Drive/OneDrive)';
					form.appendChild(url);

					const btn = document.createElement('button');
					btn.type = 'submit';
					btn.className = 'btn';
					btn.textContent = 'Entregar';
					form.appendChild(btn);

					const small = document.createElement('div');
					small.className = 'task-note';
					small.style.marginTop = '0px';
					form.appendChild(small);

					form.addEventListener('submit', async (e) => {
						e.preventDefault();
						small.textContent = '';
						const answerText = ta.value.trim();
						const fileUrl = url.value.trim();
						if (!email) {
							small.textContent = 'No se encontró tu correo. Vuelve a iniciar sesión.';
							return;
						}
						if (!answerText && !fileUrl) {
							small.textContent = 'Escribe una respuesta o pega un enlace.';
							return;
						}
						btn.disabled = true;
						btn.textContent = 'Enviando...';
						try {
							const res = await fetch('/api/submit', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ taskId: t.id, email, answerText, fileUrl })
							});
							const txt = await res.text();
							let data;
							try { data = JSON.parse(txt); } catch { data = { message: null, raw: txt }; }
							if (!res.ok) {
								small.textContent = data?.message || `No se pudo entregar (HTTP ${res.status}).`;
								return;
							}
							small.textContent = 'Entregado. Actualizando…';
							await loadTasks();
						} catch {
							small.textContent = 'Error de conexión. Intenta más tarde.';
						} finally {
							btn.disabled = false;
							btn.textContent = 'Entregar';
						}
					});

					item.appendChild(form);
				}

				tasksHost.appendChild(item);
			});
		};

		const loadTasks = async () => {
			if (!tasksHost) return;
			if (!slug) {
				setTasksMsg('Materia inválida.');
				return;
			}
			if (!grade) {
				setTasksMsg('Completa tu perfil para ver tus tareas.');
				return;
			}
			setTasksMsg('Cargando tareas…');
			try {
				const qs = new URLSearchParams({
					subject: slug,
					grade: String(grade),
					group: group || '',
					email: email || ''
				});
				const res = await fetch(`/api/tasks?${qs.toString()}`);
				const txt = await res.text();
				let data;
				try { data = JSON.parse(txt); } catch { data = { message: null, raw: txt }; }
				if (!res.ok) {
					setTasksMsg(data?.message || `No se pudieron cargar las tareas (HTTP ${res.status}).`);
					return;
				}
				renderTasks(data?.tasks || []);
			} catch {
				setTasksMsg('Error de conexión cargando tareas.');
			}
		};

		// Disparar carga
		loadTasks();
	}

	// Si estás autenticado, evita volver al login
	if ((path.includes('login.html') || path === '/login' || path.startsWith('/login/')) && isAuthenticated()) {
		window.location.href = urls.aula;
		return;
	}

	// Si estás en aula y no estás autenticado, redirigir al login
	if ((path.includes('/aula') || path.includes('aula.html')) && !isAuthenticated()) {
		window.location.href = urls.login;
	}
});

