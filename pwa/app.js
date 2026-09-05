"use strict";

var MODOS_NOMBRE = {
  clase: "Modo Clase", socratico: "Modo Socratico",
  caso: "Modo Caso Practico", examen: "Modo Examen",
  corregir: "Modo Correccion", mapa: "Modo Mapa",
  fichas: "Modo Fichas", plan: "Modo Plan",
  glosario: "Modo Glosario", metodo: "Modo Metodo"
};

var estado = { modo: "clase", chatId: null, mensajes: [], enviando: false };

function $(s) { return document.querySelector(s); }

document.addEventListener("DOMContentLoaded", function () {
  console.log("[iuris] Iniciando");
  try {
    registrarSW();
    cargarPerfil();
    bindUI();
    refrescarHistorial();
    verificarCorpus();
    console.log("[iuris] Listo");
  } catch (e) {
    console.error("[iuris] Error:", e);
  }
});

function registrarSW() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(function () {});
}

function verificarCorpus() {
  fetch("/api/salud")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var a = d.servicios && d.servicios.anthropic;
      var c = d.servicios && d.servicios.corpus;
      if (!a || !a.configurado) {
        banner("Falta ANTHROPIC_API_KEY. El chat no funcionara.", true);
      } else if (!c || !c.ok) {
        banner("Sin corpus normativo. Responde en plano dogmatico.", false);
      }
    })
    .catch(function () {});
}

function banner(texto, critico) {
  var b = $("#bannerCorpus");
  if (!b) return;
  b.textContent = texto;
  b.className = critico ? "banner-corpus critico" : "banner-corpus";
}

var promptInstalacion = null;

window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  promptInstalacion = e;
  var b = $("#btnInstalar");
  if (b) b.className = "fab-instalar";
});
function bindUI() {
  var btnMenu = $("#btnMenu");
  var overlay = $("#overlay");
  var btnPerfil = $("#btnPerfil");
  var btnNuevo = $("#btnNuevo");
  var btnExportar = $("#btnExportar");
  var btnEnviar = $("#btnEnviar");
  var btnInstalar = $("#btnInstalar");
  var dlg = $("#dlgPerfil");
  var txt = $("#txt");

  if (btnMenu) btnMenu.onclick = function () { drawer(true); };
  if (overlay) overlay.onclick = function () { drawer(false); };
  if (btnPerfil) btnPerfil.onclick = function () { dlg.showModal(); };
  if (btnNuevo) btnNuevo.onclick = nuevoChat;
  if (btnExportar) btnExportar.onclick = exportar;
  if (btnEnviar) btnEnviar.onclick = function (e) { e.preventDefault(); enviar(); };

  if (btnInstalar) {
    btnInstalar.onclick = function () {
      if (!promptInstalacion) return;
      promptInstalacion.prompt();
      promptInstalacion = null;
      btnInstalar.className = "fab-instalar oculto";
    };
  }

  var modos = document.querySelectorAll(".modo-btn");
  for (var i = 0; i < modos.length; i++) {
    (function (b) {
      b.onclick = function () { cambiarModo(b.dataset.modo); drawer(false); };
    })(modos[i]);
  }

  var sugs = document.querySelectorAll(".sug");
  for (var j = 0; j < sugs.length; j++) {
    (function (b) {
      b.onclick = function () { txt.value = b.textContent; enviar(); };
    })(sugs[j]);
  }

  if (dlg) dlg.addEventListener("close", guardarPerfil);

  if (txt) {
    txt.addEventListener("input", function () {
      txt.style.height = "auto";
      txt.style.height = Math.min(txt.scrollHeight, 160) + "px";
    });
    txt.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 820) {
        e.preventDefault();
        enviar();
      }
    });
  }
}

function drawer(abrir) {
  var d = $("#drawer");
  var o = $("#overlay");
  if (d) d.className = abrir ? "drawer abierto" : "drawer";
  if (o) o.className = abrir ? "overlay visible" : "overlay";
}

