# BUONO DASHBOARD

Painel comercial online da Buono Odontologia.

## O que já está implementado

- Login individual.
- Todos os usuários com acesso completo.
- Criação de novos logins pela área Usuários.
- Cadastro, edição e exclusão de lançamentos.
- Banco de dados online Supabase.
- Atualização em tempo real entre computadores.
- Indicadores automáticos.
- Metas de conversão e entrada.
- Filtros Hoje / Esta semana / Este mês / Personalizado.
- Resultado da semana e do mês.
- Gráficos de conversão.
- Histórico de pacientes.
- Auditoria de criação, edição e exclusão.
- Geração de PDF.
- Layout responsivo.

## Colocar online — caminho simples

### 1. Criar o banco

Crie um projeto gratuito no Supabase.

No SQL Editor do Supabase, abra:

`supabase/schema.sql`

e execute tudo.

### 2. Pegar as chaves

No Supabase, vá em Project Settings > API.

Copie:
- Project URL
- anon public key

Crie `.env.local` na raiz do projeto usando `.env.example` como modelo:

VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

### 3. Criar o primeiro usuário

O próprio formulário de login possui "Criar um novo login".

Depois do primeiro cadastro, esse usuário já consegue acessar o painel e criar outros logins na aba Usuários.

### 4. Ativar criação de usuários

A pasta:

`supabase/functions/create-user/index.ts`

é uma Edge Function porque criar usuários por outro usuário exige a Service Role Key no servidor, e essa chave NUNCA deve ficar no navegador.

No Supabase CLI:

`supabase functions deploy create-user`

Depois, configure a variável `SUPABASE_SERVICE_ROLE_KEY` no ambiente da função conforme a documentação do Supabase.

### 5. Rodar localmente

No terminal:

`npm install`

depois:

`npm run dev`

### 6. Hospedar

Suba este projeto para um repositório GitHub e importe o repositório na Vercel.

Nas Environment Variables da Vercel, coloque:

`VITE_SUPABASE_URL`
`VITE_SUPABASE_ANON_KEY`

Depois do deploy, a Vercel fornecerá o endereço do site.

## Observação importante

A arquitetura foi feita para dados compartilhados online. O navegador não guarda a base principal: os lançamentos ficam no Supabase.

A atualização em tempo real usa o Realtime do Supabase, então quando uma pessoa salva um lançamento, os outros painéis conectados recebem a mudança.

Para produção, configure também backups do projeto Supabase e um domínio próprio, por exemplo:

dashboard.buonoodontologia.com.br
