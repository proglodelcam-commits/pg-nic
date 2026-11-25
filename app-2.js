
(function(){
  /* Generate ambient particles */
  var pc=document.getElementById('introParticles');
  if(pc){
    var cnt=window.innerWidth<500?16:38;
    for(var i=0;i<cnt;i++){
      var d=document.createElement('div');
      d.className='g';
      var sz=Math.random()*4+1;
      d.style.width=sz+'px';
      d.style.height=sz+'px';
      d.style.left=Math.random()*100+'%';
      d.style.bottom=-(Math.random()*12)+'%';
      d.style.animationDuration=(Math.random()*13+7)+'s';
      d.style.animationDelay=(Math.random()*5)+'s';
      var gold=Math.random()>.5;
      d.style.background=gold
        ?'rgba(200,150,62,'+(Math.random()*.28+.08).toFixed(2)+')'
        :'rgba(76,175,80,'+(Math.random()*.18+.05).toFixed(2)+')';
      pc.appendChild(d);
    }
  }

  /* Sparkle burst after logo lands */
  var logo=document.querySelector('.intro-logo');
  if(logo){
    logo.addEventListener('animationend',function(){
      var sym=['✦','✧','⟡','·'];
      var wrap=document.getElementById('pantalla-bienvenida');
      for(var s=0;s<10;s++){
        var sp=document.createElement('div');
        sp.className='intro-sp';
        sp.textContent=sym[Math.floor(Math.random()*sym.length)];
        sp.style.left=(Math.random()*50+25)+'%';
        sp.style.top=(Math.random()*22+20)+'%';
        sp.style.animationDelay=(Math.random()*.35)+'s';
        sp.style.color=Math.random()>.5?'#c8963e':'#4CAF50';
        wrap.appendChild(sp);
        (function(el){setTimeout(function(){el.remove()},1200)})(sp);
      }
    },{once:true});
  }

  /* Auto-transition after duration */
  var el=document.getElementById('pantalla-bienvenida');
  var DUR=4000;
  setTimeout(function(){
    if(!el)return;
    el.classList.add('fade-out');
    setTimeout(function(){el.style.display='none'},950);
  },DUR);

  /* Skip on tap/click */
  if(el){
    el.addEventListener('click',function(){
      el.classList.add('fade-out');
      setTimeout(function(){el.style.display='none'},950);
    },{once:true});
  }
})();
