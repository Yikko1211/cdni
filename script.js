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
    const ACCOUNTS_KEY = 'cdniAccounts';
    const USER_KEY = 'cdniUser';

    function getAccounts() {
        try {
            return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveAccounts(accounts) {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }

    function setCurrentUser(user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        updateUIForAuth();
    }

    function getCurrentUser() {
        try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; }
    }

    function logout() {
        localStorage.removeItem(USER_KEY);
        updateUIForAuth();
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    function updateUIForAuth() {
        const navMenu = document.querySelector('.nav-menu');
        if (!navMenu) return;
        const user = getCurrentUser();

        // Remove any existing .nav-user placeholder
        const existing = navMenu.querySelector('.nav-user');
        if (existing) existing.remove();

        // Hide original auth links if logged in
        if (user) {
            const authLinks = Array.from(navMenu.querySelectorAll('a.btn-nav-auth'));
            authLinks.forEach(a => a.remove());

            const li = document.createElement('li');
            li.className = 'nav-user';
            li.innerHTML = `<span class="greeting">Hola, ${escapeHtml(user.name)}</span> <button id="logoutBtn" class="btn-nav-auth" aria-label="Cerrar sesión">Cerrar sesión</button>`;
            navMenu.appendChild(li);

            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.addEventListener('click', () => { logout(); });
        } else {
            // If not logged, ensure auth links exist (restore if they were removed)
            if (!navMenu.querySelector('a[href="iniciar-sesion.html"]')) {
                const liLogin = document.createElement('li');
                liLogin.innerHTML = '<a href="iniciar-sesion.html" class="btn-nav-auth">Entrar</a>';
                const liReg = document.createElement('li');
                liReg.innerHTML = '<a href="registrarse.html" class="btn-nav-auth highlight">Registro</a>';
                navMenu.appendChild(liLogin);
                navMenu.appendChild(liReg);
            }
        }
    }

    updateUIForAuth();

    const formSignUpPage = document.getElementById('formSignUpPage');
    if (formSignUpPage) {
        formSignUpPage.onsubmit = async (e) => {
            e.preventDefault();
            const authMessage = document.getElementById('authMessage');
            const email = document.getElementById('regEmail').value.trim();
            const nombre = document.getElementById('regName').value.trim();
            const password = document.getElementById('regPass').value;

            if (!email.toLowerCase().endsWith('@gmail.com')) {
                authMessage.textContent = "Error: Debes usar una cuenta de @gmail.com";
                authMessage.style.color = "red";
                return;
            }

            if (password.length < 8) {
                authMessage.textContent = "La contraseña debe tener al menos 8 caracteres.";
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

                const result = await response.json().catch(() => ({}));

                if (response.ok) {
                    // backend accepted: store local copy and set current user
                    const accounts = getAccounts();
                    accounts.push({ name: nombre, email, password });
                    saveAccounts(accounts);
                    setCurrentUser({ name: nombre, email });
                    window.location.href = 'index.html';
                } else {
                    authMessage.textContent = result.error || "Hubo un error al registrar.";
                    authMessage.style.color = "red";
                }
            } catch (error) {
                // Fallback: no backend — create local account so user can log in locally
                const accounts = getAccounts();
                accounts.push({ name: nombre, email, password });
                saveAccounts(accounts);
                setCurrentUser({ name: nombre, email });
                window.location.href = 'index.html';
            }
        };
    }

    // --- 3. LÓGICA DE LOGIN (Página iniciar-sesion.html) ---
    const formSignInPage = document.getElementById('formSignInPage');
    if (formSignInPage) {
        formSignInPage.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPass').value;
            const loginMessage = document.getElementById('loginMessage') || document.getElementById('authMessage');

            // Intentar autenticar contra backend (Cloudflare D1)
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json().catch(() => ({}));
                if (response.ok) {
                    // backend devolvió nombre y correo
                    setCurrentUser({ name: result.name || (email.split('@')[0]), email: result.email || email });
                    window.location.href = 'index.html';
                    return;
                } else {
                    if (loginMessage) {
                        loginMessage.textContent = result.error || 'Usuario o contraseña incorrectos.';
                        loginMessage.style.color = 'red';
                    } else {
                        alert(result.error || 'Usuario o contraseña incorrectos.');
                    }
                    return;
                }
            } catch (err) {
                // Fallback: si no funciona el backend, usar cuentas locales
                const accounts = getAccounts();
                if (accounts.length === 0) {
                    const nameGuess = email.split('@')[0] || 'Usuario';
                    setCurrentUser({ name: nameGuess, email });
                    window.location.href = 'index.html';
                    return;
                }

                const match = accounts.find(a => a.email.toLowerCase() === email.toLowerCase() && a.password === password);
                if (match) {
                    setCurrentUser({ name: match.name, email: match.email });
                    window.location.href = 'index.html';
                } else {
                    if (loginMessage) {
                        loginMessage.textContent = 'Usuario o contraseña incorrectos.';
                        loginMessage.style.color = 'red';
                    } else {
                        alert('Usuario o contraseña incorrectos.');
                    }
                }
            }
        };
    }

    // --- 4. MODAL DE BIENVENIDA (FIRST VISIT) ---
    function showWelcomeIfFirstVisit() {
        try {
            const key = 'cdniSeenWelcome';
            if (localStorage.getItem(key)) return;

            const overlay = document.createElement('div');
            overlay.className = 'welcome-overlay';

            const modal = document.createElement('div');
            modal.className = 'welcome-modal';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'close-welcome';
            closeBtn.setAttribute('aria-label', 'Cerrar');
            closeBtn.innerHTML = '✕';

            const p = document.createElement('p');
            p.innerHTML = 'Sitio web creado por estudiante <strong>Zaid Xavier Badillo Lopez</strong> de <strong>6A</strong>';
            p.style.opacity = '0.95';

            modal.appendChild(closeBtn);
            modal.appendChild(p);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            function closeWelcome() {
                try { localStorage.setItem(key, '1'); } catch (e) {}
                overlay.remove();
            }

            closeBtn.addEventListener('click', closeWelcome);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeWelcome();
            });

            // Allow Esc to close
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    closeWelcome();
                    document.removeEventListener('keydown', escHandler);
                }
            });
        } catch (e) {
            // ignore failures in storage
        }
    }

    // Ejecutar modal después de una pequeña espera para que la carga se vea suave
    setTimeout(showWelcomeIfFirstVisit, 600);

    // --- 5. PASSWORD TOGGLE + STRENGTH ---
    function initPasswordToggles() {
        const toggles = document.querySelectorAll('.pw-toggle');
        toggles.forEach(btn => {
            const group = btn.closest('.password-group');
            if (!group) return;
            const input = group.querySelector('input[type="password"], input[type="text"]');
            if (!input) return;

            btn.addEventListener('click', () => {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                btn.textContent = isPassword ? '🙈' : '👁️';
            });

            // Strength indicator for register page
            if (input.id === 'regPass') {
                const strengthEl = document.getElementById('pwStrength');
                input.addEventListener('input', () => {
                    const v = input.value || '';
                    const score = Math.min(4, Math.floor(v.length / 4));
                    const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];
                    if (strengthEl) {
                        strengthEl.textContent = v.length ? `Contraseña: ${labels[score]}` : '';
                        strengthEl.style.color = score < 2 ? 'crimson' : (score < 3 ? 'orange' : 'green');
                    }
                });
            }
        });
    }

    initPasswordToggles();
});
