// ============================================================================
//  Edge Function: usuarios  ·  alta, baja y CAMBIO DE ROL.
//
//  ⚠️ Esta función vivía SÓLO en Supabase: se desplegó y su código nunca se
//  guardó en el repo, así que nadie podía leerla ni revisarla. Aquí queda.
//
//  v2 (2026-08-16) — CAMBIAR EL ROL SIN DAR DE BAJA.
//  Rodrigo: "en usuarios, que podamos mover si es Dirección, Ventas, Diseño, y
//  si le mueves da o quita permisos." Antes la única forma de cambiarle el rol a
//  alguien era borrarlo y volverlo a crear, lo que le tiraba la contraseña.
//
//  El rol NO es una etiqueta: es el permiso. La base de datos entrega la nómina
//  y los financieros según el rol del correo que entró, así que mover a alguien
//  a 'direccion' le abre esos datos de verdad, y sacarlo se los cierra.
//
//  DOS CANDADOS, para no quedarse fuera de la propia app:
//   · nadie puede cambiarse el rol a sí mismo;
//   · no se puede quitar al ÚLTIMO Dirección — si no, la app se queda sin quien
//     pueda dar de alta a nadie y hay que entrar por la base de datos.
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const ROLES = ["direccion", "diseno", "vendedor"];

function json(o: unknown, status: number) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(URL, SERVICE);
    const body = await req.json();
    const accion = body.accion;

    // Bootstrap: crear el primer admin si aun no hay ningun usuario.
    if (accion === "bootstrap") {
      const { data: lista } = await admin.auth.admin.listUsers();
      if ((lista?.users?.length || 0) > 0) return json({ error: "ya-inicializado" }, 400);
      const { data: perm } = await admin.from("permitidos").select("rol").eq("email", body.email).single();
      if (perm?.rol !== "direccion") return json({ error: "no-permitido" }, 403);
      const { error } = await admin.auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true }, 200);
    }

    // Lo demas requiere que quien llama sea direccion.
    const jwt = (req.headers.get("authorization") || "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(jwt);
    const correo = u?.user?.email;
    if (!correo) return json({ error: "no-sesion" }, 401);
    const { data: yo } = await admin.from("permitidos").select("rol").eq("email", correo).single();
    if (yo?.rol !== "direccion") return json({ error: "solo-direccion" }, 403);

    if (accion === "crear") {
      const email = String(body.email || "").trim().toLowerCase();
      const { error } = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true });
      let yaExistia = false;
      if (error) {
        if (!String(error.message).toLowerCase().includes("already")) return json({ error: error.message }, 400);
        yaExistia = true;
      }
      // ⚠️ 2026-08-19: "DAR DE ALTA" A UN CORREO QUE YA TENÍA CUENTA le dejaba SU
      // contraseña vieja intacta (createUser falla con "already" y ahí se
      // quedaba) — Rodrigo necesitaba reemitir credenciales para gente que ya
      // estaba en la lista pero nunca había entrado. Ahora, si ya existía, se le
      // FIJA la contraseña nueva con updateUserById en vez de dejarla como estaba.
      if (yaExistia) {
        const { data: lista } = await admin.auth.admin.listUsers();
        const u = lista?.users?.find((x) => x.email === email);
        if (u) await admin.auth.admin.updateUserById(u.id, { password: body.password });
      }
      await admin.from("permitidos").upsert({ email, nombre: body.nombre || null, rol: body.rol || "vendedor" });
      // La contraseña que se acaba de fijar (nueva o de alta) queda guardada
      // para el Excel de "Descargar credenciales" — Rodrigo: "cada vez que demos
      // de alta a alguien, que se guarde en ese excel automáticamente".
      if (body.password) {
        await admin.from("credenciales_temporales").upsert({
          email, nombre: body.nombre || null, rol: body.rol || "vendedor",
          password_temporal: body.password, actualizado: new Date().toISOString(),
        });
      }
      return json({ ok: true }, 200);
    }

    if (accion === "rol") {
      const email = String(body.email || "").trim().toLowerCase();
      const rol = String(body.rol || "");
      if (!ROLES.includes(rol)) return json({ error: "rol-invalido" }, 400);
      if (email === String(correo).toLowerCase()) return json({ error: "no-puedes-cambiarte-tu-rol" }, 400);
      // No dejar la app sin Dirección: si el que se mueve es el último, se frena.
      const { data: quien } = await admin.from("permitidos").select("rol").eq("email", email).single();
      if (!quien) return json({ error: "no-esta-en-la-lista" }, 404);
      if (quien.rol === "direccion" && rol !== "direccion") {
        const { count } = await admin.from("permitidos").select("email", { count: "exact", head: true }).eq("rol", "direccion");
        if ((count || 0) <= 1) return json({ error: "es-el-unico-direccion" }, 400);
      }
      const { error } = await admin.from("permitidos").update({ rol }).eq("email", email);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, rol }, 200);
    }

    if (accion === "eliminar") {
      const email = String(body.email || "").trim().toLowerCase();
      if (email === String(correo).toLowerCase()) return json({ error: "no-puedes-borrarte" }, 400);
      const { data: quien } = await admin.from("permitidos").select("rol").eq("email", email).single();
      if (quien?.rol === "direccion") {
        const { count } = await admin.from("permitidos").select("email", { count: "exact", head: true }).eq("rol", "direccion");
        if ((count || 0) <= 1) return json({ error: "es-el-unico-direccion" }, 400);
      }
      const { data: lista } = await admin.auth.admin.listUsers();
      const target = lista?.users?.find((x) => x.email === email);
      if (target) await admin.auth.admin.deleteUser(target.id);
      await admin.from("permitidos").delete().eq("email", email);
      return json({ ok: true }, 200);
    }

    return json({ error: "accion-desconocida" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
