import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({error:"Método não permitido"}), {status:405});
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({error:"Não autenticado"}), {status:401});

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, {global:{headers:{Authorization:`Bearer ${token}`}}});
    const {data:{user:caller}} = await userClient.auth.getUser(token);
    if (!caller) return new Response(JSON.stringify({error:"Não autenticado"}), {status:401});

    const body = await req.json();
    if (!body.nome || !body.email || !body.senha) throw new Error("Nome, e-mail e senha são obrigatórios.");
    if (body.senha.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");

    const admin = createClient(url, service);
    const {data,error} = await admin.auth.admin.createUser({
      email: body.email,
      password: body.senha,
      email_confirm: true,
      user_metadata: {nome: body.nome}
    });
    if (error) throw error;

    return new Response(JSON.stringify({id:data.user?.id}), {headers:{"Content-Type":"application/json"}});
  } catch (e) {
    return new Response(JSON.stringify({error:e.message || "Erro interno"}), {status:400,headers:{"Content-Type":"application/json"}});
  }
});
