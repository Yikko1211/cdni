(() => {
	const initMobileNav = () => {
		const header = document.querySelector('header');
		if (!header) return;

		document.body.classList.add('js-nav');

		if (header.querySelector('.nav-toggle')) return;
		const toggleBtn = document.createElement('button');
		toggleBtn.type = 'button';
		toggleBtn.className = 'nav-toggle';
		toggleBtn.setAttribute('aria-label', 'Abrir menú');
		toggleBtn.setAttribute('aria-expanded', 'false');
		toggleBtn.innerHTML = '<span class="nav-toggle-icon" aria-hidden="true"></span>';
		header.appendChild(toggleBtn);

		const setHeaderHeightVar = () => {
			const h = Math.ceil(header.getBoundingClientRect().height);
			document.documentElement.style.setProperty('--header-h', `${h}px`);
		};

		const ensureOverlay = () => {
			let overlay = document.querySelector('.mobile-nav-overlay');
			if (overlay) return overlay;
			overlay = document.createElement('div');
			overlay.className = 'mobile-nav-overlay';
			overlay.innerHTML = `
				<div class="mobile-nav-backdrop" aria-hidden="true"></div>
				<div class="mobile-nav-sheet" role="navigation">
					<div class="mobile-nav-links"></div>
					<div class="mobile-nav-actions"></div>
				</div>
			`;
			document.body.appendChild(overlay);
			overlay.addEventListener('click', (event) => {
				if (event.target && event.target.classList?.contains('mobile-nav-backdrop')) {
					closeMenu();
				}
			});
			return overlay;
		};

		const renderOverlay = () => {
			const overlay = ensureOverlay();
			const linksHost = overlay.querySelector('.mobile-nav-links');
			const actionsHost = overlay.querySelector('.mobile-nav-actions');
			if (linksHost) linksHost.innerHTML = '';
			if (actionsHost) actionsHost.innerHTML = '';
			const ul = header.querySelector('nav ul');
			if (ul && linksHost) {
				linksHost.appendChild(ul.cloneNode(true));
				linksHost.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => closeMenu()));
			}

			// En /login, solo mostrar el switch necesario (login <-> register)
			if (actionsHost) {
				const isLoginVisible = Boolean(document.getElementById('loginForm') && !document.getElementById('loginForm').classList.contains('hidden'));
				const link = document.createElement('a');
				link.className = 'btn btn-solid';
				if (isLoginVisible) {
					link.href = '#register';
					link.textContent = 'Registrarse';
				} else {
					link.href = '#login';
					link.textContent = 'Iniciar sesión';
				}
				link.addEventListener('click', () => closeMenu());
				actionsHost.appendChild(link);
			}
		};

		const closeMenu = () => {
			document.body.classList.remove('nav-overlay-open');
			document.body.classList.remove('no-scroll');
			toggleBtn.setAttribute('aria-expanded', 'false');
			toggleBtn.setAttribute('aria-label', 'Abrir menú');
		};

		const openMenu = () => {
			setHeaderHeightVar();
			renderOverlay();
			document.body.classList.add('nav-overlay-open');
			document.body.classList.add('no-scroll');
			toggleBtn.setAttribute('aria-expanded', 'true');
			toggleBtn.setAttribute('aria-label', 'Cerrar menú');
		};

		toggleBtn.addEventListener('click', () => {
			const isOpen = document.body.classList.contains('nav-overlay-open');
			if (isOpen) closeMenu();
			else openMenu();
		});

		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') closeMenu();
		});
		window.addEventListener('resize', () => {
			setHeaderHeightVar();
			if (!window.matchMedia('(max-width: 768px)').matches) closeMenu();
		});
		setHeaderHeightVar();
	};

	// Lógica simple para cambiar entre Login y Registro
	const loginForm = document.getElementById('loginForm');
	const registerForm = document.getElementById('registerForm');
	const overlayLogin = document.getElementById('overlayLogin');
	const overlayRegister = document.getElementById('overlayRegister');

const signUpBtn = document.getElementById('signUpBtn');
const signInBtn = document.getElementById('signInBtn');

const loginFormElement = document.getElementById('loginFormElement');
const registerFormElement = document.getElementById('registerFormElement');

const loginMessage = document.getElementById('loginMessage');
const registerMessage = document.getElementById('registerMessage');

const showRegister = () => {
	loginForm.classList.add('hidden');
	registerForm.classList.remove('hidden');
	overlayLogin.classList.add('hidden');
	overlayRegister.classList.remove('hidden');
};

