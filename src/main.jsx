import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  LayoutDashboard, Plus, Search, CalendarDays, FileText, Users,
  Pencil, Trash2, LogOut, Menu, X, RefreshCw, Download, TrendingUp,
  WalletCards, Target, CircleDollarSign, UserPlus, Eye, EyeOff, CheckCircle2,
  AlertCircle, UserRound
} from "lucide-react";
import { jsPDF } from "jspdf";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const META_CONVERSAO = 30;
const META_ENTRADA_MIN = 20;
const META_ENTRADA_MAX = 30;

const brl = (v=0) => new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"}).format(Number(v)||0);
const pct = (v=0) => `${(Number(v)||0).toFixed(2).replace(".", ",")}%`;
const isoToday = () => new Date().toISOString().slice(0,10);
const dateBR = (s) => s ? new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR") : "";
const monday = (d) => {
  const x = new Date(d); x.setHours(12,0,0,0);
  const day = x.getDay() || 7; x.setDate(x.getDate() - day + 1); return x;
};
const iso = (d) => new Date(d).toISOString().slice(0,10);
const calc = (rows) => {
  const oportunidades = rows.reduce((s,r)=>s+Number(r.oportunidade||0),0);
  const fechado = rows.reduce((s,r)=>s+Number(r.fechado||0),0);
  const entrada = rows.reduce((s,r)=>s+Number(r.entrada||0),0);
  return {
    oportunidades, fechado, entrada,
    conversao: oportunidades ? fechado/oportunidades*100 : 0,
    entradaPct: fechado ? entrada/fechado*100 : 0,
    naoFechado: oportunidades-fechado,
    saldo: fechado-entrada
  };
};
const moneyInput = (v) => String(v ?? "").replace(/\D/g,"");