function cambiarModo(m) {
  estado.modo = m;
  var btns = document.querySelectorAll(".modo-btn");
  for (var i = 0; i < btns.length; i++) {
    btns[i].className = btns[i].dataset.modo === m ? "modo-btn active" : "modo-btn";
  }
  var el = $("#modoActual");
  if (el) el.textContent = MODOS_NOMBRE[m] || m;
}

function cargarPerfil() {
  var p = Perfil.leer();
  var campos = {
    pPais: p.pais, pJurisdiccion: p.jurisdiccion,
    pUniversidad: p.universidad, pMateria: p.materia, pNivel: p.nivel
  };
  for (var id in campos) {
    var el = $("#" + id);
    if (el && campos[id]) el.value = campos[id];
  }
}

function guardarPerfil() {
  function val(id) {
    var e = $("#" + id);
    return e ? e.value : "";
  }
  Perfil.guardar({
    pais: val("pPais"),
    jurisdiccion: val("pJurisdiccion"),
    universidad: val("pUniversidad"),
    materia: val("pMateria"),
    nivel: val("pNivel")
  });
}
function enviar() {
  var txt = $("#txt");
  if (!txt) return;

  var contenido = txt.value.trim();
  if (!contenido || estado.enviando) return;

  var bienv = document.querySelector(".bienvenida");
  if (bienv) bienv.remove();

  estado.enviando = true;
  txt.value = "";
  txt.style.height = "auto";
  $("#btnEnviar").disabled = true;

  estado.mensajes.push({ rol: "user", texto: contenido });
  pintarMensaje("user", contenido);

  var burbuja = pintarMensaje("assistant", "", true);
  var cuerpo = burbuja.querySelector(".md");
  var acumulado = "";

  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modo: estado.modo,
      perfil: Perfil.leer(),
      mensajes: estado.mensajes.slice(-16).map(function (m) {
        return { role: m.rol, content: m.texto };
      })
    })
  })
  .then(function (resp) {
    if (!resp.ok) {
      return resp.json().then(function (e) {
        throw new Error(e.mensaje || "HTTP " + resp.status);
      });
    }
    return leerStream(resp, function (delta) {
      acumulado += delta;
      cuerpo.innerHTML = md(acumulado);
      scrollAbajo();
    }, function (ev) {
      if (ev.tipo === "contexto") {
        if (ev.fuentes && ev.fuentes.length) pintarFuentes(burbuja, ev.fuentes);
        if (ev.advertencias) pintarAdvertencias(burbuja, ev.advertencias);
      }
      if (ev.tipo === "verificacion") pintarVerificacion(burbuja, ev);
    });
  })
  .then(function () {
    burbuja.className = "msg assistant";
    estado.mensajes.push({ rol: "assistant", texto: acumulado });
    acciones(burbuja, acumulado);
    persistir();
  })
  .catch(function (err) {
    burbuja.className = "msg assistant";
    cuerpo.innerHTML = '<p class="error">Error: ' + esc(err.message) + '</p>' +
      '<button class="btn-reintentar">Reintentar</button>';
    var rb = cuerpo.querySelector(".btn-reintentar");
    if (rb) {
      rb.onclick = function () {
        burbuja.remove();
        estado.mensajes.pop();
        txt.value = contenido;
        enviar();
      };
    }
  })
  .then(function () {
    estado.enviando = false;
    $("#btnEnviar").disabled = false;
    txt.focus();
  });
}

function leerStream(resp, onDelta, onEvento) {
  var reader = resp.body.getReader();
  var dec = new TextDecoder();
  var buffer = "";

  function paso() {
    return reader.read().then(function (r) {
      if (r.done) return;
      buffer += dec.decode(r.value, { stream: true });
      var lineas = buffer.split("\n");
      buffer = lineas.pop() || "";
      for (var i = 0; i < lineas.length; i++) {
        var l = lineas[i];
        if (l.indexOf("data: ") !== 0) continue;
        var data = l.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          var j = JSON.parse(data);
          if (j.delta) onDelta(j.delta);
          else if (j.tipo) onEvento(j);
        } catch (e) {}
      }
      return paso();
    });
  }
  return paso();
}

