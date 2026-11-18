-- 02_data.sql: ukázková (vymyšlená) data
-- INSERT OR IGNORE: když záznam se stejným id už existuje, přeskočí se. Skript jde pustit opakovaně.
-- (V MySQL se píše INSERT IGNORE.)

INSERT OR IGNORE INTO Autori (id_autora, jmeno) VALUES
  (1, 'Karel Čapek'), (2, 'Božena Němcová'), (3, 'Jaroslav Foglar'), (4, 'Eduard Petiška'),
  (5, 'Jules Verne'), (6, 'Astrid Lindgrenová'), (7, 'Ota Pavel'), (8, 'Jaroslav Hašek'),
  (9, 'Karel Jaromír Erben'), (10, 'Alois Jirásek');

INSERT OR IGNORE INTO Zanry (id_zanru, nazev) VALUES
  (1, 'Sci-fi'), (2, 'Klasika'), (3, 'Dobrodružný'), (4, 'Pohádky'), (5, 'Humor'),
  (6, 'Detektivka'), (7, 'Poezie'), (8, 'Historický');

INSERT OR IGNORE INTO Knihy (id_knihy, nazev, rok, id_autora, id_zanru) VALUES
  (1,  'R.U.R.', 1920, 1, 1),
  (2,  'Válka s mloky', 1936, 1, 1),
  (3,  'Babička', 1855, 2, 2),
  (4,  'Záhada hlavolamu', 1941, 3, 6),
  (5,  'Stínadla se bouří', 1946, 3, 3),
  (6,  'Staré řecké báje a pověsti', 1946, 4, 4),
  (7,  'Dvacet tisíc mil pod mořem', 1870, 5, 1),
  (8,  'Cesta kolem světa za 80 dní', 1873, 5, 3),
  (9,  'Pipi Dlouhá punčocha', 1945, 6, 4),
  (10, 'Jak jsem potkal ryby', 1974, 7, 5),
  (11, 'Osudy dobrého vojáka Švejka', 1921, 8, 5),
  (12, 'Bratři Lví srdce', 1973, 6, 3),
  (13, 'Kytice', 1853, 9, 7),
  (14, 'Staré pověsti české', 1894, 10, 8);

INSERT OR IGNORE INTO Vytisky (id_vytisku, id_knihy, inv_cislo, datum_porizeni, datum_vyrazeni) VALUES
  (1,  1,  'K-001', '2019-09-01', NULL),
  (2,  1,  'K-002', '2019-09-01', NULL),
  (3,  1,  'K-003', '2022-01-15', '2026-06-30'),   -- poškozený, vyřazen
  (4,  2,  'K-004', '2018-05-10', NULL),
  (5,  3,  'K-005', '2017-03-20', NULL),
  (6,  3,  'K-006', '2020-09-01', NULL),
  (7,  4,  'K-007', '2019-10-12', NULL),
  (8,  4,  'K-008', '2021-02-02', NULL),
  (9,  5,  'K-009', '2019-10-12', NULL),
  (10, 6,  'K-010', '2016-09-01', NULL),
  (11, 6,  'K-011', '2023-01-10', NULL),
  (12, 7,  'K-012', '2018-11-11', NULL),
  (13, 8,  'K-013', '2020-04-04', NULL),
  (14, 9,  'K-014', '2021-09-01', NULL),
  (15, 9,  'K-015', '2021-09-01', NULL),
  (16, 10, 'K-016', '2022-05-05', NULL),
  (17, 11, 'K-017', '2015-09-01', NULL),
  (18, 11, 'K-018', '2019-09-01', NULL),
  (19, 12, 'K-019', '2023-03-03', NULL),
  (20, 13, 'K-020', '2017-10-10', NULL),
  (21, 13, 'K-021', '2018-10-10', NULL),
  (22, 14, 'K-022', '2020-02-20', NULL);

INSERT OR IGNORE INTO Ctenari (id_ctenare, jmeno, trida) VALUES
  (1, 'Tereza Malá', '2.A'), (2, 'Ondřej Černý', '2.B'), (3, 'Lucie Horká', '2.A'),
  (4, 'Jakub Vlček', '2.B'), (5, 'Eliška Kratochvílová', '2.A'), (6, 'Matěj Dvořák', '2.B'),
  (7, 'Adéla Procházková', '2.A'), (8, 'Filip Novotný', '2.B'), (9, 'Nikola Marešová', '2.A'),
  (10, 'David Šimek', '2.B');

-- Půjčuje se konkrétní výtisk. Výpůjčky téhož výtisku na sebe navazují (nepřekrývají se)
-- a nevrácená může být nejvýš jedna (hlídá to unikátní index v 01_schema.sql).
-- Babička (výtisky 5 a 6) je teď půjčená obě, takže žádný volný kus nemá.
INSERT OR IGNORE INTO Vypujcky (id_vypujcky, id_ctenare, id_vytisku, datum_od, datum_vraceni) VALUES
  (1,  1, 1,  '2026-09-14', '2026-09-28'),
  (2,  2, 1,  '2026-09-29', '2026-10-13'),
  (3,  3, 2,  '2026-09-20', '2026-10-04'),
  (4,  4, 2,  '2026-10-20', NULL),
  (5,  1, 5,  '2026-10-01', '2026-10-15'),
  (6,  9, 5,  '2026-10-16', NULL),
  (7,  5, 6,  '2026-10-02', NULL),
  (8,  3, 4,  '2026-09-22', '2026-10-06'),
  (9,  2, 7,  '2026-10-05', NULL),
  (10, 6, 9,  '2026-10-02', NULL),
  (11, 5, 14, '2026-09-30', '2026-10-14'),
  (12, 7, 17, '2026-10-08', NULL),
  (13, 7, 13, '2026-09-15', '2026-09-29'),
  (14, 8, 10, '2026-10-10', NULL),
  (15, 10, 20, '2026-09-25', '2026-10-09'),
  (16, 3, 21, '2026-10-12', '2026-10-26'),
  (17, 5, 12, '2026-10-18', NULL),
  (18, 7, 22, '2026-10-20', NULL),
  (19, 10, 16, '2026-10-21', '2026-11-02'),
  (20, 4, 3,  '2026-05-02', '2026-05-20');
