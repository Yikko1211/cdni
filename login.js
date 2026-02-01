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

const setMessage = (el, text, type) => {
	el.textContent = text;
	el.classList.remove('success', 'error');
	if (type) el.classList.add(type);
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
		const data = await response.json();

		if (!response.ok) {
			setMessage(loginMessage, data.message || 'No se pudo iniciar sesión.', 'error');
			return;
		}

		setMessage(loginMessage, 'Sesión iniciada correctamente.', 'success');
	} catch (error) {
		setMessage(loginMessage, 'Error de conexión. Intenta más tarde.', 'error');
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
		const data = await response.json();

		if (!response.ok) {
			setMessage(registerMessage, data.message || 'No se pudo registrar.', 'error');
			return;
		}

		setMessage(registerMessage, 'Registro exitoso. Ya puedes iniciar sesión.', 'success');
		showLogin();
	} catch (error) {
		setMessage(registerMessage, 'Error de conexión. Intenta más tarde.', 'error');
	}
});