function scrollAbajo() {
  var c = $("#chat");
  if (c.scrollHeight - c.scrollTop - c.clientHeight < 160) {
    c.scrollTop = c.scrollHeight;
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function pintarMensaje(rol, texto, escribiendo) {
  var div = document.createElement("div");
  div.className = "msg " + rol + (escribiendo ? " escribiendo" : "");
  div.innerHTML =
    '<div class="avatar">' + (rol === "user" ? "&#128100;" : "&#9878;") + '</div>' +
    '<div class="burbuja"><div class="md">' +
    (rol === "user" ? esc(texto) : md(texto)) + '</div></div>';
  $("#chat").appendChild(div);
  scrollAbajo();
  return div;
}

function pintarFuentes(burbuja, fuentes) {
  var det = document.createElement("details");
  det.className = "panel-fuentes";
  var html = "<summary>" + fuentes.length + " fuente" +
    (fuentes.length > 1 ? "s" : "") + " consultada" +
    (fuentes.length > 1 ? "s" : "") + "</summary><ul>";
  for (var i = 0; i < fuentes.length; i++) {
    var f = fuentes[i];
    html += '<li class="fuente ' + f.estado + ' jer-' + f.jerarquia + '">' +
      "<b>Art. " + esc(f.articulo) + " " + esc(f.sigla) + "</b>";
    if (f.rubrica) html += "<em>" + esc(f.rubrica) + "</em>";
    if (f.jerarquia === 1) html += '<span class="tag tag-const">CONSTITUCIONAL</span>';
    if (f.estado === "derogado") html += '<span class="tag tag-derog">DEROGADO</span>';
    if (f.url) html += '<a href="' + esc(f.url) + '" target="_blank">verificar</a>';
    html += "</li>";
  }
  det.innerHTML = html + "</ul>";
  var b = burbuja.querySelector(".burbuja");
  b.insertBefore(det, b.firstChild);
}

function pintarAdvertencias(burbuja, advs) {
  if (!advs || !advs.length) return;
  var cont = document.createElement("div");
  cont.className = "advertencias";
  var html = "";
  for (var i = 0; i < advs.length; i++) {
    html += '<div class="adv nivel-' + advs[i].nivel + '"><p>' +
      esc(advs[i].texto) + "</p></div>";
  }
  cont.innerHTML = html;
  var b = burbuja.querySelector(".burbuja");
  b.insertBefore(cont, b.firstChild);
}

function pintarVerificacion(burbuja, v) {
  var div = document.createElement("div");
  div.className = "verificacion nivel-" + v.nivel;
  div.innerHTML = "<b>Verificacion de citas</b><br>" + md(v.mensaje || "");
  burbuja.querySelector(".burbuja").appendChild(div);
}

function acciones(el, texto) {
  var acc = document.createElement("div");
  acc.className = "acciones-msg";
  acc.innerHTML =
    '<button data-a="copiar">Copiar</button>' +
    '<button data-a="fichas">Fichas</button>' +
    '<button data-a="preguntar">Preguntar</button>';
  el.querySelector(".burbuja").appendChild(acc);

  acc.onclick = function (e) {
    var a = e.target.dataset.a;
    if (a === "copiar") {
      navigator.clipboard.writeText(texto);
      e.target.textContent = "Copiado";
      setTimeout(function () { e.target.textContent = "Copiar"; }, 1500);
    }
    if (a === "fichas") {
      cambiarModo("fichas");
      $("#txt").value = "Converti en fichas de repaso lo que acabas de explicar.";
      enviar();
    }
    if (a === "preguntar") {
      cambiarModo("socratico");
      $("#txt").value = "Tomame una pregunta sobre lo que acabas de explicar.";
      $("#txt").focus();
    }
  };
}

function md(src) {
  if (!src) return "";
  var t = esc(src);

  t = t.replace(/```(\w*)\n([\s\S]*?)```/g, function (m, l, c) {
    return "<pre><code>" + c + "</code></pre>";
  });

  t = t.replace(/^#### (.*)$/gm, "<h4>$1</h4>")
       .replace(/^### (.*)$/gm, "<h3>$1</h3>")
       .replace(/^## (.*)$/gm, "<h2>$1</h2>")
       .replace(/^# (.*)$/gm, "<h2>$1</h2>");

  t = t.replace(/^&gt; (.*)$/gm, "<blockquote>$1</blockquote>");
  t = t.replace(/^[\-\*] (.*)$/gm, "<li>$1</li>");
  t = t.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  var partes = t.split(/\n{2,}/);
  var out = [];
  for (var i = 0; i < partes.length; i++) {
    var p = partes[i];
    if (/^\s*<(h[234]|ul|ol|pre|table|blockquote)/.test(p)) out.push(p);
    else out.push("<p>" + p.replace(/\n/g, "<br>") + "</p>");
  }
  return out.join("");
}

function persistir() {
  if (!estado.chatId) {
    estado.chatId = "c" + Date.now() + Math.random().toString(36).slice(2, 8);
  }
  var primero = null;
  for (var i = 0; i < estado.mensajes.length; i++) {
    if (estado.mensajes[i].rol === "user") { primero = estado.mensajes[i]; break; }
  }
  DB.guardar({
    id: estado.chatId,
    titulo: (primero ? primero.texto : "Consulta").slice(0, 60),
    modo: estado.modo,
    mensajes: estado.mensajes,
    creado: Date.now()
  }).then(refrescarHistorial);
}

function refrescarHistorial() {
  DB.listar().then(function (chats) {
    var cont = $("#listaChats");
    if (!cont) return;
    if (!chats.length) {
      cont.innerHTML = '<p class="vacio">Sin conversaciones.</p>';
      return;
    }
    cont.innerHTML = "";
    var max = Math.min(chats.length, 40);
    for (var i = 0; i < max; i++) {
      (function (c) {
        var d = document.createElement("div");
        d.className = "chat-item" + (c.id === estado.chatId ? " activo" : "");
        d.innerHTML = '<span class="ci-titulo">' + esc(c.titulo) + "</span>" +
          '<button class="ci-borrar">x</button>';
        d.querySelector(".ci-titulo").onclick = function () { abrirChat(c.id); };
        d.querySelector(".ci-borrar").onclick = function (e) {
          e.stopPropagation();
          DB.borrar(c.id).then(function () {
            if (c.id === estado.chatId) nuevoChat();
            refrescarHistorial();
          });
        };
        cont.appendChild(d);
      })(chats[i]);
    }
  });
}

function abrirChat(id) {
  DB.obtener(id).then(function (c) {
    if (!c) return;
    estado.chatId = c.id;
    estado.mensajes = c.mensajes;
    cambiarModo(c.modo || "clase");
    $("#chat").innerHTML = "";
    for (var i = 0; i < c.mensajes.length; i++) {
      var m = c.mensajes[i];
      var b = pintarMensaje(m.rol, m.texto);
      if (m.rol === "assistant") acciones(b, m.texto);
    }
    drawer(false);
  });
}

function nuevoChat() {
  estado.chatId = null;
  estado.mensajes = [];
  $("#chat").innerHTML =
    '<div class="bienvenida"><span class="brand-mark grande">&#9878;</span>' +
    "<h2>Iuris - Tutor Juridico Virtual</h2>" +
    "<p>Elegi un modo de estudio y planteá tu consulta.</p></div>";
  drawer(false);
  refrescarHistorial();
}

function exportar() {
  if (!estado.mensajes.length) return;
  var p = Perfil.leer();
  var cab = "# Iuris - " + (MODOS_NOMBRE[estado.modo] || "") + "\n" +
    "Materia: " + (p.materia || "-") + "\n" +
    "Fecha: " + new Date().toLocaleString() + "\n\n" +
    "> Contenido con fines exclusivamente academicos.\n\n---\n\n";
  var cuerpo = "";
  for (var i = 0; i < estado.mensajes.length; i++) {
    var m = estado.mensajes[i];
    cuerpo += (m.rol === "user" ? "## Consulta" : "## Iuris") +
      "\n\n" + m.texto + "\n\n---\n\n";
  }
  var blob = new Blob([cab + cuerpo], { type: "text/markdown;charset=utf-8" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "iuris-" + Date.now() + ".md";
  a.click();
}
