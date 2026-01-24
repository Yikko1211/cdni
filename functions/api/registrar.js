// functions/api/registrar.js

export async function onRequestPost(context) {
    try {
        const { email, nombre, password } = await context.request.json();

        if (!email || !nombre || !password) {
            return new Response(JSON.stringify({ error: 'Faltan campos requeridos.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // 1. VERIFICADOR: ¿Es Gmail?
        if (!email.toLowerCase().endsWith('@gmail.com')) {
            return new Response(JSON.stringify({ error: "Solo se permiten correos de Gmail." }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 2. Preparar hash con salt usando Web Crypto
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const passwordHash = await hashPassword(password, salt);
        const saltHex = toHex(salt);

        // 3. Insertar en D1 (binding: db)
        const db = context.env.db;
        if (!db) {
            return new Response(JSON.stringify({ error: 'Database binding (db) no está disponible.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        try {
            const stmt = db.prepare('INSERT INTO users (name, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)');
            const res = await stmt.bind(nombre, email.toLowerCase(), passwordHash, saltHex).run();
            return new Response(JSON.stringify({ message: `Registro exitoso para ${nombre}.`, success: true }), { headers: { 'Content-Type': 'application/json' } });
        } catch (dbErr) {
            // Manejar constraint (email único)
            const msg = (dbErr && dbErr.message && dbErr.message.includes('UNIQUE')) ? 'El correo ya está registrado.' : 'Error al guardar en la base de datos.';
            return new Response(JSON.stringify({ error: msg }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }

    } catch (err) {
        return new Response(JSON.stringify({ error: "Error en el servidor" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

function toHex(buffer) {
    return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, saltUint8) {
    const enc = new TextEncoder();
    const pwdBytes = enc.encode(password);
    const combined = new Uint8Array(saltUint8.length + pwdBytes.length);
    combined.set(saltUint8, 0);
    combined.set(pwdBytes, saltUint8.length);
    const hashBuf = await crypto.subtle.digest('SHA-256', combined);
    const hashArray = new Uint8Array(hashBuf);
    return toHex(hashArray);
}
