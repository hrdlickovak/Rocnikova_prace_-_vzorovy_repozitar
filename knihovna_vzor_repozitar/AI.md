# Použití AI

Sem napište, jestli jste při projektu použili AI. Když ne, napište to. Bez tohoto souboru je použití AI podvod.
U každého použití napište: **nástroj**, **k čemu**, **prompt** a **co jste z toho použili**.

## Vzorový záznam
- **Nástroj:** Claude
- **K čemu:** vytvoření vzorového projektu Knihovna (tabulky, data, dotazy, web). Vzor vychází z dřívějších projektů jednoho z vyučujících (SŠ a PedF UK, vznikly před AI). Z časových důvodů předal zdrojové kódy AI, která je zjednodušila, převedla do jiné podoby a změnila téma. Výsledek zkontrolovali a schválili oba vyučující, než šel k žákům.
- **Co se použilo:** celý vzor. Ve vašem projektu to tak být nesmí, návrh a data musí být vaše.
- **Prompt** (přiložené podklady: prezentace z hodin, dřívější projekty, zadání):

```
ROLE
Jsi zkušený učitel databází a SQL na střední škole a zároveň pečlivý SQL vývojář.
Vysvětluješ jednoduše, bez zbytečného žargonu, tak aby to pochopil žák 2. ročníku
oboru Informační technologie.

CONTEXT
Učím předmět Aplikační software. Žáci mají od listopadu do dubna ročníkový projekt:
vlastní databáze v SQLite. Přikládám prezentace z hodin o vztazích 1:N a M:N,
své dřívější projekty jako zdroj nápadů a zadání projektu.
Chci z toho udělat VZOROVÝ projekt na téma KNIHOVNA, který půjde vzít, pochopit
a přepsat na vlastní téma. Zvládnout to musí každý žák, ale musí rozumět tomu,
co dělá. Cílem není, aby to za ně udělala AI.
SQLite jsem zvolil, aby projekt jel kdekoli: bez serveru, bez VirtualBoxu
a bez instalací v Ubuntu. Součástí je jednoduchý web, který běží jen v prohlížeči.
Je to rychlá kontrola, ne cíl: ukáže strukturu databáze, vztahy a data, aby
je žák líp pochopil. Projekt musí dávat smysl i bez něj.

ACTION
Z podkladů vytvoř zjednodušenou, ale věrohodnou databázi a dotazy.
Zjednoduš: vynech vše, co zadání nevyžaduje. Zachovej princip a logiku,
aby šla snadno předělat na jiné téma (jídelna, kino, e-shop).

STEPS (postupuj krok za krokem a u každého kroku stručně napiš, proč ho děláš)
1. Nejdřív se zeptej na vše, co ti chybí. Neodhaduj. Pak pokračuj.
2. Navrhni 4 až 6 tabulek a u každé jednou větou řekni, co popisuje.
3. U každé dvojice tabulek urči vztah 1:N nebo M:N a zdůvodni ho.
   M:N rozděl spojovací tabulkou.
4. Napiš 01_schema.sql: CREATE TABLE IF NOT EXISTS, první sloupec vždy
   id_něco INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, cizí klíče přes REFERENCES,
   NOT NULL, CHECK a DEFAULT tam, kde to dává smysl.
5. Napiš 02_data.sql: INSERT OR IGNORE, aspoň 8 řádků v hlavních tabulkách
   a 10 ve spojovací. Data musí odpovídat realitě (např. kniha má víc výtisků).
6. Napiš 03_dotazy.sql: 10 číslovaných dotazů s komentářem (WHERE a ORDER BY,
   tři JOINy, LEFT JOIN, COUNT s GROUP BY, INSERT, UPDATE, DELETE).
7. Zkontroluj sám sebe: skripty pusť dvakrát za sebou, ověř cizí klíče, počty
   řádků a že každý dotaz vrátí smysluplný výsledek. Napiš, co jsi našel.
8. Ve 3 až 5 větách vysvětli, jak z toho žák udělá vlastní projekt:
   co přepíše a co nechá.

NARROWING
- Jen SQLite a čistý SQL, žádný PHP, MySQL ani Python.
- Názvy bez háčků a mezer.
- Nic nevymýšlej mimo zadání a podklady. Když něco nevíš, zeptej se.
- Krátké věty, tabulky tam, kde to pomůže.

EXPECTATION
Tři soubory (01_schema.sql, 02_data.sql, 03_dotazy.sql), tabulku "požadavek zadání,
minimum, vzor, kde to je" a krátký návod na přepsání na jiné téma.

EXPERIMENT
Na konci navrhni dvě jiná témata, na která se vzor snadno předělá, a u každého
napiš, které tabulky se změní.

PURPOSE
Žák má pochopit princip (tabulky, klíče, vztahy, dotazy), ne jen zkopírovat
hotové řešení.
```

## Jak to použít ve svém projektu
Stejnou kostru (role, situace, kroky, omezení, očekávání) můžete použít, ale místo "vytvoř" napište:

```
Moje téma je [TÉMA]. Navrhni jen schéma (tabulky a vztahy) a ptej se mě.
SQL napíšu sám a pošlu ti ho ke kontrole. Vysvětli mi každou chybu jednou větou.
```

Do tohoto souboru pak vložte svůj skutečný prompt a napište, co jste z odpovědi použili.
