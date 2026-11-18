-- 03_dotazy.sql: ukázkové dotazy. Každý má číslo, popis a jde pustit samostatně.
-- (Číslovaný komentář "-- 1) ..." používá i web: nabídne dotazy v rozbalovátku.)

-- 1) Knihy od roku 1940, od nejstarší (WHERE, ORDER BY)
SELECT nazev, rok FROM Knihy WHERE rok >= 1940 ORDER BY rok;

-- 2) Knihy Karla Čapka (JOIN 2 tabulky)
SELECT Knihy.nazev, Autori.jmeno AS autor, Knihy.rok FROM Knihy
INNER JOIN Autori ON Knihy.id_autora = Autori.id_autora
WHERE Autori.jmeno = 'Karel Čapek' ORDER BY Knihy.rok;

-- 3) Kdo má co půjčeno a ještě nevrátil (JOIN 4 tabulky přes spojovací)
SELECT Ctenari.jmeno AS ctenar, Knihy.nazev AS kniha, Vytisky.inv_cislo, Vypujcky.datum_od FROM Vypujcky
INNER JOIN Ctenari ON Vypujcky.id_ctenare = Ctenari.id_ctenare
INNER JOIN Vytisky ON Vypujcky.id_vytisku = Vytisky.id_vytisku
INNER JOIN Knihy   ON Vytisky.id_knihy    = Knihy.id_knihy
WHERE Vypujcky.datum_vraceni IS NULL ORDER BY Vypujcky.datum_od;

-- 4) Totéž i s autorem a žánrem (JOIN 6 tabulek)
SELECT Ctenari.jmeno AS ctenar, Knihy.nazev AS kniha, Autori.jmeno AS autor, Zanry.nazev AS zanr
FROM Vypujcky
INNER JOIN Ctenari ON Vypujcky.id_ctenare = Ctenari.id_ctenare
INNER JOIN Vytisky ON Vypujcky.id_vytisku = Vytisky.id_vytisku
INNER JOIN Knihy   ON Vytisky.id_knihy    = Knihy.id_knihy
INNER JOIN Autori  ON Knihy.id_autora     = Autori.id_autora
INNER JOIN Zanry   ON Knihy.id_zanru      = Zanry.id_zanru
WHERE Vypujcky.datum_vraceni IS NULL;

-- 5) Volné výtisky: nejsou vyřazené a nemají nevrácenou výpůjčku (LEFT JOIN + IS NULL)
SELECT Knihy.nazev, Vytisky.inv_cislo FROM Vytisky
INNER JOIN Knihy ON Vytisky.id_knihy = Knihy.id_knihy
LEFT JOIN Vypujcky ON Vypujcky.id_vytisku = Vytisky.id_vytisku AND Vypujcky.datum_vraceni IS NULL
WHERE Vytisky.datum_vyrazeni IS NULL AND Vypujcky.id_vypujcky IS NULL
ORDER BY Knihy.nazev;

-- 6) Kolik má každý titul výtisků v oběhu a kolik z nich je volných (COUNT, GROUP BY)
SELECT Knihy.nazev, COUNT(Vytisky.id_vytisku) AS vytisku, COUNT(Vytisky.id_vytisku) - COUNT(Vypujcky.id_vypujcky) AS volnych
FROM Knihy
INNER JOIN Vytisky ON Vytisky.id_knihy = Knihy.id_knihy AND Vytisky.datum_vyrazeni IS NULL
LEFT JOIN Vypujcky ON Vypujcky.id_vytisku = Vytisky.id_vytisku AND Vypujcky.datum_vraceni IS NULL
GROUP BY Knihy.id_knihy ORDER BY volnych, Knihy.nazev;

-- 7) Čtenáři s víc než jednou výpůjčkou (GROUP BY + HAVING)
SELECT Ctenari.jmeno, COUNT(*) AS pocet_vypujcek FROM Vypujcky
INNER JOIN Ctenari ON Vypujcky.id_ctenare = Ctenari.id_ctenare
GROUP BY Ctenari.id_ctenare HAVING COUNT(*) > 1;

-- 8) Půjčení volného výtisku K-019 (INSERT); datum_od se doplní výchozí hodnotou, tedy dnešek
INSERT INTO Vypujcky (id_ctenare, id_vytisku) VALUES (6, 19);

-- 9) Vrácení knihy (UPDATE)
UPDATE Vypujcky SET datum_vraceni = date('now') WHERE id_vypujcky = 4;

-- 10) Smazání staré, už vrácené výpůjčky (DELETE)
DELETE FROM Vypujcky WHERE id_vypujcky = 13 AND datum_vraceni IS NOT NULL;
