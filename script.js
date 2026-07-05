  // mobile nav toggle
  var navToggle = document.getElementById('navToggle');
  navToggle.addEventListener('click', function(){
    var isOpen = document.querySelector('.nav-links').classList.toggle('mobile-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  });

  // core principles: click a step to preview its clip/screenshot
  (function(){
    var steps = document.querySelectorAll('.principle-step');
    var mediaEls = document.querySelectorAll('.principles-display [data-step]');
    if(!steps.length || !mediaEls.length) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function activate(stepId){
      steps.forEach(function(btn){
        var isActive = btn.getAttribute('data-step') === stepId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });
      mediaEls.forEach(function(el){
        var isActive = el.getAttribute('data-step') === stepId;
        el.classList.toggle('active', isActive);
        if(el.tagName === 'VIDEO'){
          if(isActive && !reduceMotion){
            el.currentTime = 0;
            el.play().catch(function(){});
          } else {
            el.pause();
          }
        }
      });
    }

    steps.forEach(function(btn){
      btn.addEventListener('click', function(){ activate(btn.getAttribute('data-step')); });
    });

    var initialVideo = document.querySelector('.principles-display video.active');
    if(initialVideo && !reduceMotion){ initialVideo.play().catch(function(){}); }
  })();

  // scroll reveal
  var revealEls = document.querySelectorAll('.reveal');
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, {threshold:0.12, rootMargin:'0px 0px -40px 0px'});
  revealEls.forEach(function(el){ io.observe(el); });

  // only one faq open at a time
  var faqs = document.querySelectorAll('.faq-item');
  faqs.forEach(function(item){
    item.addEventListener('toggle', function(){
      if(item.open){
        faqs.forEach(function(other){ if(other !== item) other.open = false; });
      }
    });
  });

  // copy-to-clipboard for the self-host snippet
  var copyStatus = document.getElementById('copyStatus');
  document.querySelectorAll('.copy-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var text = btn.getAttribute('data-copy');
      navigator.clipboard.writeText(text).then(function(){
        var original = btn.textContent;
        btn.textContent = 'Copied!';
        if(copyStatus){ copyStatus.textContent = 'Commands copied to clipboard'; }
        setTimeout(function(){ btn.textContent = original; }, 1600);
      });
    });
  });
