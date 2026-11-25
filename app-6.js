
import{initializeApp}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import{getDatabase,ref,onValue,get,set,update}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import{getAuth,signInAnonymously,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const cfg={
  apiKey:'AIzaSyBfPmfE6axd_W0Z80b0L-Jbjy6q7l9_NTk',
  authDomain:'productos-globales-campo.firebaseapp.com',
  databaseURL:'https://productos-globales-campo-default-rtdb.firebaseio.com',
  projectId:'productos-globales-campo',
  storageBucket:'productos-globales-campo.firebasestorage.app',
  messagingSenderId:'938958452862',
  appId:'1:938958452862:web:3b618567dae9aa01b7c02f',
  measurementId:'G-MKD9T10DP3'
};
const _app=initializeApp(cfg);
const db=getDatabase(_app);
PGServicio.iniciar(_app);
const _auth=getAuth(_app);
/* Ayudante expuesto para que el boton de Google Wallet (script normal) pueda
   leer las estrellas/compras REALES del cliente desde Firebase. */
window.PG_walletData = async function(raw){
  const d = await PGServicio.resumen(raw);
  return {tel:d.tel,nombre:d.nombre,compras:d.compras,estrellas:d.estrellas};
};
window.PG_walletUpdate = function(){ /* Wallet se actualiza desde un servidor autorizado, no al enviar pedidos. */ };

let productos={},clientes={},carrito=[],cActual=null;
const WA='50557973097';
/* Tienda Kyte: enlace general + por producto (campo kyteUrl / kyte_url en Firebase) */
const KYTE_STORE='https://proglodelcampo.catalog.kyte.site';
function kyteOf(p){ return (p&&(p.kyteUrl||p.kyte_url))||KYTE_STORE; }
/* Catálogo base cargado desde el Panel-Admin (se siembra en la nube si está vacía) */
const SEED_PRODUCTOS={
  P01:{nombre:"Café Molido Premium 1lb",precio:180,stock:48,costo:110,minimo:20,categoria:"Café",puntos:9,imagen:"",icono:"fa-mug-hot",visible:true,controla_stock:true},
  P02:{nombre:"Café en Grano 1lb",precio:200,stock:12,costo:120,minimo:15,categoria:"Café",puntos:10,imagen:"",icono:"fa-seedling",visible:true,controla_stock:true},
  P03:{nombre:"Pinolillo Tradicional 1lb",precio:90,stock:5,costo:52,minimo:10,categoria:"Pinolillo",puntos:5,imagen:"",icono:"fa-wheat-awn",visible:true,controla_stock:true},
  P04:{nombre:"Pinol Puro 1lb",precio:70,stock:34,costo:40,minimo:12,categoria:"Pinol",puntos:4,imagen:"",icono:"fa-bowl-rice",visible:true,controla_stock:true},
  P05:{nombre:"Humus de Lombriz 5kg",precio:250,stock:6,costo:150,minimo:8,categoria:"Humus",puntos:12,imagen:"",icono:"fa-worm",visible:true,controla_stock:true},
  P06:{nombre:"Humus de Lombriz 1kg",precio:80,stock:60,costo:45,minimo:15,categoria:"Humus",puntos:4,imagen:"",icono:"fa-leaf",visible:true,controla_stock:true},
  P07:{nombre:"Café Oro Especial 1lb",precio:260,stock:9,costo:160,minimo:10,categoria:"Café",puntos:13,imagen:"",icono:"fa-award",visible:true,controla_stock:true},
  P08:{nombre:"Combo Degustación",precio:320,stock:15,costo:190,minimo:5,categoria:"Combo",puntos:16,imagen:"",icono:"fa-box",visible:true,controla_stock:true}
};

const $=id=>document.getElementById(id),
      M=n=>'C$ '+Number(n||0).toLocaleString('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2}),
      E=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[x]));

