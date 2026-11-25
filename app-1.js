
  /* Nosotros: botón copiar ACH y respaldo de imagen nutricional */
  (function(){
    var cp=document.getElementById('nos-copy-ach');
    if(cp){cp.addEventListener('click',function(){
      var el=document.getElementById(cp.getAttribute('data-copy'));
      var val=(el?el.textContent:'').replace(/\s+/g,'');
      var done=function(){var o=cp.textContent;cp.textContent='¡Copiado!';setTimeout(function(){cp.textContent=o},1600)};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(val).then(done,done)}
      else{try{var t=document.createElement('textarea');t.value=val;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t)}catch(e){}done()}
    })}
    var ni=document.getElementById('nos-nutri-img');
    if(ni){ni.addEventListener('error',function(){ni.style.display='none'})}
  })();
  