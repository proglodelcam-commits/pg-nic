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

// PG del Campo — corrección de imágenes de catálogo, 2026-11-25.
// Base64 de raster se decodifica como bytes y se muestra con Blob; nunca se inserta como HTML ni como URL de datos.
(function(){
 'use strict';
 const cache=new Map();
 function image(raw){
  const value=String(raw||'').trim();if(!value)return '';
  if(!value.startsWith('data:')){const u=PGUrl(value);return u==='#'?'':u;}
  if(cache.has(value))return cache.get(value);
  const match=/^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(value);
  if(!match||match[2].length>16000000)return '';
  try{
   const binary=atob(match[2].replace(/\s/g,''));if(binary.length<12)return '';
   const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
   const mime=match[1].toLowerCase().replace('jpg','jpeg');
   const valid=mime==='png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10:
     mime==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
     mime==='gif'?String.fromCharCode(...bytes.slice(0,6)).match(/^GIF8[79]a$/):
     mime==='webp'?String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP':false;
   if(!valid)return '';
   const url=URL.createObjectURL(new Blob([bytes],{type:'image/'+mime}));cache.set(value,url);return url;
  }catch(e){return '';}
 }
 window.PGImagen=image;
 window.PGImagenLimpiar=function(values){const keep=new Set(values.map(v=>String(v||'').trim()));for(const [k,u] of cache){if(!keep.has(k)){URL.revokeObjectURL(u);cache.delete(k);}}};
})();
