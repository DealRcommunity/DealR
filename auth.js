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
        then: function (res, rej) { return run().then(res, rej); }
      };
      function run() {
        var s = sess(), rows = get(table, []);
        if (q.op === "upsert") {
          if (!s) return ko("not_logged");
          var row = q.row;
          if (table === "profiles" && row.id !== s.user.id) return ko("forbidden");
          if (table === "documents") row.owner = s.user.id;
          var same = table === "profiles" ? function (r) { return r.id === row.id; } : function (r) { return r.owner === row.owner && r.num === row.num; };
          var i = rows.findIndex(same);
          if (i >= 0) rows[i] = Object.assign(rows[i], row); else rows.push(Object.assign({ created_at: new Date().toISOString() }, row));
          try { put(table, rows); } catch (e) { return ko("quota"); }
          return ok(null);
        }
        var out = table === "documents" ? rows.filter(function (r) { return s && r.owner === s.user.id; }) : rows.slice();
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

  /* Messages d'erreur en français */
  A.message = function (e) {
    var m = String((e && (e.message || e.error_description)) || e || "");
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