function App() {
  const [session,setSession] = useState(null);
  const [loading,setLoading] = useState(true);
  const [authMode,setAuthMode] = useState("login");
  const [page,setPage] = useState("dashboard");
  const [rows,setRows] = useState([]);
  const [users,setUsers] = useState([]);
  const [period,setPeriod] = useState("month");
  const [from,setFrom] = useState(iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to,setTo] = useState(isoToday());
  const [search,setSearch] = useState("");
  const [modal,setModal] = useState(null);
  const [toast,setToast] = useState(null);
  const [mobileOpen,setMobileOpen] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data:sub} = supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return ()=>sub.subscription.unsubscribe();
  },[]);

  useEffect(() => {
    if (session) loadAll();
  },[session]);

  useEffect(() => {
    if (!session || !supabase) return;
    const channel = supabase.channel("buono-realtime")
      .on("postgres_changes",{event:"*",schema:"public",table:"lancamentos"},()=>loadRows())
      .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},()=>loadUsers())
      .subscribe();
    return ()=>supabase.removeChannel(channel);
  },[session]);

  const loadRows = async () => {
    if (!supabase) return;
    const {data,error}=await supabase.from("lancamentos").select("*").order("data",{ascending:false}).order("created_at",{ascending:false});
    if (!error) setRows(data||[]);
  };
  const loadUsers = async () => {
    if (!supabase) return;
    const {data}=await supabase.from("profiles").select("*").order("nome");
    setUsers(data||[]);
  };
  const loadAll = async () => {
    setLoading(true); await Promise.all([loadRows(),loadUsers()]); setLoading(false);
  };

  const filtered = useMemo(()=>{
    const a = period==="today" ? isoToday() : from;
    const b = period==="today" ? isoToday() : to;
    let list=rows.filter(r=>r.data>=a && r.data<=b);
    if(search.trim()) list=list.filter(r=>r.paciente.toLowerCase().includes(search.toLowerCase()));
    return list;
  },[rows,period,from,to,search]);

  const currentStats = useMemo(()=>calc(filtered),[filtered]);
  const weekStats = useMemo(()=>{
    const m=monday(new Date()), a=iso(m), b=iso(new Date(m.getFullYear(),m.getMonth(),m.getDate()+6));
    return calc(rows.filter(r=>r.data>=a&&r.data<=b));
  },[rows]);
  const monthStats = useMemo(()=>{
    const d=new Date(), a=iso(new Date(d.getFullYear(),d.getMonth(),1)), b=iso(new Date(d.getFullYear(),d.getMonth()+1,0));
    return calc(rows.filter(r=>r.data>=a&&r.data<=b));
  },[rows]);

  const chartData = useMemo(()=>{
    const map={};
    filtered.forEach(r=>{
      const key=r.data;
      if(!map[key]) map[key]=[];
      map[key].push(r);
    });
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=>({date:dateBR(date).slice(0,5), conversao:calc(items).conversao}));
  },[filtered]);

  const weekChart = useMemo(()=>{
    const map={};
    rows.forEach(r=>{
      const d=new Date(`${r.data}T12:00:00`);
      const m=monday(d); const key=iso(m);
      if(!map[key]) map[key]=[];
      map[key].push(r);
    });
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).slice(-8).map(([k,v],i)=>({semana:`Semana ${i+1}`,conversao:Number(calc(v).conversao.toFixed(2))}));
  },[rows]);

  const showToast=(message,type="ok")=>{setToast({message,type});setTimeout(()=>setToast(null),3000)};
  const logout=async()=>{await supabase.auth.signOut(); setSession(null);};

  const deleteRow=async(id)=>{
    if(!confirm("Excluir este lançamento?")) return;
    const {error}=await supabase.from("lancamentos").delete().eq("id",id);
    if(error) showToast(error.message,"err"); else showToast("Lançamento excluído.");
  };

  const generatePDF=()=>{
    const doc=new jsPDF();
    const s=currentStats;
    let y=18;
    doc.setFontSize(20); doc.text("BUONO DASHBOARD",14,y); y+=9;
    doc.setFontSize(11); doc.text(`Relatório: ${dateBR(period==="today"?isoToday():from)} a ${dateBR(period==="today"?isoToday():to)}`,14,y); y+=12;
    const lines=[
      `Oportunidades: ${brl(s.oportunidades)}`,
      `Total fechado: ${brl(s.fechado)}`,
      `Taxa de conversão: ${pct(s.conversao)} | Meta: ${META_CONVERSAO}%`,
      `Total de entradas: ${brl(s.entrada)}`,
      `Percentual de entrada: ${pct(s.entradaPct)} | Ideal: ${META_ENTRADA_MIN}% a ${META_ENTRADA_MAX}%`,
      `Valor não fechado: ${brl(s.naoFechado)}`,
      `Saldo dos fechamentos: ${brl(s.saldo)}`
    ];
    doc.setFontSize(12); lines.forEach(t=>{doc.text(t,14,y);y+=8});
    y+=5; doc.setFontSize(14); doc.text("Lançamentos",14,y);y+=8;
    doc.setFontSize(8);
    filtered.forEach(r=>{
      if(y>275){doc.addPage();y=18}
      doc.text(`${dateBR(r.data)} | ${r.paciente} | Oport. ${brl(r.oportunidade)} | Fech. ${brl(r.fechado)} | Entr. ${brl(r.entrada)}`,14,y); y+=6;
    });
    doc.save(`buono-dashboard-${isoToday()}.pdf`);
  };

  if(!supabase) return <SetupScreen/>;

  if(!session) return <Auth mode={authMode} setMode={setAuthMode} showToast={showToast}/>;

  const nav=[
    ["dashboard","Dashboard",LayoutDashboard],
    ["lancamentos","Lançamentos",FileText],
    ["usuarios","Usuários",Users]
  ];

  return <div className="app">
    <aside className={`sidebar ${mobileOpen?"open":""}`}>
      <div className="brand"><div className="brandMark">B</div><div><b>BUONO</b><span>DASHBOARD</span></div><button className="closeMobile" onClick={()=>setMobileOpen(false)}><X size={20}/></button></div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?"active":""} onClick={()=>{setPage(id);setMobileOpen(false)}}><Icon size={19}/>{label}</button>)}</nav>
      <div className="sideBottom">
        <div className="logged"><div className="avatar">{(session.user.user_metadata?.nome||session.user.email||"U")[0].toUpperCase()}</div><div><b>{session.user.user_metadata?.nome||"Usuário"}</b><span>{session.user.email}</span></div></div>
        <button onClick={logout} className="logout"><LogOut size={17}/> Sair</button>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <button className="menu" onClick={()=>setMobileOpen(true)}><Menu/></button>
        <div><h1>{page==="dashboard"?"Painel de Performance":page==="lancamentos"?"Lançamentos":"Usuários"}</h1><span>Buono Odontologia</span></div>
        <div className="topActions"><button className="iconBtn" onClick={loadAll} title="Atualizar"><RefreshCw size={18}/></button><button className="primary" onClick={()=>setModal({type:"launch"})}><Plus size={18}/> Novo lançamento</button></div>
      </header>

      {page==="dashboard" && <Dashboard stats={currentStats} week={weekStats} month={monthStats} chartData={chartData} weekChart={weekChart} period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo} onPDF={generatePDF}/>}
      {page==="lancamentos" && <Launches rows={filtered} search={search} setSearch={setSearch} onEdit={r=>setModal({type:"launch",row:r})} onDelete={deleteRow} stats={currentStats}/>}
      {page==="usuarios" && <UsersPage users={users} onRefresh={loadUsers} showToast={showToast}/>}

      {modal?.type==="launch" && <LaunchModal row={modal.row} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);loadRows();showToast("Lançamento salvo com sucesso.")}} showToast={showToast}/>}
      {toast && <div className={`toast ${toast.type==="err"?"err":""}`}>{toast.type==="err"?<AlertCircle size={18}/>:<CheckCircle2 size={18}/>} {toast.message}</div>}
    </main>
  </div>;
}

