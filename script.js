
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
	if (isAuthenticated()) {
		document.body.classList.add('is-auth');
	} else {
		document.body.classList.remove('is-auth');
	}

	// Remover botones según estado de sesión (no solo ocultar con CSS)
	const loginBtn = document.querySelector('.btn-login');
	const registerBtn = document.querySelector('.btn-register');
	const logoutBtn = document.querySelector('.btn-logout');
	if (isAuthenticated()) {
		loginBtn?.remove();
		registerBtn?.remove();
	} else {
		logoutBtn?.remove();
	}

	const logoutButtons = document.querySelectorAll('.btn-logout');
	logoutButtons.forEach((btn) => {
		btn.addEventListener('click', (event) => {
			event.preventDefault();
			localStorage.removeItem('auth');
			document.body.classList.remove('is-auth');
			window.location.href = 'index.html';
		});
	});

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

