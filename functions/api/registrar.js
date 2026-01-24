// functions/api/registrar.js

export async function onRequestPost(context) {
    try {
        const { email, nombre, password } = await context.request.json();

        // 1. VERIFICADOR: ¿Es Gmail?
        if (!email.endsWith('@gmail.com')) {
            return new Response(JSON.stringify({ error: "Solo se permiten correos de Gmail." }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 2. Aquí normalmente guardarías en una base de datos (como Cloudflare D1 o KV)
        // Por ahora, simularemos que se guardó correctamente.
        
        return new Response(JSON.stringify({ 
            message: `Registro exitoso para ${nombre}.`,
            success: true 
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: "Error en el servidor" }), { status: 500 });
    }
}
