import React, { useMemo, useRef, useState } from "react";
import { supabase, supabaseReady } from "./supabase";
import { jsPDF } from "jspdf";
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Bell, Check, ChevronDown,
  CircleHelp, Clock3, FileCheck2, FilePlus2, Files, Home, LayoutDashboard,
  LockKeyhole, Mail, Menu, Music2, PenLine, Plus, Search, Send, Settings,
  ShieldCheck, Trash2, Users, Wallet, X
} from "lucide-react";

const ADMIN_EMAIL = "bambuzarecords@gmail.com";
const emptyComposer = () => ({ name:"", id:"", email:"", role:"Compositor", share:"" });
const initialComposers = [
  { name:"Johnatan Restrepo", id:"", email:"", role:"Compositor", share:"" },
  emptyComposer(), emptyComposer(), emptyComposer(), emptyComposer(), emptyComposer()
];

function App() {
  const [section, setSection] = useState("Inicio");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [song, setSong] = useState("");
  const [project, setProject] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [composers, setComposers] = useState(initialComposers);
  const [docType, setDocType] = useState("Acuerdo de splits");
  const [notice, setNotice] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [signatureEmail, setSignatureEmail] = useState("");
  const [savedDocs, setSavedDocs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bambuza-sign-docs") || "[]"); } catch { return []; }
  });
  const [contacts, setContacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bambuza-sign-contacts") || "[]"); } catch { return []; }
  });
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const validComposers = composers.filter(c => c.name.trim());
  const total = validComposers.reduce((sum,c) => sum + (Number(c.share)||0), 0);
  const allSharesValid = validComposers.length > 0 && Math.abs(total-100)<0.001 && validComposers.every(c => Number(c.share)>=0);
  const filteredDocs = savedDocs.filter(d => (d.song+" "+d.project+" "+d.type).toLowerCase().includes(query.toLowerCase()));

  const nav = [
    { label:"Inicio", icon:LayoutDashboard },
    { label:"Documentos", icon:Files },
    { label:"Nuevo documento", icon:FilePlus2 },
    { label:"Compositores", icon:Users },
  ];
  const updateComposer = (index, field, value) => setComposers(old => old.map((c,i) => i===index ? {...c,[field]:value} : c));
  const persistDocs = (next) => { setSavedDocs(next); localStorage.setItem("bambuza-sign-docs", JSON.stringify(next)); };
  const persistContacts = (next) => { setContacts(next); localStorage.setItem("bambuza-sign-contacts", JSON.stringify(next)); };
  const show = (message) => { setNotice(message); window.setTimeout(()=>setNotice(""),3500); };

  const buildDocument = () => ({
    id: crypto.randomUUID(), type:docType, song:song.trim(), project:project.trim(),
    date, composers:validComposers.map(c=>({...c,share:Number(c.share)||0})),
    total, status:"Borrador", createdAt:new Date().toISOString()
  });

  const saveDraft = () => {
    if (!song.trim()) return show("Escribe el nombre de la obra musical.");
    if (!validComposers.length) return show("Agrega al menos un compositor.");
    if (!allSharesValid) return show("Los porcentajes deben sumar exactamente 100 %.");
    const doc = buildDocument();
    persistDocs([doc,...savedDocs]);
    show("Documento guardado en este navegador.");
    setSection("Documentos");
  };

  const downloadPdf = (doc) => {
    const pdf = new jsPDF();
    pdf.setFillColor(17,17,17); pdf.rect(0,0,210,34,"F");
    pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(21);
    pdf.text("BAMBUZA",15,17); pdf.setFontSize(9); pdf.text("SIGN  /  BAMBUZA RECORDS",15,25);
    pdf.setTextColor(25,25,25); pdf.setFontSize(16); pdf.text(doc.type,15,49);
    pdf.setFontSize(10); pdf.setFont("helvetica","normal");
    pdf.text("Obra musical: "+doc.song,15,62);
    pdf.text("Proyecto / artista: "+(doc.project||"No especificado"),15,70);
    pdf.text("Fecha: "+doc.date,15,78);
    pdf.setFont("helvetica","bold"); pdf.text("PARTICIPANTES Y DISTRIBUCIÓN",15,94);
    let y=104;
    doc.composers.forEach((c,i)=>{
      pdf.setFont("helvetica","normal");
      pdf.text((i+1)+". "+c.name+"  |  "+c.role+"  |  "+c.share+"%",15,y);
      y+=8;
      if(y>255){pdf.addPage();y=20;}
    });
    y+=8; pdf.setFont("helvetica","bold"); pdf.text("DECLARACIÓN DE ACUERDO",15,y); y+=8;
    pdf.setFont("helvetica","normal");
    const disclaimer = "Los participantes declaran que revisaron la información consignada y que los porcentajes reflejan el acuerdo informado para esta obra. Este documento es un borrador operativo y debe ser revisado y aceptado por todas las partes antes de considerarse un acuerdo definitivo.";
    const lines=pdf.splitTextToSize(disclaimer,178); pdf.text(lines,15,y);
    y += lines.length*5+12;
    pdf.setFont("helvetica","bold"); pdf.text("FIRMAS",15,y); y+=10;
    doc.composers.forEach(c=>{
      pdf.setFont("helvetica","normal");
      pdf.line(15,y+8,90,y+8); pdf.text(c.name,15,y+14);
      pdf.text("Firma pendiente",105,y+6); y+=24;
      if(y>265){pdf.addPage();y=20;}
    });
    pdf.setFontSize(8); pdf.setTextColor(110,110,110);
    pdf.text("Generado por BAMBUZA SIGN. La generación del PDF no acredita por sí sola identidad ni firma electrónica.",15,287);
    pdf.save("BAMBUZA-SIGN-"+doc.song.replace(/[^a-z0-9]/gi,"-")+".pdf");
  };

  const downloadCurrent = () => {
    if (!song.trim() || !validComposers.length || !allSharesValid) return show("Completa la obra y verifica que los splits sumen 100 %.");
    downloadPdf(buildDocument());
  };

  const loadSignatureCanvas = () => {
    const canvas=canvasRef.current;
    if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    const ratio=window.devicePixelRatio||1;
    canvas.width=rect.width*ratio; canvas.height=160*ratio;
    const ctx=canvas.getContext("2d"); ctx.scale(ratio,ratio);
    ctx.lineWidth=2; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.strokeStyle="#111";
  };
  const point = (e) => {
    const r=canvasRef.current.getBoundingClientRect();
    return {x:e.clientX-r.left,y:e.clientY-r.top};
  };
  const startDraw = (e) => { drawing.current=true; const p=point(e); const ctx=canvasRef.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(p.x,p.y); };
  const draw = (e) => { if(!drawing.current)return; const p=point(e); const ctx=canvasRef.current.getContext("2d"); ctx.lineTo(p.x,p.y);ctx.stroke(); };
  const stopDraw = () => { drawing.current=false; };
  const clearSignature = () => { const c=canvasRef.current;if(c)c.getContext("2d").clearRect(0,0,c.width,c.height); };

  const navTo = (label) => { setSection(label);setMenuOpen(false); };
  const Status = ({children}) => <span className="status">{children}</span>;

  return <div className="app-shell">
    <aside className={"sidebar "+(menuOpen?"sidebar-open":"")}>
      <div className="brand"><div className="brand-mark">B.</div><div><strong>BAMBUZA</strong><span>SIGN / RECORDS</span></div><button className="mobile-close" onClick={()=>setMenuOpen(false)}><X size={18}/></button></div>
      <div className="workspace"><span className="workspace-dot"></span><div><b>Bambuza Records</b><small>Espacio de trabajo</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">PLATAFORMA</div>
      {nav.map(item=>{const Icon=item.icon;return <button key={item.label} className={"nav-item "+(section===item.label?"active":"")} onClick={()=>navTo(item.label)}><Icon size={18}/><span>{item.label}</span>{item.label==="Documentos"&&savedDocs.length>0&&<em>{savedDocs.length}</em>}</button>;})}
      <div className="nav-label lower">CUENTA</div>
      <button className={"nav-item "+(section==="Configuración"?"active":"")} onClick={()=>navTo("Configuración")}><Settings size={18}/><span>Configuración</span></button>
      <div className="sidebar-bottom"><div className="secure"><ShieldCheck size={17}/><div><b>Espacio privado</b><small>Protección de documentos</small></div></div><div className="user-card"><div className="avatar">B</div><div><b>Bambuza Admin</b><small>{ADMIN_EMAIL}</small></div><ChevronDown size={15}/></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><button className="menu-button" onClick={()=>setMenuOpen(true)}><Menu/></button><div className="breadcrumbs">Bambuza Records <span>/</span> <b>{section}</b></div><div className="top-actions"><span className="online-dot"></span><span className="workspace-status">Sistema de gestión</span><button className="icon-button" title="Ayuda" onClick={()=>show("BAMBUZA SIGN · Versión inicial de construcción")}><CircleHelp size={19}/></button><div className="top-avatar">B</div></div></header>

      <div className="content">
        {notice&&<div className="toast"><Check size={17}/>{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
        {section==="Inicio"&&<><div className="page-heading"><div><div className="eyebrow">PANEL DE CONTROL</div><h1>Tu operación creativa,<br/><span>en orden.</span></h1><p>Gestiona acuerdos, participantes y documentos de Bambuza Records.</p></div><button className="primary-button" onClick={()=>navTo("Nuevo documento")}><Plus size={17}/> Nuevo documento</button></div>
          <div className="stat-grid"><div className="stat-card"><div className="stat-icon"><Files/></div><span>Documentos creados</span><strong>{savedDocs.length}</strong><small>En este dispositivo</small></div><div className="stat-card"><div className="stat-icon"><Users/></div><span>Contactos guardados</span><strong>{contacts.length}</strong><small>Base local de contactos</small></div><div className="stat-card"><div className="stat-icon"><Clock3/></div><span>Firmas pendientes</span><strong>—</strong><small>Firma online por configurar</small></div><div className="stat-card"><div className="stat-icon"><FileCheck2/></div><span>Completados</span><strong>{savedDocs.filter(d=>d.status==="Firmado").length}</strong><small>Documentos finalizados</small></div></div>
          <div className="section-row"><div><h2>Actividad reciente</h2><p>Tus últimos documentos creados</p></div><button className="text-button" onClick={()=>navTo("Documentos")}>Ver todos <ArrowRight size={16}/></button></div>
          <div className="table-card">{savedDocs.length===0?<div className="empty-state"><div className="empty-icon"><FilePlus2/></div><b>Aún no tienes documentos</b><p>Empieza creando un acuerdo de splits para una obra musical.</p><button className="secondary-button" onClick={()=>navTo("Nuevo documento")}>Crear primer documento</button></div>:<DocTable docs={savedDocs.slice(0,5)} onDownload={downloadPdf}/>}</div>
          <div className="setup-note"><LockKeyhole size={19}/><div><b>Preparando tu espacio online</b><p>La versión actual permite probar el generador. Para sincronización entre dispositivos, enlaces privados y firma online debemos conectar la base de datos.</p></div><Status>Configuración pendiente</Status></div>
        </>}
        {section==="Nuevo documento"&&<><div className="page-heading compact"><div><div className="eyebrow">GENERADOR DE DOCUMENTOS</div><h1>Nuevo <span>acuerdo.</span></h1><p>Completa la información de la obra y distribuye el 100 % de participación.</p></div><button className="secondary-button" onClick={()=>navTo("Documentos")}><ArrowLeft size={16}/> Volver</button></div>
          <div className="form-layout"><div className="form-main">
            <div className="panel"><div className="panel-title"><span className="step">01</span><div><h3>Información del documento</h3><p>Identifica la obra y el tipo de acuerdo.</p></div></div>
              <label>Tipo de documento<select value={docType} onChange={e=>setDocType(e.target.value)}><option>Acuerdo de splits</option><option>Acuerdo de composición</option><option>Contrato de producción musical</option><option>Acuerdo de colaboración artística</option></select></label>
              <div className="two-fields"><label>Nombre de la obra<input value={song} onChange={e=>setSong(e.target.value)} placeholder="Nombre de la canción"/></label><label>Proyecto / artista<input value={project} onChange={e=>setProject(e.target.value)} placeholder="Artista o proyecto"/></label></div>
              <label>Fecha del acuerdo<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
            </div>
            <div className="panel"><div className="panel-title"><span className="step">02</span><div><h3>Compositores y porcentajes</h3><p>Registra hasta seis participantes. La distribución debe sumar 100 %.</p></div></div>
              <div className="composer-head"><span>PARTICIPANTE</span><span>ROL</span><span>PORCENTAJE</span><span></span></div>
              {composers.map((c,i)=><div className="composer-row" key={i}><div className="person-input"><div className="person-number">{i+1}</div><div><input aria-label={"Nombre compositor "+(i+1)} value={c.name} onChange={e=>updateComposer(i,"name",e.target.value)} placeholder={i===0?"Johnatan Restrepo":"Nombre completo"}/><input aria-label={"Correo compositor "+(i+1)} className="sub-input" value={c.email} onChange={e=>updateComposer(i,"email",e.target.value)} placeholder="Correo electrónico"/></div></div><select aria-label="Rol" value={c.role} onChange={e=>updateComposer(i,"role",e.target.value)}><option>Compositor</option><option>Productor</option><option>Autor</option><option>Beatmaker</option><option>Letrista</option><option>Arreglista</option></select><div className="share-input"><input type="number" min="0" max="100" step="0.01" value={c.share} onChange={e=>updateComposer(i,"share",e.target.value)} placeholder="0"/><span>%</span></div><button className="clear-row" title="Limpiar participante" onClick={()=>updateComposer(i,"name","")}><X size={15}/></button></div>)}
              <div className={"split-total "+(allSharesValid?"valid":"")}><div><span>Distribución total</span><b>{total.toFixed(2)}%</b></div><div className="progress"><i style={{width:Math.min(total,100)+"%"}}/></div><small>{allSharesValid?"Distribución correcta.":"Los porcentajes deben sumar exactamente 100 %."}</small></div>
            </div>
            <div className="form-buttons"><button className="secondary-button" onClick={saveDraft}><Check size={16}/> Guardar borrador</button><button className="primary-button" onClick={downloadCurrent}><ArrowDownToLine size={16}/> Descargar PDF</button></div>
          </div>
          <aside className="form-aside"><div className="preview-card"><div className="preview-label">VISTA PREVIA</div><div className="preview-brand">BAMBUZA <span>SIGN</span></div><div className="preview-line"></div><h3>{song||"Nombre de la obra"}</h3><p>{project||"Proyecto / artista"}</p><div className="preview-meta"><span>DOCUMENTO</span><b>{docType}</b></div><div className="preview-meta"><span>FECHA</span><b>{date}</b></div><div className="preview-line"></div><span className="preview-label">PARTICIPANTES</span>{validComposers.map((c,i)=><div className="preview-person" key={i}><span>{c.name}</span><b>{Number(c.share)||0}%</b></div>)}{!validComposers.length&&<small>Los participantes aparecerán aquí.</small>}<div className="preview-total"><span>TOTAL</span><b>{total.toFixed(2)}%</b></div></div><div className="aside-tip"><ShieldCheck size={18}/><p><b>Revisión necesaria</b><br/>Confirma los nombres, roles y porcentajes con todos los participantes antes de enviar el acuerdo.</p></div></aside></div>
        </>}
        {section==="Documentos"&&<><div className="page-heading compact"><div><div className="eyebrow">ARCHIVO DIGITAL</div><h1>Mis <span>documentos.</span></h1><p>Consulta y descarga los acuerdos creados.</p></div><button className="primary-button" onClick={()=>navTo("Nuevo documento")}><Plus size={17}/> Nuevo documento</button></div><div className="filter-bar"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por obra o proyecto..."/></div><span>{filteredDocs.length} documentos</span></div><div className="table-card">{filteredDocs.length?<DocTable docs={filteredDocs} onDownload={downloadPdf}/>:<div className="empty-state"><div className="empty-icon"><Files/></div><b>No encontramos documentos</b><p>Crea un nuevo acuerdo para empezar tu archivo.</p></div>}</div></>}
        {section==="Compositores"&&<><div className="page-heading compact"><div><div className="eyebrow">DIRECTORIO CREATIVO</div><h1>Red de <span>colaboradores.</span></h1><p>Contactos registrados en este navegador.</p></div></div><ContactManager contacts={contacts} onSave={persistContacts}/></>}
        {section==="Configuración"&&<><div className="page-heading compact"><div><div className="eyebrow">PREFERENCIAS</div><h1>Configuración.</h1><p>Datos generales del espacio de trabajo.</p></div></div><div className="panel settings-panel"><h3>Cuenta administradora</h3><label>Correo administrador<input value={ADMIN_EMAIL} readOnly/></label><label>Nombre del espacio<input value="Bambuza Records" readOnly/></label><label>Conexión de base de datos<input value={supabaseReady?"Supabase configurado":"Pendiente de conectar Supabase"} readOnly/></label><div className="settings-warning"><LockKeyhole size={18}/><span>La autenticación, permisos de administrador y almacenamiento en la nube se habilitarán al configurar Supabase.</span></div></div></>}
      </div>
      <footer className="footer"><span>BAMBUZA SIGN © {new Date().getFullYear()} · Bambuza Records</span><span>DOCUMENTS · SPLITS · AGREEMENTS</span></footer>
    </main>
  </div>;
}

function DocTable({docs,onDownload}) {
  return <div className="table-wrap"><table><thead><tr><th>DOCUMENTO</th><th>FECHA</th><th>PARTICIPANTES</th><th>ESTADO</th><th></th></tr></thead><tbody>{docs.map(doc=><tr key={doc.id}><td><div className="doc-name"><div className="doc-icon"><Music2 size={17}/></div><div><b>{doc.song}</b><small>{doc.type} · {doc.project||"Sin proyecto"}</small></div></div></td><td>{doc.date}</td><td>{doc.composers.length} participantes</td><td><span className="draft-state"><span></span>{doc.status}</span></td><td><button className="download-button" onClick={()=>onDownload(doc)} title="Descargar PDF"><ArrowDownToLine size={17}/></button></td></tr>)}</tbody></table></div>;
}

function ContactManager({contacts,onSave}) {
  const [form,setForm]=useState(emptyComposer());
  const update=(k,v)=>setForm(old=>({...old,[k]:v}));
  const submit=()=>{if(!form.name.trim())return;onSave([{...form,id:crypto.randomUUID()},...contacts]);setForm(emptyComposer());};
  return <div className="contacts-layout"><div className="panel"><div className="panel-title"><div><h3>Agregar colaborador</h3><p>Guarda los datos básicos del participante.</p></div></div><label>Nombre completo<input value={form.name} onChange={e=>update("name",e.target.value)} placeholder="Nombre y apellidos"/></label><label>Correo electrónico<input type="email" value={form.email} onChange={e=>update("email",e.target.value)} placeholder="correo@ejemplo.com"/></label><label>Identificación<input value={form.id} onChange={e=>update("id",e.target.value)} placeholder="Cédula (opcional)"/></label><label>Rol habitual<select value={form.role} onChange={e=>update("role",e.target.value)}><option>Compositor</option><option>Productor</option><option>Artista</option><option>Beatmaker</option><option>Autor</option></select></label><button className="primary-button full-button" onClick={submit}><Plus size={16}/> Guardar contacto</button></div><div className="panel"><div className="panel-title"><div><h3>Contactos guardados</h3><p>{contacts.length} colaboradores</p></div></div>{contacts.length?contacts.map(c=><div className="contact-row" key={c.id}><div className="contact-avatar">{c.name.slice(0,1).toUpperCase()}</div><div><b>{c.name}</b><small>{c.email||c.role}</small></div><button className="clear-row" onClick={()=>onSave(contacts.filter(x=>x.id!==c.id))}><Trash2 size={15}/></button></div>):<div className="empty-small">Todavía no hay contactos guardados.</div>}</div></div>;
}

export default App;