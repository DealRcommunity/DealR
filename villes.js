/* Recherche de ville (France métropolitaine, DROM et collectivités d'outre-mer)
   Données : communes-fr.json, construit à partir du Code officiel géographique (INSEE)
   et de la base officielle des codes postaux (La Poste).
   DealrVilles.attach(input, { onPick: function (ville) {} })
   ville = { nom, cp, dep, depNom } */
(function () {
  var dataP = null;
  function load() {
    if (!dataP) dataP = fetch("communes-fr.json").then(function (r) { if (!r.ok) throw new Error("villes"); return r.json(); })
      .then(function (d) {
        d.list = d.c.map(function (x) { return { nom: x[0], cps: x[1].split(","), dep: x[2], pop: x[3], k: norm(x[0]) }; });
        return d;
      }).catch(function (e) { dataP = null; throw e; });
    return dataP;
  }
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/['’\-]/g, " ").replace(/\bst(e?)\b/g, "saint$1").replace(/\s+/g, " ").trim();
  }
  function search(d, q, max) {
    var out = [], nq = norm(q), digits = /^\d{2,5}$/.test(q.replace(/\s/g, ""));
    if (!nq) return out;
    if (digits) {
      var dq = q.replace(/\s/g, "");
      for (var i = 0; i < d.list.length && out.length < max; i++) {
        var c = d.list[i], hit = c.cps.filter(function (p) { return p.indexOf(dq) === 0; });
        hit.slice(0, 3).forEach(function (p) { if (out.length < max) out.push({ c: c, cp: p }); });
      }
      return out;
    }
    var a = [], b = [], w = [];
    for (var j = 0; j < d.list.length; j++) {
      var x = d.list[j];
      if (x.k === nq) a.push(x);
      else if (x.k.indexOf(nq) === 0) b.push(x);
      else if (nq.length > 2 && x.k.indexOf(" " + nq) > 0) w.push(x);
    }
    return a.concat(b, w).slice(0, max).map(function (c) { return { c: c, cp: c.cps[0] }; });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }

  var CSS = ".vl-wrap{position:relative}" +
    ".vl-list{position:absolute;z-index:40;left:0;right:0;top:calc(100% + 6px);margin:0;padding:6px;list-style:none;background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.16),0 1px 3px rgba(0,0,0,.08);max-height:320px;overflow-y:auto}" +
    ".vl-list li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer}" +
    ".vl-list li[aria-selected=true],.vl-list li:hover{background:#f3f4fb}" +
    ".vl-list b{font-weight:600}.vl-list small{color:#6b6b73;font-size:.82rem;white-space:nowrap}" +
    ".vl-cp{font-variant-numeric:tabular-nums;font-weight:700;font-size:.85rem;color:#3448f0;background:#eef0ff;border-radius:99px;padding:3px 9px;white-space:nowrap}" +
    ".vl-msg{padding:10px 12px;color:#6b6b73;font-size:.9rem;cursor:default!important}" +
    ".vl-msg:hover{background:none!important}";

  function attach(input, opts) {
    opts = opts || {};
    if (!document.getElementById("vlCss")) { var st = document.createElement("style"); st.id = "vlCss"; st.textContent = CSS; document.head.appendChild(st); }
    var wrap = document.createElement("div"); wrap.className = "vl-wrap";
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    var list = document.createElement("ul"); list.className = "vl-list"; list.id = input.id + "-list"; list.setAttribute("role", "listbox"); list.hidden = true;
    wrap.appendChild(list);
    input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list"); input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", list.id); input.setAttribute("autocomplete", "off");
    var items = [], cur = -1, picked = null, timer = null, data = null;

    function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); cur = -1; }
    function mark(i) {
      cur = i;
      Array.prototype.forEach.call(list.children, function (li, k) { li.setAttribute("aria-selected", k === i ? "true" : "false"); });
      if (i >= 0 && list.children[i]) { input.setAttribute("aria-activedescendant", list.children[i].id); list.children[i].scrollIntoView({ block: "nearest" }); }
    }
    function pick(i) {
      var it = items[i]; if (!it) return;
      picked = { nom: it.c.nom, cp: it.cp, dep: it.c.dep, depNom: (data.deps || {})[it.c.dep] || "" };
      input.value = picked.nom; close();
      if (opts.onPick) opts.onPick(picked);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function render(q) {
      items = search(data, q, 8); list.textContent = "";
      if (!items.length) { var m = document.createElement("li"); m.className = "vl-msg"; m.textContent = "Aucune ville trouvée. Vérifiez l’orthographe ou tapez le code postal."; list.appendChild(m); }
      items.forEach(function (it, i) {
        var li = document.createElement("li"); li.id = list.id + "-" + i; li.setAttribute("role", "option");
        var more = it.c.cps.length > 1 && !/^\d/.test(q) ? " · " + it.c.cps.length + " codes" : "";
        li.innerHTML = "<span><b>" + esc(it.c.nom) + "</b><br><small>" + esc(((data.deps || {})[it.c.dep] || "") + " (" + it.c.dep + ")") + esc(more) + "</small></span><span class=\"vl-cp\">" + esc(it.cp) + "</span>";
        li.addEventListener("mousedown", function (e) { e.preventDefault(); pick(i); });
        list.appendChild(li);
      });
      list.hidden = false; input.setAttribute("aria-expanded", "true"); mark(items.length ? 0 : -1);
    }
    function update() {
      var q = input.value.trim();
      if (picked && q !== picked.nom) { picked = null; if (opts.onPick) opts.onPick(null); }
      if (q.length < 2) { close(); return; }
      load().then(function (d) { data = d; if (document.activeElement === input) render(q); })
        .catch(function () { close(); });
    }
    input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(update, 90); });
    input.addEventListener("focus", function () { load().then(function (d) { data = d; }).catch(function () {}); });
    input.addEventListener("keydown", function (e) {
      if (list.hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); mark(Math.min(cur + 1, items.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); mark(Math.max(cur - 1, 0)); }
      else if (e.key === "Enter") { if (cur >= 0) { e.preventDefault(); e.stopPropagation(); pick(cur); } }
      else if (e.key === "Escape") { close(); }
    });
    input.addEventListener("blur", function () { setTimeout(close, 120); });
    return {
      picked: function () { return picked; },
      set: function (v) { picked = v && v.nom ? v : null; input.value = v && v.nom ? v.nom : (v || ""); },
      ready: function () { return load().then(function () { return true; }, function () { return false; }); }
    };
  }
  window.DealrVilles = { attach: attach, load: load, norm: norm };
})();
