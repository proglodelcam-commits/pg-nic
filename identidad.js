(function(){
 'use strict';
 function local(raw){
  let s=String(raw||'').replace(/[\s()+.-]/g,'');
  if(s.startsWith('00505'))s=s.slice(5);else if(s.length===11&&s.startsWith('505'))s=s.slice(3);
  if(!/^[5678]\d{7}$/.test(s))throw new Error('Ingresá un WhatsApp válido: 8 dígitos o +505 seguido del número.');
  return s;
 }
 window.PGWhatsApp=Object.freeze({local,e164:raw=>'+505'+local(raw)});
 window.PGTexto=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.PGUrl=value=>{try{const u=new URL(String(value||''),location.href);return ['https:','http:'].includes(u.protocol)?u.href:'#';}catch(e){return '#';}};
})();
