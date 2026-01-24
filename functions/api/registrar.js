export async function onRequestPost(context) {
  // 1. Extraer los datos que envía el estudiante desde el formulario
  const { nombre, email, contrasena } = await context.request.json();
  
  try {
    // 2. Intentar guardar en la base de datos D1
    // Nota: 'DB' es el nombre que configuraste en el "Binding" del panel de Cloudflare
    await context.env.DB.prepare(
      "INSERT INTO usuarios (nombre, email, contrasena) VALUES (?, ?, ?)"
    ).bind(nombre, email, contrasena).run();

    return new Response("Cuenta creada con éxito", { 
      status: 200,
      headers: { "Content-Type": "text/plain" } 
    });
  } catch (error) {
    // 3. Si el correo ya existe, D1 lanzará un error porque pusimos 'UNIQUE' en el email
    return new Response("Error: El correo ya está registrado o faltan datos.", { 
      status: 400,
      headers: { "Content-Type": "text/plain" }
    });
  }
}
