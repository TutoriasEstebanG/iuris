"use strict";

var MODOS_NOMBRE = {
  clase: "Modo Clase", socratico: "Modo Socratico",
  caso: "Modo Caso Practico", examen: "Modo Examen",
  corregir: "Modo Correccion", mapa: "Modo Mapa",
  fichas: "Modo Fichas", plan: "Modo Plan",
  glosario: "Modo Glosario", metodo: "Modo Metodo",
  documento: "Análisis de Fallo / PDF",
  catedra: "Cátedra a Demanda"
};

var SVG_BALANZA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"></line><path d="M4 7l8-4 8 4"></path><path d="M6 13l-3-6h6l-3 6a3 3 0 0 1-6 0z"></path><path d="M18 13l-3-6h6l-3 6a3 3 0 0 1-6 0z"></path><path d="M8 21h8"></path></svg>';
var SVG_BALANZA_GRANDE = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"></line><path d="M4 7l8-4 8 4"></path><path d="M6 13l-3-6h6l-3 6a3 3 0 0 1-6 0z"></path><path d="M18 13l-3-6h6l-3 6a3 3 0 0 1-6 0z"></path><path d="M8 21h8"></path></svg>';
var SVG_USER = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
var SVG_CLIP = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>';
var SVG_AUDIO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
var SVG_TRASH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

var estado = { modo: "clase", chatId: null, mensajes: [], enviando: false, adjuntoActual: null, adjuntoSesion: null, manosLibres: false };

function actualizarChipAdjunto() {
  var chip = $("#chipAdjunto");
  var nom = $("#nombreAdjunto");
  var doc = estado.adjuntoActual || estado.adjuntoSesion;
  if (chip && nom) {
    if (doc && doc.nombre) {
      nom.textContent = doc.nombre;
      chip.classList.remove("oculto");
    } else {
      chip.classList.add("oculto");
    }
  }
}

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
  var btnCerrarDrawer = $("#btnCerrarDrawer");
  var overlay = $("#overlay");
  var appShell = $("#appShell");
  var btnPerfil = $("#btnPerfil");
  var btnNuevo = $("#btnNuevo");
  var btnExportar = $("#btnExportar");
  var btnEnviar = $("#btnEnviar");
  var btnInstalar = $("#btnInstalar");
  var dlg = $("#dlgPerfil");
  var txt = $("#txt");

  // Recordar preferencia de barra retráctil en escritorio
  try {
    var guardado = localStorage.getItem("iuris_sidebar_abierta");
    if (guardado === "0" && appShell && window.innerWidth > 850) {
      appShell.classList.add("sidebar-retraida");
    }
  } catch (e) {}

  if (btnMenu) btnMenu.onclick = function () { alternarDrawer(); };
  if (btnCerrarDrawer) btnCerrarDrawer.onclick = function () { alternarDrawer(false); };
  if (overlay) overlay.onclick = function () { alternarDrawer(false); };
  if (btnPerfil) btnPerfil.onclick = function () { dlg.showModal(); };
  if (btnNuevo) btnNuevo.onclick = nuevoChat;
  if (btnExportar) btnExportar.onclick = exportar;
  if (btnEnviar) btnEnviar.onclick = function (e) { e.preventDefault(); enviar(); };

  var btnVoz = $("#btnVoz");
  if (btnVoz) btnVoz.onclick = alternarDictadoVoz;
  var btnManosLibres = $("#btnManosLibres");
  if (btnManosLibres) btnManosLibres.onclick = alternarManosLibres;
  configurarAdjuntos();

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
      b.onclick = function () {
        cambiarModo(b.dataset.modo);
        if (window.innerWidth <= 850) alternarDrawer(false);
      };
    })(modos[i]);
  }

  var sugs = document.querySelectorAll(".sug");
  for (var j = 0; j < sugs.length; j++) {
    (function (b) {
      b.onclick = function () {
        var txtEl = $("#txt");
        if (txtEl) { txtEl.value = b.textContent; enviar(); }
      };
    })(sugs[j]);
  }

  if (dlg) dlg.addEventListener("close", guardarPerfil);

  if (txt) {
    txt.addEventListener("input", function () {
      txt.style.height = "auto";
      txt.style.height = Math.min(txt.scrollHeight, 180) + "px";
    });
    txt.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        enviar();
      }
    });
  }
}

