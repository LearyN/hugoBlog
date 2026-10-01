/* ============================================================
   CarSelect — brand → model → variant picker
   Shared by the two-car and multi-car comparison pages.
   Usage:
     <script src="/compare/carselect.js"></script>
     CarSelect.host(colIndex, currentModelId)      // emit placeholder
     CarSelect.mountAll(rootEl, {
       cars: CARS, trims: trims,
       values: {0:'byd-atto-2', 1:'proton-e-mas-7'},  // col -> modelId
       onChange: function(col, modelId, variantSid){...}
     });
   ============================================================ */
(function(){
  var BRANDS = {byd:'BYD', proton:'Proton', chery:'Chery', gac:'GAC', toyota:'Toyota', mg:'MG', honda:'Honda', nissan:'Nissan', perodua:'Perodua'};
  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function brandKey(id){return String(id||'').split('-')[0];}
  function brandLabel(k){return BRANDS[k] || (k ? k.toUpperCase() : '');}

  function injectCSS(){
    if(document.getElementById('cs-style')) return;
    var css = ''
      + '.cs{position:relative;display:inline-block;width:100%}'
      + '.cs-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;font:inherit;font-size:13.5px;font-weight:600;color:#111827;border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;background:#fff;cursor:pointer;text-align:left}'
      + '.cs-trigger:hover{border-color:#a5b4fc}'
      + '.cs.open .cs-trigger{border-color:#0b5fff;box-shadow:0 0 0 3px rgba(11,95,255,.12)}'
      + '.cs-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.cs-caret{color:#6b7280;font-size:11px;flex:0 0 auto}'
      + '.cs-panel{position:fixed;z-index:900;width:320px;max-width:92vw;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 16px 44px rgba(15,23,42,.18);padding:10px;display:flex;flex-direction:column;gap:8px}'
      + '.cs-panel[hidden]{display:none}'
      + '.cs-searchrow input{width:100%;font:inherit;font-size:13px;border:1px solid #e5e7eb;border-radius:8px;padding:7px 10px 7px 30px;box-sizing:border-box}'
      + '.cs-searchrow{position:relative}'
      + '.cs-searchrow::before{content:"⌕";position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#9ca3af;font-size:14px}'
      + '.cs-crumbs{display:flex;align-items:center;flex-wrap:wrap;gap:4px;font-size:12px;color:#6b7280;min-height:16px}'
      + '.cs-crumbs a{color:#0b5fff;cursor:pointer;text-decoration:none}'
      + '.cs-crumbs a:hover{text-decoration:underline}'
      + '.cs-crumbs .cs-sep{color:#cbd5e1;margin:0 1px}'
      + '.cs-letters{display:grid;grid-template-columns:repeat(13,1fr);gap:2px}'
      + '.cs-letters button{border:none;background:none;font:inherit;font-size:11px;font-weight:700;color:#0b5fff;cursor:pointer;padding:3px 0;border-radius:5px;line-height:1.1}'
      + '.cs-letters button:hover{background:#eff6ff}'
      + '.cs-letters button.on{background:#0b5fff;color:#fff}'
      + '.cs-letters button.dim{color:#cbd5e1;cursor:default}'
      + '.cs-letters button.dim:hover{background:none}'
      + '.cs-list{max-height:240px;overflow:auto;display:flex;flex-direction:column;gap:2px;border-top:1px solid #eef1f6;padding-top:6px}'
      + '.cs-item{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;font:inherit;font-size:13.5px;color:#111827;background:none;border:none;border-radius:8px;padding:8px 10px;cursor:pointer;text-align:left}'
      + '.cs-item:hover{background:#f3f5f9}'
      + '.cs-item.sel{background:#eff6ff;color:#0b5fff;font-weight:700}'
      + '.cs-sub{font-size:11.5px;color:#9ca3af;font-weight:400;flex:0 0 auto}'
      + '.cs-empty{font-size:12.5px;color:#9ca3af;padding:12px 4px;text-align:center}'
      + '@media(max-width:640px){.cs-panel{width:88vw}}';
    var st=document.createElement('style'); st.id='cs-style'; st.textContent=css;
    document.head.appendChild(st);
  }

  function variantSuffix(modelId, sid){
    var list=(window.__csTrims||function(){return [];})(modelId) || [];
    if(list.length<=1) return '';
    var v=list.filter(function(x){return String(x.sid)===String(sid);})[0];
    return v ? (' · '+v.name) : '';
  }
  // Public helper so pages can keep the trigger label in sync when state changes
  // outside the picker (e.g. variant resolution on load).
  window.variantSuffix = variantSuffix;
  function buildHost(host, opts){
    var cars = opts.cars, trims = opts.trims;
    window.__csTrims = trims;
    var col = host.dataset.csCol;
    var current = host.dataset.csVal;
    var varSid = host.dataset.csVar;
    var initLabel = host.dataset.csLabel;

    // brand -> [modelId]
    var byBrand = {};
    Object.keys(cars).forEach(function(id){ (byBrand[brandKey(id)] = byBrand[brandKey(id)] || []).push(id); });
    // which letters have brands
    var lettersUsed = {};
    Object.keys(byBrand).forEach(function(b){ lettersUsed[brandLabel(b).charAt(0).toUpperCase()] = 1; });

    var st = {level:'brand', brand:null, model:null, letter:null, q:''};

    host.classList.add('cs');
    host.innerHTML =
      '<button class="cs-trigger" type="button" aria-haspopup="listbox">'
      + '<span class="cs-name">'+esc(initLabel || (cars[current] ? cars[current].name : 'Select car'))+'</span>'
      + '<span class="cs-caret">▾</span></button>'
      + '<div class="cs-panel" hidden>'
      +   '<div class="cs-searchrow"><input class="cs-search" type="search" placeholder="Search brand or model…" aria-label="Search brand or model"></div>'
      +   '<div class="cs-crumbs"></div>'
      +   '<div class="cs-letters"></div>'
      +   '<div class="cs-list"></div>'
      + '</div>';

    var trigger = host.querySelector('.cs-trigger');
    var panel   = host.querySelector('.cs-panel');
    var searchEl= host.querySelector('.cs-search');
    var crumbsEl= host.querySelector('.cs-crumbs');
    var lettersEl=host.querySelector('.cs-letters');
    var listEl  = host.querySelector('.cs-list');

    // Seed the picker with the currently displayed model/variant so opening it
    // lands on that trim list with the active variant pre-selected.
    function reset(){
      if(current && cars[current] && varSid){
        st={level:'variant', brand:brandKey(current), model:current, letter:null, q:''};
      } else if(current && cars[current]){
        st={level:'model', brand:brandKey(current), model:null, letter:null, q:''};
      } else {
        st={level:'brand', brand:null, model:null, letter:null, q:''};
      }
      searchEl.value='';
    }
    // Keep the highlighted row of the current model in view when the panel opens.
    function scrollSelIntoView(){
      var sel=listEl.querySelector('.cs-item.sel');
      if(!sel) return;
      var lr=listEl.getBoundingClientRect(), sr=sel.getBoundingClientRect();
      if(sr.top < lr.top || sr.bottom > lr.bottom){
        listEl.scrollTop += (sr.top - lr.top) - (lr.height - sr.height)/2;
      }
    }
    function place(){
      var r=trigger.getBoundingClientRect();
      var w=Math.min(320, Math.max(240, r.width));
      var left=r.left;
      if(left + w > window.innerWidth - 10) left = Math.max(8, window.innerWidth - w - 10);
      panel.style.width = w + 'px';
      panel.style.left  = left + 'px';
      panel.style.top   = (r.bottom + 6) + 'px';
      panel.style.maxHeight = Math.max(220, window.innerHeight - r.bottom - 20) + 'px';
    }
    function open(){ reset(); panel.hidden=false; host.classList.add('open'); draw(); place(); scrollSelIntoView(); searchEl.focus(); }
    function close(){ panel.hidden=true; host.classList.remove('open'); }

    function draw(){
      // breadcrumb
      var cr=['<a data-nav="brand">All brands</a>'];
      if(st.brand || st.model || st.level!=='brand') cr.push('<a data-nav="model">'+esc(st.brand?brandLabel(st.brand):'Brand')+'</a>');
      if(st.model) cr.push('<span>'+esc(cars[st.model].name)+'</span>');
      crumbsEl.innerHTML = cr.join('<span class="cs-sep">›</span>');

      // letters
      lettersEl.innerHTML = LETTERS.map(function(L){
        var dim = lettersUsed[L] ? '' : ' dim';
        var on = (st.letter===L)?' on':'';
        return '<button type="button" class="'+('' + dim + on).trim()+'" data-letter="'+L+'">'+L+'</button>';
      }).join('');

      // list
      if(st.q){
        var res=[];
        Object.keys(byBrand).forEach(function(b){
          if(brandLabel(b).toLowerCase().indexOf(st.q)>=0) res.push({t:'brand',b:b});
          byBrand[b].forEach(function(id){
            if(cars[id].name.toLowerCase().indexOf(st.q)>=0) res.push({t:'model',id:id});
          });
        });
        listEl.innerHTML = res.length ? res.map(function(r){
          if(r.t==='brand') return '<button type="button" class="cs-item" data-brand="'+r.b+'">'+esc(brandLabel(r.b))+'<span class="cs-sub">brand</span></button>';
          return '<button type="button" class="cs-item" data-model="'+r.id+'">'+esc(cars[r.id].name)+'<span class="cs-sub">'+esc(brandLabel(brandKey(r.id)))+'</span></button>';
        }).join('') : '<div class="cs-empty">No brand or model matches “'+esc(st.q)+'”.</div>';
        return;
      }

      if(st.level==='brand'){
        var brands=Object.keys(byBrand).sort(function(a,b){return brandLabel(a).localeCompare(brandLabel(b));});
        if(st.letter) brands=brands.filter(function(b){return brandLabel(b).charAt(0).toUpperCase()===st.letter;});
        listEl.innerHTML = brands.length ? brands.map(function(b){
          var n=byBrand[b].length;
          return '<button type="button" class="cs-item" data-brand="'+b+'">'+esc(brandLabel(b))+'<span class="cs-sub">'+n+' model'+(n>1?'s':'')+'</span></button>';
        }).join('') : '<div class="cs-empty">No brand in this letter.</div>';
      } else if(st.level==='model'){
        listEl.innerHTML = byBrand[st.brand].map(function(id){
          return '<button type="button" class="cs-item'+(id===current?' sel':'')+'" data-model="'+id+'">'+esc(cars[id].name)+'</button>';
        }).join('');
      } else if(st.level==='variant'){
        listEl.innerHTML = trims(st.model).map(function(v){
          var on=(String(v.sid)===String(varSid))?' sel':'';
          return '<button type="button" class="cs-item'+on+'" data-model="'+st.model+'" data-var="'+v.sid+'">'+esc(v.name)+'<span class="cs-sub">'+esc(v.price||'')+'</span></button>';
        }).join('');
      }
    }

    function commit(modelId, sid){
      current = modelId;
      if(sid){ varSid = sid; host.dataset.csVar = sid; }
      host.dataset.csVal = modelId;
      var lbl = cars[modelId].name + (sid ? variantSuffix(modelId, sid) : '');
      host.dataset.csLabel = lbl;
      trigger.querySelector('.cs-name').textContent = lbl;
      close();
      if(opts.onChange) opts.onChange(col, modelId, sid);
    }

    trigger.addEventListener('click', function(e){ e.stopPropagation(); panel.hidden ? open() : close(); });

    host.addEventListener('click', function(e){
      e.stopPropagation();
      var t=e.target.closest('[data-letter],[data-brand],[data-model],[data-nav]');
      if(!t) return;
      if(t.hasAttribute('data-letter')){
        if(!lettersUsed[t.dataset.letter]) return;
        st.letter = (st.letter===t.dataset.letter) ? null : t.dataset.letter;
        st.level='brand'; draw(); return;
      }
      if(t.hasAttribute('data-nav')){
        var nv=t.dataset.nav;
        if(nv==='brand'){ st.level='brand'; st.brand=null; st.model=null; }
        else if(nv==='model'){ st.level='model'; st.model=null; }
        draw(); return;
      }
      if(t.hasAttribute('data-brand')){
        st.brand=t.dataset.brand; st.level='model'; st.model=null; st.q=''; searchEl.value=''; draw(); return;
      }
      if(t.hasAttribute('data-var')){
        commit(t.dataset.model, t.dataset.var); return;
      }
      if(t.hasAttribute('data-model')){
        var id=t.dataset.model, list=trims(id);
        if(list.length>1){ st.model=id; st.level='variant'; draw(); }
        else { commit(id, list[0].sid); }
        return;
      }
    });

    searchEl.addEventListener('input', function(){ st.q=searchEl.value.toLowerCase().trim(); draw(); });
    searchEl.addEventListener('click', function(e){ e.stopPropagation(); });

    if(!host.__csDocBound){
      host.__csDocBound = true;
      document.addEventListener('click', function(e){ if(!host.contains(e.target)) close(); });
      document.addEventListener('keydown', function(e){ if(e.key==='Escape') close(); });
      window.addEventListener('resize', function(){ if(!panel.hidden) place(); });
      window.addEventListener('scroll', function(){ if(!panel.hidden) close(); }, {passive:true});
    }

    draw();
  }

  window.CarSelect = {
    host: function(col, val, label, sid){
      return '<span class="cs-host" data-cs-col="'+esc(col)+'" data-cs-val="'+esc(val)+'" data-cs-var="'+esc(sid==null?'':sid)+'" data-cs-label="'+esc(label||'')+'"></span>';
    },
    mountAll: function(root, opts){
      injectCSS();
      var nodes = (root||document).querySelectorAll('.cs-host:not(.cs)');
      Array.prototype.forEach.call(nodes, function(n){ buildHost(n, opts); });
    },
    brandLabel: brandLabel,
    brandKey: brandKey
  };
})();
