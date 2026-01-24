document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica para el menú de navegación móvil ---
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active'); // Alterna la clase 'active' para mostrar/ocultar el menú
        });

        // Cierra el menú si se hace clic fuera de él (opcional)
        document.addEventListener('click', (event) => {
            if (!navMenu.contains(event.target) && !menuToggle.contains(event.target) && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
            }
        });
    }

    // --- Lógica para el formulario de contacto ---
    const contactForm = document.getElementById('contact-form');
    const formMessage = document.querySelector('.form-message');

    if (contactForm && formMessage) {
        contactForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Evita que la página se recargue

            // Aquí puedes añadir lógica para enviar el formulario a un servicio real
            // Por ahora, solo mostraremos un mensaje de éxito simulado.

            formMessage.textContent = '¡Gracias por tu mensaje! Nos pondremos en contacto contigo pronto.';
            formMessage.style.display = 'block';
            formMessage.style.color = 'green';
            formMessage.style.marginTop = '15px';
            contactForm.reset(); // Limpia los campos del formulario

            // Opcional: Ocultar el mensaje después de unos segundos
            setTimeout(() => {
                formMessage.style.display = 'none';
            }, 5000);
        });
    }

    // --- Lógica para el botón "Conoce más" ---
    const btnPrincipal = document.querySelector('.btn-principal');
    if (btnPrincipal) {
        btnPrincipal.addEventListener('click', () => {
            // Desplazamiento suave a la sección "Nosotros"
            document.querySelector('#nosotros').scrollIntoView({
                behavior: 'smooth'
            });
        });
    }
});
