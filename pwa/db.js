/**
 * Iuris - Persistencia local
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

var DB = (function () {
  var NOMBRE = "iuris-db";
  var VERSION = 1;
  var db = null;

  function abrir() {
    return new Promise(function (res, rej) {
      if (db) return res(db);
      var req = indexedDB.open(NOMBRE, VERSION);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains("chats")) {
          var s = d.createObjectStore("chats", { keyPath: "id" });
          s.createIndex("porFecha", "actualizado");
        }
      };
      req.onsuccess = function (e) { db = e.target.result; res(db); };
      req.onerror = function () { rej(req.error); };
    });
  }

  function guardar(chat) {
    return abrir().then(function (d) {
      chat.actualizado = Date.now();
      return new Promise(function (res, rej) {
        var tx = d.transaction("chats", "readwrite");
        tx.objectStore("chats").put(chat);
        tx.oncomplete = res;
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  function listar() {
    return abrir().then(function (d) {
      return new Promise(function (res, rej) {
        var out = [];
        var tx = d.transaction("chats", "readonly");
        var idx = tx.objectStore("chats").index("porFecha");
        idx.openCursor(null, "prev").onsuccess = function (e) {
          var c = e.target.result;
          if (c) { out.push(c.value); c.continue(); }
          else res(out);
        };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  function obtener(id) {
    return abrir().then(function (d) {
      return new Promise(function (res, rej) {
        var r = d.transaction("chats", "readonly").objectStore("chats").get(id);
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }

  function borrar(id) {
    return abrir().then(function (d) {
      return new Promise(function (res) {
        var tx = d.transaction("chats", "readwrite");
        tx.objectStore("chats").delete(id);
        tx.oncomplete = res;
      });
    });
  }

  return {
    guardar: guardar,
    listar: listar,
    obtener: obtener,
    borrar: borrar
  };
})();

var Perfil = {
  leer: function () {
    try {
      return JSON.parse(localStorage.getItem("iuris-perfil")) || {};
    } catch (e) {
      return {};
    }
  },
  guardar: function (p) {
    localStorage.setItem("iuris-perfil", JSON.stringify(p));
  }
};
