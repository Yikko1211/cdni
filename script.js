document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Lógica para el menú de navegación móvil ---
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });

        document.addEventListener('click', (event) => {
            if (!navMenu.contains(event.target) && !menuToggle.contains(event.target) && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
            }
        });
    }

    // --- 2. Lógica para el botón "Conoce más" / "Saber más" ---
    const btnPrincipal = document.querySelector('.btn-principal');
    if (btnPrincipal) {
        btnPrincipal.addEventListener('click', (e) => {
            // Si el botón está dentro del Hero, hace scroll a información
            const target = document.querySelector('#informacion') || document.querySelector('#nosotros');
            if(target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // --- 3. Lógica para el Modal de Login y Registro ---
    const modal = document.getElementById('authModal');
    const btnOpen = document.getElementById('openLogin');
    const btnClose = document.querySelector('.close-btn');
    const toRegister = document.getElementById('toRegister');
    const toLogin = document.getElementById('toLogin');
    const authMessage = document.getElementById('authMessage');

    if (btnOpen && modal) {
        btnOpen.onclick = () => modal.style.display = "block";
        btnClose.onclick = () => modal.style.display = "none";

        toRegister.onclick = (e) => {
            e.preventDefault();
            document.getElementById('loginForm').style.display = "none";
            document.getElementById('registerForm').style.display = "block";
        }
        toLogin.onclick = (e) => {
            e.preventDefault();
            document.getElementById('registerForm').style.display = "none";
            document.getElementById('loginForm').style.display = "block";
        }
    }

    // --- 4. Conexión con la API (functions/api/registrar.js) ---
    const formSignUp = document.getElementById('formSignUp');
    if (formSignUp) {
        formSignUp.onsubmit = async (e) => {
            e.preventDefault();
            authMessage.textContent = "Procesando...";
            
            const datos = {
                nombre: document.getElementById('regName').value,
                email: document.getElementById('regEmail').value,
                password: document.getElementById('regPass').value
            };

            try {
                // Enviamos los datos al archivo que creaste en functions/api/
                const respuesta = await fetch('/api/registrar', {
                    method: 'POST',
                    body: JSON.stringify(datos),
                    headers: { 'Content-Type': 'application/json' }
                });

                const resultado = await respuesta.json();

                if (respuesta.ok) {
                    alert("¡Registro exitoso! Ya puedes iniciar sesión.");
                    toLogin.click();
                } else {
                    // Aquí aparecerá el error si no es @gmail.com
                    authMessage.textContent = resultado.error || "Error al registrar.";
                }
            } catch (error) {
                authMessage.textContent = "Error de conexión con el servidor.";
            }
        };
    }

    // --- 5. Lógica para el formulario de contacto ---
    const contactForm = document.getElementById('contact-form');
    const formMessage = document.querySelector('.form-message');

    if (contactForm && formMessage) {
        contactForm.addEventListener('submit', (event) => {
            event.preventDefault();
            formMessage.textContent = '¡Gracias por tu mensaje! Nos pondremos en contacto contigo pronto.';
            formMessage.style.display = 'block';
            formMessage.style.color = 'green';
            formMessage.style.marginTop = '15px';
            contactForm.reset();
            setTimeout(() => { formMessage.style.display = 'none'; }, 5000);
        });
    }
});
