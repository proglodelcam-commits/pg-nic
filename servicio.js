/* PG del Campo — Servicio de pedidos SIN Cloud Functions (plan Spark / sin Blaze).
   Mantiene la misma API que usa app-6.js: PGServicio.iniciar / pedido / nombreCliente / resumen / nueva.
   Escribe en los mismos nodos que lee el Panel:
     compras_registro/{id}, transacciones/{id}, cuentas_por_cobrar/{id} (solo crédito),
     clientes/{tel}/compras/{id} con estrella:'pendiente', y descuenta productos/{id}/stock.
   NUNCA escribe clientes/{tel}/total_compras ni monto_total: eso lo suma el Panel al confirmar el pago.
   Nada se marca como pagado desde el navegador. */
import {getDatabase,ref,get,update,runTransaction} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import {getAuth,signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

let app=null,authReady=null,last=null;
const storageKey='pg-pedido-idempotente-v2';
const r2=n=>Math.round((Number(n)||0)*100)/100;
const db=()=>getDatabase(app);

function initialize(a){
 app=a;const auth=getAuth(a);
 authReady=auth.currentUser?Promise.resolve(auth.currentUser):signInAnonymously(auth);
 authReady.catch(()=>{});
}
async function ready(){
 if(!app)throw new Error('La aplicación todavía está cargando. Intentá de nuevo.');
 try{await authReady;}
 catch(e){const error=new Error('No se pudo iniciar la sesión segura con Firebase. Revisá tu conexión e intentá de nuevo. No se registró ningún pedido.');error.code=e&&e.code;throw error;}
}
const denied=e=>/permission[_ -]?denied/i.test((e&&(e.code||e.message))||'');

function read(){try{return JSON.parse(sessionStorage.getItem(storageKey));}catch(e){return last;}}
function save(v){last=v;try{sessionStorage.setItem(storageKey,JSON.stringify(v));}catch(e){}}
function uuid(){if(crypto.randomUUID)return crypto.randomUUID();const a=new Uint8Array(20);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');}

/* Número de recibo: mismo contador que usa el Panel (meta/contador_recibo = siguiente a emitir), con transacción para no repetir. */
async function nextReceipt(){
 let asignado=null;
 const r=await runTransaction(ref(db(),'meta/contador_recibo'),cur=>{
  const n=(cur===null||cur===undefined)?1001:(parseInt(cur,10)||1001);
  asignado=n;return n+1;
 });
 if(!r.committed||asignado===null)throw new Error('No se pudo asignar el número de pedido. Intentá de nuevo.');
 return String(asignado).padStart(7,'0');
}

async function tiers(){
 let v=[{min:600,pct:1},{min:1200,pct:2},{min:1800,pct:3}];
 try{const s=await get(ref(db(),'config/fidelidad/volumen'));const x=s.val();if(Array.isArray(x)&&x.length)v=x;else if(x&&typeof x==='object')v=Object.values(x);}catch(e){}
 return v;
}

/* Reserva de inventario con transacciones atómicas (evita vender de más). Si las reglas no permiten
   escribir stock al público, se omite y el pedido queda marcado con stock_descontado:false. */
async function reservarStock(items){
 const hechos=[];
 try{
  for(const it of items){
   const r=await runTransaction(ref(db(),'productos/'+it.id+'/stock'),cur=>{
    if(cur===null||cur===undefined)return cur; // sin dato de stock: no se bloquea
    const n=Number(cur);
    if(!Number.isFinite(n)||n<it.cantidad)return; // aborta: no alcanza
    return n-it.cantidad;
   });
   if(!r.committed){
    await devolverStock(hechos);
    const e=new Error('Stock insuficiente para "'+it.nombre+'". Actualizá tu carrito e intentá de nuevo.');e.code='stock';throw e;
   }
   hechos.push(it);
  }
  return {ok:true,hechos};
 }catch(e){
  if(e.code==='stock')throw e;
  await devolverStock(hechos);
  if(denied(e))return {ok:false,hechos:[]};
  throw e;
 }
}
async function devolverStock(items){
 for(const it of items){try{await runTransaction(ref(db(),'productos/'+it.id+'/stock'),cur=>(Number(cur)||0)+it.cantidad);}catch(e){}}
}

async function order(data){
 await ready();
 data.telefono=PGWhatsApp.local(data.telefono);
 if(!data.telefono)throw new Error('Ingresá los 8 dígitos de tu WhatsApp.');
 const nombre=String(data.nombre||'').trim().slice(0,80);
 if(!nombre)throw new Error('Escribí tu nombre completo.');
 const fingerprint=JSON.stringify(data);let state=read();
 if(!state||state.fingerprint!==fingerprint){state={fingerprint,solicitud:uuid()};save(state);}
 // Mismo pedido ya registrado en esta sesión: se devuelve sin duplicar ni descontar stock otra vez.
 if(state.resultado)return state.resultado;

 const modo=data.modo==='credito'?'credito':'contado';
 const metodo=modo==='contado'?(data.metodo==='contra_entrega'?'contra_entrega':'lafise'):'N/A';
 const tel=data.telefono;

 // 1) Productos y precios REALES desde la base (no se confía en precios del navegador)
 const pedidos=new Map();
 (Array.isArray(data.items)?data.items:[]).forEach(i=>{
  const id=String((i&&i.id)||'').trim();const c=parseInt(i&&i.cantidad,10);
  if(!id||!(c>=1)||c>999)return;pedidos.set(id,(pedidos.get(id)||0)+c);
 });
 if(!pedidos.size)throw new Error('El carrito está vacío.');
 const snap=await get(ref(db(),'productos'));const catalogo=snap.val()||{};
 const items=[];let subtotal=0;
 for(const [id,cantidad] of pedidos){
  const p=catalogo[id];
  if(!p||!(Number(p.precio)>0))throw new Error('Un producto de tu carrito ya no está disponible. Actualizá la página.');
  if(p.stock!=null&&Number(p.stock)<cantidad)throw new Error('Stock insuficiente para "'+(p.nombre||id)+'". Quedan '+Number(p.stock)+'.');
  const precio=r2(p.precio);items.push({id,cantidad,nombre:p.nombre||id,precio});subtotal=r2(subtotal+precio*cantidad);
 }

 // 2) Descuento por volumen y envío calculados aquí con las mismas reglas de la tienda
 let pct=0;
 if(data.tipo!=='distribuidor'){for(const t of [...await tiers()].sort((a,b)=>a.min-b.min)){if(subtotal>Number(t.min))pct=Number(t.pct)/100;}}
 const descuento=r2(subtotal*pct);
 const envioSel=Number(data.envio);
 const aConvenir=envioSel===-1;
 const envio=aConvenir?0:(Number.isFinite(envioSel)&&envioSel>0?r2(envioSel):0);
 const total=r2(subtotal-descuento+envio);
 if(Number.isFinite(Number(data.totalEsperado))&&Math.abs(Number(data.totalEsperado)-total)>0.05)
  throw new Error('Los precios o descuentos cambiaron. Actualizá la página y revisá el total antes de confirmar.');

 // 3) Identificadores (se reutilizan si hay que reintentar el mismo pedido)
 if(!state.numero){state.numero=await nextReceipt();save(state);}
 if(!state.id){state.id=(modo==='credito'?'credito_':'contado_')+Date.now();save(state);}
 const numero=state.numero,id=state.id,now=new Date().toISOString();

 // 4) Reservar inventario
 const reserva=await reservarStock(items);

 // 5) Un solo update atómico con todo el pedido
 let nombreExistente='';
 try{const s=await get(ref(db(),'clientes/'+tel+'/nombre'));nombreExistente=typeof s.val()==='string'?s.val().trim():'';}catch(e){}
 const origen=String(data.origen||'Tienda en Línea').slice(0,40);
 const tipoTxt=modo==='credito'?'Venta a crédito':'Venta al contado';
 const estado=modo==='credito'?'pendiente':'por_confirmar'; // nunca "pagada" desde el navegador
 const itemsDet={};items.forEach(i=>{itemsDet[i.id]={cantidad:i.cantidad,nombre:i.nombre,precio:i.precio};});
 const u={};
 if(!nombreExistente)u['clientes/'+tel+'/nombre']=nombre; // no se sobrescribe el nombre de un cliente ya registrado
 u['clientes/'+tel+'/compras/'+id]={
  id,fecha:now,numero_recibo:numero,origen,tipo:tipoTxt,estado,
  subtotal,porcentaje_descuento:pct,monto_descuento:descuento,envio,costo_envio:envio,envio_a_convenir:aConvenir,total,
  monto_pagado:0,saldo_pendiente:total,metodo_pago:metodo,zona:String(data.zona||'').slice(0,80),direccion:String(data.direccion||'').slice(0,200),
  items:itemsDet,
  estrella:'pendiente',estrella_monto:total,estrella_fecha:now,estrella_origen:origen
 };
 u['compras_registro/'+id]={
  id,fecha:now,whatsapp_cliente:tel,nombre_cliente:nombreExistente||nombre,numero_recibo:numero,origen,
  tipo:modo,estado,items:itemsDet,subtotal,descuento,monto_descuento:descuento,tipo_descuento:pct>0?'volumen':'',
  envio,costo_envio:envio,total,monto_revertir:total,monto_pagado:0,saldo_pendiente:total,metodo_pago:metodo,
  zona:String(data.zona||'').slice(0,80),direccion:String(data.direccion||'').slice(0,200),
  stock_descontado:reserva.ok
 };
 u['transacciones/'+id]={
  id,fecha:now,cliente:nombreExistente||nombre,whatsapp:tel,tipo:tipoTxt,origen,
  monto:total,monto_pagado:0,saldo_pendiente:total,estado,numero_recibo:numero,metodo_pago:metodo,envio,costo_envio:envio
 };
 if(modo==='credito'){
  u['cuentas_por_cobrar/'+id]={
   id,fecha:now,whatsapp_cliente:tel,nombre_cliente:nombreExistente||nombre,numero_recibo:numero,origen,
   monto_original:total,monto_pagado:0,saldo_pendiente:total,estado:'pendiente',tipo:tipoTxt,items:itemsDet,metodo_pago:'N/A'
  };
 }
 try{await update(ref(db()),u);}
 catch(e){
  await devolverStock(reserva.hechos);
  const error=new Error(denied(e)
   ?'Firebase no autorizó el registro del pedido (reglas de la base de datos). Contactá al negocio por WhatsApp. No se confirmó un pago ni se descontó inventario.'
   :'No se pudo registrar el pedido por un problema de conexión. Intentá de nuevo. No se confirmó un pago ni se descontó inventario.');
  error.code=e&&e.code;console.error('[PGServicio] Falló el registro del pedido',e);throw error;
 }
 const result={id,numero_recibo:numero,total,subtotal,descuento,costo_envio:envio,stock_descontado:reserva.ok};
 save({...state,resultado:result});
 return result;
}

/* Consulta mínima del cliente por WhatsApp: solo campos sueltos, nunca la lista de clientes. */
async function customerSummary(raw){
 await ready();
 const tel=PGWhatsApp.local(raw);
 let nombre='',compras;
 try{const s=await get(ref(db(),'clientes/'+tel+'/nombre'));nombre=typeof s.val()==='string'?s.val().trim():'';}
 catch(e){
  const error=new Error('No se pudo recuperar el nombre del cliente. Escribí tu nombre manualmente.');error.code=e&&e.code;throw error;
 }
 try{const s=await get(ref(db(),'clientes/'+tel+'/total_compras'));const n=parseInt(s.val(),10);if(Number.isFinite(n)&&n>=0)compras=n;}catch(e){}
 let N=10;
 try{const s=await get(ref(db(),'config/fidelidad'));const c=s.val()||{};const n=parseInt(c.comprasPorPremio||c.compras_por_premio||0,10);if(n>0)N=n;}catch(e){}
 const total=compras||0;let estrellas=total%N;if(estrellas===0&&total>0)estrellas=N;
 return {tel,nombre,registrado:!!nombre,compras,estrellas};
}

// Esta página nunca escribe contadores de compras, pagos o premios del cliente: eso lo confirma el Panel.
window.PGServicio=Object.freeze({
 iniciar:initialize,pedido:order,nombreCliente:customerSummary,resumen:customerSummary,
 nueva:()=>{last=null;try{sessionStorage.removeItem(storageKey);}catch(e){}}
});

document.getElementById('pg-nueva-orden')?.addEventListener('click',()=>{if(confirm('¿Querés comenzar otra orden independiente? Esto no cancela la anterior.')){PGServicio.nueva();alert('Ahora podés enviar una nueva orden.');}});
