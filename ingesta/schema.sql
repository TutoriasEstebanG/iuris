PRAGMA journal_mode = WAL;

DROP TABLE IF EXISTS normas;
CREATE TABLE normas (
  id                  TEXT PRIMARY KEY,
  tipo                TEXT DEFAULT 'normativo',
  jurisdiccion        TEXT NOT NULL,
  cuerpo_legal        TEXT NOT NULL,
  sigla               TEXT NOT NULL,
  libro               TEXT,
  titulo              TEXT,
  capitulo            TEXT,
  seccion             TEXT,
  articulo            TEXT NOT NULL,
  articulo_num        INTEGER,
  rubrica             TEXT,
  texto               TEXT NOT NULL,
  vigente_desde       TEXT,
  vigente_hasta       TEXT,
  estado              TEXT DEFAULT 'vigente',
  jerarquia_normativa INTEGER DEFAULT 3,
  reformas            TEXT DEFAULT '[]',
  concordancias       TEXT DEFAULT '[]',
  materia             TEXT DEFAULT '[]',
  fuente_url          TEXT,
  hash_verif          TEXT,
  fecha_ingesta       TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_jur_sigla ON normas(jurisdiccion, sigla);
CREATE INDEX idx_articulo  ON normas(jurisdiccion, sigla, articulo);
CREATE INDEX idx_estado    ON normas(estado);
CREATE INDEX idx_jerarquia ON normas(jerarquia_normativa);

DROP TABLE IF EXISTS normas_fts;
CREATE VIRTUAL TABLE normas_fts USING fts5(
  id UNINDEXED, cuerpo_legal, ubicacion, rubrica, texto, materia,
  tokenize = 'unicode61 remove_diacritics 2'
);