function SetupScreen(){
  return <div className="center"><div className="setup"><div className="brandMark big">B</div><h1>BUONO DASHBOARD</h1><p>Configure as variáveis do Supabase para colocar o painel online.</p><code>VITE_SUPABASE_URL<br/>VITE_SUPABASE_ANON_KEY</code><p>Depois execute <b>npm install</b> e <b>npm run dev</b>.</p></div></div>
}

function Auth({mode,setMode,showToast}){
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [nome,setNome]=useState(""); const [busy,setBusy]=useState(false);
  const submit=async(e)=>{
    e.preventDefault();setBusy(true);
    try{
      if(mode==="login"){
        const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error;
      }else{
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{nome}}}); if(error) throw error;
        if(!data.session) showToast("Conta criada. Verifique o e-mail para confirmar o acesso.");
      }
    }catch(err){showToast(err.message,"err")}finally{setBusy(false)}
  };
  return <div className="auth"><div className="authCard"><div className="authLogo"><div className="brandMark big">B</div><h1>BUONO DASHBOARD</h1><p>Painel de Performance Comercial</p></div>
    <form onSubmit={submit}>{mode==="signup"&&<label>Nome<input value={nome} onChange={e=>setNome(e.target.value)} required placeholder="Seu nome"/></label>}
      <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="voce@buono.com"/></label>
      <label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength="6" placeholder="••••••••"/></label>
      <button className="primary full" disabled={busy}>{busy?"Entrando...":mode==="login"?"Entrar":"Criar conta"}</button>
    </form>
    <button className="linkBtn" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"Criar um novo login":"Já tenho login"}</button>
  </div></div>
}

function Dashboard({stats,week,month,chartData,weekChart,period,setPeriod,from,setFrom,to,setTo,onPDF}){
  return <div className="content">
    <div className="filters">
      <div className="segmented">{[["today","Hoje"],["week","Esta semana"],["month","Este mês"],["custom","Personalizado"]].map(([v,l])=><button className={period===v?"selected":""} onClick={()=>{setPeriod(v); if(v==="week"){const m=monday(new Date());setFrom(iso(m));setTo(iso(new Date(m.getFullYear(),m.getMonth(),m.getDate()+6)))} if(v==="month"){const d=new Date();setFrom(iso(new Date(d.getFullYear(),d.getMonth(),1)));setTo(iso(new Date(d.getFullYear(),d.getMonth()+1,0)))}}} key={v}>{l}</button>)}</div>
      {period==="custom"&&<div className="dateInputs"><label>De<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Até<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>}
      <button className="outline" onClick={onPDF}><Download size={17}/> Salvar PDF</button>
    </div>

    <div className="cards">
      <Stat icon={CircleDollarSign} label="Oportunidades" value={brl(stats.oportunidades)}/>
      <Stat icon={CheckCircle2} label="Total fechado" value={brl(stats.fechado)} positive/>
      <Stat icon={Target} label="Taxa de conversão" value={pct(stats.conversao)} status={stats.conversao>=META_CONVERSAO?"green":"red"} sub={stats.conversao>=META_CONVERSAO?"Acima da meta":"Abaixo da meta"}/>
      <Stat icon={WalletCards} label="Total de entradas" value={brl(stats.entrada)}/>
      <Stat icon={TrendingUp} label="% de entrada" value={pct(stats.entradaPct)} status={stats.entradaPct>=20&&stats.entradaPct<=30?"green":stats.entradaPct<20?"red":"orange"} sub={stats.entradaPct>=20&&stats.entradaPct<=30?"Dentro do ideal":stats.entradaPct<20?"Abaixo do ideal":"Acima do ideal"}/>
    </div>

    <div className="twoCol">
      <section className="panel"><div className="panelHead"><div><h2>📅 Resultado da semana</h2><span>Segunda a domingo</span></div><Badge value={week.conversao} type="conversion"/></div><MiniStats s={week}/></section>
      <section className="panel"><div className="panelHead"><div><h2>🗓️ Resultado do mês</h2><span>Mês atual</span></div><Badge value={month.conversao} type="conversion"/></div><MiniStats s={month}/></section>
    </div>

    <div className="twoCol">
      <section className="panel chartPanel"><div className="panelHead"><div><h2>Evolução da conversão</h2><span>Resultado real × meta de 30%</span></div></div>
        <div className="chart"><ResponsiveContainer width="100%" height={280}><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date"/><YAxis domain={[0,"auto"]} tickFormatter={v=>`${v}%`}/><Tooltip formatter={v=>[pct(v),"Conversão"]}/><ReferenceLine y={30} label="Meta 30%" strokeDasharray="5 5"/><Area type="monotone" dataKey="conversao" strokeWidth={3} fillOpacity={0.12}/></AreaChart></ResponsiveContainer></div>
      </section>
      <section className="panel chartPanel"><div className="panelHead"><div><h2>Comparação entre semanas</h2><span>Últimas semanas com lançamentos</span></div></div>
        <div className="chart"><ResponsiveContainer width="100%" height={280}><BarChart data={weekChart}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="semana"/><YAxis tickFormatter={v=>`${v}%`}/><Tooltip formatter={v=>[pct(v),"Conversão"]}/><ReferenceLine y={30} strokeDasharray="5 5"/><Bar dataKey="conversao" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></div>
      </section>
    </div>

    <section className="panel quick"><div><h2>Resumo do período selecionado</h2><p>Não fechado: <b>{brl(stats.naoFechado)}</b> · Saldo dos fechamentos: <b>{brl(stats.saldo)}</b></p></div><Badge value={stats.entradaPct} type="entry"/></section>
  </div>
}