function drawer(abrir) {
  alternarDrawer(abrir);
}

function alternarDrawer(abrir) {
  var d = $("#drawer");
  var o = $("#overlay");
  var shell = $("#appShell");
  var esDesktop = window.innerWidth > 850;

  if (typeof abrir !== "boolean") {
    if (esDesktop) {
      abrir = shell ? shell.classList.contains("sidebar-retraida") : false;
    } else {
      abrir = d ? !d.classList.contains("abierto") : true;
    }
  }

  if (esDesktop) {
    if (shell) {
      if (abrir) shell.classList.remove("sidebar-retraida");
      else shell.classList.add("sidebar-retraida");
    }
    try {
      localStorage.setItem("iuris_sidebar_abierta", abrir ? "1" : "0");
    } catch (e) {}
  } else {
    if (d) {
      if (abrir) d.classList.add("abierto");
      else d.classList.remove("abierto");
    }
    if (o) {
      if (abrir) o.classList.add("visible");
      else o.classList.remove("visible");
    }
  }
}

function cambiarModo(m) {
  estado.modo = m;
  var btns = document.querySelectorAll(".modo-btn");
  for (var i = 0; i < btns.length; i++) {
    btns[i].className = btns[i].dataset.modo === m ? "modo-btn active" : "modo-btn";
  }
  var el = $("#modoActual");
  if (el) el.textContent = MODOS_NOMBRE[m] || m;
  var elComp = $("#composerModoNombre");
  if (elComp) elComp.textContent = MODOS_NOMBRE[m] || m;
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

  var adjuntoParaEnviar = estado.adjuntoActual || estado.adjuntoSesion;
  var contenido = txt.value.trim();
  if (!contenido && adjuntoParaEnviar) {
    if (estado.modo === "socratico") {
      contenido = "Por favor, analiza este material y guíame con preguntas socráticas siguiendo su temario.";
    } else if (estado.modo === "catedra") {
      contenido = "Por favor, presenta el temario estructurado y comienza la clase guiada a partir de este material.";
    } else if (estado.modo === "documento") {
      contenido = "Por favor, realiza el análisis procesal y dogmático de este documento.";
    } else if (estado.modo === "examen") {
      contenido = "Por favor, utiliza este temario/programa para tomarme un simulacro de examen oral.";
    } else {
      contenido = "Por favor, analiza este material, explícame su estructura y sus conceptos jurídicos clave.";
    }
  }
  if (!contenido || estado.enviando) return;

  var bienv = document.querySelector(".bienvenida");
  if (bienv) bienv.remove();

  estado.enviando = true;
  estado.adjuntoSesion = adjuntoParaEnviar;
  estado.adjuntoActual = null;
  txt.value = "";
  txt.style.height = "auto";
  $("#btnEnviar").disabled = true;

  var inputArchivo = $("#inputArchivo");
  if (inputArchivo) inputArchivo.value = "";
  actualizarChipAdjunto();

  estado.mensajes.push({
    rol: "user",
    texto: contenido,
    adjunto: adjuntoParaEnviar ? { nombre: adjuntoParaEnviar.nombre, tipo: adjuntoParaEnviar.tipo } : undefined
  });
  pintarMensaje("user", contenido, false, adjuntoParaEnviar);

  var burbuja = pintarMensaje("assistant", "", true);
  var cuerpo = burbuja.querySelector(".md");
  var acumulado = "";
  var animando = false;

  function renderStreaming() {
    if (animando) return;
    animando = true;
    requestAnimationFrame(function () {
      cuerpo.innerHTML = md(acumulado);
      scrollAbajo();
      animando = false;
    });
  }

  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modo: estado.modo,
      perfil: Perfil.leer(),
      adjunto: adjuntoParaEnviar,
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
      renderStreaming();
    }, function (ev) {
      if (ev.tipo === "contexto") {
        if (ev.fuentes && ev.fuentes.length) pintarFuentes(burbuja, ev.fuentes);
        if (ev.jurisprudencia && ev.jurisprudencia.length) pintarJurisprudencia(burbuja, ev.jurisprudencia);
        if (ev.advertencias) pintarAdvertencias(burbuja, ev.advertencias);
      }
      if (ev.tipo === "herramienta") pintarHerramienta(burbuja, ev);
      if (ev.tipo === "verificacion") pintarVerificacion(burbuja, ev);
    });
  })
  .then(function () {
    burbuja.className = "msg assistant";
    cuerpo.innerHTML = md(acumulado);
    scrollAbajo();
    estado.mensajes.push({ rol: "assistant", texto: acumulado });
    acciones(burbuja, acumulado);

    // Mejoras Interactivas: Fichas 3D, Pizarra Dogmática y Expediente Digital
    if (estado.modo === "fichas" || parsearFichas(acumulado).length > 0) {
      renderizarVisorFichas(burbuja, acumulado);
    } else if (estado.modo === "mapa" || acumulado.includes("Teoria del Delito") || acumulado.includes("Acción") || acumulado.includes("Accion")) {
      renderizarPizarraVisual(burbuja, acumulado);
    } else if (estado.modo === "caso" && (acumulado.includes("Demanda") || acumulado.includes("foja") || acumulado.includes("fs."))) {
      renderizarExpedienteDigital(burbuja, acumulado);
    }

    // Mejora 3: Bucle de Mesa de Examen Oral Manos Libres
    if (estado.manosLibres) {
      reproducirVoz(acumulado, null, function () {
        if (estado.manosLibres) alternarDictadoVoz(true);
      });
    }

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
function pintarMensaje(rol, texto, escribiendo, adjunto) {
  var div = document.createElement("div");
  div.className = "msg " + rol + (escribiendo ? " escribiendo" : "");
  var htmlAdjunto = "";
  if (adjunto && adjunto.nombre) {
    htmlAdjunto = '<div class="adjunto-tag"><span class="icono-clip">' + SVG_CLIP + '</span> <b>' + esc(adjunto.nombre) + '</b></div>';
  }
  div.innerHTML =
    '<div class="avatar">' + (rol === "user" ? SVG_USER : SVG_BALANZA) + '</div>' +
    '<div class="burbuja">' + htmlAdjunto + '<div class="md">' +
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

function pintarJurisprudencia(burbuja, fallos) {
  if (!fallos || !fallos.length) return;
  var det = document.createElement("details");
  det.className = "panel-fuentes panel-jurisprudencia";
  var html = "<summary>⚖️ " + fallos.length + " precedente" +
    (fallos.length > 1 ? "s" : "") + " judicial" +
    (fallos.length > 1 ? "es" : "") + " (CSJN)</summary><ul>";
  for (var i = 0; i < fallos.length; i++) {
    var f = fallos[i];
    html += '<li class="fuente fallo-csjn">' +
      "<b>" + esc(f.autos) + "</b>" +
      (f.fecha ? " <em>(" + esc(f.fecha.slice(0, 4)) + ")</em>" : "");
    if (f.cita) html += ' <span class="tag tag-const">' + esc(f.cita) + '</span>';
    if (f.holding) html += '<p class="holding-resumen"><strong>Holding:</strong> ' + esc(f.holding) + '</p>';
    if (f.url) html += '<a href="' + esc(f.url) + '" target="_blank">ver fallo oficial</a>';
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

function pintarHerramienta(burbuja, ev) {
  if (!ev || !ev.resultado) return;
  var cont = document.createElement("div");
  cont.className = "tarjeta-herramienta";
  var r = ev.resultado;
  var html = "";

  if (ev.nombre === "calcular_plazo_procesal") {
    html = '<div class="herramienta-header">&#128197; <b>Cómputo Procesal Verificado</b></div>' +
      '<div class="herramienta-cuerpo">' +
      '<p><strong>Vencimiento:</strong> ' + esc(r.fechaVencimiento) + '</p>' +
      '<p><strong>Plazo de gracia:</strong> ' + esc(r.plazoDeGracia) + '</p>' +
      '<small>Días hábiles judiciales computados: ' + esc(r.diasComputados) + '</small>' +
      '</div>';
  } else if (ev.nombre === "calcular_indemnizacion") {
    var cap = Number(r.capitalIndemnizatorio || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 });
    html = '<div class="herramienta-header">&#129518; <b>Cálculo Indemnizatorio Judicial</b></div>' +
      '<div class="herramienta-cuerpo">' +
      '<p><strong>Capital resultante:</strong> $' + cap + '</p>' +
      '<p><strong>Fórmula:</strong> ' + esc(r.formula) + '</p>' +
      '<small>' + esc(r.citaJurisprudencial) + '</small>' +
      '</div>';
  } else if (ev.nombre === "verificar_inconstitucionalidad") {
    html = '<div class="herramienta-header">&#9878; <b>Control de Constitucionalidad CSJN</b></div>' +
      '<div class="herramienta-cuerpo">' +
      (r.declaradoInconstitucional
        ? '<p class="tag-inconstitucional">⚠️ Declarado inconstitucional por la CSJN</p>' +
          '<p><strong>Precedente:</strong> ' + esc(r.precedenteCSJN) + ' (' + esc(r.publicacionOficial) + ')</p>' +
          '<p><strong>Holding:</strong> ' + esc(r.holding) + '</p>'
        : '<p>Sin declaración de inconstitucionalidad registrada para la norma.</p>') +
      '</div>';
  } else {
    html = '<div class="herramienta-header">&#9881; <b>Herramienta: ' + esc(ev.nombre) + '</b></div>';
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
    '<button data-a="audio" class="btn-audio" title="Escuchar respuesta">' + SVG_AUDIO + ' Escuchar</button>' +
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
    if (a === "audio") {
      reproducirVoz(texto, e.target);
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

function reproducirVoz(texto, btn, onEnd) {
  if (!("speechSynthesis" in window)) {
    if (typeof onEnd === "function") onEnd();
    return;
  }
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    if (btn) btn.classList.remove("reproduciendo");
    return;
  }
  var textoLimpio = texto
    .replace(/<[^>]+>/g, " ")
    .replace(/[*#`_~]/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  var utter = new SpeechSynthesisUtterance(textoLimpio);
  utter.lang = "es-AR";
  utter.rate = 1.0;

  var voces = window.speechSynthesis.getVoices();
  var vozEs = voces.find(function (v) { return v.lang && v.lang.startsWith("es"); });
  if (vozEs) utter.voice = vozEs;

  if (btn) btn.classList.add("reproduciendo");
  utter.onend = function () {
    if (btn) btn.classList.remove("reproduciendo");
    if (typeof onEnd === "function") onEnd();
  };
  utter.onerror = function () {
    if (btn) btn.classList.remove("reproduciendo");
    if (typeof onEnd === "function") onEnd();
  };
  window.speechSynthesis.speak(utter);
}

var reconocedorVoz = null;
var timerSilencioVoz = null;

function alternarManosLibres() {
  estado.manosLibres = !estado.manosLibres;
  var btn = $("#btnManosLibres");
  if (btn) {
    if (estado.manosLibres) {
      btn.classList.add("activo-manos-libres");
      if (!estado.enviando) {
        alternarDictadoVoz(true);
      }
    } else {
      btn.classList.remove("activo-manos-libres");
      if (timerSilencioVoz) clearTimeout(timerSilencioVoz);
    }
  }
}

function alternarDictadoVoz(forzarInicio) {
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    if (!forzarInicio) alert("El dictado por voz no es compatible con este navegador.");
    return;
  }

  var btn = $("#btnVoz");
  if (reconocedorVoz && !forzarInicio) {
    reconocedorVoz.stop();
    reconocedorVoz = null;
    if (btn) btn.classList.remove("escuchando");
    if (timerSilencioVoz) clearTimeout(timerSilencioVoz);
    return;
  }

  if (reconocedorVoz && forzarInicio) return;

  try {
    var rec = new SpeechRec();
    rec.lang = "es-AR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = function () {
      if (btn) btn.classList.add("escuchando");
    };

    rec.onresult = function (ev) {
      var transcripcion = "";
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          transcripcion += ev.results[i][0].transcript + " ";
        }
      }
      var txt = $("#txt");
      if (txt && transcripcion) {
        txt.value = (txt.value ? txt.value.trim() + " " : "") + transcripcion.trim();
        txt.style.height = Math.min(txt.scrollHeight, 160) + "px";
        txt.focus();
      }

      if (estado.manosLibres) {
        if (timerSilencioVoz) clearTimeout(timerSilencioVoz);
        timerSilencioVoz = setTimeout(function () {
          if (reconocedorVoz) {
            try { reconocedorVoz.stop(); } catch (e) {}
            reconocedorVoz = null;
            if (btn) btn.classList.remove("escuchando");
          }
          enviar();
        }, 1800);
      }
    };

    rec.onerror = function (e) {
      console.warn("[voz] error:", e.error);
      if (btn) btn.classList.remove("escuchando");
      reconocedorVoz = null;
    };

    rec.onend = function () {
      if (btn) btn.classList.remove("escuchando");
      reconocedorVoz = null;
    };

    rec.start();
    reconocedorVoz = rec;
  } catch (err) {
    console.error("[voz]", err);
    if (btn) btn.classList.remove("escuchando");
    reconocedorVoz = null;
  }
}

// ═══ MEJORA 2: VISOR CINESTÉSICO DE FICHAS 3D CON SM-2 ═══
function parsearFichas(texto) {
  if (!texto) return [];
  var fichas = [];
  var rxAnversoReverso = /\*\*\[?(\d+)?\]?\s*ANVERSO\*\*([\s\S]*?)\*\*REVERSO\*\*([\s\S]*?)(?:(?=\*\*\[?\d*\]?\s*ANVERSO)|(?=\*Etiquetas)|(?=```csv)|$)/gi;
  var m;
  while ((m = rxAnversoReverso.exec(texto)) !== null) {
    var anverso = m[2].replace(/^[-–—\s]+/, "").trim();
    var reverso = m[3].replace(/^[-–—\s]+/, "").trim();
    if (anverso && reverso) {
      fichas.push({ anverso: anverso, reverso: reverso });
    }
  }

  if (!fichas.length) {
    var rxCsv = /```csv\s*([\s\S]*?)```/i;
    var mCsv = rxCsv.exec(texto);
    if (mCsv) {
      var lineas = mCsv[1].split("\n");
      for (var i = 0; i < lineas.length; i++) {
        var l = lineas[i].trim();
        if (!l || l.toLowerCase().startsWith("anverso;")) continue;
        var cols = l.split(";");
        if (cols.length >= 2) {
          fichas.push({ anverso: cols[0].trim(), reverso: cols[1].trim() });
        }
      }
    }
  }

  return fichas;
}

function renderizarVisorFichas(burbuja, texto) {
  var fichas = parsearFichas(texto);
  if (!fichas.length) return;

  var actual = 0;
  var cont = document.createElement("div");
  cont.className = "visor-fichas";

  function actualizarFicha() {
    var f = fichas[actual];
    cont.innerHTML =
      '<div class="ficha-progreso">🃏 Ficha ' + (actual + 1) + ' de ' + fichas.length + ' • (Toca para girar 🔄)</div>' +
      '<div class="ficha-escena">' +
        '<div class="ficha-3d" id="fichaActiva">' +
          '<div class="ficha-cara frente"><div>' + md(f.anverso) + '</div></div>' +
          '<div class="ficha-cara dorso"><div>' + md(f.reverso) + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="ficha-controles" id="controlesSM2">' +
        '<button class="btn-sm2 olvide" data-q="0">Olvide</button>' +
        '<button class="btn-sm2 dificil" data-q="2">Difícil</button>' +
        '<button class="btn-sm2 bien" data-q="3">Bien</button>' +
        '<button class="btn-sm2 facil" data-q="5">Fácil</button>' +
      '</div>';

    var tarjeta = cont.querySelector("#fichaActiva");
    var controles = cont.querySelector("#controlesSM2");

    tarjeta.onclick = function () {
      tarjeta.classList.toggle("volteada");
      if (tarjeta.classList.contains("volteada")) {
        controles.classList.add("visible");
      }
    };

    var btns = cont.querySelectorAll(".btn-sm2");
    for (var b = 0; b < btns.length; b++) {
      btns[b].onclick = function (e) {
        var q = parseInt(e.target.dataset.q, 10);
        guardarSM2(f.anverso, q);
        actual = (actual + 1) % fichas.length;
        actualizarFicha();
      };
    }
  }

  actualizarFicha();
  burbuja.querySelector(".burbuja").appendChild(cont);
}

function guardarSM2(clave, calidad) {
  try {
    var raw = localStorage.getItem("IURIS_SM2_FICHAS") || "{}";
    var mapa = JSON.parse(raw);
    var item = mapa[clave] || { reps: 0, interval: 1, ease: 2.5 };

    if (calidad < 2) {
      item.reps = 0;
      item.interval = 1;
    } else {
      if (item.reps === 0) item.interval = 1;
      else if (item.reps === 1) item.interval = 6;
      else item.interval = Math.round(item.interval * item.ease);
      item.reps++;
    }
    item.ease = Math.max(1.3, item.ease + (0.1 - (5 - calidad) * (0.08 + (5 - calidad) * 0.02)));
    item.proximoRepaso = Date.now() + item.interval * 24 * 3600 * 1000;

    mapa[clave] = item;
    localStorage.setItem("IURIS_SM2_FICHAS", JSON.stringify(mapa));
  } catch (e) {}
}

// ═══ MEJORA 4: PIZARRA DOGMÁTICA VISUAL ═══
function renderizarPizarraVisual(burbuja, texto) {
  var cont = document.createElement("div");
  cont.className = "pizarra-visual";

  var esDelito = /delito|accion|tipicidad|antijuridicidad|culpabilidad/i.test(texto);

  if (esDelito) {
    cont.innerHTML =
      '<div class="pizarra-titulo">🗺️ <b>Pizarra Estratificada: Teoría del Delito</b> <small>(Toca un estrato)</small></div>' +
      '<div class="pizarra-arbol">' +
        '<div class="nodo-pizarra activo" data-estrato="accion"><div class="nodo-titulo">1. Acción</div><div class="nodo-detalle">Conducta humana voluntaria. Excluye: fuerza física irresistible, actos reflejos, estado de inconsciencia.</div></div>' +
        '<div class="nodo-flecha">➔</div>' +
        '<div class="nodo-pizarra" data-estrato="tipicidad"><div class="nodo-titulo">2. Tipicidad</div><div class="nodo-detalle">Subsunción formal y material en el tipo penal. Tipo objetivo (imputación objetiva) y subjetivo (dolo/culpa).</div></div>' +
        '<div class="nodo-flecha">➔</div>' +
        '<div class="nodo-pizarra" data-estrato="antijuridicidad"><div class="nodo-titulo">3. Antijuridicidad</div><div class="nodo-detalle">Contrariedad al orden jurídico. Justificación: legítima defensa (art. 34 inc. 6 CP), estado de necesidad.</div></div>' +
        '<div class="nodo-flecha">➔</div>' +
        '<div class="nodo-pizarra" data-estrato="culpabilidad"><div class="nodo-titulo">4. Culpabilidad</div><div class="nodo-detalle">Juicio de reproche individual. Imputabilidad, comprensión de la criminalidad y exigibilidad de otra conducta.</div></div>' +
      '</div>';
  } else {
    cont.innerHTML =
      '<div class="pizarra-titulo">⏱️ <b>Línea de Secuencia Procesal Ordinaria</b></div>' +
      '<div class="pizarra-arbol">' +
        '<div class="nodo-pizarra activo"><div class="nodo-titulo">1. Demanda</div><div class="nodo-detalle">Interposición y requisitos formales (art. 330 CPCCN).</div></div>' +
        '<div class="nodo-flecha">➔</div>' +
        '<div class="nodo-pizarra"><div class="nodo-titulo">2. Traslado</div><div class="nodo-detalle">Plazo: 15 días hábiles para contestar y oponer excepciones.</div></div>' +
        '<div class="nodo-flecha">➔</div>' +
        '<div class="nodo-pizarra"><div class="nodo-titulo">3. Prueba</div><div class="nodo-detalle">Audiencia preliminar (art. 360) y producción de peritajes.</div></div>' +
        '<div class="nodo-flecha">➔</div>' +
        '<div class="nodo-pizarra"><div class="nodo-titulo">4. Sentencia</div><div class="nodo-detalle">Clausura del debate y fallo definitivo motivado.</div></div>' +
      '</div>';
  }

  var nodos = cont.querySelectorAll(".nodo-pizarra");
  for (var n = 0; n < nodos.length; n++) {
    nodos[n].onclick = function (e) {
      var item = e.currentTarget;
      for (var j = 0; j < nodos.length; j++) nodos[j].classList.remove("activo");
      item.classList.add("activo");
    };
  }

  burbuja.querySelector(".burbuja").appendChild(cont);
}

// ═══ MEJORA 5: CLÍNICA JURÍDICA CON EXPEDIENTE DIGITAL POR PESTAÑAS ═══
function renderizarExpedienteDigital(burbuja, texto) {
  var cont = document.createElement("div");
  cont.className = "expediente-digital";

  cont.innerHTML =
    '<div class="expediente-header">📁 <b>Expediente Judicial Digital: Autos de Estudio</b> <span>Secretaría Única</span></div>' +
    '<div class="expediente-tabs">' +
      '<button class="tab-foja activa" data-tab="demanda">📑 Fs. 1/4: Demanda</button>' +
      '<button class="tab-foja" data-tab="cedula">📬 Fs. 5: Cédula de Notificación</button>' +
      '<button class="tab-foja" data-tab="contestacion">🛑 Fs. 6/11: Contestación y Excepciones</button>' +
      '<button class="tab-foja" data-tab="pericia">🔬 Fs. 12: Dictamen Pericial</button>' +
    '</div>' +
    '<div class="foja-contenido" id="fojaContenido">' +
      '<p><strong>ESCRITO DE DEMANDA (Fs. 1/4):</strong> Promueve demanda por daños y perjuicios derivados de incumplimiento contractual. Reclama daño emergente, lucro cesante y daño moral. Acompaña prueba documental y ofrece testimonial.</p>' +
    '</div>';

  var tabs = cont.querySelectorAll(".tab-foja");
  var cuerpo = cont.querySelector("#fojaContenido");

  var contenidos = {
    demanda: '<p><strong>ESCRITO DE DEMANDA (Fs. 1/4):</strong> Promueve demanda por daños y perjuicios derivados de incumplimiento contractual. Reclama daño emergente, lucro cesante y daño moral. Acompaña prueba documental y ofrece testimonial.</p>',
    cedula: '<p><strong>CÉDULA DE NOTIFICACIÓN CON CARGO (Fs. 5):</strong> Diligenciada al domicilio legal. Notificada en fecha formal. <em>Atención procesal:</em> El plazo de 15 días hábiles comienza a computarse desde el día hábil inmediato posterior (Art. 156 CPCCN).</p>',
    contestacion: '<p><strong>CONTESTACIÓN Y OPOSICIÓN DE EXCEPCIONES (Fs. 6/11):</strong> Niega los hechos sustanciales de la demanda. Plantea excepción previa de prescripción liberatoria e incompetencia de jurisdicción. Solicita rechazo in limine.</p>',
    pericia: '<p><strong>DICTAMEN PERICIAL TÉCNICO (Fs. 12):</strong> El perito oficial constata la existencia de desperfectos materiales y cuantifica los rubros objetivos con tablas de depreciación técnica.</p>'
  };

  for (var i = 0; i < tabs.length; i++) {
    tabs[i].onclick = function (e) {
      for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove("activa");
      var t = e.currentTarget;
      t.classList.add("activa");
      cuerpo.innerHTML = contenidos[t.dataset.tab] || "<p>Sin contenido.</p>";
    };
  }

  burbuja.querySelector(".burbuja").appendChild(cont);
}

function configurarAdjuntos() {
  var btnAdjuntar = $("#btnAdjuntar");
  var inputArchivo = $("#inputArchivo");
  var btnQuitar = $("#btnQuitarAdjunto");

  if (btnAdjuntar && inputArchivo) {
    btnAdjuntar.onclick = function () { inputArchivo.click(); };
  }

  if (inputArchivo) {
    inputArchivo.onchange = function (e) {
      var archivo = e.target.files && e.target.files[0];
      if (!archivo) return;

      var tiposValidos = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
      if (!tiposValidos.includes(archivo.type)) {
        alert("Formato no soportado. Debe ser PDF o imagen (PNG, JPG, WEBP).");
        inputArchivo.value = "";
        return;
      }

      if (archivo.size > 10 * 1024 * 1024) {
        alert("El archivo supera el límite de 10 MB.");
        inputArchivo.value = "";
        return;
      }

      var lector = new FileReader();
      lector.onload = function (ev) {
        var dataUrl = ev.target.result;
        var base64 = dataUrl.split(",")[1];
        estado.adjuntoActual = {
          nombre: archivo.name,
          tipo: archivo.type,
          base64: base64
        };
        estado.adjuntoSesion = estado.adjuntoActual;
        actualizarChipAdjunto();
      };
      lector.readAsDataURL(archivo);
    };
  }

  if (btnQuitar) {
    btnQuitar.onclick = function () {
      estado.adjuntoActual = null;
      estado.adjuntoSesion = null;
      if (inputArchivo) inputArchivo.value = "";
      actualizarChipAdjunto();
    };
  }
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
    adjunto: estado.adjuntoSesion,
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
          '<button class="ci-borrar" aria-label="Eliminar consulta" title="Eliminar consulta">' + SVG_TRASH + '</button>';
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
    estado.adjuntoSesion = c.adjunto || null;
    estado.adjuntoActual = null;
    actualizarChipAdjunto();
    cambiarModo(c.modo || "clase");
    $("#chat").innerHTML = "";
    for (var i = 0; i < c.mensajes.length; i++) {
      var m = c.mensajes[i];
      var b = pintarMensaje(m.rol, m.texto, false, m.adjunto);
      if (m.rol === "assistant") acciones(b, m.texto);
    }
    if (window.innerWidth <= 850) alternarDrawer(false);
  });
}

function nuevoChat() {
  estado.chatId = null;
  estado.mensajes = [];
  estado.adjuntoActual = null;
  estado.adjuntoSesion = null;
  actualizarChipAdjunto();
  var inp = $("#inputArchivo");
  if (inp) inp.value = "";

  $("#chat").innerHTML =
    '<div class="bienvenida">' +
      '<span class="brand-mark grande" aria-hidden="true">' + SVG_BALANZA_GRANDE + '</span>' +
      '<h2>Iuris — Tutor Jurídico Virtual</h2>' +
      '<p>Acompañamiento docente para la carrera de Derecho: dogmática, jurisprudencia CSJN y práctica forense.</p>' +
      '<div class="sugerencias">' +
        '<button class="sug">Diferencia entre nulidad absoluta y relativa</button>' +
        '<button class="sug">Explicame los estratos de la teoría del delito</button>' +
        '<button class="sug">Requisitos de procedencia del amparo judicial</button>' +
        '<button class="sug">Calcular indemnización Méndez para 30 años y 20% incapacidad</button>' +
      '</div>' +
    '</div>';

  var sugs = document.querySelectorAll(".sug");
  for (var j = 0; j < sugs.length; j++) {
    (function (b) {
      b.onclick = function () {
        var txt = $("#txt");
        if (txt) { txt.value = b.textContent; enviar(); }
      };
    })(sugs[j]);
  }

  if (window.innerWidth <= 850) alternarDrawer(false);
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
