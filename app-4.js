
var navLinks=document.querySelectorAll('.nav-link');
var sections=document.querySelectorAll('.section');
var bottomNavItems=document.querySelectorAll('.bottom-nav .nav-item');
function navegarA(target){
  sections.forEach(function(section){
    section.classList.remove('active');
    if(section.id===target) section.classList.add('active');
  });
  bottomNavItems.forEach(function(item){
    item.classList.remove('active');
    if(item.dataset.target===target) item.classList.add('active');
  });
  window.scrollTo(0,0);
}
navLinks.forEach(function(link){
  link.addEventListener('click',function(e){
    e.preventDefault();
    navegarA(link.dataset.target);
  });
});
function irAPedido(){ navegarA('pedido'); }
window.irAPedido=irAPedido;
window.navegarA=navegarA;

var deferredPrompt;
var installBanner=document.getElementById('installBanner');
var installBtn=document.getElementById('installBtn');
if('serviceWorker' in navigator){
  var _swRecargando=false;
  /* Cuando el Service Worker nuevo toma control, recarga una sola vez
     para mostrar la versión recién publicada (sin bucles). */
  navigator.serviceWorker.addEventListener('controllerchange',function(){
    if(_swRecargando) return;
    _swRecargando=true;
    window.location.reload();
  });
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('./sw-pg-seguro.js').then(function(reg){
      /* Busca si hay una versión nueva cada vez que se abre la tienda. */
      try{ reg.update(); }catch(e){}
      reg.addEventListener('updatefound',function(){
        var nuevo=reg.installing;
        if(!nuevo) return;
        nuevo.addEventListener('statechange',function(){
          /* Hay versión nueva lista y ya había una activa: actívala. */
          if(nuevo.state==='installed' && navigator.serviceWorker.controller){
            nuevo.postMessage('SKIP_WAITING');
          }
        });
      });
    }).catch(function(err){console.log('SW Error: ',err);});
  });
}
window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault();
  deferredPrompt=e;
  setTimeout(function(){
    if(!window.matchMedia('(display-mode: standalone)').matches){
      installBanner.style.display='flex';
    }
  },4000);
});
if(installBtn){
  installBtn.addEventListener('click',async function(){
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    var outcome=await deferredPrompt.userChoice;
    if(outcome==='accepted'){
      installBanner.style.display='none';
      deferredPrompt=null;
    }
  });
}