function MiniStats({s}){return <div className="miniGrid"><div><span>Oportunidades</span><b>{brl(s.oportunidades)}</b></div><div><span>Fechado</span><b>{brl(s.fechado)}</b></div><div><span>Conversão</span><b>{pct(s.conversao)}</b></div><div><span>Entradas</span><b>{brl(s.entrada)}</b></div><div><span>% entrada</span><b>{pct(s.entradaPct)}</b></div></div>}
function Stat({icon:Icon,label,value,status,sub}){return <div className="stat"><div className="statIcon"><Icon size={20}/></div><span>{label}</span><strong>{value}</strong>{sub&&<small className={status}>{status==="green"?"🟢":status==="red"?"🔴":"🟠"} {sub}</small>}</div>}
function Badge({value,type}){let text="",cl="";if(type==="conversion"){cl=value>=30?"green":"red";text=value>=30?"ACIMA DA META":"ABAIXO DA META"}else{cl=value>=20&&value<=30?"green":value<20?"red":"orange";text=value>=20&&value<=30?"DENTRO DO IDEAL":value<20?"ABAIXO DO IDEAL":"ACIMA DO IDEAL"}return <span className={`badge ${cl}`}>{cl==="green"?"🟢":cl==="red"?"🔴":"🟠"} {text}</span>}

function Launches({rows,search,setSearch,onEdit,onDelete,stats}){
  return <div className="content"><div className="listTop"><div><h2>Histórico dos pacientes</h2><span>{rows.length} lançamento(s) no período</span></div><div className="search"><Search size={18}/><input placeholder="Buscar paciente..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
  <section className="panel tableWrap"><table><thead><tr><th>Data</th><th>Paciente</th><th>Oportunidade</th><th>Fechado</th><th>Entrada</th><th>Conversão</th><th>% Entrada</th><th></th></tr></thead><tbody>
  {rows.map(r=>{const conv=r.oportunidade?Number(r.fechado)/Number(r.oportunidade)*100:0;const ent=r.fechado?Number(r.entrada)/Number(r.fechado)*100:0;return <tr key={r.id}><td>{dateBR(r.data)}</td><td><b>{r.paciente}</b></td><td>{brl(r.oportunidade)}</td><td>{brl(r.fechado)}</td><td>{brl(r.entrada)}</td><td><span className={conv>=30?"pill green":"pill red"}>{pct(conv)}</span></td><td><span className={`pill ${ent>=20&&ent<=30?"green":ent<20?"red":"orange"}`}>{pct(ent)}</span></td><td><button className="rowBtn" onClick={()=>onEdit(r)}><Pencil size={16}/></button><button className="rowBtn danger" onClick={()=>onDelete(r.id)}><Trash2 size={16}/></button></td></tr>})}
  {!rows.length&&<tr><td colSpan="8" className="empty">Nenhum lançamento encontrado.</td></tr>}</tbody></table></section></div>
}

