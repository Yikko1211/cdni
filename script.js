document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. MENÚ MÓVIL ---
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            const isActive = navMenu.classList.toggle('active');
            menuToggle.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        });

        // Cerrar menú con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                menuToggle.focus();
            }
        });
    }

    // --- 2. LÓGICA DE REGISTRO (Página registrarse.html) ---
    const formSignUpPage = document.getElementById('formSignUpPage');
    if (formSignUpPage) {
        formSignUpPage.onsubmit = async (e) => {
            e.preventDefault();
            const authMessage = document.getElementById('authMessage');
            const email = document.getElementById('regEmail').value;
            const nombre = document.getElementById('regName').value;
            const password = document.getElementById('regPass').value;

            // Verificador de Gmail
            if (!email.toLowerCase().endsWith('@gmail.com')) {
                authMessage.textContent = "Error: Debes usar una cuenta de @gmail.com";
                authMessage.style.color = "red";
                return;
            }

            authMessage.textContent = "Procesando registro...";
            authMessage.style.color = "blue";

            try {
                const response = await fetch('/api/registrar', {
                    method: 'POST',
                    body: JSON.stringify({ nombre, email, password }),
                    headers: { 'Content-Type': 'application/json' }
                });

                const result = await response.json();

                if (response.ok) {
                    alert("¡Registro exitoso! Bienvenido a la Abraham Lincoln.");
                    window.location.href = "iniciar-sesion.html";
                } else {
                    authMessage.textContent = result.error || "Hubo un error al registrar.";
                    authMessage.style.color = "red";
                }
            } catch (error) {
                authMessage.textContent = "Error de conexión con el servidor.";
            }
        };
    }

    // --- 3. LÓGICA DE LOGIN (Página iniciar-sesion.html) ---
    const formSignInPage = document.getElementById('formSignInPage');
    if (formSignInPage) {
        formSignInPage.onsubmit = (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            // Aquí agregarás la lógica de autenticación real más adelante
            alert("Verificando datos para: " + email);
        };
    }
});
