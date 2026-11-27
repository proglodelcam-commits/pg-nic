(function(){
 'use strict';
 const allowed=new Set(['irAPedido','cliente','calc','copiarAliasACH','procesar','generarRecibo','toggleChatBot','evaluarTecla','enviarMensaje','closeReceipt','cerrarBienvenida','evaluarEnterAcceso','verMisSellosYEntrar','entrarComoInvitado','calcularTotales','procesarPagoWhatsApp','generarEImprimirRecibo','cerrarModalRecibo','carruselMove','carruselGo','add','removeItem','pgLimpiarFiltros','pgElegirCategoria','agregarAlCarrito','quitarDelCarrito']);
 function invoke(el,event){
  const code=el.getAttribute('data-pg-'+event.type)||'';
  if(code==='window.print()'){window.print();return;}
  const match=/^([A-Za-z][A-Za-z0-9]*)\((.*)\)$/.exec(code.trim());
  if(!match||!allowed.has(match[1])||typeof window[match[1]]!=='function')return;
  const args=[];
  if(match[2].trim())for(const part of match[2].split(',')){
   const s=part.trim();if(s==='event'){args.push(event);continue;}
   if(/^-?\d+$/.test(s)){args.push(Number(s));continue;}
   const q=/^'([^']*)'$/.exec(s)||/^"([^"]*)"$/.exec(s);
   if(q){args.push(q[1]);continue;}return;
  }
  // Whitelisted function and inert arguments only: no eval or Function constructor.
  Promise.resolve().then(()=>window[match[1]](...args)).catch(e=>alert(e.message));
 }
 for(const type of ['click','input','change','keypress'])document.addEventListener(type,event=>{
  const el=event.target.closest('[data-pg-'+type+']');if(el)invoke(el,event);
 });
 document.addEventListener('error',event=>{
  const el=event.target;if(el.tagName==='IMG'&&el.hasAttribute('data-pg-error')){
   el.style.display='none';if(el.nextElementSibling)el.nextElementSibling.style.display='flex';
  }
 },true);
})();
