/* Dealr – petit générateur de PDF (A4, Helvetica, accents et €), sans bibliothèque externe.
   Le texte reste sélectionnable dans le PDF. Coordonnées en points, origine en haut à gauche. */
(function () {
  var W = 595.28, H = 841.89;
  // Largeurs Helvetica / Helvetica-Bold (caractères 32 à 126), en millièmes de la taille
  var R = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  var B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  // Caractères hors Latin-1 présents dans l'encodage WinAnsi
  var WIN = { 0x20AC: 0x80, 0x201A: 0x82, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x0152: 0x8C, 0x0153: 0x9C, 0x202F: 0x20, 0x2009: 0x20, 0x2212: 0x2D, 0x2010: 0x2D, 0x2011: 0x2D };
  var EXTRA_W = { 0x80: 556, 0x85: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0x8C: 1000, 0x9C: 944, 0xA0: 278, 0xAB: 556, 0xBB: 556, 0xB0: 400, 0xD7: 584 };

  function code(ch) {
    var c = ch.charCodeAt(0);
    if (c < 128) return c;
    if (c >= 0xA0 && c <= 0xFF) return c;
    return WIN[c] || 63; // « ? » si le caractère n'existe pas dans la police
  }
  function width(ch, bold) {
    var c = code(ch);
    if (c >= 32 && c <= 126) return (bold ? B : R)[c - 32];
    if (EXTRA_W[c]) return EXTRA_W[c] + (bold && (c === 0x91 || c === 0x92) ? 56 : 0);
    var base = ch.normalize ? ch.normalize("NFD").charAt(0) : ch; // é → e
    var b = base.charCodeAt(0);
    return b >= 32 && b <= 126 ? (bold ? B : R)[b - 32] : 556;
  }
  function textWidth(s, size, bold) {
    var w = 0; s = String(s);
    for (var i = 0; i < s.length; i++) w += width(s[i], bold);
    return w * size / 1000;
  }
  function esc(s) {
    var out = ""; s = String(s);
    for (var i = 0; i < s.length; i++) {
      var c = code(s[i]);
      if (c === 40 || c === 41 || c === 92) out += "\\" + String.fromCharCode(c);
      else if (c < 32 || c > 126) out += "\\" + ("00" + c.toString(8)).slice(-3);
      else out += String.fromCharCode(c);
    }
    return out;
  }
  function rgb(hex) {
    hex = String(hex || "#000000").replace("#", "");
    return [0, 2, 4].map(function (i) { return (parseInt(hex.substr(i, 2), 16) / 255).toFixed(3); }).join(" ");
  }
  function n(v) { return (Math.round(v * 100) / 100).toString(); }

  function Doc(meta) { this.pages = []; this.meta = meta || {}; this.addPage(); }
  Doc.prototype.W = W; Doc.prototype.H = H;
  Doc.prototype.addPage = function () { this.cur = []; this.pages.push(this.cur); return this; };
  Doc.prototype.textWidth = textWidth;
  /* Texte : o = { size, bold, color, align: "left" | "right" | "center" } ; y = ligne de base depuis le haut */
  Doc.prototype.text = function (x, y, s, o) {
    o = o || {}; var size = o.size || 10, bold = !!o.bold;
    if (o.align === "right") x -= textWidth(s, size, bold);
    else if (o.align === "center") x -= textWidth(s, size, bold) / 2;
    this.cur.push("BT /" + (bold ? "F2" : "F1") + " " + n(size) + " Tf " + rgb(o.color) + " rg " + n(x) + " " + n(H - y) + " Td (" + esc(s) + ") Tj ET");
    return this;
  };
  Doc.prototype.line = function (x1, y1, x2, y2, w, color) {
    this.cur.push(rgb(color) + " RG " + n(w || 1) + " w " + n(x1) + " " + n(H - y1) + " m " + n(x2) + " " + n(H - y2) + " l S");
    return this;
  };
  Doc.prototype.rect = function (x, y, w, h, o) {
    o = o || {};
    var r = n(x) + " " + n(H - y - h) + " " + n(w) + " " + n(h) + " re ";
    if (o.fill) this.cur.push(rgb(o.fill) + " rg " + r + "f");
    if (o.stroke) this.cur.push((o.dash ? "[3 3] 0 d " : "") + rgb(o.stroke) + " RG " + n(o.width || 1) + " w " + r + "S" + (o.dash ? " [] 0 d" : ""));
    return this;
  };
  Doc.prototype.circle = function (cx, cy, r, color) {
    var k = 0.5523 * r, y = H - cy;
    this.cur.push(rgb(color) + " rg " + n(cx + r) + " " + n(y) + " m " +
      n(cx + r) + " " + n(y + k) + " " + n(cx + k) + " " + n(y + r) + " " + n(cx) + " " + n(y + r) + " c " +
      n(cx - k) + " " + n(y + r) + " " + n(cx - r) + " " + n(y + k) + " " + n(cx - r) + " " + n(y) + " c " +
      n(cx - r) + " " + n(y - k) + " " + n(cx - k) + " " + n(y - r) + " " + n(cx) + " " + n(y - r) + " c " +
      n(cx + k) + " " + n(y - r) + " " + n(cx + r) + " " + n(y - k) + " " + n(cx + r) + " " + n(y) + " c f");
    return this;
  };
  /* Découpe un texte en lignes qui tiennent dans maxW (respecte les retours à la ligne) */
  Doc.prototype.wrap = function (s, maxW, size, bold) {
    var out = [];
    String(s || "").split(/\r?\n/).forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), line = "";
      if (!words.length) { out.push(""); return; }
      words.forEach(function (w) {
        var t = line ? line + " " + w : w;
        if (textWidth(t, size, bold) <= maxW) { line = t; return; }
        if (line) out.push(line);
        while (textWidth(w, size, bold) > maxW && w.length > 1) { // mot trop long : on le coupe
          var k = w.length; while (k > 1 && textWidth(w.slice(0, k), size, bold) > maxW) k--;
          out.push(w.slice(0, k)); w = w.slice(k);
        }
        line = w;
      });
      out.push(line);
    });
    return out;
  };
  /* Assemble le fichier PDF (chaîne ASCII) */
  Doc.prototype.build = function () {
    var objs = [], pageIds = [], self = this;
    function add(s) { objs.push(s); return objs.length; }
    var cat = add(""), pages = add("");
    var f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    var f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    this.pages.forEach(function (p) {
      var stream = p.join("\n");
      var c = add("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
      pageIds.push(add("<< /Type /Page /Parent " + pages + " 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /Font << /F1 " + f1 + " 0 R /F2 " + f2 + " 0 R >> >> /Contents " + c + " 0 R >>"));
    });
    objs[cat - 1] = "<< /Type /Catalog /Pages " + pages + " 0 R >>";
    objs[pages - 1] = "<< /Type /Pages /Kids [" + pageIds.map(function (i) { return i + " 0 R"; }).join(" ") + "] /Count " + pageIds.length + " >>";
    var info = add("<< /Title (" + esc(self.meta.title || "Document") + ") /Producer (Dealr) /Creator (Dealr) >>");
    var out = "%PDF-1.4\n", offs = [];
    objs.forEach(function (o, i) { offs.push(out.length); out += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
    var x = out.length;
    out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
    offs.forEach(function (o) { out += ("0000000000" + o).slice(-10) + " 00000 n \n"; });
    out += "trailer\n<< /Size " + (objs.length + 1) + " /Root " + cat + " 0 R /Info " + info + " 0 R >>\nstartxref\n" + x + "\n%%EOF";
    return out;
  };
  Doc.prototype.blob = function () { return new Blob([this.build()], { type: "application/pdf" }); };
  /* Téléchargement direct du fichier */
  Doc.prototype.save = function (filename) {
    var url = URL.createObjectURL(this.blob()), a = document.createElement("a");
    a.href = url; a.download = filename || "document.pdf"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };

  window.DealrPDF = { create: function (meta) { return new Doc(meta); }, textWidth: textWidth };
})();
