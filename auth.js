/* Dealr – comptes et données (Supabase, ou mode démonstration si config.js est vide)
   Utilisé par toutes les pages. Nécessite config.js chargé avant ce fichier. */
(function () {
  var C = window.DEALR_CONFIG || {};
  var configured = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && /^https:\/\//.test(C.SUPABASE_URL));
  var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  var clientP = null;

  var demo = !configured;   // config.js vide : mode démonstration (données dans ce navigateur)

  /* ---------- Mode démonstration : même fonctionnement que Supabase, stocké dans le navigateur ---------- */
  function isAdminEmail(email) {
    var list = (C.ADMIN_EMAILS || []).map(function (e) { return String(e).trim().toLowerCase(); });
    return !!email && list.indexOf(String(email).trim().toLowerCase()) >= 0;
  }
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
        var s = sess(), rows = get(table, []), adm = !!(s && isAdminEmail(s.user.email));
        if (q.op === "update") {
          if (!s) return ko("not_logged");
          var hit = rows.filter(function (r) { return q.f.every(function (f) { return f(r); }); });
          if (table === "deals" && !adm && hit.some(function (r) { return r.payer !== s.user.id && r.payee !== s.user.id; })) return ko("forbidden");
          hit.forEach(function (r) { Object.assign(r, q.patch); });
          try { put(table, rows); } catch (e) { return ko("quota"); }
          return ok(null);
        }
        if (q.op === "upsert") {
          if (!s) return ko("not_logged");
          var row = q.row;
          if (table === "profiles" && (row.id !== s.user.id || adm)) return ko("forbidden");
          if (table === "deals" && adm) return ko("admin_member");
          if (table === "documents") row.owner = s.user.id;
          if (table === "conversations" && !adm && row.user_a !== s.user.id && row.user_b !== s.user.id) return ko("forbidden");
          if (table === "messages" && row.kind === "admin" && !adm) return ko("forbidden");
          if (table === "messages" && row.sender !== s.user.id) return ko("forbidden");
          var same = table === "documents" ? function (r) { return r.owner === row.owner && r.num === row.num; } : function (r) { return r.id === row.id; };
          var i = rows.findIndex(same);
          if (i >= 0) rows[i] = Object.assign(rows[i], row); else rows.push(Object.assign({ created_at: new Date().toISOString() }, row));
          try { put(table, rows); } catch (e) { return ko("quota"); }
          return ok(null);
        }
        var out = table === "documents" ? rows.filter(function (r) { return s && r.owner === s.user.id; })
          : table === "conversations" && !adm ? rows.filter(function (r) { return s && (r.user_a === s.user.id || r.user_b === s.user.id); })
          : rows.slice();
        if (table === "profiles") {
          var admIds = get("users", []).filter(function (u) { return isAdminEmail(u.email); }).map(function (u) { return u.id; });
          out = out.filter(function (r) { return admIds.indexOf(r.id) < 0; });
        }
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
    return Promise.all([A.user(), A.isAdmin()]).then(function (r) {
      var u = r[0];
      if (!u) throw new Error("not_logged");
      if (r[1]) throw new Error("admin_member");
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
          return Promise.all([A.myProfile().catch(function () { return null; }), A.isAdmin()]).then(function (r) {
            var me = r[0];
            var mine = r[1] ? { id: u.id, n: "Équipe Dealr", job: "Support Dealr", photo: "" }
              : snap(Object.assign({ id: u.id }, me || {}), (me && me.n) || (u.email || "").split("@")[0]);
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
    funded: "Paiement sécurisé au coffre", delivered: "Travail livré", released: "Paiement versé", disputed: "Litige ouvert", refunded: "Client remboursé" };

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
    return Promise.all([A.user(), A.isAdmin()]).then(function (r) {
      var u = r[0];
      if (!u) throw new Error("not_logged");
      if (r[1]) throw new Error("admin_member");
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
          if (/^(accepted|funded|delivered|released|disputed|refunded)$/.test(to)) patch[to + "_at"] = now;
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

  /* ---------- Tableau de bord ---------- */
  /* Tous mes deals (comme client ou comme prestataire), les plus récents d'abord */
  A.myDeals = function () {
    return A.user().then(function (u) {
      if (!u) return [];
      return client().then(function (c) {
        return Promise.all([c.from("deals").select("*").eq("payer", u.id), c.from("deals").select("*").eq("payee", u.id)]);
      }).then(function (r) {
        var rows = check(r[0]).concat(check(r[1])), seen = {}, out = [];
        rows.forEach(function (d) { if (!seen[d.id]) { seen[d.id] = 1; out.push(d); } });
        out.sort(function (x, y) { return String(y.updated_at || "").localeCompare(String(x.updated_at || "")); });
        return out;
      });
    });
  };
  A.LIVE_DEAL = /^(proposed|accepted|funded|delivered|disputed)$/;
  /* Chiffres clés à partir des deals d'un membre */
  A.dealStats = function (deals, me) {
    var now = new Date(), month = now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2);
    var st = { toReceive: 0, earned: 0, earnedMonth: 0, committed: 0, spent: 0, refunded: 0, live: 0, done: 0 };
    deals.forEach(function (d) {
      var a = +d.amount || 0, held = /^(funded|delivered|disputed)$/.test(d.status);
      if (A.LIVE_DEAL.test(d.status)) st.live++;
      if (d.status === "released" || d.status === "refunded") st.done++;
      if (d.payee === me) {
        if (held) st.toReceive += a;
        if (d.status === "released") { st.earned += a; if (String(d.released_at || "").slice(0, 7) === month) st.earnedMonth += a; }
      } else if (d.payer === me) {
        if (held) st.committed += a;
        if (d.status === "released") st.spent += a;
        if (d.status === "refunded") st.refunded += a;
      }
    });
    return st;
  };
  /* Ce que le membre doit faire maintenant (les étapes où c'est à lui d'agir) */
  A.dealTodos = function (deals, me) {
    var out = [];
    deals.forEach(function (d) {
      var a = A.eur(d.amount), t = null;
      if (d.status === "proposed" && d.proposer !== me) t = { kind: "answer", label: "Répondre à la proposition", text: "« " + d.title + " » · " + a, cta: "Répondre", prio: 1 };
      else if (d.status === "accepted" && d.payer === me) t = { kind: "pay", label: "Sécuriser le paiement", text: "« " + d.title + " » · " + a + " à mettre au coffre", cta: "Payer", prio: 0 };
      else if (d.status === "funded" && d.payee === me) t = { kind: "deliver", label: "Réaliser et livrer", text: "« " + d.title + " » · " + a + " vous attendent au coffre", cta: "Livrer", prio: 2 };
      else if (d.status === "delivered" && d.payer === me) t = { kind: "validate", label: "Vérifier la livraison", text: "« " + d.title + " » · libérez " + a + " si tout est conforme", cta: "Vérifier", prio: 0 };
      if (t) { t.deal = d; t.deadline = d.deadline || null; out.push(t); }
    });
    out.sort(function (x, y) { return x.prio - y.prio || String(x.deadline || "9").localeCompare(String(y.deadline || "9")); });
    return out;
  };

  /* ---------- Administration ----------
     Démo : adresse présente dans ADMIN_EMAILS (config.js).
     Supabase : présence dans la table admins, vérifiée par la base (fonction is_admin). */
  var adminP = null;
  A.isAdmin = function (refresh) {
    if (refresh) adminP = null;
    if (!adminP) adminP = A.user().then(function (u) {
      if (!u) return false;
      if (demo) return isAdminEmail(u.email);
      return client().then(function (c) { return c.rpc("is_admin"); }).then(function (r) { return !r.error && r.data === true; });
    }).catch(function () { return false; });
    return adminP;
  };
  function needAdmin() { return A.isAdmin().then(function (ok) { if (!ok) throw new Error("forbidden"); }); }

  /* Tous les deals (l'admin les voit tous), les plus récents d'abord */
  A.adminDeals = function () {
    return needAdmin().then(client)
      .then(function (c) { return c.from("deals").select("*").order("updated_at", { ascending: false }).limit(500); })
      .then(check);
  };
  A.getConversation = function (id) {
    return client().then(function (c) { return getConv(c, id); });
  };
  /* Message de l'équipe Dealr dans la conversation d'un deal (visible par les deux participants) */
  A.adminPost = function (convId, text) {
    text = String(text || "").trim().slice(0, 2000);
    if (!text) return Promise.reject(new Error("empty"));
    return needAdmin().then(function () { return A.user(); }).then(function (u) {
      return client().then(function (c) {
        return getConv(c, convId).then(function (conv) {
          if (!conv) throw new Error("not_found");
          var now = new Date().toISOString();
          return c.from("messages").insert({ id: newId(), conv: convId, sender: u.id, text: text, kind: "admin", deal: null, created_at: now }).then(check).then(function () {
            return c.from("conversations").upsert(Object.assign({}, conv, { last_text: ("Équipe Dealr : " + text).slice(0, 200), last_sender: u.id, updated_at: now, read_a: false, read_b: false })).then(check);
          });
        });
      });
    });
  };
  /* Décision sur un litige : « released » (payer le prestataire) ou « refunded » (rembourser le client) */
  A.resolveDispute = function (deal, outcome, note) {
    if (outcome !== "released" && outcome !== "refunded") return Promise.reject(new Error("deal_state"));
    note = String(note || "").trim();
    if (note.length < 10) return Promise.reject(new Error("admin_note"));
    return needAdmin().then(client).then(function (c) {
      return c.from("deals").select("*").eq("id", deal.id).maybeSingle().then(check).then(function (cur) {
        if (!cur || cur.status !== "disputed") throw new Error("deal_state");
        var now = new Date().toISOString(), patch = { status: outcome, updated_at: now };
        patch[outcome + "_at"] = now;
        return c.from("deals").update(patch).eq("id", cur.id).then(check).then(function () {
          var head = outcome === "released"
            ? "Décision de l’équipe Dealr : le paiement de " + A.eur(cur.amount) + " est versé au prestataire."
            : "Décision de l’équipe Dealr : le client est remboursé de " + A.eur(cur.amount) + ".";
          return A.adminPost(cur.conv, head + "\n" + note);
        }).then(function () { return Object.assign({}, cur, patch); });
      });
    });
  };

  /* Pour l'admin : lien « Litiges » avec pastille et bandeau d'alerte quand un nouveau litige arrive */
  function adminAlerts() {
    A.isAdmin().then(function (ok) {
      if (!ok) return;
      return A.adminDeals().then(function (all) {
        var open = all.filter(function (d) { return d.status === "disputed"; });
        setBadge("dnAdmin", open.length, "red", " litige" + (open.length > 1 ? "s" : "") + " ouvert" + (open.length > 1 ? "s" : ""));
        var key = "dealr_admin_seen", seen = "";
        try { seen = localStorage.getItem(key) || ""; } catch (e) {}
        var fresh = open.filter(function (d) { return String(d.disputed_at || d.updated_at) > seen; });
        if (!fresh.length || /admin\.html/.test(location.pathname) || document.getElementById("adminAlert")) return;
        var latest = fresh.map(function (d) { return String(d.disputed_at || d.updated_at); }).sort().pop();
        var box = document.createElement("div"); box.id = "adminAlert"; box.setAttribute("role", "alert");
        box.style.cssText = "position:fixed;right:16px;top:80px;z-index:70;max-width:min(380px,calc(100vw - 32px));background:#fff;border:2px solid #c0270f;border-radius:18px;padding:14px 16px;box-shadow:0 20px 50px rgba(0,0,0,.2);font:500 14px/1.45 Figtree,system-ui,sans-serif;color:#111";
        var t = document.createElement("b"); t.style.cssText = "display:block;color:#a1230f;font-size:15px;margin-bottom:4px";
        t.textContent = fresh.length > 1 ? fresh.length + " nouveaux litiges" : "Nouveau litige ouvert";
        var p = document.createElement("div");
        p.textContent = fresh.length > 1 ? "Des membres attendent une décision de l’équipe Dealr." : "« " + fresh[0].title + " » · " + A.eur(fresh[0].amount) + " bloqués au coffre.";
        var row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;margin-top:10px";
        var go = document.createElement("a"); go.href = "admin.html"; go.textContent = "Examiner";
        go.style.cssText = "background:#111;color:#fff;border-radius:99px;padding:7px 16px;font-weight:600;text-decoration:none";
        var later = document.createElement("button"); later.type = "button"; later.textContent = "Plus tard";
        later.style.cssText = "border:0;background:none;color:#6b6b73;text-decoration:underline;cursor:pointer;font:inherit";
        function done() { try { localStorage.setItem(key, latest); } catch (e) {} box.remove(); }
        later.onclick = done; go.onclick = done;
        row.appendChild(go); row.appendChild(later); box.appendChild(t); box.appendChild(p); box.appendChild(row);
        document.body.appendChild(box);
      });
    }).catch(function () {});
  }

  /* Lien « Messages » avec pastille de messages non lus, à placer dans un en-tête */
  /* ---------- Menu commun à toutes les pages ----------
     Chaque page contient <nav data-nav="(page)"> ; le menu y est généré ici, identique partout :
     visiteur : Marketplace · Se connecter · Créer un compte
     membre   : Marketplace · Messages · Tableau de bord · Mon profil · Se déconnecter
     admin    : Marketplace · Messages · Administration · Se déconnecter
     Les éléments propres à une page (data-extra / data-extra="end") sont conservés autour. */
  var NAV_CSS = ".dnav{display:flex;align-items:center;gap:22px}" +
    ".dnav a,.dnav button.lk{text-decoration:none;color:#6b6b73;font:500 1rem Figtree,system-ui,sans-serif;white-space:nowrap;background:none;border:0;padding:0;cursor:pointer}" +
    ".dnav a:hover,.dnav button.lk:hover,.dnav a[aria-current]{color:#111}" +
    ".dnav a[aria-current]{font-weight:600}" +
    ".dnav .dn-pill{border:1.5px solid #111;border-radius:99px;padding:7px 15px;color:#111;font-weight:600}" +
    ".dnav .dn-pill:hover{background:#111;color:#fff}" +
    ".mbadge{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;margin-left:6px;border-radius:99px;background:#f55a1f;color:#fff;font:700 11px/1 Figtree,system-ui,sans-serif;vertical-align:1px}" +
    ".mbadge.red{background:#c0270f}.mbadge[hidden]{display:none}" +
    "nav[data-nav]{position:relative;display:flex;align-items:center}" +
    ".dn-acc{position:relative;display:inline-flex}" +
    ".dnav button.dn-accbtn{display:inline-flex;align-items:center;gap:4px;border:1.5px solid #111;border-radius:99px;padding:7px 15px;color:#111;font-weight:600}" +
    ".dnav button.dn-accbtn:hover,.dnav button.dn-accbtn[aria-expanded=true]{background:#111;color:#fff}" +
    ".dn-dd{display:none;position:absolute;top:calc(100% + 10px);right:0;flex-direction:column;gap:2px;background:#fff;border-radius:16px;padding:8px;min-width:210px;box-shadow:0 20px 50px rgba(0,0,0,.18),0 1px 3px rgba(0,0,0,.08);z-index:61}" +
    ".dn-dd.open{display:flex}" +
    ".dn-dd a,.dn-dd button.lk{padding:10px 12px;border-radius:10px;text-align:left}" +
    ".dn-dd a:hover,.dn-dd button.lk:hover{background:#f5f5f7;color:#111}" +
    ".dnav-tg{display:none;align-items:center;gap:8px;border:1.5px solid #111;background:#fff;border-radius:99px;padding:7px 14px;font:600 .92rem Figtree,system-ui,sans-serif;color:#111;cursor:pointer}" +
    ".dnav-tg .mbadge{margin-left:0}" +
    "@media(max-width:760px){nav[data-nav] [data-extra]:not([data-extra=end]){display:none!important}" +
    ".dnav{display:none;position:absolute;top:calc(100% + 10px);right:0;flex-direction:column;align-items:stretch;gap:2px;background:#fff;border-radius:18px;padding:8px;min-width:230px;box-shadow:0 20px 50px rgba(0,0,0,.18),0 1px 3px rgba(0,0,0,.08);z-index:60}" +
    ".dnav.open{display:flex}.dnav a,.dnav button.lk{padding:11px 14px;border-radius:12px;text-align:left}.dnav a:hover,.dnav button.lk:hover{background:#f5f5f7}" +
    ".dnav .dn-pill{border:0;padding:11px 14px}.dnav-tg{display:inline-flex}" +
    ".dn-acc{display:contents}.dnav button.dn-accbtn{display:none}.dn-dd{display:flex;position:static;box-shadow:none;padding:0;min-width:0;gap:2px}" +
    ".dn-dd a,.dn-dd button.lk{padding:11px 14px}}";

  function setBadge(id, n, cls, label) {
    var el = document.getElementById(id); if (!el) return;
    var b = el.querySelector(".mbadge");
    if (!b) { b = document.createElement("span"); b.className = "mbadge" + (cls ? " " + cls : ""); el.appendChild(b); }
    b.textContent = n > 9 ? "9+" : String(n); b.hidden = !n; b.setAttribute("aria-label", n + label);
    var ab = document.getElementById("dnAccBadge");
    if (ab) { var s2 = 0; ["dnAdmin", "dnDash"].forEach(function (k) { var x = document.querySelector("#" + k + " .mbadge"); if (x && !x.hidden) s2 += parseInt(x.textContent, 10) || 0; }); ab.textContent = String(s2); ab.hidden = !s2; }
    var t = document.getElementById("dnTgBadge");
    if (t) { var tot = 0; ["dnMsg", "dnAdmin", "dnDash"].forEach(function (k) { var x = document.querySelector("#" + k + " .mbadge"); if (x && !x.hidden) tot += parseInt(x.textContent, 10) || 0; }); t.textContent = String(tot); t.hidden = !tot; }
  }
  function refreshBadges() {
    A.user().then(function (u) {
      if (!u) return;
      A.unreadCount().then(function (n) { setBadge("dnMsg", n, "", " conversation" + (n > 1 ? "s" : "") + " non lue" + (n > 1 ? "s" : "")); });
      if (document.getElementById("dnDash")) A.myDeals().then(function (ds) { var n = A.dealTodos(ds, u.id).length; setBadge("dnDash", n, "", " action" + (n > 1 ? "s" : "") + " à faire"); }).catch(function () {});
      adminAlerts();
    });
  }
  A.renderNav = function () {
    var nav = document.querySelector("nav[data-nav]");
    if (!nav || nav.querySelector(".dnav")) return;
    if (!document.getElementById("dnavCss")) { var st = document.createElement("style"); st.id = "dnavCss"; st.textContent = NAV_CSS; document.head.appendChild(st); }
    var page = nav.getAttribute("data-nav");
    if (page === "profil-public" && /[?&]id=moi\b/.test(location.search)) page = "profil";
    nav.setAttribute("aria-label", "Menu principal");
    var box = document.createElement("div"); box.className = "dnav"; box.id = "dnav";
    var firstEnd = nav.querySelector('[data-extra="end"]');
    nav.insertBefore(box, firstEnd);
    var tg = document.createElement("button"); tg.type = "button"; tg.className = "dnav-tg"; tg.setAttribute("aria-expanded", "false"); tg.setAttribute("aria-controls", "dnav");
    tg.innerHTML = "Menu<span class=\"mbadge\" id=\"dnTgBadge\" hidden></span>";
    nav.appendChild(tg);
    tg.onclick = function (e) { e.stopPropagation(); var o = box.classList.toggle("open"); tg.setAttribute("aria-expanded", o ? "true" : "false"); };
    document.addEventListener("click", function (e) { if (!nav.contains(e.target)) { box.classList.remove("open"); tg.setAttribute("aria-expanded", "false"); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { box.classList.remove("open"); tg.setAttribute("aria-expanded", "false"); } });
    function add(label, href, key, id, cls) {
      var a = document.createElement("a"); a.href = href; a.textContent = label;
      if (id) a.id = id; if (cls) a.className = cls;
      if (key && key === page) a.setAttribute("aria-current", "page");
      box.appendChild(a); return a;
    }
    add("Marketplace", "marketplace.html", "marketplace");
    Promise.all([A.user(), A.isAdmin()]).then(function (r) {
      var u = r[0], adm = r[1];
      if (!u) {
        add("Se connecter", "connexion.html", page === "connexion" ? "connexion" : "", "dnLogin");
        add("Créer un compte", "connexion.html#inscription", "", "dnSignup", "dn-pill");
        return;
      }
      add("Messages", "messages.html", "messages", "dnMsg");
      /* Sur l'accueil (page avec ses propres liens), on garde la même forme que pour un visiteur :
         les liens du compte sont regroupés derrière un bouton « Mon compte » */
      var compact = !!nav.querySelector("[data-extra]:not([data-extra=end])"), target = box;
      if (compact) {
        var wrap = document.createElement("span"); wrap.className = "dn-acc";
        var bt = document.createElement("button"); bt.type = "button"; bt.className = "lk dn-pill dn-accbtn"; bt.id = "dnAcc";
        bt.setAttribute("aria-haspopup", "true"); bt.setAttribute("aria-expanded", "false");
        bt.innerHTML = (adm ? "Administration" : "Mon compte") + "<span class=\"mbadge\" id=\"dnAccBadge\" hidden></span> <span aria-hidden=\"true\">▾</span>";
        var dd = document.createElement("div"); dd.className = "dn-dd"; dd.id = "dnDd";
        wrap.appendChild(bt); wrap.appendChild(dd); box.appendChild(wrap); target = dd;
        bt.onclick = function (e) { e.stopPropagation(); var o = dd.classList.toggle("open"); bt.setAttribute("aria-expanded", o ? "true" : "false"); };
        document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) { dd.classList.remove("open"); bt.setAttribute("aria-expanded", "false"); } });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") { dd.classList.remove("open"); bt.setAttribute("aria-expanded", "false"); } });
      }
      function addTo(label, href, key, id) { var a = add(label, href, key, id); target.appendChild(a); return a; }
      if (adm) addTo("Administration", "admin.html", "admin", "dnAdmin");
      else { addTo("Tableau de bord", "dashboard.html", "dashboard", "dnDash"); addTo("Mon profil", "prestataire.html?id=moi", "profil", "dnProfile"); }
      var out = document.createElement("button"); out.type = "button"; out.className = "lk" + (compact ? "" : " dn-pill"); out.id = "dnLogout"; out.textContent = "Se déconnecter";
      out.onclick = function () { out.disabled = true; A.signOut().then(function () { location.href = "index.html"; }); };
      target.appendChild(out);
      refreshBadges();
    });
  };
  /* Ancien nom conservé : met à jour les pastilles du menu */
  A.messagesLink = function () { refreshBadges(); };
  A.refreshNav = refreshBadges;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", A.renderNav); else A.renderNav();

  /* Messages d'erreur en français */
  A.message = function (e) {
    var m = String((e && (e.message || e.error_description)) || e || "");
    if (/admin_member/.test(m)) return "Le compte administrateur sert à gérer le site : il ne peut pas avoir de profil ni faire de deal.";
    if (/admin_note/.test(m)) return "Expliquez votre décision en quelques mots (10 caractères minimum) : elle sera envoyée aux deux parties.";
    if (/forbidden|permission denied|row-level security/i.test(m)) return "Action réservée : vous n’avez pas les droits nécessaires.";
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

  /* Le compte admin gère le site : il ne crée pas de profil, ne propose pas ses services, ne fait pas de deal.
     Les éléments marqués « member-only » (ou data-acc) lui sont masqués. */
  function adminMode() {
    A.isAdmin().then(function (ok) {
      if (!ok) return;
      var st = document.createElement("style");
      st.textContent = ".is-admin [data-acc],.is-admin .member-only{display:none!important}";
      document.head.appendChild(st);
      document.body.classList.add("is-admin");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", adminMode); else adminMode();

  /* Profil obligatoire : un membre connecté doit terminer son profil avant d'utiliser le site.
     Champs requis (les mêmes que l'assistant de création) : nom, ville, métier, 3 compétences,
     présentation d'au moins 40 caractères et tarif. */
  A.profileMissing = function (p) {
    if (!p) return ["profil"];
    var m = [];
    if (!p.n) m.push("nom");
    if (!p.city) m.push("ville");
    if (!p.job) m.push("métier");
    if (!p.skills || p.skills.length < 3) m.push("compétences");
    if (!p.bio || String(p.bio).length < 40) m.push("présentation");
    if (!(p.rate > 0)) m.push("tarif");
    return m;
  };
  A.profileComplete = function (p) { return !A.profileMissing(p).length; };
  function profileGate() {
    var page = location.pathname.split("/").pop() || "index.html";
    if (/^(profil|connexion)\.html$/.test(page)) return;
    /* Sans session enregistrée dans le navigateur, c'est un visiteur : rien à vérifier */
    var likely = false;
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k === "dealr_demo_session" || /^sb-.*-auth-token$/.test(k)) { likely = true; break; } } } catch (e) {}
    if (!likely) return;
    var st = document.createElement("style"); st.id = "dlrGate"; st.textContent = "body{visibility:hidden}"; document.head.appendChild(st);
    function done() { var x = document.getElementById("dlrGate"); if (x) x.remove(); }
    setTimeout(done, 4000);
    A.user().then(function (u) {
      if (!u) return done();
      return A.isAdmin().then(function (adm) {
        if (adm) return done();
        return A.myProfile().then(function (p) {
          if (A.profileComplete(p)) return done();
          location.replace("profil.html?obligatoire=1");
        }, done);
      });
    }).catch(done);
  }
  profileGate();

  window.DealrAuth = A;
})();