function LaunchModal({row,onClose,onSaved,showToast}){
  const [form,setForm]=useState({data:row?.data||isoToday(),paciente:row?.paciente||"",oportunidade:row?.oportunidade??"",fechado:row?.fechado??"",entrada:row?.entrada??""});
  const [busy,setBusy]=useState(false);
  const save=async(e)=>{
    e.preventDefault();setBusy(true);
    const payload={data:form.data,paciente:form.paciente.trim(),oportunidade:Number(form.oportunidade||0),fechado:Number(form.fechado||0),entrada:Number(form.entrada||0),updated_at:new Date().toISOString()};
    try{
      if(!payload.paciente) throw new Error("Informe o nome do paciente.");
      if(payload.fechado>payload.oportunidade) throw new Error("O valor fechado não pode ser maior que a oportunidade.");
      if(payload.entrada>payload.fechado) throw new Error("A entrada não pode ser maior que o valor fechado.");
      const q=row ? supabase.from("lancamentos").update(payload).eq("id",row.id) : supabase.from("lancamentos").insert(payload);
      const {error}=await q;if(error) throw error;onSaved();
    }catch(err){showToast(err.message,"err")}finally{setBusy(false)}
  };
  return <div className="overlay"><div className="modal"><div className="modalHead"><div><h2>{row?"Editar lançamento":"Novo lançamento"}</h2><span>Preencha somente os dados do paciente.</span></div><button onClick={onClose}><X/></button></div>
    <form onSubmit={save} className="formGrid"><label>Data<input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} required/></label><label className="full2">Nome do paciente<input value={form.paciente} onChange={e=>setForm({...form,paciente:e.target.value})} placeholder="Ex.: João da Silva" required/></label>
    <label>Valor da oportunidade<input inputMode="decimal" value={form.oportunidade} onChange={e=>setForm({...form,oportunidade:e.target.value.replace(",",".")})} placeholder="5000.00" required/></label>
    <label>Valor fechado<input inputMode="decimal" value={form.fechado} onChange={e=>setForm({...form,fechado:e.target.value.replace(",",".")})} placeholder="3500.00" required/></label>
    <label>Valor da entrada<input inputMode="decimal" value={form.entrada} onChange={e=>setForm({...form,entrada:e.target.value.replace(",",".")})} placeholder="700.00" required/></label>
    <div className="modalActions"><button type="button" className="outline" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy?"Salvando...":"Salvar lançamento"}</button></div></form>
  </div></div>
}

function UsersPage({users,onRefresh,showToast}){
  const [form,setForm]=useState({nome:"",email:"",senha:""});
  const [busy,setBusy]=useState(false);
  const create=async(e)=>{
    e.preventDefault();setBusy(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const token=session?.access_token;
      const res=await fetch(`${SUPABASE_URL}/functions/v1/create-user`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(form)});
      const body=await res.json(); if(!res.ok) throw new Error(body.error||"Não foi possível criar o usuário.");
      setForm({nome:"",email:"",senha:""});await onRefresh();showToast("Login criado.");
    }catch(e){showToast(e.message,"err")}finally{setBusy(false)}
  };
  return <div className="content"><div className="listTop"><div><h2>Usuários</h2><span>Todos os usuários têm acesso completo.</span></div></div>
    <div className="twoCol usersGrid"><section className="panel"><div className="panelHead"><div><h2><UserPlus size={20}/> Criar novo login</h2><span>O novo usuário poderá visualizar, editar e excluir dados.</span></div></div>
      <form className="userForm" onSubmit={create}><label>Nome<input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} required/></label><label>E-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label><label>Senha temporária<input type="password" minLength="6" value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})} required/></label><button className="primary" disabled={busy}>{busy?"Criando...":"Criar login"}</button></form>
    </section><section className="panel"><div className="panelHead"><div><h2>Equipe</h2><span>{users.length} usuário(s)</span></div></div><div className="userList">{users.map(u=><div className="userItem" key={u.id}><div className="avatar">{(u.nome||"U")[0].toUpperCase()}</div><div><b>{u.nome||"Usuário"}</b><span>{u.email}</span></div><span className="access">Acesso total</span></div>)}</div></section></div>
  </div>
}

export default App;
