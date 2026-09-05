/**
 * Iuris — Acceso a datos (Turso o SQLite local)
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { createClient } from "@libsql/client";

let cliente = null;

export function obtenerDB() {
  if (cliente) return cliente;

  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  const local = process.env.LOCAL_DB_PATH;

  if (url && token) {
    cliente = createClient({ url, authToken: token });
  } else if (local) {
    cliente = createClient({ url: `file:${local}` });
  } else {
    throw new Error("Sin base de datos configurada");
  }
  return cliente;
}

export async function consultar(sql, params = []) {
  const db = obtenerDB();
  const r = await db.execute({ sql, args: params });
  return r.rows.map(f => ({ ...f }));
}

export async function consultarUno(sql, params = []) {
  const filas = await consultar(sql, params);
  return filas[0] || null;
}

export async function verificarCorpus() {
  try {
    const r = await consultarUno(
      "SELECT COUNT(*) AS n FROM normas WHERE estado != 'derogado'");
    const cuerpos = await consultar(
      "SELECT sigla, COUNT(*) AS n FROM normas GROUP BY sigla ORDER BY n DESC");
    return {
      ok: Number(r.n) > 0,
      articulos: Number(r.n),
      cuerpos: cuerpos.map(c => ({ sigla: c.sigla, articulos: Number(c.n) })),
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