/* ── Base de conocimiento viva para BotsPG: catálogo + datos de empresa desde Firebase ── */
window.pgContextoTienda=function(){
  try{
    var out=[];
    var e=window.__pgEmpresa||{};
    out.push('NEGOCIO: '+(e.nombre||'Productos Globales del Campo (PG del Campo)'));
    if(e.lugar) out.push('Ubicacion: '+e.lugar);
    if(e.tel) out.push('Telefono: '+e.tel);
    if(e.whatsapp) out.push('WhatsApp: +505 '+e.whatsapp);
    if(Array.isArray(e.horarios)&&e.horarios.length){ out.push('Horarios: '+e.horarios.map(function(h){return h.dia+' '+h.horario;}).join('; ')); }
    if(e.envio) out.push('Envios: '+String(e.envio).replace(/\s+/g,' ').trim());
    if(e.pagoEntrega) out.push('Pago contra entrega: '+String(e.pagoEntrega).replace(/\s+/g,' ').trim());
    if(e.banco) out.push('Pago por transferencia: '+e.banco+(e.cuenta?(' Cta '+e.cuenta):'')+(e.ach?(' ACH '+e.ach):''));
    if(e.mision) out.push('Mision: '+String(e.mision).replace(/\s+/g,' ').trim());
    out.push('Tienda en linea oficial para pedidos del asistente: https://proglodelcam-commits.github.io/pg-nic/');
    if(e.enlaceKyte) out.push('Catalogo Kyte: '+e.enlaceKyte);
    var P=window.__pgProductos||{};
    var items=Object.entries(P).filter(function(entry){return entry[1]&&entry[1].visible!==false;});
    if(items.length){
      out.push('CATALOGO ('+items.length+' productos):');
      out.push('Enlace para preparar carrito: https://proglodelcam-commits.github.io/pg-nic/?items=ID:CANTIDAD#pedido. Usar IDs exactos y separar productos con comas. No confirmar ni cobrar desde el enlace.');
      items.forEach(function(entry){
        var id=entry[0],p=entry[1];
        var disp=(p.controla_stock===false)?'disponible':((Number(p.stock||0)>0)?'disponible':'agotado');
        out.push('- ID='+id+' | '+(p.nombre||'Producto')+': '+M(p.precio)+(p.categoria?(' | '+p.categoria):'')+' | '+disp+(p.puntos?(' | '+p.puntos+' pts fidelidad'):''));
      });
    }
    return out.join('\n');
  }catch(err){ return ''; }
};


