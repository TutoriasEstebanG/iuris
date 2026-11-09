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

DROP TABLE IF EXISTS jurisprudencia;
CREATE TABLE jurisprudencia (
  id                  TEXT PRIMARY KEY,
  tribunal            TEXT NOT NULL,
  autos               TEXT NOT NULL,
  fecha               TEXT NOT NULL,
  tomo                INTEGER,
  pagina              INTEGER,
  holding             TEXT NOT NULL,
  sumario             TEXT NOT NULL,
  hechos              TEXT,
  votos               TEXT DEFAULT '[]',
  citas_normativas    TEXT DEFAULT '[]',
  precedentes         TEXT DEFAULT '[]',
  materia             TEXT DEFAULT '[]',
  estado              TEXT DEFAULT 'vigente',
  fuente_url          TEXT,
  hash_verif          TEXT,
  fecha_ingesta       TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_jurisp_tribunal ON jurisprudencia(tribunal);
CREATE INDEX idx_jurisp_autos    ON jurisprudencia(autos);
CREATE INDEX idx_jurisp_fecha    ON jurisprudencia(fecha);
CREATE INDEX idx_jurisp_estado   ON jurisprudencia(estado);

DROP TABLE IF EXISTS jurisprudencia_fts;
CREATE VIRTUAL TABLE jurisprudencia_fts USING fts5(
  id UNINDEXED, tribunal, autos, holding, sumario, hechos, materia,
  tokenize = 'unicode61 remove_diacritics 2'
);

