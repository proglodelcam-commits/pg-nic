import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import {getDatabase,ref,get} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import {getAuth,signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
let app=null,authReady=null,last=null;
const storageKey='pg-pedido-idempotente-v1';
function initialize(a){app=a;const auth=getAuth(a);authReady=auth.currentUser?Promise.resolve(auth.currentUser):signInAnonymously(auth);authReady.catch(()=>{});}
async function invoke(name,data){
 if(!app)throw new Error('La aplicación todavía está cargando. Intentá de nuevo.');
 try{await authReady;return (await httpsCallable(getFunctions(app,'us-central1'),name)(data)).data;}
 catch(e){
  if(['functions/not-found','functions/unavailable','functions/internal'].includes(e.code)){const error=new Error('El servicio seguro de pedidos no está disponible. Contactá al negocio. No se confirmó un pago ni se descontó inventario.');error.code=e.code;throw error;}
  throw e;
 }
}
function read(){try{return JSON.parse(sessionStorage.getItem(storageKey));}catch(e){return last;}}
function save(v){last=v;try{sessionStorage.setItem(storageKey,JSON.stringify(v));}catch(e){}}
function uuid(){if(crypto.randomUUID)return crypto.randomUUID();const a=new Uint8Array(20);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');}
async function order(data){
 data.telefono=PGWhatsApp.local(data.telefono);
 const fingerprint=JSON.stringify(data);let state=read();
 if(!state||state.fingerprint!==fingerprint){state={fingerprint,solicitud:uuid(),uid:getAuth(app).currentUser?.uid};save(state);}
 const result=await invoke('pgCrearPedido',{...data,solicitud:state.solicitud});
 save({...state,resultado:result});return result;
}
// Consulta mínima del nombre. No descarga la lista de clientes ni cambia reglas de acceso.
async function customerName(raw){
 const telefono=PGWhatsApp.local(raw);
 try{return await invoke('pgResumenCliente',{telefono});}
 catch(e){
  if(!['functions/not-found','functions/unavailable','functions/internal'].includes(e.code))throw e;
  try{
   await authReady;
   const snap=await get(ref(getDatabase(app),'clientes/'+telefono+'/nombre'));
   const nombre=snap.val();
   return {tel:telefono,nombre:typeof nombre==='string'?nombre.trim():'',registrado:typeof nombre==='string'&&!!nombre.trim()};
  }catch(readError){
   const error=new Error('No se pudo recuperar el nombre: el servicio de clientes no está disponible y Firebase no autorizó la consulta. Escribí tu nombre manualmente; el negocio debe habilitar el servicio seguro de clientes.');
   error.code=readError?.code||e.code;throw error;
  }
 }
}

// Never write customer purchase counters, payments, rewards or stock from this browser.
window.PGServicio=Object.freeze({iniciar:initialize,pedido:order,nombreCliente:customerName,nueva:()=>{last=null;try{sessionStorage.removeItem(storageKey);}catch(e){}},resumen:telefono=>invoke('pgResumenCliente',{telefono:PGWhatsApp.local(telefono)})});

document.getElementById('pg-nueva-orden')?.addEventListener('click',()=>{if(confirm('¿Querés comenzar otra orden independiente? Esto no cancela la anterior.')){PGServicio.nueva();alert('Ahora podés enviar una nueva orden.');}});