/* PG del Campo — importar el carrito del bot, sin registrar ni pagar una orden. */
let pgCatalogoListo=false,pgImportado=false,pgImportando=false;
function pgLeerItemsURL(){
 const u=new URL(window.location.href);let raw=u.searchParams.get('items');
 if(raw===null){const hash=u.hash.replace(/^#/,'');const at=hash.indexOf('?');if(at>=0)raw=new URLSearchParams(hash.slice(at+1)).get('items');}
 return raw;
}
let pgItemsPendientes=pgLeerItemsURL();
function pgParseItems(raw){
 if(typeof raw!=='string'||!raw.trim()||raw.length>6000)throw new Error('El enlace no contiene una lista de productos válida.');
 const parts=raw.split(',');if(parts.length>30)throw new Error('El enlace contiene demasiados productos.');
 const result=new Map();
 for(const part of parts){
  const match=/^([^:]+):([0-9]+)$/.exec(part.trim());
  if(!match)throw new Error('El enlace de compra tiene un formato inválido.');
  const id=match[1],q=Number(match[2]);
  if(id.length>100||/[.#$\[\]\/\u0000-\u001f]/.test(id)||!Number.isInteger(q)||q<1||q>100)throw new Error('El enlace tiene un código o una cantidad inválida.');
  const total=(result.get(id)||0)+q;if(total>100)throw new Error('Cantidad excesiva para un producto del enlace.');
  result.set(id,total);
 }
 return Array.from(result,([id,q])=>({id,q}));
}
function pgAplicarPedidoEnlace(){
 if(!pgCatalogoListo||pgImportado||pgImportando||pgItemsPendientes===null)return;
 pgImportando=true;
 try{
  const requests=pgParseItems(pgItemsPendientes),fresh=[];
  for(const item of requests){
   const p=productos[item.id];
   if(!p||p.visible===false)throw new Error('Un producto del enlace no está disponible. Pedí al asistente un enlace actualizado.');
   if(p.controla_stock!==false&&item.q>Number(p.stock||0))throw new Error('No hay existencias suficientes de '+String(p.nombre||'este producto')+' para la cantidad del enlace.');
   const price=Number(p.precio);if(!Number.isFinite(price)||price<0)throw new Error('El producto no tiene un precio válido.');
   fresh.push({id:item.id,n:String(p.nombre||'Producto'),price,q:item.q});
  }
  // Everything is validated before replacing the cart; no partial order from a broken link.
  carrito=fresh;pgImportado=true;calc();
  const section=document.getElementById('pedido');
  if(section){let notice=document.getElementById('pg-pedido-enlace-aviso');if(!notice){notice=document.createElement('p');notice.id='pg-pedido-enlace-aviso';notice.setAttribute('role','status');notice.style.cssText='padding:12px;border:1px solid #c8963e;border-radius:12px;background:#fff8e8;color:#1b382b;margin:12px 0;font-size:13px';section.prepend(notice);}notice.textContent='Carrito cargado con '+fresh.reduce((n,i)=>n+i.q,0)+' unidades. Revisá los productos y precios, completá tus datos y confirmá por WhatsApp.';}
  if(typeof window.navegarA==='function')window.navegarA('pedido');
  else if(typeof window.irAPedido==='function')window.irAPedido();
 }catch(e){pgImportado=true;alert('No se pudo preparar el carrito del enlace: '+e.message+' El pedido no se registró ni se cobró.');}
 finally{pgImportando=false;}
}
window.PG_cargarPedidoEnlace=function(raw){pgItemsPendientes=raw;pgImportado=false;pgAplicarPedidoEnlace();};
window.addEventListener('hashchange',function(){const raw=pgLeerItemsURL();if(raw!==null&&raw!==pgItemsPendientes)window.PG_cargarPedidoEnlace(raw);});

/* ── Listeners de Firebase (tiempo real) ── */
function startSync(){
  onValue(ref(db,'productos'),s=>{productos=s.val()||{};window.__pgProductos=productos;render();pgCatalogoListo=true;pgAplicarPedidoEnlace();});
  /* Por seguridad NO se suscribe a todo el nodo 'clientes' (datos privados de todos). Se consulta por telefono bajo demanda en cliente() y saveTransaction(). */
  onValue(ref(db,'anuncios'),s=>{renderCarrusel(s.val()||{})});
  onValue(ref(db,'config/empresa'),s=>{var e=s.val()||{};window.__pgEmpresa=e;if(e.chatbotUrl&&/^https?:\/\//i.test(e.chatbotUrl))window.WEB_APP_URL=e.chatbotUrl;renderHorario(e);renderEmpresa(e)});
  /* Siembra automática del catálogo si la nube está vacía */
  /* El catálogo solo lo administra el negocio. */
}
/* Autenticación anónima antes de tocar la base de datos (requerida por las reglas). */
let _syncStarted=false;
onAuthStateChanged(_auth,u=>{ if(u&&!_syncStarted){ _syncStarted=true; startSync(); } });
/* PGServicio inicia Firebase Auth. startSync responde a onAuthStateChanged. */

/* ── Carrusel de Anuncios ── */
let _carruselTimer=null;
function renderCarrusel(anuncios){
  const box=document.getElementById('carrusel-container');
  if(!box)return;
  const activos=Object.entries(anuncios).filter(([_,v])=>v.activo!==false).map(([k,v])=>({id:k,...v}));
  /* Orden aleatorio: baraja los anuncios en cada recarga de la página (Fisher-Yates). */
  for(let i=activos.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=activos[i];activos[i]=activos[j];activos[j]=t;}
  if(!activos.length){
    box.innerHTML='<div class="carrusel-empty"><i class="fas fa-bullhorn" style="margin-right:6px"></i>Próximamente más promociones</div>';
    if(_carruselTimer){clearInterval(_carruselTimer);_carruselTimer=null;}
    return;
  }
  let html='<div class="carrusel-wrap"><div class="carrusel-track" id="carrusel-track">';
  activos.forEach(function(a){
    /* Solo se acepta enlace http(s) para evitar esquemas peligrosos (javascript:, data:). */
    var href=(a.enlace&&/^https?:\/\//i.test(a.enlace))?a.enlace:'';
    var fondo=(a.fondo&&/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(a.fondo))?a.fondo:'';
    html+='<div class="carrusel-slide"'+(fondo?' style="background:'+fondo+'"':'')+'>';
    if(href)html+='<a href="'+E(href)+'" target="_blank" rel="noopener noreferrer" style="display:block;width:100%">';
    if(a.tipo==='video'&&a.url){
      html+='<iframe src="'+E(a.url)+'" allow="autoplay;encrypted-media" allowfullscreen loading="lazy"></iframe>';
    }else if(a.imagen){
      html+='<img src="'+E(a.imagen)+'" alt="'+(a.titulo?E(a.titulo):'Anuncio')+'" loading="lazy">';
    }else{
      html+='<div style="width:100%;height:180px;display:flex;align-items:center;justify-content:center;background:'+(fondo||'var(--primary)')+';color:#fff;font-size:15px;font-weight:600;padding:20px;text-align:center">'+(a.titulo?E(a.titulo):'Anuncio')+'</div>';
    }
    if(a.titulo||a.descripcion){
      html+='<div class="slide-overlay">';
      if(a.titulo)html+='<h3>'+E(a.titulo)+'</h3>';
      if(a.descripcion)html+='<p>'+E(a.descripcion)+'</p>';
      html+='</div>';
    }
    if(href)html+='</a>';
    html+='</div>';
  });
  html+='</div>';
  if(activos.length>1){
    html+='<button class="carrusel-btn prev" data-pg-click="carruselMove(-1)">&#8249;</button>';
    html+='<button class="carrusel-btn next" data-pg-click="carruselMove(1)">&#8250;</button>';
  }
  html+='</div>';
  if(activos.length>1){
    html+='<div class="carrusel-dots" id="carrusel-dots">';
    activos.forEach(function(_,i){
      html+='<button class="carrusel-dot'+(i===0?' active':'')+'" data-pg-click="carruselGo('+i+')"></button>';
    });
    html+='</div>';
  }
  box.innerHTML=html;
  _carruselIdx=0;_carruselLen=activos.length;
  if(_carruselTimer)clearInterval(_carruselTimer);
  if(_carruselLen>1)_carruselTimer=setInterval(function(){carruselMove(1)},4500);
}
let _carruselIdx=0,_carruselLen=0;
window.carruselMove=function(dir){
  _carruselIdx=(_carruselIdx+dir+_carruselLen)%_carruselLen;
  carruselGo(_carruselIdx);
};
window.carruselGo=function(idx){
  _carruselIdx=idx;
  var track=document.getElementById('carrusel-track');
  if(track)track.style.transform='translateX(-'+idx*100+'%)';
  var dots=document.querySelectorAll('.carrusel-dot');
  dots.forEach(function(d,i){d.classList.toggle('active',i===idx);});
};

/* ── Render catálogo (nuevas tarjetas PWA) ── */
function render(){
  const c=$('products-grid');
  let html='';
  Object.entries(productos).forEach(function([id,p]){
    let st=p.controla_stock===false?999999:(+p.stock||0);
    let ku=kyteOf(p);
    let imageUrl=PGImagen(p.imagen);
    let imgHtml=imageUrl
      ?'<img class="product-image" src="'+E(imageUrl)+'" alt="'+E(p.nombre)+'" data-pg-error="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="product-image-fallback" style="display:none"><i class="fas fa-leaf"></i></div>'
      :'<div class="product-image-fallback"><i class="fas fa-leaf"></i></div>';
    html+='<div class="product-card"><div class="product-image-container"><a class="product-image-link" href="'+E(PGUrl(ku))+'" target="_blank" rel="noopener noreferrer" title="Ver en Kyte">'+imgHtml+'</a></div><div class="product-info"><h4 class="product-name" title="'+E(p.nombre)+'">'+E(p.nombre)+'</h4><p style="font-size:10px;color:var(--text-muted);margin-bottom:4px">'+(st?st+' disponibles':'Agotado')+'</p><div class="product-price">'+M(p.precio)+'</div><button class="btn-add" '+(st?'':'disabled')+' data-pg-click="add(\''+E(id)+'\')">'+(st?'+ Agregar':'Agotado')+'</button><a class="product-kyte" href="'+E(PGUrl(ku))+'" target="_blank" rel="noopener noreferrer">Ver en Kyte \u2197</a></div></div>';
  });
  c.innerHTML=html||'<p style="padding:20px;color:var(--text-muted);text-align:center">No hay productos disponibles.</p>';
  PGImagenLimpiar(Object.values(productos).map(p=>p&&p.imagen));
}

/* ── Horario de atención (editable desde el Panel-Admin, nodo config/empresa) ── */
function renderHorario(emp){
  const box=$('horario-atencion');
  if(!box) return;
  let hs=emp&&emp.horarios;
  if(!hs) return; /* sin datos en Firebase: se conserva el texto por defecto */
  let arr=Array.isArray(hs)?hs:Object.values(hs);
  arr=arr.filter(function(h){return h&&(h.dia||h.horario)});
  if(!arr.length) return;
  box.innerHTML=arr.map(function(h){var cls=((h.horario||'')==='Cerrado')?' cerrado':'';return '<span class="dia">'+E(h.dia||'')+'</span><span class="hora'+cls+'">'+E(h.horario||'')+'</span>'}).join('');
}

/* ── Datos de empresa en "Nosotros" (editables desde el Panel-Admin, nodo config/empresa) ── */
function renderEmpresa(emp){
  if(!emp) return;
  var set=function(id,v){var el=$(id); if(el&&v!=null&&String(v).trim()!=='') el.textContent=v;};
  var href=function(id,v){var el=$(id); if(el&&v) el.setAttribute('href',v);};
  set('empresa-mision',emp.mision); set('empresa-unico',emp.unico); set('empresa-envio',emp.envio);
  set('nos-direccion',emp.direccion); set('nos-tel',emp.tel); set('nos-email',emp.email);
  set('nos-club-eslogan',emp.clubEslogan); set('nos-club-desc',emp.clubDescripcion); set('nos-club-cierre',emp.clubCierre);
  set('nos-pago-banco',emp.banco); set('nos-pago-titular',emp.titular); set('nos-pago-ach',emp.whatsapp||emp.ach);
  set('nos-pago-cuenta',emp.cuenta); set('nos-pago-entrega',emp.pagoEntrega); set('nos-pago-cheque',emp.pagoCheque);
  set('nos-nutri-sub',emp.nutriSubtitulo);
  set('nos-footer-copy',emp.footerCopy); set('nos-footer-loc',emp.lugar); set('nos-footer-tel',emp.tel);
  if(emp.footerRuc) set('nos-footer-ruc',emp.footerRuc); else if(emp.ruc) set('nos-footer-ruc','RUC: '+emp.ruc);
  if(emp.email){ href('nos-email-link','mailto:'+emp.email); }
  if(emp.tel){ var wt=String(emp.tel).replace(/\D/g,'').replace(/^505/,''); if(wt){ href('nos-tel-link','https://wa.me/505'+wt); } }
  if(emp.whatsapp){ var ww=String(emp.whatsapp).replace(/\D/g,'').replace(/^505/,''); if(ww){ href('nos-link-wa','https://wa.me/505'+ww); } }
  if(emp.enlaceKyte){ href('nos-link-kyte',emp.enlaceKyte); }
  if(emp.enlaceTarjetaFidelidad){ href('nos-link-tarjeta',emp.enlaceTarjetaFidelidad); }
  if(emp.enlacePagoQR){ href('nos-link-qr',emp.enlacePagoQR); }
  var hs=emp.horarios;
  if(hs){
    var arr=Array.isArray(hs)?hs:Object.values(hs);
    arr=arr.filter(function(h){return h&&(h.dia||h.horario)});
    var box=$('horario-nosotros');
    if(box&&arr.length){ box.innerHTML=arr.map(function(h){var cls=((h.horario||'')==='Cerrado')?' cerrado':'';return '<span class="dia">'+E(h.dia||'')+'</span><span class="hora'+cls+'">'+E(h.horario||'')+'</span>'}).join(''); }
  }
}

/* ── Carrito ── */
window.add=function(id){
  let p=productos[id];
  if(!p)return;
  let stock=p.controla_stock===false?999999:(+p.stock||0);
  let x=carrito.find(function(i){return i.id===id});
  if(x){
    if(x.q+1>stock)return alert('Stock insuficiente. Solo quedan '+stock+' unidades.');
    x.q++;
  }else{
    if(stock<1)return alert('Producto agotado.');
    carrito.push({id,n:p.nombre,price:+p.precio||0,q:1});
  }
  calc();
};

window.removeItem=function(id){carrito=carrito.filter(function(x){return x.id!==id});calc()};

/* ── Cliente ── */
window.cliente=async function(){
  const raw=$('cliente-tel').value.trim();
  if(!raw){cActual=null;calc();return;}
  try{
    const d=await PGServicio.resumen(raw);
    if(raw!==$('cliente-tel').value.trim())return;
    cActual={nombre:d.nombre,total_compras:d.compras};
    if(d.nombre!=='Cliente PG'&&!$('cliente-nombre').value)$('cliente-nombre').value=d.nombre;
    $('clientInfo').textContent=d.nombre+' · '+d.compras+' compras confirmadas'+(d.aviso?' · '+d.aviso:'');
  }catch(e){cActual=null;$('clientInfo').textContent=e.message;}
  calc();
};
let pgFidelidad={volumen:[{min:600,pct:1},{min:1200,pct:2},{min:1800,pct:3}]};
onValue(ref(db,'config/fidelidad'),s=>{pgFidelidad=s.val()||pgFidelidad;calc();});
/* ── Descuento por volumen ── */
function pct(sub){
  if($('tipo').value==='distribuidor')return 0;
  let p=0;for(const t of [...(pgFidelidad.volumen||[])].sort((a,b)=>a.min-b.min)){if(sub>Number(t.min))p=Number(t.pct)/100;}
  return p;
}

function totals(){
  let sub=carrito.reduce(function(a,i){return a+i.q*i.price},0),
      p=pct(sub),
      d=sub*p,
      z=+$('zona-envio').value,
      conv=z===-1,
      ship=conv?0:z,
      total=sub-d+ship;
  return{sub,p,d,z,conv,ship,total,modo:$('modo').value,metodo:$('metodo-pago').value};
}

/* ── Actualizar QR dinámico del sidebar ── */
var _lastReceiptRef='';
function updateSidebarQR(amount,refNum){
  var base='https://digital.lafise.com/?BANK=BLNI&ACCOUNT_NUMBER=140051265';
  var url=base+'&AMOUNT='+encodeURIComponent(amount.toFixed(2));
  if(refNum) url+='&REFERENCE='+encodeURIComponent(refNum);
  url+='&CONCEPT=Compra%20Productos%20PG%20del%20Campo';
  $('sidebar-qr').src='https://api.qrserver.com/v1/create-qr-code/?size=110x110&data='+encodeURIComponent(url);
  _lastReceiptRef=refNum||'';
  var label=refNum?'Escanea para pagar C$'+amount.toFixed(2)+' (Ref: '+refNum+')':'Escanea para pagar C$'+amount.toFixed(2)+' con LAFISE Digital';
  $('sidebar-qr-label').textContent=label;
}

/* ── Calcular y renderizar carrito ── */
window.calc=calc;function calc(){
  let q=carrito.reduce(function(a,i){return a+i.q},0),t=totals();
  $('cart-count').textContent=q+' Items';
  $('cart-count-badge').textContent=q;
  $('cart-items').innerHTML=carrito.map(function(i){return '<div class="cart-item"><div class="cart-item-details"><h4>'+E(i.n)+'</h4><p>C$ '+i.price.toFixed(2)+' \u00d7 '+i.q+'</p></div><div class="cart-item-actions"><strong>C$ '+(i.price*i.q).toFixed(2)+'</strong><button class="btn-remove" data-pg-click="removeItem(\''+E(i.id)+'\')">Quitar</button></div></div>'}).join('')||'<div class="cart-empty">El carrito est\u00e1 vac\u00edo</div>';
  $('subtotal').textContent=M(t.sub);
  $('costo-envio').textContent=t.conv&&t.sub?'A convenir':M(t.ship);
  $('total-pagar').textContent=t.conv&&t.sub?M(t.sub-t.d)+' + env\u00edo':M(t.total);
  $('linea-desc-aplicado').style.display=t.p?'flex':'none';
  $('label-porcentaje-desc').textContent='Descuento por volumen ('+t.p*100+'%)';
  $('monto-desc-aplicado').textContent='-'+M(t.d);
  $('ret').style.display=$('tipo').value==='juridica'&&t.sub>1000?'block':'none';
  $('paymentWrap').style.display=t.modo==='contado'?'block':'none';
  $('totalLabel').textContent=t.modo==='credito'?'SALDO A CR\u00c9DITO':'TOTAL NETO A PAGAR';
  $('modeNotice').className='notice '+(t.modo==='credito'?'credit':'cash');
  $('modeNotice').innerHTML=t.modo==='credito'
    ?'<b>CR\u00c9DITO:</b> tu pedido queda registrado como orden pendiente de pago y se suma a tu cuenta por cobrar. Te confirmamos el l\u00edmite por WhatsApp.'
    :'<b>CONTADO:</b> tu pedido queda registrado como orden. El pago se coordina al confirmar \u2014 por WhatsApp te decimos c\u00f3mo seguimos.';
  $('btn-whatsapp').disabled=!q||!$('cliente-tel').value.trim()||!$('cliente-nombre').value.trim();
  $('btn-recibo').disabled=!q||!$('cliente-tel').value.trim();
  if(t.sub>0){ updateSidebarQR(t.total,_lastReceiptRef); }
  else{ _lastReceiptRef=''; $('sidebar-qr-label').textContent='Escanea para pagar con LAFISE Digital'; }
}

/* ── Contador de recibos ── */
async function nextReceipt(){return ''; /* El número real se asigna atómicamente en el servidor. */}
async function saveTransaction(){
  const t=totals(),tel=PGWhatsApp.local($('cliente-tel').value),name=$('cliente-nombre').value.trim();
  const z=$('zona-envio'),zone=z.options[z.selectedIndex].getAttribute('data-nombre')||'';
  const o=await PGServicio.pedido({telefono:tel,nombre:name,origen:'Tienda en Línea',modo:t.modo,
    metodo:t.metodo,tipo:$('tipo').value,zona:zone,envio:t.z,direccion:$('cliente-dir').value.trim(),
    totalEsperado:t.total,items:carrito.map(i=>({id:i.id,cantidad:i.q}))});
  return {id:o.id,num:o.numero_recibo,t:{...t,total:o.total,sub:o.subtotal,d:o.descuento,ship:o.costo_envio}};
}
/* ── Mensaje WhatsApp (con datos LAFISE) ── */
function msg(d){
  let t=d.t,
      selZona=$('zona-envio'),
      nombreZona=selZona.options[selZona.selectedIndex].getAttribute('data-nombre')||'',
      dir=$('cliente-dir').value.trim()||'Retiro en Sucursal',
      m='*PRODUCTOS GLOBALES DEL CAMPO*%0A====================%0A*PEDIDO No.:* '+d.num+'%0A*CLIENTE:* '+d.name+'%0A*C\u00d3DIGO:* '+d.tel+'%0A*MODALIDAD:* '+(t.modo==='credito'?'VENTA A CR\u00c9DITO':'VENTA AL CONTADO')+'%0A';
  if(t.modo==='contado')m+='*M\u00c9TODO DE PAGO:* '+(t.metodo==='lafise'?'Transferencia / QR LAFISE Bancentro':'Pago Contra Entrega (Efectivo / Transferencia al recibir)')+'%0A';
  m+='%0A*PRODUCTOS:*%0A';
  carrito.forEach(function(i){m+='\u2022 '+i.n+' \u2014 '+i.q+' \u00d7 C$'+i.price.toFixed(2)+'%0A'});
  m+='%0A*SUBTOTAL:* C$'+t.sub.toFixed(2)+'%0A*DESCUENTO VOLUMEN ('+t.p*100+'%):* -C$'+t.d.toFixed(2)+'%0A*ENV\u00cdO:* '+(t.conv?'A convenir':'C$'+t.ship.toFixed(2))+'%0A*MODALIDAD DESPACHO:* '+nombreZona+'%0A*DIRECCI\u00d3N:* '+dir+'%0A*'+(t.modo==='credito'?'SALDO A CR\u00c9DITO':'TOTAL DEL PEDIDO')+':* C$'+t.total.toFixed(2)+'%0A*ESTADO:* '+(t.modo==='credito'?'Orden registrada \u2014 pendiente de pago':'Orden registrada \u2014 falta confirmar por WhatsApp');
  var lafiseUrl='https://digital.lafise.com/?BANK=BLNI&ACCOUNT_NUMBER=140051265&AMOUNT='+t.total.toFixed(2)+'&REFERENCE='+d.num+'&CONCEPT=Compra%20Productos%20PG%20del%20Campo';
  m+='%0A%0A*DATOS DE PAGO*%0A====================%0A*PAGAR AHORA:* '+encodeURIComponent(lafiseUrl)+'%0A%0A*M\u00c9TODO DE PAGO:* Transferencia / LAFISE Digital%0A*Titular:* Fernando Mart\u00ednez (Representante Legal PG del Campo)%0A*Cuenta N\u00b0:* 140051265%0A*Alias ACH/M\u00f3vil LAFISE:* 5797 3097%0A%0A*C\u00d3MO SEGUIMOS*%0A====================%0A1. Revis\u00e1 que tus datos est\u00e9n correctos.%0A2. Envi\u00e1 este mensaje.%0A3. Te contestamos por aqu\u00ed con el total final y la forma de entrega.%0A'+(t.modo==='contado'?'%0A_Si elegiste transferencia, pod\u00e9s pagar ya con el enlace o el alias de arriba. Si elegiste contra entrega, pag\u00e1s al recibir._%0A':'%0A');
m+='%0A%0A*BS*D%0ATodo lo Bueno viene de Dios, con su ayuda todo es posible realizar';
  return m;
}

/* ── Procesar venta ── */
window.procesar=async function(){
  if(!carrito.length)return;
  let name=$('cliente-nombre').value.trim(),tel=PGWhatsApp.local($('cliente-tel').value);
  if(!name||!tel)return alert('Completa nombre y WhatsApp.');
  try{
    let d=await saveTransaction(),num=d.num;
    _lastReceiptRef=d.num;
    let waWin=window.open('https://wa.me/'+WA+'?text='+msg({name:name,tel:tel,num:d.num,t:d.t}),'_blank');
    /* Si cierran la pestaña de WhatsApp sin enviar, avisarles: la orden queda en la base pero no nos llega */
    try{
      let cerrada=false;
      let timer=setInterval(function(){
        if(waWin&&waWin.closed){
          clearInterval(timer);
          if(cerrada)return; cerrada=true;
          setTimeout(function(){
            alert('Tu orden '+d.num+' sigue guardada, pero todav\u00eda no nos lleg\u00f3.\nAbr\u00ed WhatsApp de nuevo desde el bot\u00f3n y dale enviar \u2014 si no, no nos enteramos.');
          },800);
        }
      },1000);
      setTimeout(function(){clearInterval(timer);},600000);
    }catch(e){}
    carrito=[];calc();
    alert('Orden '+num+' registrada \u2705\nAbrimos WhatsApp para que la env\u00edes. El pedido queda confirmado cuando nos contest\u00e1s por ah\u00ed.');
  }catch(e){
    console.error(e);
    alert('No se pudo registrar el pedido: '+e.message);
  }
};

/* ── Generar recibo ── */
window.generarRecibo=async function(){
  if(!carrito.length)return;
  let name=$('cliente-nombre').value.trim()||'Cliente',tel=PGWhatsApp.local($('cliente-tel').value);
  if(!tel)return alert('Completa el c\u00f3digo de cliente.');
  try{
    let d=await saveTransaction(),num=d.num,t=d.t;
    _lastReceiptRef=d.num;
    updateSidebarQR(t.total,d.num);
    let lafisePayUrl='https://digital.lafise.com/?BANK=BLNI&ACCOUNT_NUMBER=140051265&AMOUNT='+t.total.toFixed(2)+'&REFERENCE='+d.num+'&CONCEPT=Compra%20Productos%20PG%20del%20Campo';
    let lafiseInfo='LAFISE Bancentro\nTitular: Fernando Martinez\nCuenta No. 140051265\nAlias ACH/Movil: 5797 3097\nMonto: C$ '+t.total.toFixed(2);
    let qrUrl='https://api.qrserver.com/v1/create-qr-code/?size=150x150&data='+encodeURIComponent(lafisePayUrl);
    let selZona=$('zona-envio'),nombreZona=selZona.options[selZona.selectedIndex].getAttribute('data-nombre')||'';
    let dir=$('cliente-dir').value.trim()||'Despacho Convencional';
    $('rec-body').innerHTML=
      '<div style="text-align:center;font-weight:bold;margin-bottom:2px">PG DEL CAMPO</div>'+
      '<div style="text-align:center;font-size:10px">R\u00daC: 0452907730000U</div>'+
      '<div style="text-align:center;font-size:9.5px;font-weight:bold;margin-bottom:2px">R\u00e9gimen de Cuota Fija</div>'+
      '<div style="text-align:center;font-size:10px;margin-bottom:8px">Jinotepe, Carazo, Nicaragua</div>'+
      '<p><b>ORDEN PENDIENTE — NO ES COMPROBANTE DE PAGO</b></p>'+'<div style="margin-bottom:3px"><strong>Pedido No.:</strong> '+num+'</div>'+ 
      '<div style="margin-bottom:6px"><strong>Fecha Emisi\u00f3n:</strong> '+new Date().toLocaleDateString('es-NI')+'</div>'+
      '<hr style="border:none;border-top:1px dashed #ccc;margin:6px 0">'+
      '<div style="margin-bottom:6px"><strong>Cliente:</strong> '+E(name)+'<br><strong>Tel\u00e9fono:</strong> '+E(tel)+'<br><strong>Direcci\u00f3n:</strong> '+E(dir)+'<br><strong>Despacho:</strong> '+E(nombreZona)+'</div>'+
      '<hr style="border:none;border-top:1px dashed #ccc;margin:6px 0">'+
      '<div style="font-weight:bold;margin-bottom:4px">ITEMS COMPRADOS:</div>'+
      carrito.map(function(i){return '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>'+i.q+'x '+E(i.n)+'</span><span>C$ '+(i.price*i.q).toFixed(2)+'</span></div>'}).join('')+
      '<hr style="border:none;border-top:1px dashed #ccc;margin:6px 0">'+
      '<div style="display:flex;justify-content:space-between"><span>SUBTOTAL:</span><span>C$ '+t.sub.toFixed(2)+'</span></div>'+
      (t.p>0?'<div style="display:flex;justify-content:space-between"><span>Descuento ('+t.p*100+'%):</span><span>- C$ '+t.d.toFixed(2)+'</span></div>':'')+
      '<div style="display:flex;justify-content:space-between"><span>ENV\u00cdO:</span><span>'+(t.conv?'A convenir':'C$ '+t.ship.toFixed(2))+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin-top:6px"><span>TOTAL COMPRA:</span><span>C$ '+t.total.toFixed(2)+'</span></div>'+
      '<hr style="border:none;border-top:1px dashed #ccc;margin:6px 0">'+
      '<div style="background:#f4f4f6;padding:8px;border-radius:6px;margin:6px 0;font-size:10.5px;text-align:center">'+
        '<p style="font-size:11px;color:var(--primary);font-weight:bold;margin-bottom:6px">DATOS DE PAGO LAFISE</p>'+
        '<a href="'+lafisePayUrl+'" target="_blank" rel="noopener" style="display:inline-block;background:#005691;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:11px;font-weight:bold;margin-bottom:8px">\uD83D\uDD17 Pagar con LAFISE Digital</a>'+
        '<p style="font-size:10px;color:#444;margin-bottom:2px"><strong>Titular:</strong> Fernando Mart\u00ednez (Representante Legal PG del Campo)</p>'+
        '<p style="font-size:10px;color:#444;margin-bottom:2px"><strong>Cuenta N\u00b0:</strong> 140051265</p>'+
        '<p style="font-size:10px;color:#444;margin-bottom:6px"><strong>Alias ACH/M\u00f3vil:</strong> 5797 3097</p>'+
        '<div style="margin-top:6px">'+
          '<p style="font-size:9.5px;font-weight:bold;color:#555;margin-bottom:3px">Escanea para pagar con LAFISE Digital:</p>'+
          '<img src="'+qrUrl+'" alt="QR Pago LAFISE Digital" style="width:120px;height:120px;border:1px solid #ddd;padding:4px;background:#fff;border-radius:6px">'+
        '</div>'+
      '</div>'+
      '<hr style="border:none;border-top:1px dashed #ccc;margin:6px 0">'+
      '<p style="text-align:center;font-size:10.5px;font-weight:bold;color:var(--primary);margin-top:6px">\u00a1Gracias por preferirnos e impulsar el campo!</p>'+
      '<hr style="border:none;border-top:1px dashed #ccc;margin:6px 0">'+
      '<p style="text-align:center;font-size:11px;font-weight:bold;color:var(--primary);margin-top:4px">*BS*D</p>'+
      '<p style="text-align:center;font-size:10px;font-style:italic;color:#555">Todo lo Bueno viene de Dios, con su ayuda todo es posible realizar</p>';
    $('receipt-modal').style.display='flex';
    carrito=[];
    $('cliente-dir').value='';
    calc();
  }catch(e){
    alert('No se pudo generar la orden de pedido: '+e.message);
  }
};

window.closeReceipt=function(){$('receipt-modal').style.display='none'};

calc();

for(const nombre of ['procesar','generarRecibo','procesarPagoWhatsApp','generarEImprimirRecibo']){
 if(typeof window[nombre]!=='function')continue;
 const fn=window[nombre];window[nombre]=async function(...args){
  if(window.__pgProcesando)return;
  window.__pgProcesando=true;
  try{return await fn(...args);}catch(e){alert('No se pudo guardar la orden: '+e.message);}
  finally{window.__pgProcesando=false;}
 };
}
