// PG del Campo — v6.1.0: atención humana por WhatsApp Business, bot web siempre activo.
(function(){
 'use strict';
 window.WEB_APP_URL=window.WEB_APP_URL||'https://pg-del-campo-bot.onrender.com/chat-web';
 const BUSINESS='50557973097';
 try{
  const key='pg_sesion_chat';
  if(!localStorage.getItem(key))localStorage.setItem(key,'v'+Date.now().toString(36)+Math.random().toString(36).slice(2,8));
  window.PG_SESION=localStorage.getItem(key);
 }catch(e){window.PG_SESION='v'+Math.random().toString(36).slice(2,10);}
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
  append(message,'usuario');input.value='';const pending=append('Escribiendo…');
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
   if(d.respuesta){formato(pending,d.respuesta);
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