const showLogin = () => {
	registerForm.classList.add('hidden');
	loginForm.classList.remove('hidden');
	overlayRegister.classList.add('hidden');
	overlayLogin.classList.remove('hidden');
};

// Ir a Registro
signUpBtn.addEventListener('click', showRegister);

// Ir a Login
signInBtn.addEventListener('click', showLogin);

const setViewFromHash = () => {
	const hash = window.location.hash || '';
	if (hash === '#register') showRegister();
	else if (hash.startsWith('#invite=')) showInviteForm(hash.replace('#invite=', ''));
	else showLogin();
};

// Formulario de registro por invitación (maestros)
const showInviteForm = (token) => {
	if (!token) return showLogin();
	loginForm.classList.add('hidden');
	registerForm.classList.add('hidden');
	if (overlayLogin) overlayLogin.classList.add('hidden');
	if (overlayRegister) overlayRegister.classList.add('hidden');

	let invForm = document.getElementById('inviteRegForm');
	if (!invForm) {
		const wrapper = document.querySelector('.login-container') || document.querySelector('.login-wrapper');
		if (!wrapper) return;
		invForm = document.createElement('div');
		invForm.id = 'inviteRegForm';
		invForm.className = 'login-form';
		invForm.innerHTML = `
			<h2>Registro por Invitación</h2>
			<span>Crea tu cuenta de maestro</span>
			<form id="inviteFormEl" style="margin-top:20px;">
				<input type="hidden" id="inviteToken" value="${token}">
				<div class="input-group"><i class="fas fa-user"></i><input id="inviteName" type="text" placeholder="Nombre completo" required></div>
				<div class="input-group"><i class="fas fa-lock"></i><input id="invitePassword" type="password" placeholder="Contraseña (min 6)" required></div>
				<button type="submit">Crear Cuenta</button>
				<div class="form-message" id="inviteMessage"></div>
			</form>
		`;
		wrapper.insertBefore(invForm, wrapper.firstChild);

		document.getElementById('inviteFormEl').addEventListener('submit', async (e) => {
			e.preventDefault();
			const msgEl = document.getElementById('inviteMessage');
			setMessage(msgEl, '', null);
			const name = document.getElementById('inviteName').value.trim();
			const password = document.getElementById('invitePassword').value.trim();
			const tk = document.getElementById('inviteToken').value.trim();
			try {
				const res = await fetch('/api/invite-register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token: tk, name, password })
				});
				const data = await res.json();
				if (!res.ok) { setMessage(msgEl, data?.message || 'Error', 'error'); return; }
				setMessage(msgEl, 'Cuenta creada. Ya puedes iniciar sesión.', 'success');
				setTimeout(() => { window.location.hash = ''; showLogin(); }, 1500);
			} catch { setMessage(msgEl, 'Error de conexión.', 'error'); }
		});
	}
	invForm.classList.remove('hidden');
};

// Soportar link directo a registro/login/invite
window.addEventListener('hashchange', setViewFromHash);
setViewFromHash();

	// Ahora que showLogin/showRegister existen, inicializa el menú móvil
	initMobileNav();

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

