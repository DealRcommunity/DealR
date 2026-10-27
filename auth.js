/* Dealr – comptes et données (Supabase, ou mode démonstration si config.js est vide)
   Utilisé par toutes les pages. Nécessite config.js chargé avant ce fichier. */
(function () {
  var C = window.DEALR_CONFIG || {};
  var configured = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && /^https:\/\//.test(C.SUPABASE_URL));
  var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  var clientP = null;

  var demo = !configured;   // config.js vide : mode démonstration (données dans ce navigateur)

  /* ---------- Mode démonstration : même fonctionnement que Supabase, stocké dans le navigateur ---------- */
  function demoClient() {
    var K = "dealr_demo_";
    function get(k, d) { try { var v = JSON.parse(localStorage.getItem(K + k)); return v == null ? d : v; } catch (e) { return d; } }
    function put(k, v) { localStorage.setItem(K + k, JSON.stringify(v)); }
    function ok(data) { return Promise.resolve({ data: data, error: null }); }
    function ko(m) { return Promise.resolve({ data: null, error: { message: m } }); }
    function uid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, function () { return (Math.random() * 16 | 0).toString(16); }); }
    function hash(pw, salt) {
      var txt = salt + ":" + pw;
      if (window.crypto && crypto.subtle && window.TextEncoder) {
        return crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt)).then(function (b) {
          return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
        });
      }
      var h = 5381; for (var i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
      return Promise.resolve("x" + h);
    }
    function sess() { return get("session", null); }
    function login(u) { var s = { user: { id: u.id, email: u.email } }; put("session", s); return s; }
    var auth = {
      getSession: function () { return ok({ session: sess() }); },
      signUp: function (o) {
        var users = get("users", []), email = String(o.email).toLowerCase();
        if (users.some(function (u) { return u.email === email; })) return ko("User already registered");
        var salt = uid();
        return hash(o.password, salt).then(function (h) {
          var u = { id: uid(), email: email, salt: salt, hash: h };
          users.push(u); put("users", users);
          var s = login(u); return ok({ session: s, user: s.user });
        });
      },
      signInWithPassword: function (o) {
        var email = String(o.email).toLowerCase(), u = get("users", []).filter(function (x) { return x.email === email; })[0];
        if (!u) return ko("Invalid login credentials");
        return hash(o.password, u.salt).then(function (h) { return h === u.hash ? ok({ session: login(u) }) : ko("Invalid login credentials"); });
      },
      signOut: function () { localStorage.removeItem(K + "session"); return ok(null); },
      resetPasswordForEmail: function () { return ko("demo_reset"); },
      updateUser: function () { return ko("demo_reset"); },
      onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; }
    };
    function from(table) {
      var q = { f: [], op: "select", single: false, sort: null }, b = {
        select: function () { return b; },
        eq: function (k, v) { q.f.push(function (r) { return r[k] === v; }); return b; },
        like: function (k, v) { var pre = v.replace(/%$/, ""); q.f.push(function (r) { return String(r[k]).indexOf(pre) === 0; }); return b; },
        order: function (k, o) { q.sort = { k: k, asc: !!(o && o.ascending) }; return b; },
        limit: function (n) { q.lim = n; return b; },
        maybeSingle: function () { q.single = true; return b; },
        upsert: function (row) { q.op = "upsert"; q.row = row; return b; },
        insert: function (row) { q.op = "upsert"; q.row = row; return b; },
        update: function (patch) { q.op = "update"; q.patch = patch; return b; },
        then: function (res, rej) { return run().then(res, rej); }
      };
      function run() {
        var s = sess(), rows = get(table, []);
        if (q.op === "update") {
          if (!s) return ko("not_logged");
          var hit = rows.filter(function (r) { return q.f.every(function (f) { return f(r); }); });
          if (table === "deals" && hit.some(function (r) { return r.payer !== s.user.id && r.payee !== s.user.id; })) return ko("forbidden");
          hit.forEach(function (r) { Object.assign(r, q.patch); });
          try { put(table, rows); } catch (e) { return ko("quota"); }
          return ok(null);
        }
        if (q.op === "upsert") {
          if (!s) return ko("not_logged");
          var row = q.row;
          if (table === "profiles" && row.id !== s.user.id) return ko("forbidden");
          if (table === "documents") row.owner = s.user.id;
          if (table === "conversations" && row.user_a !== s.user.id && row.user_b !== s.user.id) return ko("forbidden");
          if (table === "messages" && row.sender !== s.user.id) return ko("forbidden");
          var same = table === "documents" ? function (r) { return r.owner === row.owner && r.num === row.num; } : function (r) { return r.id === row.id; };
          var i = rows.findIndex(same);
          if (i >= 0) rows[i] = Object.assign(rows[i], row); else rows.push(Object.assign({ created_at: new Date().toISOString() }, row));
          try { put(table, rows); } catch (e) { return ko("quota"); }
          return ok(null);
        }
        var out = table === "documents" ? rows.filter(function (r) { return s && r.owner === s.user.id; })
          : table === "conversations" ? rows.filter(function (r) { return s && (r.user_a === s.user.id || r.user_b === s.user.id); })
          : rows.slice();
        q.f.forEach(function (f) { out = out.filter(f); });
        if (q.sort) out.sort(function (a, c) { var x = String(a[q.sort.k] || ""), y = String(c[q.sort.k] || ""); return q.sort.asc ? (x < y ? -1 : x > y ? 1 : 0) : (x < y ? 1 : x > y ? -1 : 0); });
        if (q.lim) out = out.slice(0, q.lim);
        return ok(q.single ? (out[0] || null) : out);
      }
      return b;
    }
    return { auth: auth, from: from };
  }

  /* Bandeau visible sur toutes les pages en mode démonstration */
  if (demo) {
    var showBanner = function () {
      if (document.getElementById("demoBanner")) return;
      var d = document.createElement("div");
      d.id = "demoBanner";
      d.setAttribute("role", "note");
      d.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:50;max-width:min(420px,calc(100vw - 24px));background:#111;color:#fff;font:500 13px/1.45 Figtree,system-ui,sans-serif;padding:10px 14px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25)";
      d.textContent = "Mode démonstration : les comptes et profils sont enregistrés uniquement dans ce navigateur, sans sécurité réelle. Remplissez config.js pour passer aux vrais comptes.";
      var x = document.createElement("button");
      x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Masquer");
      x.style.cssText = "margin-left:10px;border:0;background:rgba(255,255,255,.2);color:#fff;border-radius:50%;width:22px;height:22px;cursor:pointer";
      x.onclick = function () { d.remove(); try { sessionStorage.setItem("dealr_demo_hide", "1"); } catch (e) {} };
      d.appendChild(x);
      try { if (sessionStorage.getItem("dealr_demo_hide")) return; } catch (e) {}
      document.body.appendChild(d);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showBanner); else showBanner();
  }

  function client() {
    if (demo) { if (!clientP) clientP = Promise.resolve(demoClient()); return clientP; }
    if (!clientP) {
      clientP = new Promise(function (res, rej) {
        if (window.supabase && window.supabase.createClient) return res();
        var s = document.createElement("script");
        s.src = LIB;
        s.onload = res;
        s.onerror = function () { rej(new Error("lib_load")); };
        document.head.appendChild(s);
      }).then(function () {
        return window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
      });
      clientP.catch(function () { clientP = null; });
    }
    return clientP;
  }
  function check(r) { if (r.error) throw r.error; return r.data; }

  var A = { configured: true, demo: demo, client: client };

  /* Adresse de base du site (pour les liens envoyés par email) */
  A.base = function () { return location.href.replace(/[#?].*$/, "").replace(/[^\/]*$/, ""); };

  /* Session */
  A.user = function () {
    return client()
      .then(function (c) { return c.auth.getSession(); })
      .then(function (r) { return r.data && r.data.session ? r.data.session.user : null; })
      .catch(function () { return null; });
  };
  A.signUp = function (email, password) {
    return client().then(function (c) {
      return c.auth.signUp({ email: email, password: password, options: { emailRedirectTo: A.base() + "connexion.html" } });
    }).then(check);
  };
  A.signIn = function (email, password) {
    return client().then(function (c) { return c.auth.signInWithPassword({ email: email, password: password }); }).then(check);
  };
  A.signOut = function () { return client().then(function (c) { return c.auth.signOut(); }); };
  A.resetPassword = function (email) {
    return client().then(function (c) {
      return c.auth.resetPasswordForEmail(email, { redirectTo: A.base() + "connexion.html?reset=1" });
    }).then(check);
  };
  A.updatePassword = function (password) {
    return client().then(function (c) { return c.auth.updateUser({ password: password }); }).then(check);
  };
  A.onAuth = function (fn) {
    client().then(function (c) { c.auth.onAuthStateChange(fn); }).catch(function () {});
  };

  /* Profils (table profiles : lecture publique, écriture par le propriétaire uniquement) */
  A.myProfile = function () {
    return A.user().then(function (u) {
      if (!u) return null;
      return client()
        .then(function (c) { return c.from("profiles").select("data").eq("id", u.id).maybeSingle(); })
        .then(check)
        .then(function (row) { return row ? Object.assign({}, row.data, { id: u.id }) : null; });
    });
  };
  A.saveProfile = function (data) {
    return A.user().then(function (u) {
      if (!u) throw new Error("not_logged");
      return client()
        .then(function (c) { return c.from("profiles").upsert({ id: u.id, data: data, updated_at: new Date().toISOString() }); })
        .then(check);
    });
  };
  A.getProfile = function (id) {
    return client()
      .then(function (c) { return c.from("profiles").select("id,data").eq("id", id).maybeSingle(); })
      .then(check)
      .then(function (row) { return row ? Object.assign({}, row.data, { id: row.id }) : null; });
  };
  A.listProfiles = function () {
    return client()
      .then(function (c) { return c.from("profiles").select("id,data").order("updated_at", { ascending: false }).limit(200); })
      .then(check)
      .then(function (rows) { return rows.map(function (r) { return Object.assign({}, r.data, { id: r.id }); }); })
      .catch(function () { return []; });
  };

  /* Devis et factures (table documents : visibles par leur propriétaire uniquement) */
  A.listDocs = function () {
    return client()
      .then(function (c) { return c.from("documents").select("num,type,client,ttc,data,created_at").order("created_at", { ascending: false }).limit(100); })
      .then(check);
  };
  A.nextNumber = function (prefix) {
    return client()
      .then(function (c) { return c.from("documents").select("num").like("num", prefix + "%"); })
      .then(check)
      .then(function (rows) {
        var max = 0;
        rows.forEach(function (r) { var n = parseInt(String(r.num).slice(prefix.length), 10); if (n > max) max = n; });
        return max + 1;
      });
  };
  A.saveDoc = function (row) {
    return A.user().then(function (u) {
      if (!u) throw new Error("not_logged");
      row.owner = u.id;
      return client()
        .then(function (c) { return c.from("documents").upsert(row, { onConflict: "owner,num" }); })
        .then(check);
    });
  };

  /* Messagerie (tables conversations et messages : visibles par les deux participants uniquement) */
  function pairId(a, b) { return [a, b].sort().join("_"); }
  function snap(p, fallback) { return { id: p.id, n: p.n || fallback || "Membre", job: p.job || "", photo: A.safeImg(p.photo) }; }
  function getConv(c, id) { return c.from("conversations").select("*").eq("id", id).maybeSingle().then(check); }

  /* Ouvre (ou crée) la conversation avec un autre membre ; renvoie son identifiant */
  A.openConversation = function (other) {
    return A.user().then(function (u) {
      if (!u) throw new Error("not_logged");
      if (!other || !other.id) throw new Error("not_found");
      if (other.id === u.id) throw new Error("self_chat");
      var id = pairId(u.id, other.id);
      return client().then(function (c) {
        return getConv(c, id).then(function (row) {
          if (row) return id;
          return A.myProfile().catch(function () { return null; }).then(function (me) {
            var mine = snap(Object.assign({ id: u.id }, me || {}), (me && me.n) || (u.email || "").split("@")[0]);
            var theirs = snap(other);
            var first = u.id < other.id;
            var now = new Date().toISOString();
            return c.from("conversations").upsert({
              id: id, user_a: first ? u.id : other.id, user_b: first ? other.id : u.id,
              a_snap: first ? mine : theirs, b_snap: first ? theirs : mine,
              last_text: "", last_sender: null, read_a: true, read_b: true, updated_at: now
            }).then(check).then(function () { return id; });
          });
        });
      });
    });
  };

  /* Liste de mes conversations, la plus récente en premier */
  A.listConversations = function () {
    return A.user().then(function (u) {
      if (!u) return [];
      return client().then(function (c) {
        return Promise.all([
          c.from("conversations").select("*").eq("user_a", u.id),
          c.from("conversations").select("*").eq("user_b", u.id)
        ]);
      }).then(function (r) {
        var rows = check(r[0]).concat(check(r[1])), seen = {}, out = [];
        rows.forEach(function (row) { if (!seen[row.id]) { seen[row.id] = 1; out.push(row); } });
        out.sort(function (x, y) { return String(y.updated_at || "").localeCompare(String(x.updated_at || "")); });
        return out.map(function (row) {
          var isA = row.user_a === u.id;
          return {
            id: row.id, other: (isA ? row.b_snap : row.a_snap) || { n: "Membre" }, me: u.id,
            lastText: row.last_text || "", lastMine: row.last_sender === u.id,
            updatedAt: row.updated_at, unread: !(isA ? row.read_a : row.read_b)
          };
        });
      });
    });
  };

  A.listMessages = function (convId) {
    return client()
      .then(function (c) { return c.from("messages").select("*").eq("conv", convId).order("created_at", { ascending: true }).limit(500); })
      .then(check);
  };

  function newId() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10); }
  A.eur = function (n) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(+n || 0); };

  /* Ajoute un message à la conversation et la marque « non lue » pour l'autre participant */
  function post(c, conv, u, msg, preview) {
    var now = new Date().toISOString(), isA = conv.user_a === u.id;
    var row = Object.assign({ id: newId(), conv: conv.id, sender: u.id, created_at: now, kind: "text", deal: null }, msg);
    return c.from("messages").insert(row).then(check).then(function () {
      var patch = Object.assign({}, conv, { last_text: String(preview || row.text).slice(0, 200), last_sender: u.id, updated_at: now });
      patch[isA ? "read_a" : "read_b"] = true;
      patch[isA ? "read_b" : "read_a"] = false;
      return c.from("conversations").upsert(patch).then(check);
    });
  }

  A.sendMessage = function (convId, text) {
    text = String(text || "").trim().slice(0, 2000);
    if (!text) return Promise.reject(new Error("empty"));
    return A.user().then(function (u) {
      if (!u) throw new Error("not_logged");
      return client().then(function (c) {
        return getConv(c, convId).then(function (conv) {
          if (!conv) throw new Error("not_found");
          return post(c, conv, u, { text: text });
        });
      });
    });
  };

  /* ---------- Deals ----------
     Un participant propose (prestation, montant, date) ; l'autre accepte, refuse ou contre-propose.
     Une fois accepté des deux côtés, le client sécurise le paiement : l'argent est bloqué au coffre Dealr.
     Le prestataire livre, le client valide, et le coffre verse le paiement au prestataire. */
  var FLOW = {
    proposed:  { accepted: "other", declined: "other", countered: "other", cancelled: "proposer" },
    accepted:  { funded: "payer", cancelled: "any" },
    funded:    { delivered: "payee", disputed: "payer" },
    delivered: { released: "payer", disputed: "payer" }
  };
  A.DEAL_EVENT = { accepted: "Deal accepté", declined: "Deal refusé", cancelled: "Deal annulé", countered: "Contre-proposition",
    funded: "Paiement sécurisé au coffre", delivered: "Travail livré", released: "Paiement versé", disputed: "Litige ouvert" };

  /* Le membre « me » peut-il faire passer ce deal au statut « to » ? */
  A.dealCan = function (d, me, to) {
    var who = (FLOW[d.status] || {})[to];
    if (!who || (me !== d.payer && me !== d.payee)) return false;
    if (who === "any") return true;
    if (who === "other") return me !== d.proposer;
    if (who === "proposer") return me === d.proposer;
    return me === d[who];
  };

  A.listDeals = function (convId) {
    return client()
      .then(function (c) { return c.from("deals").select("*").eq("conv", convId).order("created_at", { ascending: true }).limit(100); })
      .then(check);
  };

  /* f : { title, amount, deadline, details, role: "payee" (je serai payé) ou "payer" (je paierai) }
     replaces : le deal remplacé par cette contre-proposition (mêmes rôles) */
  A.proposeDeal = function (convId, f, replaces) {
    var title = String(f.title || "").trim().slice(0, 140);
    var amount = Math.round(parseFloat(String(f.amount).replace(",", ".")) * 100) / 100;
    if (!title) return Promise.reject(new Error("deal_title"));
    if (!(amount >= 1) || amount > 100000) return Promise.reject(new Error("deal_amount"));
    return A.user().then(function (u) {
      if (!u) throw new Error("not_logged");
      return client().then(function (c) {
        return getConv(c, convId).then(function (conv) {
          if (!conv) throw new Error("not_found");
          var other = conv.user_a === u.id ? conv.user_b : conv.user_a;
          var payer = replaces ? replaces.payer : (f.role === "payer" ? u.id : other);
          var payee = replaces ? replaces.payee : (f.role === "payer" ? other : u.id);
          var now = new Date().toISOString();
          var deal = { id: newId(), conv: convId, proposer: u.id, payer: payer, payee: payee, title: title, amount: amount,
            deadline: f.deadline || null, details: String(f.details || "").trim().slice(0, 1000) || null,
            status: "proposed", created_at: now, updated_at: now };
          var first = replaces ? A.updateDeal(replaces, "countered", true) : Promise.resolve();
          return first
            .then(function () { return c.from("deals").insert(deal).then(check); })
            .then(function () {
              var label = (replaces ? "Contre-proposition : " : "Deal proposé : ") + title + " · " + A.eur(amount);
              return post(c, conv, u, { kind: "deal", deal: deal.id, text: label });
            })
            .then(function () { return deal; });
        });
      });
    });
  };

  /* Fait avancer un deal (accepter, sécuriser, livrer, libérer…) en vérifiant que l'action est permise */
  A.updateDeal = function (deal, to, silent) {
    return A.user().then(function (u) {
      if (!u) throw new Error("not_logged");
      return client().then(function (c) {
        return c.from("deals").select("*").eq("id", deal.id).maybeSingle().then(check).then(function (cur) {
          if (!cur) throw new Error("not_found");
          if (!A.dealCan(cur, u.id, to)) throw new Error("deal_state");
          var now = new Date().toISOString(), patch = { status: to, updated_at: now };
          if (/^(accepted|funded|delivered|released)$/.test(to)) patch[to + "_at"] = now;
          return c.from("deals").update(patch).eq("id", cur.id).then(check).then(function () {
            var d = Object.assign({}, cur, patch);
            if (silent) return d;
            return getConv(c, cur.conv).then(function (conv) {
              return post(c, conv, u, { kind: "event", deal: cur.id, text: A.DEAL_EVENT[to] }, A.DEAL_EVENT[to] + " · " + A.eur(cur.amount));
            }).then(function () { return d; });
          });
        });
      });
    });
  };

  A.markRead = function (convId) {
    return A.user().then(function (u) {
      if (!u) return;
      return client().then(function (c) {
        return getConv(c, convId).then(function (conv) {
          if (!conv) return;
          var k = conv.user_a === u.id ? "read_a" : "read_b";
          if (conv[k]) return;
          var patch = Object.assign({}, conv); patch[k] = true;
          return c.from("conversations").upsert(patch).then(check);
        });
      });
    }).catch(function () {});
  };

  A.unreadCount = function () {
    return A.listConversations().then(function (l) { return l.filter(function (c) { return c.unread; }).length; }).catch(function () { return 0; });
  };

  /* Lien « Messages » avec pastille de messages non lus, à placer dans un en-tête */
  A.messagesLink = function (el) {
    if (!el) return;
    if (!document.getElementById("mbadgeCss")) {
      var st = document.createElement("style"); st.id = "mbadgeCss";
      st.textContent = ".mbadge{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;margin-left:6px;border-radius:99px;background:#f55a1f;color:#fff;font:700 11px/1 Figtree,system-ui,sans-serif;vertical-align:1px}.mbadge[hidden]{display:none}";
      document.head.appendChild(st);
    }
    A.user().then(function (u) {
      if (!u) return;
      el.hidden = false;
      A.unreadCount().then(function (n) {
        var b = el.querySelector(".mbadge");
        if (!b) { b = document.createElement("span"); b.className = "mbadge"; el.appendChild(b); }
        b.textContent = n > 9 ? "9+" : String(n);
        b.hidden = !n;
        b.setAttribute("aria-label", n + " conversation" + (n > 1 ? "s" : "") + " non lue" + (n > 1 ? "s" : ""));
      });
    });
  };

  /* Messages d'erreur en français */
  A.message = function (e) {
    var m = String((e && (e.message || e.error_description)) || e || "");
    if (/deal_title/.test(m)) return "Indiquez la prestation concernée par le deal.";
    if (/deal_amount/.test(m)) return "Montant invalide : entre 1 € et 100 000 €.";
    if (/deal_state|statut non autoris/i.test(m)) return "Ce deal a changé entre-temps. La conversation a été mise à jour.";
    if (/self_chat/.test(m)) return "C’est votre propre profil : vous ne pouvez pas vous écrire à vous-même.";
    if (/empty/.test(m)) return "Le message est vide.";
    if (/demo_reset/.test(m)) return "En mode démonstration, aucun email n’est envoyé. Créez un nouveau compte pour tester.";
    if (/quota/.test(m)) return "Le stockage du navigateur est plein (mode démonstration). Retirez quelques photos et réessayez.";
    if (/not_configured/.test(m)) return "La connexion n’est pas encore configurée sur ce site (voir config.js).";
    if (/lib_load|Failed to fetch|NetworkError|network/i.test(m)) return "Impossible de joindre le serveur. Vérifiez votre connexion internet.";
    if (/Invalid login credentials/i.test(m)) return "Identifiant ou mot de passe incorrect.";
    if (/already registered|already been registered|already exists/i.test(m)) return "Un compte existe déjà avec cet email. Connectez-vous.";
    if (/Email not confirmed/i.test(m)) return "Confirmez d’abord votre adresse email grâce au lien reçu.";
    if (/Password should be|weak|at least/i.test(m)) return "Mot de passe trop faible : au moins 8 caractères, avec lettres et chiffres.";
    if (/rate limit|too many|security purposes/i.test(m)) return "Trop de tentatives. Patientez une minute avant de réessayer.";
    if (/invalid.*email|valid email/i.test(m)) return "Adresse email invalide.";
    if (/not_logged|JWT|session/i.test(m)) return "Votre session a expiré. Reconnectez-vous.";
    if (/relation .* does not exist|schema cache/i.test(m)) return "La base de données n’est pas prête (exécutez supabase.sql).";
    return "Une erreur est survenue. Réessayez.";
  };

  /* Page réservée aux membres connectés */
  A.requireUser = function (next) {
    return A.user().then(function (u) {
      if (!u) {
        location.replace("connexion.html?next=" + encodeURIComponent(next || location.pathname.split("/").pop() + location.search));
        return new Promise(function () {});
      }
      return u;
    });
  };

  /* Image enregistrée sous forme de data URL : on n'accepte que des images encodées proprement */
  A.safeImg = function (s) { return typeof s === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(s) ? s : ""; };

  window.DealrAuth = A;
})();
