
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
		navActions.insertAdjacentHTML(
			'beforeend',
			`<a class="btn btn-outline btn-aula" href="${urls.aula}">Aula</a>`
		);
		if (authed) {
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
			} catch {
				// ignore
			}
			const expire = 'auth=; path=/; max-age=0; samesite=lax';
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
		const label = name || email;
		welcomeEl.textContent = label ? `Sesión iniciada como: ${label}` : '';
	}

	// Si estás autenticado, evita volver al login
	const path = window.location.pathname;
	if ((path.includes('login.html') || path === '/login' || path.startsWith('/login/')) && isAuthenticated()) {
		window.location.href = urls.aula;
		return;
	}

	// Si estás en aula y no estás autenticado, redirigir al login
	if ((path.includes('/aula') || path.includes('aula.html')) && !isAuthenticated()) {
		window.location.href = urls.login;
	}
});

