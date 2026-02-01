
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

// Control de sesión simple
const isAuthenticated = () => localStorage.getItem('auth') === '1';

document.addEventListener('DOMContentLoaded', () => {
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
				'<a class="btn btn-outline btn-logout" href="#">Cerrar Sesión</a>'
			);
		} else {
			navActions.insertAdjacentHTML(
				'beforeend',
				'<a class="btn btn-outline btn-login" href="login.html">Iniciar Sesión</a>'
			);
			navActions.insertAdjacentHTML(
				'beforeend',
				'<a class="btn btn-solid btn-register" href="login.html#register">Registrarse</a>'
			);
		}
	}

	// Logout (después de renderizar botones)
	document.querySelectorAll('.btn-logout').forEach((btn) => {
		btn.addEventListener('click', (event) => {
			event.preventDefault();
			localStorage.removeItem('auth');
			localStorage.removeItem('userName');
			localStorage.removeItem('userEmail');
			document.body.classList.remove('is-auth');
			window.location.href = 'index.html';
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
	if (path.includes('login.html') && isAuthenticated()) {
		window.location.href = 'aula.html';
		return;
	}

	// Si estás en aula y no estás autenticado, redirigir al login
	if ((path.includes('/aula') || path.includes('aula.html')) && !isAuthenticated()) {
		window.location.href = 'login.html';
	}
});

