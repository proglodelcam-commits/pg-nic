
function copiarAliasACH(){
  var numeroAlias=document.getElementById("alias-ach-num").innerText;
  navigator.clipboard.writeText(numeroAlias).then(function(){
    alert("\u00a1Alias ACH ("+numeroAlias+") copiado al portapapeles!");
  }).catch(function(err){
    console.error("Error al copiar el Alias ACH: ",err);
  });
}
window.copiarAliasACH=copiarAliasACH;
