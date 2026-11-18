-- Knihovna
-- (První řádek je název projektu, web ho ukáže jako nadpis. Tady a v 02_data.sql a 03_dotazy.sql měníte vše, jinde nic.)
-- Skript jde pustit opakovaně: tabulky a indexy se vytvoří jen když ještě neexistují.
--
-- PRAVIDLA, která platí v každém projektu:
--  * každá tabulka má první sloupec  id_něco INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL  (číslo přidělí databáze sama)
--  * cizí klíč je  INTEGER NOT NULL REFERENCES Tabulka(id_...)  a vždy má i ON DELETE RESTRICT
--  * povinné věci jsou NOT NULL, text má maximální délku VARCHAR(N) a CHECK length (web podle toho hlídá formulář),
--    datum má CHECK date(...) = ..., nepovinné věci mají DEFAULT
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Autori (
  id_autora  INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  jmeno      VARCHAR(100) NOT NULL CHECK (length(trim(jmeno)) BETWEEN 1 AND 100)
);

CREATE TABLE IF NOT EXISTS Zanry (
  id_zanru   INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  nazev      VARCHAR(50) NOT NULL UNIQUE CHECK (length(trim(nazev)) BETWEEN 1 AND 50)
);

-- vztah 1:N  Autori -> Knihy a Zanry -> Knihy (cizí klíče jsou na straně N)
CREATE TABLE IF NOT EXISTS Knihy (
  id_knihy   INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  nazev      VARCHAR(150) NOT NULL CHECK (length(trim(nazev)) BETWEEN 1 AND 150),
  rok        INTEGER CHECK (rok BETWEEN 1400 AND 2100),
  id_autora  INTEGER NOT NULL REFERENCES Autori(id_autora) ON DELETE RESTRICT ON UPDATE CASCADE,
  id_zanru   INTEGER NOT NULL REFERENCES Zanry(id_zanru)   ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Titul (Knihy) a konkrétní kus (Vytisky) jsou dvě různé věci: jeden titul může mít v knihovně víc výtisků.
-- vztah 1:N  Knihy -> Vytisky. Půjčuje se vždy konkrétní výtisk (podle inventárního čísla).
-- Jestli je výtisk volný nebo půjčený, se neukládá: zjistí se z výpůjček (jinak by se údaj mohl rozejít).
CREATE TABLE IF NOT EXISTS Vytisky (
  id_vytisku       INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  id_knihy         INTEGER NOT NULL REFERENCES Knihy(id_knihy) ON DELETE RESTRICT ON UPDATE CASCADE,
  inv_cislo        VARCHAR(20) NOT NULL UNIQUE CHECK (length(trim(inv_cislo)) BETWEEN 1 AND 20),
  datum_porizeni   TEXT NOT NULL DEFAULT (date('now')) CHECK (date(datum_porizeni) = datum_porizeni),
  datum_vyrazeni   TEXT CHECK (datum_vyrazeni IS NULL OR date(datum_vyrazeni) = datum_vyrazeni),  -- prázdné = v oběhu
  CHECK (datum_vyrazeni IS NULL OR datum_vyrazeni >= datum_porizeni)
);

CREATE TABLE IF NOT EXISTS Ctenari (
  id_ctenare INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  jmeno      VARCHAR(100) NOT NULL CHECK (length(trim(jmeno)) BETWEEN 1 AND 100),
  trida      VARCHAR(10) NOT NULL DEFAULT 'neuvedeno' CHECK (length(trim(trida)) BETWEEN 1 AND 10)
);

-- spojovací tabulka: vztah M:N  Ctenari <-> Vytisky (tedy čtenář a kniha) se rozpadne na dvě 1:N
CREATE TABLE IF NOT EXISTS Vypujcky (
  id_vypujcky    INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  id_ctenare     INTEGER NOT NULL REFERENCES Ctenari(id_ctenare) ON DELETE RESTRICT ON UPDATE CASCADE,
  id_vytisku     INTEGER NOT NULL REFERENCES Vytisky(id_vytisku) ON DELETE RESTRICT ON UPDATE CASCADE,
  datum_od       TEXT NOT NULL DEFAULT (date('now')) CHECK (date(datum_od) = datum_od),   -- RRRR-MM-DD, výchozí je dnešek
  datum_vraceni  TEXT CHECK (datum_vraceni IS NULL OR date(datum_vraceni) = datum_vraceni),  -- prázdné = zatím nevráceno
  CHECK (datum_vraceni IS NULL OR datum_vraceni >= datum_od),
  UNIQUE (id_ctenare, id_vytisku, datum_od)   -- stejný výtisk tomu samému čtenáři jednou za den
);

-- pravidla knihovny:
--  * jeden výtisk může být nevrácený jen u jednoho čtenáře najednou
CREATE UNIQUE INDEX IF NOT EXISTS ux_vypujcky_nevracena ON Vypujcky(id_vytisku) WHERE datum_vraceni IS NULL;
--  * vyřazený výtisk nejde půjčit od data vyřazení dál (trigger zastaví vložení výpůjčky, stará historie zůstává)
CREATE TRIGGER IF NOT EXISTS trg_vypujcky_vyrazeny BEFORE INSERT ON Vypujcky
WHEN EXISTS (SELECT 1 FROM Vytisky WHERE id_vytisku = NEW.id_vytisku AND datum_vyrazeni IS NOT NULL AND NEW.datum_od >= datum_vyrazeni)
BEGIN
  SELECT RAISE(ABORT, 'Vyřazený výtisk nejde půjčit');
END;

-- indexy na cizí klíče (rychlejší JOINy a mazání)
CREATE INDEX IF NOT EXISTS idx_knihy_autor     ON Knihy(id_autora);
CREATE INDEX IF NOT EXISTS idx_knihy_zanr      ON Knihy(id_zanru);
CREATE INDEX IF NOT EXISTS idx_vytisky_kniha   ON Vytisky(id_knihy);
CREATE INDEX IF NOT EXISTS idx_vypujcky_ctenar ON Vypujcky(id_ctenare);
CREATE INDEX IF NOT EXISTS idx_vypujcky_vytisk ON Vypujcky(id_vytisku);
