/* Informations juridiques des entreprises (factures)
   Recherche dans le registre officiel des entreprises (API Recherche d'entreprises, INSEE / data.gouv.fr)
   et dans la Base Adresse Nationale (Géoplateforme IGN, avec repli sur api-adresse.data.gouv.fr).
   DealrLegal.complete(legal) : true si une facture peut être créée. */
(function () {
  var L = {};
  function digits(s) { return String(s || "").replace(/\D/g, ""); }

  /* SIREN : 9 chiffres + clé de Luhn (exception : La Poste) */
  L.validSiren = function (s) {
    s = digits(s);
    if (!/^\d{9}$/.test(s)) return false;
    if (s === "356000000") return true;
    var sum = 0;
    for (var i = 0; i < 9; i++) { var n = +s[8 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; }
    return sum % 10 === 0;
  };
  /* Numéro de TVA intracommunautaire français calculé à partir du SIREN */
  L.tvaFor = function (siren) {
    siren = digits(siren);
    if (!/^\d{9}$/.test(siren)) return "";
    var k = (12 + 3 * (Number(siren) % 97)) % 97;
    return "FR" + (k < 10 ? "0" : "") + k + siren;
  };
  L.cleanTva = function (s) { return String(s || "").toUpperCase().replace(/[\s.\-]/g, ""); };
  /* Vide = non assujetti (franchise en base) ; sinon FR + clé + SIREN de l'entreprise */
  L.validTva = function (tva, siren) {
    tva = L.cleanTva(tva);
    if (!tva) return true;
    var m = tva.match(/^FR([0-9A-Z]{2})(\d{9})$/);
    if (!m || m[2] !== digits(siren)) return false;
    return /^\d\d$/.test(m[1]) ? tva === L.tvaFor(siren) : true;
  };
  L.idLabel = function (l) { var s = digits(l && (l.siret || l.siren)); return s.length === 14 ? "SIRET : " + s : (s ? "SIREN : " + s : ""); };
  L.complete = function (l) { return !!(l && String(l.name || "").trim() && L.validSiren(l.siren) && String(l.addr || "").trim().length >= 8 && L.validTva(l.tva, l.siren)); };

  /* Registre officiel des entreprises */
  function title(s) { return String(s || "").trim(); }
  L.searchCompanies = function (q) {
    var u = "https://recherche-entreprises.api.gouv.fr/search?per_page=8&page=1&q=" + encodeURIComponent(q);
    return fetch(u, { headers: { Accept: "application/json" } }).then(function (r) {
      if (!r.ok) throw new Error("registre");
      return r.json();
    }).then(function (d) {
      return (d.results || d.resultats || []).map(function (x) {
        var s = x.siege || {};
        var cp = s.code_postal || "", ville = s.libelle_commune || s.commune || "";
        return {
          siren: digits(x.siren), siret: digits(s.siret),
          name: title(x.nom_raison_sociale || x.nom_complet || x.nom),
          addr: title(s.adresse || [s.numero_voie, s.type_voie, s.libelle_voie, cp, ville].filter(Boolean).join(" ")),
          cp: cp, ville: ville, open: (x.etat_administratif || "A") === "A"
        };
      }).filter(function (x) { return x.siren && x.name; });
    });
  };
  /* Base Adresse Nationale */
  function bano(base, q) {
    return fetch(base + "?limit=6&autocomplete=1&q=" + encodeURIComponent(q)).then(function (r) {
      if (!r.ok) throw new Error("adresse");
      return r.json();
    }).then(function (d) {
      return (d.features || []).map(function (f) { var p = f.properties || {}; return { label: p.label || "", cp: p.postcode || "", ville: p.city || "" }; })
        .filter(function (a) { return a.label; });
    });
  }
  L.searchAddress = function (q) {
    return bano("https://data.geopf.fr/geocodage/search", q).catch(function () { return bano("https://api-adresse.data.gouv.fr/search/", q); });
  };

  /* Liste de suggestions sous un champ */
  var CSS = ".lg-wrap{position:relative}" +
    ".lg-list{position:absolute;z-index:40;left:0;right:0;top:calc(100% + 6px);margin:0;padding:6px;list-style:none;background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.16),0 1px 3px rgba(0,0,0,.08);max-height:330px;overflow-y:auto}" +
    ".lg-list li{padding:10px 12px;border-radius:10px;cursor:pointer;line-height:1.35}" +
    ".lg-list li[aria-selected=true],.lg-list li:hover{background:#f3f4fb}" +
    ".lg-list small{display:block;color:#6b6b73;font-size:.8rem;font-variant-numeric:tabular-nums}" +
    ".lg-list .lg-add{border-bottom:1px solid #ececf0;border-radius:10px 10px 0 0}.lg-list .lg-add b{color:#3448f0}" +
    ".lg-list .lg-off{opacity:.55}.lg-msg{color:#6b6b73;font-size:.9rem;cursor:default!important}.lg-msg:hover{background:none!important}";
  var uid = 0;
  L.attach = function (input, o) {
    if (!document.getElementById("lgCss")) { var st = document.createElement("style"); st.id = "lgCss"; st.textContent = CSS; document.head.appendChild(st); }
    var wrap = document.createElement("div"); wrap.className = "lg-wrap";
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    var list = document.createElement("ul"); list.className = "lg-list"; list.id = "lg" + (++uid); list.setAttribute("role", "listbox"); list.hidden = true;
    wrap.appendChild(list);
    input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list"); input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", list.id); input.setAttribute("autocomplete", "off");
    var items = [], cur = -1, timer = null, seq = 0;
    function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); cur = -1; }
    function mark(i) {
      cur = i;
      Array.prototype.forEach.call(list.children, function (li, k) { li.setAttribute("aria-selected", k === i ? "true" : "false"); });
      if (i >= 0 && list.children[i]) list.children[i].scrollIntoView({ block: "nearest" });
    }
    function pick(i) { var it = items[i]; if (!it || it.off) return; close(); o.onPick(it.v); }
    function show(arr, msg) {
      items = arr; list.textContent = "";
      arr.forEach(function (it, i) {
        var li = document.createElement("li"); li.id = list.id + "-" + i; li.setAttribute("role", "option");
        if (it.cls) li.className = it.cls;
        li.innerHTML = it.html;
        li.addEventListener("mousedown", function (e) { e.preventDefault(); pick(i); });
        list.appendChild(li);
      });
      if (msg) { var m = document.createElement("li"); m.className = "lg-msg"; m.textContent = msg; list.appendChild(m); }
      list.hidden = !list.children.length; input.setAttribute("aria-expanded", list.hidden ? "false" : "true");
      var first = -1; items.some(function (it, k) { if (!it.off && !it.add) { first = k; return true; } return false; });
      mark(first);
    }
    function update() {
      if (input.readOnly) return;
      var q = input.value.trim(), my = ++seq;
      if (q.length < (o.min || 2)) { close(); return; }
      var head = o.first ? o.first(q) : null;
      show(head ? [head] : [], "Recherche…");
      o.search(q).then(function (r) {
        if (my !== seq || document.activeElement !== input) return;
        var arr = (head ? [head] : []).concat(r.map(o.item));
        show(arr, r.length ? "" : (o.empty || "Aucun résultat."));
      }).catch(function () {
        if (my !== seq) return;
        show(head ? [head] : [], o.down || "Recherche indisponible pour le moment.");
      });
    }
    input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(update, 250); if (o.onType) o.onType(); });
    input.addEventListener("keydown", function (e) {
      if (list.hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); mark(Math.min(cur + 1, items.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); mark(Math.max(cur - 1, 0)); }
      else if (e.key === "Enter") { if (cur >= 0) { e.preventDefault(); e.stopPropagation(); pick(cur); } }
      else if (e.key === "Escape") { close(); }
    });
    input.addEventListener("blur", function () { setTimeout(close, 150); });
    return { close: close };
  };
  window.DealrLegal = L;
})();
