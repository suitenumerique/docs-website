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

  // GitHub star history chart (real data pulled from the GitHub API)
  (function(){
    var container = document.getElementById('starChart');
    var dataEl = document.getElementById('starHistoryData');
    if(!container || !dataEl) return;

    var raw;
    try { raw = JSON.parse(dataEl.textContent); } catch(e){ return; }
    if(!raw || !raw.length) return;

    var points = raw.map(function(p){ return {t: new Date(p.date).getTime(), count: p.count}; });
    var t0 = points[0].t, t1 = points[points.length - 1].t;
    var maxCount = points[points.length - 1].count;
    var niceMax = Math.max(4000, Math.ceil(maxCount / 4000) * 4000);

    var W = 760, H = 300;
    var M = {top: 30, right: 16, bottom: 26, left: 44};
    var plotW = W - M.left - M.right;
    var plotH = H - M.top - M.bottom;

    function xFor(t){ return M.left + (t - t0) / (t1 - t0) * plotW; }
    function yFor(c){ return M.top + plotH - (c / niceMax) * plotH; }
    function fmtK(n){ return n >= 1000 ? (n / 1000) + 'k' : String(n); }

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label',
      'Line chart of cumulative GitHub stars: near zero from April 2024 to March 2025, ' +
      'a sharp jump after reaching the Hacker News front page on March 16, 2025, ' +
      'then steady growth to ' + maxCount.toLocaleString() + ' stars today.');

    // gridlines + y-axis ticks
    var ySteps = niceMax / 4000;
    for(var i = 0; i <= ySteps; i++){
      var val = i * 4000;
      var y = yFor(val);
      var gline = document.createElementNS(svgNS, 'line');
      gline.setAttribute('x1', M.left); gline.setAttribute('x2', W - M.right);
      gline.setAttribute('y1', y); gline.setAttribute('y2', y);
      gline.setAttribute('class', 'sc-grid');
      svg.appendChild(gline);
      var ylabel = document.createElementNS(svgNS, 'text');
      ylabel.setAttribute('x', M.left - 8); ylabel.setAttribute('y', y + 4);
      ylabel.setAttribute('text-anchor', 'end');
      ylabel.setAttribute('class', 'sc-axis-label');
      ylabel.textContent = fmtK(val);
      svg.appendChild(ylabel);
    }

    // x-axis ticks: one per calendar year in range, plus the start date
    var xTicks = [{t: t0, label: new Date(t0).toLocaleDateString(undefined, {month: 'short', year: 'numeric'})}];
    var startYear = new Date(t0).getUTCFullYear(), endYear = new Date(t1).getUTCFullYear();
    for(var yr = startYear + 1; yr <= endYear; yr++){
      var jan1 = Date.UTC(yr, 0, 1);
      if(jan1 > t0 && jan1 < t1) xTicks.push({t: jan1, label: String(yr)});
    }
    xTicks.forEach(function(tk){
      var x = xFor(tk.t);
      var xlabel = document.createElementNS(svgNS, 'text');
      xlabel.setAttribute('x', x); xlabel.setAttribute('y', H - 6);
      xlabel.setAttribute('text-anchor', 'middle');
      xlabel.setAttribute('class', 'sc-axis-label');
      xlabel.textContent = tk.label;
      svg.appendChild(xlabel);
    });

    // area + line
    var coords = points.map(function(p){ return xFor(p.t) + ',' + yFor(p.count); });
    var lineD = 'M' + coords.join(' L');
    var areaD = lineD + ' L' + xFor(t1) + ',' + (M.top + plotH) + ' L' + xFor(t0) + ',' + (M.top + plotH) + ' Z';

    var area = document.createElementNS(svgNS, 'path');
    area.setAttribute('d', areaD); area.setAttribute('class', 'sc-area');
    svg.appendChild(area);

    var line = document.createElementNS(svgNS, 'path');
    line.setAttribute('d', lineD); line.setAttribute('class', 'sc-line');
    svg.appendChild(line);

    // annotation: the moment the HN crowd arrived (first 100 stars, reached the morning of the post)
    var annoIdx = 0;
    points.forEach(function(p, idx){ if(p.count === 100) annoIdx = idx; });
    var anno = points[annoIdx];
    var ax = xFor(anno.t), ay = yFor(anno.count);
    var labelX = Math.max(M.left + 4, ax - 116);
    var labelY = M.top + 14;

    var aline = document.createElementNS(svgNS, 'line');
    aline.setAttribute('x1', ax); aline.setAttribute('y1', ay - 5);
    aline.setAttribute('x2', ax - 18); aline.setAttribute('y2', labelY + 22);
    aline.setAttribute('class', 'sc-annotation-line');
    svg.appendChild(aline);

    var adot = document.createElementNS(svgNS, 'circle');
    adot.setAttribute('cx', ax); adot.setAttribute('cy', ay); adot.setAttribute('r', 3.5);
    adot.setAttribute('class', 'sc-annotation-dot');
    svg.appendChild(adot);

    var atext = document.createElementNS(svgNS, 'text');
    atext.setAttribute('x', labelX); atext.setAttribute('y', labelY);
    atext.setAttribute('class', 'sc-annotation-label');
    var tspan1 = document.createElementNS(svgNS, 'tspan');
    tspan1.setAttribute('x', labelX); tspan1.setAttribute('dy', '0');
    tspan1.textContent = '\u{1F680} Hacker News front page';
    var tspan2 = document.createElementNS(svgNS, 'tspan');
    tspan2.setAttribute('x', labelX); tspan2.setAttribute('dy', '15');
    tspan2.textContent = 'March 16, 2025';
    atext.appendChild(tspan1); atext.appendChild(tspan2);
    svg.appendChild(atext);

    // end marker + direct label with the current total
    var last = points[points.length - 1];
    var lx = xFor(last.t), ly = yFor(last.count);
    var endDot = document.createElementNS(svgNS, 'circle');
    endDot.setAttribute('cx', lx); endDot.setAttribute('cy', ly); endDot.setAttribute('r', 4);
    endDot.setAttribute('class', 'sc-end-dot');
    svg.appendChild(endDot);

    var endLabel = document.createElementNS(svgNS, 'text');
    endLabel.setAttribute('x', Math.min(lx, W - M.right - 2));
    endLabel.setAttribute('y', Math.max(ly - 12, M.top + 10));
    endLabel.setAttribute('text-anchor', 'end');
    endLabel.setAttribute('class', 'sc-end-label');
    endLabel.textContent = last.count.toLocaleString() + ' ★';
    svg.appendChild(endLabel);

    // hover: crosshair + tooltip snapped to the nearest sampled point
    var crosshair = document.createElementNS(svgNS, 'line');
    crosshair.setAttribute('y1', M.top); crosshair.setAttribute('y2', M.top + plotH);
    crosshair.setAttribute('class', 'sc-crosshair');
    crosshair.style.opacity = '0';
    svg.appendChild(crosshair);

    var hitRect = document.createElementNS(svgNS, 'rect');
    hitRect.setAttribute('x', M.left); hitRect.setAttribute('y', M.top);
    hitRect.setAttribute('width', plotW); hitRect.setAttribute('height', plotH);
    hitRect.setAttribute('fill', 'transparent');
    svg.appendChild(hitRect);

    container.appendChild(svg);

    var tooltip = document.createElement('div');
    tooltip.className = 'star-chart-tooltip';
    container.appendChild(tooltip);

    function nearestIndex(t){
      var best = 0, bestDiff = Infinity;
      for(var i = 0; i < points.length; i++){
        var diff = Math.abs(points[i].t - t);
        if(diff < bestDiff){ bestDiff = diff; best = i; }
      }
      return best;
    }

    function handleMove(clientX){
      var rect = svg.getBoundingClientRect();
      var scale = W / rect.width;
      var svgX = (clientX - rect.left) * scale;
      if(svgX < M.left || svgX > W - M.right){ hideTooltip(); return; }
      var t = t0 + (svgX - M.left) / plotW * (t1 - t0);
      var idx = nearestIndex(t);
      var p = points[idx];
      var px = xFor(p.t), py = yFor(p.count);
      crosshair.setAttribute('x1', px); crosshair.setAttribute('x2', px);
      crosshair.style.opacity = '1';

      var containerRect = container.getBoundingClientRect();
      var toPx = containerRect.width / W;
      tooltip.style.left = (px * toPx) + 'px';
      tooltip.style.top = (py * toPx - 10) + 'px';
      tooltip.textContent = '';
      var strong = document.createElement('b');
      strong.textContent = p.count.toLocaleString() + ' stars';
      var small = document.createElement('div');
      small.textContent = new Date(p.t).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
      tooltip.appendChild(strong);
      tooltip.appendChild(small);
      tooltip.classList.add('visible');
    }
    function hideTooltip(){
      crosshair.style.opacity = '0';
      tooltip.classList.remove('visible');
    }

    hitRect.addEventListener('pointermove', function(e){ handleMove(e.clientX); });
    hitRect.addEventListener('pointerleave', hideTooltip);
    hitRect.addEventListener('touchmove', function(e){
      if(e.touches && e.touches[0]) handleMove(e.touches[0].clientX);
    }, {passive: true});
  })();

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