const safeLocalSet = (key, value) => {
	try {
		localStorage.setItem(key, value);
	} catch {
		// ignore (storage blocked)
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

const setAuthCookie = () => {
	const base = `auth=1; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
	document.cookie = base;
	if (window.location.protocol === 'https:') {
		document.cookie = `${base}; secure`;
	}
};

// Si ya hay sesión iniciada, redirigir según role
if (safeLocalGet('auth') === '1' || getCookie('auth') === '1') {
	const storedRole = (safeLocalGet('userRole') || '').trim();
	const dest = storedRole === 'admin' ? '/admin/' : storedRole === 'teacher' ? '/maestro/' : '/aula';
	window.location.href = dest;
}

const setMessage = (el, text, type) => {
	el.textContent = text;
	el.classList.remove('success', 'error');
	if (type) el.classList.add(type);
};

const setMessageLink = (el, prefixText, href, linkText, type) => {
	// Evita innerHTML; construye nodos para link clickeable
	while (el.firstChild) el.removeChild(el.firstChild);
	el.classList.remove('success', 'error');
	if (type) el.classList.add(type);
	if (prefixText) el.appendChild(document.createTextNode(prefixText));
	const a = document.createElement('a');
	a.href = href;
	a.textContent = linkText;
	a.style.textDecoration = 'underline';
	a.style.marginLeft = '4px';
	el.appendChild(a);
};

const readJsonSafe = async (response) => {
	const text = await response.text();
	try {
		return JSON.parse(text);
	} catch {
		return { message: null, raw: text };
	}
};

const hintIfMissingApi = () => {
	// Si abres el sitio como archivos estáticos (file:// o servidor simple), no existe /api/*
	if (window.location.protocol === 'file:') {
		return ' (Tip: /api/* solo funciona en Cloudflare Pages Functions o con wrangler pages dev)';
	}
	// En localhost, solo debería funcionar si estás usando Wrangler (normalmente :8788)
	if (window.location.hostname === 'localhost' && window.location.port !== '8788') {
		return ' (Tip: /api/* no funciona con servidores estáticos simples; usa wrangler pages dev .)';
	}
	return '';
};

loginFormElement.addEventListener('submit', async (event) => {
	event.preventDefault();
	setMessage(loginMessage, '', null);

	const email = document.getElementById('loginEmail').value.trim();
	const password = document.getElementById('loginPassword').value.trim();

	try {
		const response = await fetch('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});
		const data = await readJsonSafe(response);

		if (!response.ok) {
			const msg = data?.message
				|| `No se pudo iniciar sesión (HTTP ${response.status}).${hintIfMissingApi()}`;
			setMessage(loginMessage, msg, 'error');
			return;
		}

		setMessage(loginMessage, 'Sesión iniciada correctamente.', 'success');
		setAuthCookie();
		safeLocalSet('auth', '1');
		safeLocalSet('authBool', 'true');
		if (data?.user?.name) safeLocalSet('userName', data.user.name);
		if (data?.user?.email) safeLocalSet('userEmail', data.user.email);
		const userRole = data?.user?.role || 'student';
		safeLocalSet('userRole', userRole);
		// Grado/Grupo se guardan desde el usuario registrado (DB)
		const finalGrade = normalizeGrade(data?.user?.grade);
		const finalGroup = normalizeGroup(data?.user?.group);
		if (finalGrade) safeLocalSet('userGrade', String(finalGrade));
		if (finalGroup) safeLocalSet('userGroup', finalGroup);
		if (!data?.user?.email && email) safeLocalSet('userEmail', email);
		// Redirigir según role
		const roleTarget = userRole === 'admin' ? '/admin/' : userRole === 'teacher' ? '/maestro/' : '/aula';
		setMessageLink(loginMessage, 'Sesión iniciada. Si no te redirige, entra a', roleTarget, roleTarget === '/aula' ? 'Aula' : 'Panel', 'success');
		const target = new URL(roleTarget, window.location.origin).toString();
		// Redirección confiable (replace evita volver atrás al login)
		try {
			window.location.replace(target);
		} catch {
			window.location.href = target;
		}
		// Si el login está embebido (iframe), intenta navegar el top-level
		try {
			if (window.top && window.top !== window) {
				window.top.location.href = target;
			}
		} catch {
			// ignore (cross-origin)
		}
		// Fallback por si algún navegador bloquea la navegación inmediata
		setTimeout(() => {
			try {
				if (window.location.pathname.includes('/login')) {
					window.location.href = target;
				}
			} catch {
				// ignore
			}
		}, 200);
	} catch (error) {
		setMessage(
			loginMessage,
			`Error de conexión. Intenta más tarde.${hintIfMissingApi()}`,
			'error'
		);
	}
});

registerFormElement.addEventListener('submit', async (event) => {
	event.preventDefault();
	setMessage(registerMessage, '', null);

	const name = document.getElementById('registerName').value.trim();
	const email = document.getElementById('registerEmail').value.trim();
	const password = document.getElementById('registerPassword').value.trim();
	const gradeRaw = document.getElementById('registerGrade')?.value;
	const groupRaw = document.getElementById('registerGroup')?.value;
	const grade = normalizeGrade(gradeRaw);
	const group = normalizeGroup(groupRaw);

	if (!grade || !group) {
		setMessage(registerMessage, 'Selecciona tu grado (1 a 6) y grupo (A a D).', 'error');
		return;
	}

	try {
		const response = await fetch('/api/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, email, password, grade, group })
		});
		const data = await readJsonSafe(response);

		if (!response.ok) {
			const msg = data?.message
				|| `No se pudo registrar (HTTP ${response.status}).${hintIfMissingApi()}`;
			setMessage(registerMessage, msg, 'error');
			return;
		}

		setMessage(registerMessage, 'Registro exitoso. Ya puedes iniciar sesión.', 'success');
		showLogin();
	} catch (error) {
		setMessage(
			registerMessage,
			`Error de conexión. Intenta más tarde.${hintIfMissingApi()}`,
			'error'
		);
	}
});

})();
