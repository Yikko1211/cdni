export async function onRequestPost(context) {
    try {
        const { email, password } = await context.request.json();
        if (!email || !password) {
            return new Response(JSON.stringify({ error: 'Faltan credenciales.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const db = context.env.db;
        if (!db) {
            return new Response(JSON.stringify({ error: 'Database binding (db) no está disponible.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        try {
            const stmt = db.prepare('SELECT id, name, email, password_hash, salt FROM users WHERE email = ? LIMIT 1');
            const row = await stmt.bind(email.toLowerCase()).first();

            if (!row) {
                return new Response(JSON.stringify({ error: 'Usuario no encontrado.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
            }

            const saltHex = row.salt;
            const salt = hexToUint8Array(saltHex);
            const hash = await hashPassword(password, salt);

            if (hash === row.password_hash) {
                return new Response(JSON.stringify({ name: row.name, email: row.email }), { headers: { 'Content-Type': 'application/json' } });
            } else {
                return new Response(JSON.stringify({ error: 'Credenciales inválidas.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
            }

        } catch (dbErr) {
            return new Response(JSON.stringify({ error: 'Error en la base de datos.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

    } catch (err) {
        return new Response(JSON.stringify({ error: 'Error en el servidor' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

function hexToUint8Array(hex) {
    if (!hex) return new Uint8Array();
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
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
