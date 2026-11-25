// PG del Campo — v6.2.0: atención humana por WhatsApp Business, bot web siempre activo.
(function(){
 'use strict';
 window.WEB_APP_URL=window.WEB_APP_URL||'https://pg-del-campo-bot.onrender.com/chat-web';
 const BUSINESS='50557973097';
 try{
  const key='pg_sesion_chat';
  if(!localStorage.getItem(key))localStorage.setItem(key,'v'+Date.now().toString(36)+Math.random().toString(36).slice(2,8));
  window.PG_SESION=localStorage.getItem(key);
 }catch(e){window.PG_SESION='v'+Math.random().toString(36).slice(2,10);}
// Selección determinista: solo IDs del catálogo, nunca precios suministrados por el chat.
 const ORDER_KEY='pg_chat_pedido_v2',ORDER_TTL=30*60*1000;
 let seleccion=[];
 try{const saved=JSON.parse(localStorage.getItem(ORDER_KEY)||'null');if(saved&&saved.sesion===window.PG_SESION&&Date.now()-saved.at<ORDER_TTL&&Array.isArray(saved.items))seleccion=saved.items;}catch(e){}
 function guardarSeleccion(){try{localStorage.setItem(ORDER_KEY,JSON.stringify({at:Date.now(),sesion:window.PG_SESION,items:seleccion}));}catch(e){}}
 function normalizar(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/(\d)\s*(?:grs?\.?|gramos?|g)\b/g,'$1g').replace(/(\d)\s*(?:kgs?\.?|kilogramos?)\b/g,'$1kg').replace(/(\d)\s*(?:lbs?\.?|libras?)\b/g,'$1lb');}
 const STOP=new Set('quiero quisiera deseo comprar compra necesito dame me podes puede dar llevar llevo pedido pedir favor por porfavor de del la el los las un una unos unas en y con para al a es son unidades unidad bolsas bolsa paquetes paquete presentacion producto productos pg campo listo agregar agrega anadir anade tambien mas solo sean que mejor cambia cambiar pon pone sean cantidad'.split(' '));
 function palabras(s){return normalizar(s).match(/[a-z0-9]+/g)||[];}
 function analizarPedido(text,catalogo){
  const input=normalizar(text);
  if(/\b(cancelar|cancela|cancelado|vaciar|vacia|olvida)\b/.test(input)&&/\b(pedido|compra|carrito|todo)\b/.test(input))return {estado:'cancelar',items:[]};
  const entries=Object.entries(catalogo||{}).filter(([id,p])=>p&&p.visible!==false);
  const parts=input.split(/[,;\n]+|\s+y\s+(?=\d|(?:quiero|agrega|anade)\b)/).filter(Boolean);
  const result=new Map();let problema=false,hayCantidad=false;
  for(const part of parts){
   // Gramos/peso y cifras monetarias no son cantidades de unidades.
   const unitless=part.replace(/\d+(?:[.,]\d+)?\s*(?:kg|g|lb)\b/g,' ').replace(/(?:c\$|\$)\s*\d+(?:[.,]\d+)?/g,' ');
   const qs=[...unitless.matchAll(/\b(?:x\s*)?(\d+)\b/g)];
   if(!qs.length)continue;
   hayCantidad=true;
   if(qs.length!==1){problema=true;continue;}
   const q=Number(qs[0][1]);if(!Number.isInteger(q)||q<1||q>100){problema=true;continue;}
   const tokens=[...new Set(palabras(part).filter(w=>!STOP.has(w)&&!/^\d+$/.test(w)&&w!=='x'))];
   if(!tokens.length){problema=true;continue;}
   const matches=entries.filter(([id,p])=>{
    const name=new Set(palabras(p.nombre));
    return tokens.every(t=>name.has(t)||t===normalizar(id));
   });
   if(matches.length!==1){problema=true;continue;}
   const id=matches[0][0];result.set(id,(result.get(id)||0)+q);
   if(result.get(id)>100)problema=true;
  }
  if(!hayCantidad)return {estado:'sin_cambio',items:[]};
  // No conservar un pedido anterior si el cliente cambió a una selección ambigua.
  if(problema||!result.size)return {estado:'ambiguo',items:[]};
  return {estado:'ok',agregar:/\b(agrega|agregar|anade|anadir|tambien)\b/.test(input),items:Array.from(result,([id,q])=>({id,q}))};
 }
 function registrarPedido(text){
  const parsed=analizarPedido(text,window.__pgProductos||{});
  if(parsed.estado==='sin_cambio')return;
  if(parsed.estado==='ok'&&parsed.agregar){
   const map=new Map(seleccion.map(i=>[i.id,i.q]));
   for(const i of parsed.items)map.set(i.id,(map.get(i.id)||0)+i.q);
   seleccion=Array.from(map,([id,q])=>({id,q}));
   if(seleccion.some(i=>i.q>100))seleccion=[];
  }else seleccion=parsed.estado==='ok'?parsed.items:[];
  guardarSeleccion();
 }
 function listaValida(items){
  const p=window.__pgProductos||{};
  return Array.isArray(items)&&items.length>0&&items.length<=30&&items.every(i=>i&&typeof i.id==='string'&&i.id.length<=100&&!/[,:.#$\[\]\/\u0000-\u001f]/.test(i.id)&&Number.isInteger(i.q)&&i.q>0&&i.q<=100&&p[i.id]&&p[i.id].visible!==false);
 }
 function pedidoURL(url){
  if(url.protocol!=='https:'||url.hostname!=='proglodelcam-commits.github.io'||!/^\/pg-nic\/(?:index\.html)?$/.test(url.pathname))return false;
  return /^#pedido(?:\?|$)/.test(url.hash);
 }
 function prepararRespuesta(raw,data){
  let text=String(raw||'');
  // Solo confiar en selecciones estructuradas que se validan contra el catálogo.
  if(data&&Array.isArray(data.items)){
   const structured=data.items.map(i=>({id:String(i.id||''),q:Number(i.q??i.cantidad)}));
   if(listaValida(structured)){seleccion=structured;guardarSeleccion();}
  }
  let vacio=false;
  text=text.replace(/https:\/\/[^\s<>"'\u0000-\u001f]+/g,rawURL=>{
   let u;try{u=new URL(rawURL);}catch(e){return rawURL;}
   if(!pedidoURL(u))return rawURL;
   const h=u.hash.indexOf('?');const embedded=h<0?null:new URLSearchParams(u.hash.slice(h+1)).get('items');
   const existing=u.searchParams.get('items')||embedded;
   if(existing){u.searchParams.set('items',existing);u.hash='pedido';return u.href;}
   if(!listaValida(seleccion)){vacio=true;return '[No se generó el enlace: falta identificar los productos y cantidades.]';}
   u.searchParams.set('items',seleccion.map(i=>i.id+':'+i.q).join(','));u.hash='pedido';return u.href;
  });
  if(vacio)text+='\nEscribí la cantidad y el nombre completo de cada producto, incluyendo el peso. Si hay varias presentaciones, elegí el producto en el catálogo. No se registró ni se cobró ningún pedido.';
  return text;
 }
 window.PGChatPedido={analizar:analizarPedido,registrar:registrarPedido,preparar:prepararRespuesta};

 function urlHumano(text=''){
  return 'https://wa.me/'+BUSINESS+'?text='+encodeURIComponent('Hola PG del Campo, vengo del asistente web. Mi consulta es: '+String(text).slice(0,1500));
 }
 function formato(parent,text){
  // Render as text nodes. Only HTTPS links become anchors; no untrusted HTML.
  parent.replaceChildren();const input=String(text||'');
  const links=/https:\/\/[^\s<>"'\u0000-\u001f]+/g;let start=0,match;
  function texto(fragment){
   const pieces=fragment.split(/(\*[^*\n]+\*|\n)/g);
   for(const p of pieces){
    if(p==='\n')parent.appendChild(document.createElement('br'));
    else if(p.startsWith('*')&&p.endsWith('*')&&p.length>2){const b=document.createElement('b');b.textContent=p.slice(1,-1);parent.appendChild(b);}
    else parent.appendChild(document.createTextNode(p));
   }
  }
  while((match=links.exec(input))){
   texto(input.slice(start,match.index));let raw=match[0];
   try{
    const url=new URL(raw);
    if(url.protocol==='https:'){
     const a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';
     if(pedidoURL(url)){a.target='_self';a.addEventListener('click',function(event){const rawItems=url.searchParams.get('items');if(rawItems&&typeof window.PG_cargarPedidoEnlace==='function'){event.preventDefault();window.PG_cargarPedidoEnlace(rawItems);const chat=document.getElementById('chatbot-window');if(chat)chat.style.display='none';}});}
     a.textContent=url.hostname==='wa.me'&&url.pathname==='/'+BUSINESS?'Abrir WhatsApp Business · tocá Enviar':raw;
     a.style.color='inherit';a.style.textDecoration='underline';a.style.fontWeight='700';parent.appendChild(a);
    }else texto(raw);
   }catch(e){texto(raw);}
   start=match.index+match[0].length;
  }
  texto(input.slice(start));
 }
 function append(text,role='ia'){
  const h=document.getElementById('historial'),el=document.createElement('div');el.className='mensaje '+role;
  formato(el,text);h.appendChild(el);h.scrollTop=h.scrollHeight;return el;
 }
 window.PG_pollPanel=function(){}; // No polling: human responses arrive in WhatsApp, not this widget.
 window.toggleChatBot=function(){const w=document.getElementById('chatbot-window');if(w)w.style.display=w.style.display==='flex'?'none':'flex';};
 let busy=false;
 window.enviarMensaje=async function(){
  const input=document.getElementById('texto'),h=document.getElementById('historial'),btn=document.getElementById('btn-enviar');
  if(!input||!h||busy)return;
  const message=input.value.trim();if(!message)return;
  busy=true;if(btn)btn.disabled=true;
  registrarPedido(message);append(message,'usuario');input.value='';const pending=append('Escribiendo…');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
  try{
   const context=typeof window.pgContextoTienda==='function'?window.pgContextoTienda():'';
   let endpoint=new URL(String(window.WEB_APP_URL));
   if(endpoint.pathname==='/'||!endpoint.pathname)endpoint.pathname='/chat-web';
   if(endpoint.protocol!=='https:'&&!(endpoint.protocol==='http:'&&['127.0.0.1','localhost'].includes(endpoint.hostname)))throw new Error('URL del asistente no válida.');
   const response=await fetch(endpoint.href,{method:'POST',headers:{'Content-Type':'text/plain'},signal:controller.signal,
    body:JSON.stringify({mensaje:message,contexto:context,sesion:window.PG_SESION})});
   if(!response.ok)throw new Error('Servidor no disponible');
   const d=await response.json();
   if(d.respuesta){const reply=prepararRespuesta(d.respuesta,d);formato(pending,reply);
    // Structured link fallback: show it if the server did not include it in visible text.
    if(d.derivacion==='whatsapp'&&!String(d.respuesta).includes('https://wa.me/'+BUSINESS))append(urlHumano(message));
   }else if(d.modo==='humano'){formato(pending,'Solicitá atención humana por WhatsApp:\n'+urlHumano(message)+'\nEl asistente web no debería quedar pausado. Si continúa así, avisá al negocio para actualizar el servidor.');}
   else throw new Error('Respuesta vacía');
  }catch(e){formato(pending,'No logramos conectar con el asistente. Podés solicitar atención por WhatsApp:\n'+urlHumano(message));}
  finally{clearTimeout(timeout);busy=false;if(btn)btn.disabled=false;h.scrollTop=h.scrollHeight;}
 };
 window.evaluarTecla=function(event){if(event.key==='Enter'){event.preventDefault();window.enviarMensaje();}};
 // Tiny render surface for offline automated tests; contains no session data.
 window.PGChatFormato=formato;
})();
