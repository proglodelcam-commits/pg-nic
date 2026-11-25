
(function(){
  function abrir(){
    if(localStorage.getItem('pg_welcome_hidden')==='1')return;
    var m=document.getElementById('welcome-modal');
    if(m){m.classList.add('show');}
  }
  window.cerrarBienvenida=function(){
    var m=document.getElementById('welcome-modal');
    var chk=document.getElementById('wm-no-show');
    if(chk&&chk.checked){try{localStorage.setItem('pg_welcome_hidden','1');}catch(e){}}
    if(m){m.classList.remove('show');setTimeout(function(){m.style.display='none';},350);}
  };
  /* Mostrar después de la pantalla de bienvenida (splash ~5s) */
  window.addEventListener('load',function(){setTimeout(abrir,5200);});
})();
