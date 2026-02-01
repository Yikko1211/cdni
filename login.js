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

// Soportar link directo a registro
if (window.location.hash === '#register') {
	showRegister();
}

const getCookie = (name) => {
	const part = document.cookie
		.split('; ')
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

const setAuthCookie = () => {
	const base = `auth=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
	document.cookie = base;
	if (window.location.protocol === 'https:') {
		document.cookie = `${base}; secure`;
	}
};

// Si ya hay sesión iniciada, no mostrar login
if (safeLocalGet('auth') === '1' || getCookie('auth') === '1') {
	window.location.href = '/aula';
}

const setMessage = (el, text, type) => {
	el.textContent = text;
	el.classList.remove('success', 'error');
	if (type) el.classList.add(type);
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
		if (!data?.user?.email && email) safeLocalSet('userEmail', email);
		window.location.href = '/aula';
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

	try {
		const response = await fetch('/api/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, email, password })
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
