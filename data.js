/* ==========================================================================
   DATI DEL SITO — modifica qui testi, date, corsi e link dei progetti.

   Campi di ogni progetto:
   - start/end ........ "AAAA-MM" (end: null = in corso)
   - course / degree .. etichetta del corso di studio
   - kind ............. tipo di lavoro (gruppo, individuale, tesi, esercitazione)
   - objective ........ l'obiettivo, mostrato per primo
   - data ............. dati utilizzati
   - strategy ......... passi della strategia [{ t: titolo, d: descrizione }]
   - methods / software strumenti statistici e software
   - results .......... risultati principali (paragrafi)
   - map .............. posizione nella "Mappa" (x: 0 descrivere → 1 prevedere,
                        y: 0 sistemi e mercati → 1 persone e popolazioni)
   ========================================================================== */

const THEMES = {
  demografia: { label: "Demografia",            color: "#E0582A" },
  societa:    { label: "Salute & società",      color: "#2F6FDB" },
  indici:     { label: "Indicatori & sviluppo", color: "#8E44C9" },
  modelli:    { label: "Modelli statistici",    color: "#5E9A1E" },
  ml:         { label: "Machine Learning",      color: "#D12F6A" },
  dm:         { label: "Data Mining",           color: "#0E8A8F" }
};

const DEGREES = {
  lt: "Laurea triennale · Milano-Bicocca",
  lm: "Laurea magistrale · Padova"
};

const PROJECTS = [
  /* ------------------------------------------------------------------ */
  {
    id: "tesi-magistrale",
    title: "Migrazioni interne e spopolamento delle aree interne",
    short: "Tesi magistrale",
    theme: "demografia",
    start: "2026-06", end: null,
    period: "2026 – in corso",
    course: "Tesi di laurea magistrale", degree: "lm",
    kind: "Tesi · relatore Prof. Stefano Mazzuco",
    team: "Lavoro individuale",
    kpi: "20 anni", kpiLabel: "di migrazioni italiane, dai comuni all'estero",
    objective: "Capire chi lascia i territori italiani, verso dove e perché, e quanto questi flussi contribuiscono allo spopolamento delle aree interne.",
    data: "Dati ISTAT sui trasferimenti di residenza degli ultimi vent'anni a più livelli: verso l'estero, tra regioni, tra province e tra comuni, integrati con indicatori socio-economici e demografici dei territori.",
    strategy: [
      { t: "Ricostruire i flussi", d: "Matrici origine-destinazione a diversi livelli territoriali, armonizzando serie che cambiano definizione nel tempo." },
      { t: "Descrivere i territori", d: "Indicatori di struttura demografica, mercato del lavoro e servizi per distinguere aree interne e poli." },
      { t: "Modellare i flussi", d: "Modelli gravitazionali e diadici in cui il flusso tra due territori dipende dalle loro caratteristiche e dalla distanza." },
      { t: "Gestire i conteggi", d: "Regressioni di Poisson e zero-inflated per le molte coppie di territori senza scambi, e modelli bayesiani gerarchici per i livelli annidati." }
    ],
    methods: ["Modelli gravitazionali", "Modelli diadici", "Poisson / ZINB", "Bayes gerarchico"],
    software: ["R"],
    results: [
          {
                "t": "Il lavoro è in corso. Qui arriveranno i risultati dei modelli sui flussi, le mappe dello spopolamento e il codice."
          }
    ],
    links: [],
    map: { x: 0.74, y: 0.76 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "specchio",
    title: "Oltre lo specchio: i social cambiano come vediamo il nostro corpo?",
    short: "Oltre lo specchio",
    theme: "societa",
    start: "2026-03", end: "2026-05",
    period: "Mar – Mag 2026",
    course: "Temi e metodi di popolazione e società", degree: "lm",
    kind: "Lavoro di gruppo · modulo della Prof.ssa Margherita Silan",
    team: "Con M. Badrane, A. Bianchi, V. Carfagno, C. Mauro, F. Ursillo",
    kpi: "3 su 4", kpiLabel: "18–44enni sentono i social influenzare il loro “corpo ideale”",
    objective: "Misurare quanto i social media influenzano i canoni di bellezza, la percezione del proprio corpo e le abitudini sportive degli italiani tra i 18 e i 44 anni, partendo da un'indagine raccolta interamente online.",
    data: "Questionario di 34 domande in 5 sezioni (uso dei social, sport, palestra, percezione corporea, profilo), con diverse domande riprese dall'indagine ISTAT “Aspetti della vita quotidiana” (AVQ 2023) per avere un termine di confronto. Le nostre risposte sono state unite a quelle raccolte dagli altri gruppi con lo stesso questionario.",
    strategy: [
      { t: "Reclutare sui social", d: "Pagine Facebook e Instagram dedicate e una campagna Meta Ads da 100 €, ripartita per quote di sesso ed età (campionamento non probabilistico per quote) e tracciata con parametri UTM: 58.930 impressioni e 1.246 click in circa 30 ore." },
      { t: "Misurare la distorsione", d: "Confronto del campione con AVQ: donne al 71% contro il 49% della popolazione, 18–19enni molto sovrarappresentati, sportivi ad alta intensità in eccesso." },
      { t: "Correggere con tre metodi", d: "Raking (calibrazione iterativa sulle marginali, con trimming dei pesi), pesi da propensity score stimati unendo il campione web ad AVQ (IPS-IW) e regressione multilivello con post-stratificazione (MRP)." },
      { t: "Stimare in modo bayesiano", d: "MRP come logistica con effetti casuali per sesso, età e loro interazione, stimata con MCMC (4 catene): il partial pooling stabilizza le celle con pochi rispondenti." },
      { t: "Modellare le risposte", d: "Con i pesi IPS-IW, scelti come metodo finale, modelli ordinali a odds proporzionali per le quattro dimensioni del questionario." }
    ],
    methods: ["Campionamento per quote", "Raking", "Weight trimming", "Propensity score (IPS-IW)", "MRP bayesiano", "Modelli ordinali"],
    software: ["Meta Ads Manager", "R", "rstanarm"],
    results: [
          {
                "n": "74%",
                "t": "Stima MRP della quota di 18–44enni che dà ai social un'influenza alta (almeno 7 su 10) sulla propria idea di corpo ideale, con intervallo di credibilità al 95% tra 66% e 82%. La stima con il raking è entro 1–2 punti."
          },
          {
                "n": "78% · 70%",
                "t": "Donne contro uomini. La direzione è coerente con la letteratura sulla pressione estetica dei media, ma con soli 44 uomini nel campione la differenza è un'indicazione, non una prova. Tra le fasce d'età non c'è un gradiente chiaro."
          },
          {
                "n": "71% → 47%",
                "t": "Quota di donne nel campione prima e dopo i pesi IPS-IW (49% nella popolazione AVQ). I 18–19enni scendono dal 29% al 7%, in linea con il benchmark ISTAT."
          },
          {
                "n": "67%",
                "t": "Pensa che i social non propongano canoni estetici realistici (1–4 su 10). L'insoddisfazione per il proprio corpo è polarizzata: picchi a 1 (23%) e a 10 (18%)."
          },
          {
                "n": "4 modelli",
                "t": "Nei modelli ordinali pesati, chi passa poco tempo sui social valuta in modo più critico tutte le dimensioni. Il sesso conta solo per l'insoddisfazione corporea, più bassa tra gli uomini."
          },
          {
                "n": "1.246 click",
                "t": "Campagna Meta: 58.930 impressioni con un costo per click di circa 0,08 € per entrambi i sessi. I 35–44enni hanno generato più di metà del traffico e Instagram Reels da solo 791 click, ma i questionari completati sono stati solo 18."
          }
    ],
    limits: "Con 100 € di budget, un questionario lungo e un tema sensibile le compilazioni dirette sono state poche e sono state integrate con i dati degli altri gruppi. Anche dopo la ponderazione il campione resta spostato verso chi fa molto sport.",
    role: "Con Bianchi e Carfagno ho progettato e gestito la campagna su Meta Ads Manager (testi, immagini, segmenti per sesso ed età, monitoraggio), poi ho partecipato al confronto sui metodi e alla stesura del report.",
    links: [{ label: "Report completo (PDF)", href: "assets/reports/oltre-lo-specchio.pdf", kind: "pdf" }],
    map: { x: 0.44, y: 0.93 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "ipog",
    title: "IPOG: quanto funziona la giustizia in Europa?",
    short: "Indice IPOG",
    theme: "indici",
    start: "2026-02", end: "2026-06",
    period: "Primavera 2026",
    course: "Temi e metodi di popolazione e società", degree: "lm",
    kind: "Lavoro di gruppo · Gruppo 6, A.A. 2025/26",
    team: "Con G. Bernardinis, L. Gambellin, N. Grosoli",
    kpi: "41", kpiLabel: "sistemi giudiziari europei messi a confronto",
    objective: "Costruire un indicatore composito, l'Indice di Performance Operativa Giudiziaria (IPOG), che dica con un solo numero quanto un sistema giudiziario funziona in modo efficiente, accessibile e organizzato, e che permetta di confrontare i Paesi europei.",
    data: "12 indicatori semplici tratti dalle banche dati del Consiglio d'Europa (CEPEJ, “Evaluation of Judicial Systems” e “CEPEJ Statistics”) per 41 Paesi, divisi in quattro dimensioni: efficienza (disposition time, clearance rate), risorse e accessibilità (budget, patrocinio a spese dello Stato, court fees), capitale umano (giudici, personale, avvocati, stipendi) e tecnologia (indici ICT).",
    strategy: [
      { t: "Controllare i dati", d: "Distribuzioni, dati mancanti e correlazioni: lo stipendio dei giudici manca nel 27% dei casi, e i due indici ICT sono molto correlati, quindi vengono accorpati in un'unica dimensione." },
      { t: "Imputare i mancanti", d: "Ipotesi MAR e imputazione con regressione sulle altre variabili, per non perdere Paesi come Polonia e Portogallo e mantenere la struttura multivariata." },
      { t: "Normalizzare", d: "Rescaling min-max di ogni indicatore su scala 0–100, con la polarità corretta (per esempio, un disposition time più alto è peggio)." },
      { t: "Pesare e aggregare", d: "Pesi scelti con la budget allocation: un panel di 10 studenti di Giurisprudenza ha distribuito 100 punti tra le dimensioni (efficienza 35, risorse 25, capitale umano 25, tecnologia 15), confrontati con l'equal weighting; aggregazione con media ponderata." },
      { t: "Verificare la robustezza", d: "Analisi di sensibilità rispetto a media aritmetica e geometrica (correlazioni di Spearman 0,89 e 0,83) e validazione esterna con Eurobarometro 503 e Rule of Law Index del WJP." }
    ],
    methods: ["Indicatori compositi", "Imputazione con regressione", "Normalizzazione min-max", "Budget allocation", "Analisi di sensibilità", "Correlazione di Spearman"],
    software: ["R"],
    results: [
          {
                "n": "27–52",
                "t": "Punteggi tra i 41 Paesi. La performance è molto eterogenea e non segue blocchi geografici o economici: dipende dall'organizzazione dei singoli sistemi nazionali."
          },
          {
                "n": "52 · 51,3 · 50,7",
                "t": "Ungheria, Serbia e Spagna guidano la classifica, forti nell'efficienza, la dimensione con più peso. In fondo ci sono Grecia (27), Albania (31) e Irlanda (31,4)."
          },
          {
                "n": "24ª su 41",
                "t": "L'Italia (42,1) è a metà classifica: va bene in tecnologia ma è frenata dalla durata dei procedimenti. Tra i grandi Paesi UE: Spagna 50,7, Germania 43, Italia 42,1, Francia 34,5, sotto la media in ogni dimensione."
          },
          {
                "n": "ρ = 0,89",
                "t": "Correlazione di Spearman con la classifica a media aritmetica (0,83 con la geometrica): la classifica regge al cambio di aggregazione. L'Italia è il Paese che si sposta di più, perché i pesi premiano molto l'efficienza."
          },
          {
                "n": "−0,07",
                "t": "Correlazione con il Rule of Law Index del WJP, quasi nulla come quella con l'indipendenza percepita (Eurobarometro 503). Una giustizia efficiente non è automaticamente più equa o più credibile."
          }
    ],
    limits: "Per alcuni indicatori il verso è ambiguo: tanti avvocati o stipendi alti sono sempre un segnale positivo? L'indice misura l'infrastruttura dei tribunali, non la qualità delle sentenze né l'indipendenza della magistratura.",
    links: [{ label: "Presentazione (PDF, 20 MB)", href: "assets/reports/ipog-indice-giudiziario.pdf", kind: "pdf" }],
    map: { x: 0.3, y: 0.3 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "flegrei",
    title: "Campi Flegrei: rischio reale e rischio percepito",
    short: "Campi Flegrei",
    theme: "societa",
    start: "2025-11", end: "2026-01",
    period: "A.A. 2025/26",
    course: "Temi e metodi di popolazione e società", degree: "lm",
    kind: "Lavoro di gruppo · poster",
    team: "Con G. Basso, R. Frizzerin, R. Quarato, V. Skerl",
    kpi: "25%", kpiLabel: "degli esposti ad alto rischio dichiara di non percepirne alcuno",
    objective: "Capire se chi vive ai Campi Flegrei percepisce correttamente il proprio rischio sismico: esiste una differenza di stress tra profili di rischio diversi, e c'è un disallineamento tra rischio reale e rischio percepito?",
    data: "623 risposte a un'indagine del 2025: scosse avvertite, danni all'abitazione, zona di residenza (rossa, gialla o verde), rischio percepito su una scala da 1 a 5 e stress medio misurato con la scala PSS-10.",
    strategy: [
      { t: "Esplorare", d: "Distribuzioni univariate per valutare il bilanciamento del campione, e test χ² di Pearson tra gli indicatori di rischio oggettivo, tutti fortemente associati (p < 0,001)." },
      { t: "Costruire i profili", d: "Modelli a classi latenti (LCA) sugli indicatori oggettivi, confrontando versioni con e senza covariate demografiche e stress; scelta del modello a 2 classi per parsimonia e interpretabilità." },
      { t: "Confrontare stress e percezione", d: "Test non parametrici (Mann-Whitney e Kruskal-Wallis) sullo stress per classe, e tabelle incrociate tra classe latente e rischio percepito." }
    ],
    methods: ["Classi latenti (LCA)", "Test χ²", "Mann-Whitney", "Kruskal-Wallis", "Scala PSS-10"],
    software: ["R"],
    results: [
          {
                "n": "623",
                "t": "Risposte del 2025. Prevalgono residenti in zona rossa che hanno avvertito molte scosse, e quasi nessuno si considera a rischio nullo."
          },
          {
                "n": "p < 0,001",
                "t": "Il test χ² mostra una forte associazione tra scosse avvertite, danni e zona di residenza. Il rischio percepito cresce con la frequenza delle scosse, i danni e la pericolosità della zona."
          },
          {
                "n": "64% · 33%",
                "t": "Le due classi latenti: rischio oggettivo alto (molte scosse, danni moderati, zona rossa), molto omogenea al suo interno, e rischio medio-basso, più eterogenea e con danni quasi assenti (10%)."
          },
          {
                "n": "≈ stesso stress",
                "t": "Lo stress medio (PSS-10) è distribuito in modo simile nei due profili: Mann-Whitney e Kruskal-Wallis non trovano differenze rilevanti."
          },
          {
                "n": "25% · 10%",
                "t": "Un quarto degli esposti ad alto rischio oggettivo dichiara di non percepire alcun rischio, mentre circa il 10% di chi è a basso rischio vive in allarme massimo: il rischio reale e quello percepito non coincidono."
          }
    ],
    links: [{ label: "Poster (PDF)", href: "assets/reports/campi-flegrei-poster.pdf", kind: "pdf" }],
    map: { x: 0.33, y: 0.78 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "proiezioni",
    title: "Proiezioni demografiche per un bando europeo",
    short: "Proiezioni al 2054",
    theme: "demografia",
    start: "2025-11", end: "2026-01",
    period: "Nov 2025 – Gen 2026",
    course: "Teorie e modelli demografici", degree: "lm",
    kind: "Lavoro di gruppo",
    team: "Con I. Bassetto, S. Della Gatta, F. Falcone, B. Longo",
    kpi: "4", kpiLabel: "scenari al 2054 per Emilia-Romagna, Molise e Sicilia",
    objective: "Valutare, come in un bando europeo, quali politiche demografiche (fecondità, migrazioni, mortalità) aiutano di più la popolazione in età lavorativa di tre regioni molto diverse, a 15 e 30 anni.",
    data: "Popolazione media 2024 per sesso ed età (ISTAT), tassi di fecondità e mortalità regionali, mortalità per causa 2023 per macroarea e tassi di migrazione netta per età del Canada 2023 (Statistics Canada).",
    strategy: [
      { t: "Definire gli indicatori", d: "Indice di dipendenza (ID), di struttura della popolazione attiva (ISPA, 40–64 su 15–39 anni) e di ricambio (IRPA, 60–64 su 15–19 anni)." },
      { t: "Proiettare per coorte", d: "Metodo delle componenti per coorte, per sesso, con passi quinquennali dal 2024 al 2054 e tassi costanti in ogni scenario." },
      { t: "Costruire 4 scenari", d: "1) condizioni attuali; 2) fecondità del Trentino-Alto Adige, la più alta d'Italia; 3) popolazione aperta con i tassi migratori del Canada, modello di immigrazione giovane e qualificata; 4) azzeramento delle morti per cause esterne." },
      { t: "Tavole a causa eliminata", d: "Per lo scenario 4: tavole di mortalità regionali generali e cause-deleted, stimando le morti per causa con i rapporti per età della macroarea di riferimento." }
    ],
    methods: ["Componenti per coorte", "Tavole di mortalità", "Cause-deleted life tables", "Popolazioni aperte e chiuse", "Analisi per scenari"],
    software: ["R"],
    results: [
          {
                "n": "≈ 2×",
                "t": "Nello scenario base l'indice di ricambio (IRPA) si stabilizza vicino al doppio della parità in Emilia-Romagna e oltre il doppio in Molise: per ogni persona che entra in età lavorativa quasi due ne escono."
          },
          {
                "n": "1,4 → 1,7",
                "t": "Indice di struttura del Molise tra il 2034 e il 2054: 1,7 lavoratori tra i 40 e i 64 anni per ogni 15–39enne. In Sicilia passa da 1,2 a 1,4; in Emilia-Romagna resta intorno a 1,5."
          },
          {
                "n": "≈ 50",
                "t": "Indice di dipendenza della Sicilia al 2054 con i tassi migratori canadesi, vicino alla soglia ottimale. In tutte le regioni lo scenario migratorio frena la dipendenza più degli altri nel breve e medio periodo."
          },
          {
                "n": "dal 2039",
                "t": "Con la fecondità del Trentino-Alto Adige la dipendenza prima sale (più bambini), poi i nuovi nati entrano nel mercato del lavoro: IRPA e ISPA migliorano e tornano ai livelli del 2024."
          },
          {
                "n": "≈ 0",
                "t": "Effetto dell'azzeramento delle morti per cause esterne (traumi e avvelenamenti): nessun impatto significativo sugli indici in nessuna regione."
          },
          {
                "t": "Raccomandazione per il bando: immigrazione per alleggerire subito il carico sulla popolazione attiva, sostegno alla natalità per garantire il ricambio nel lungo periodo."
          }
    ],
    limits: "Tassi costanti per trent'anni e rapporti di mortalità per causa presi dalla macroarea di riferimento, per mancanza di dati regionali del 2024.",
    links: [{ label: "Report (PDF)", href: "assets/reports/proiezioni-demografiche.pdf", kind: "pdf" }],
    map: { x: 0.62, y: 0.68 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "mighty",
    title: "Salute dei migranti in Lombardia e Marche",
    short: "Salute dei migranti",
    theme: "societa",
    start: "2025-02", end: "2025-07",
    period: "Feb – Lug 2025",
    course: "Tesi di laurea triennale e tirocinio", degree: "lt",
    kind: "Tesi · relatrice Prof.ssa Elisa Barbiano di Belgiojoso",
    team: "Progetto MIGHTY (PNRR), DISMEQ Milano-Bicocca",
    kpi: "31%", kpiLabel: "dei migranti nelle Marche che avevano bisogno di cure ha dovuto rinunciarvi",
    objective: "Studiare la salute percepita dei migranti, come cambia rispetto alla partenza, quali barriere incontrano nell'accesso alle cure e quanto fanno prevenzione, mettendo a confronto Lombardia e Marche.",
    data: "Indagine MIGHTY (novembre 2024 – febbraio 2025) su immigrati da Paesi a forte pressione migratoria, raccolta con il campionamento per centri, adatto a popolazioni senza un elenco completo. Due dataset regionali armonizzati e ponderati con i pesi campionari.",
    strategy: [
      { t: "Preparare i dati", d: "Armonizzazione e unione dei file di Lombardia e Marche, ricodifiche, nuove variabili e attivazione dei pesi campionari." },
      { t: "Salute percepita", d: "Regressione logistica ordinale (odds proporzionali) con interazione tra regione, classe d'età e anni di permanenza in Italia." },
      { t: "Cambiamento dalla partenza", d: "Matrici di transizione, diagramma di Sankey e modello GEE ordinale a misure ripetute che confronta la salute alla partenza e oggi." },
      { t: "Barriere e prevenzione", d: "Modelli logistici per la rinuncia a visite ed esami e per i controlli preventivi, stimati sul campione completo e sulla sola Lombardia, con i profili a maggiore rischio." },
      { t: "Salute dentale", d: "Un indice di salute dentale costruito ad hoc per la Lombardia e analizzato per provenienza, genere, reddito e frequenza dei controlli." }
    ],
    methods: ["Logistica ordinale", "GEE a misure ripetute", "Regressione logistica", "Pesi campionari", "Center Sampling"],
    software: ["SPSS", "R (MASS, repolr, ggplot2)", "Python (pandas)"],
    results: [
          {
                "n": "75%",
                "t": "In entrambe le regioni circa tre immigrati su quattro dichiarano una salute buona o molto buona. Il dato cala molto con l'età: nelle Marche si passa dal 91% dei 18–24enni al 44% degli over 65."
          },
          {
                "n": "< 5 anni",
                "t": "Nel modello ordinale, chi è in Italia da meno di 5 anni ha odds di buona salute significativamente più alti di chi c'è da oltre 20 (healthy migrant effect). Riducono gli odds essere donna, avere un'istruzione bassa, difficoltà economiche o essere disoccupati."
          },
          {
                "n": "34% · 39%",
                "t": "Quota che riferisce un peggioramento della salute rispetto alla partenza (Lombardia, Marche). Il modello logistico (AUC 0,72) e il GEE indicano più rischio per donne, più anziani e chi vive in Italia da più tempo: è l'exhausted migrant effect."
          },
          {
                "n": "30,9%",
                "t": "Tra chi aveva bisogno di cure, ha dovuto rinunciarvi il 30,9% nelle Marche e il 19,6% in Lombardia, contro il 3,7% degli italiani (Eurostat). In Lombardia pesano appuntamenti introvabili (74,5%) e costi (63,4%); la mancanza di informazioni sui servizi è al 27% contro il 4% delle Marche."
          },
          {
                "n": "47% · 63%",
                "t": "Prevenzione senza patologie: uomini contro donne. Cresce con gli anni di permanenza; tra gli immigrati dall'Est Europa è all'81% nelle Marche contro il 54% in Lombardia."
          },
          {
                "t": "Salute dentale: percezione complessivamente positiva e legata alla salute generale, ma molti immigrati dall'Est Europa si curano dal dentista del proprio Paese, per aggirare le barriere o per scarsa fiducia nei servizi locali."
          }
    ],
    limits: "Dati trasversali e autodichiarati. Per confrontare davvero italiani e stranieri nel tempo andrebbero integrati con i dati amministrativi sanitari regionali.",
    role: "Tirocinio al DISMEQ: pulizia e preparazione dei dati dell'indagine, analisi descrittive, stima dei modelli e collaborazione al poster presentato a PopDays 2025.",
    links: [{ label: "Tesi completa (PDF)", href: "assets/reports/tesi-triennale-mighty.pdf", kind: "pdf" }],
    map: { x: 0.56, y: 0.86 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "nigeria-sdg",
    title: "Nigeria e Agenda 2030: povertà e sviluppo sostenibile",
    short: "Nigeria & Agenda 2030",
    theme: "indici",
    start: "2025-05", end: "2025-06",
    period: "Mag – Giu 2025",
    course: "Demografia sociale", degree: "lt",
    kind: "Lavoro di gruppo · report",
    team: "Con Gilberto Lucchesi e Alessandro Magnani",
    kpi: "146°", kpiLabel: "posto al mondo nell'SDG Index (punteggio 54,6)",
    objective: "Valutare a che punto è la Nigeria rispetto ai 17 Obiettivi di Sviluppo Sostenibile e capire perché il Paese più popoloso e la prima economia petrolifera d'Africa resta intrappolato nella povertà.",
    data: "SDG Index e punteggi per obiettivo del Sustainable Development Report (2000–2024), dati della World Bank (Africa's Pulse 2025) e fonti sulla situazione economica recente.",
    strategy: [
      { t: "Quadro generale", d: "Andamento dell'SDG Index confrontato con la media dell'Africa subsahariana e con quella mondiale, e stato e trend dei 17 obiettivi." },
      { t: "Focus sul Goal 1", d: "Approfondimento su Povertà Zero, scelto perché la povertà è legata a salute, istruzione, acqua e parità di genere." },
      { t: "Leggere le serie", d: "Periodizzazione dei trend (crescita 2000–2018, poi stagnazione) e confronto tra indicatori di povertà nazionale ed estrema." },
      { t: "Collegare alle politiche", d: "Effetti delle riforme del 2023: fine dei sussidi sul carburante e liberalizzazione del naira." }
    ],
    methods: ["SDG Index", "Indicatori di povertà", "Analisi di serie storiche", "Confronti regionali"],
    software: ["R"],
    results: [
          {
                "n": "54,6",
                "t": "SDG Index della Nigeria: 146° posto al mondo e 29° nell'Africa subsahariana. Cresce fino al 2018, poi si ferma, mentre la media mondiale continua a salire."
          },
          {
                "n": "1 su 17",
                "t": "Solo il Goal 12 (consumo e produzione responsabili) risulta raggiunto. La maggior parte degli obiettivi è in rosso, con trend fermi o in peggioramento, soprattutto per povertà, fame, salute, istruzione e parità di genere."
          },
          {
                "n": "106 mln",
                "t": "Persone che vivono con meno di 2,15 $ al giorno, circa il 15% della povertà estrema mondiale. Il 40% della popolazione è sotto la soglia di povertà nazionale."
          },
          {
                "n": "2019–21",
                "t": "Biennio in cui la povertà torna a salire e il punteggio del Goal 1 crolla, probabilmente per la pandemia in un Paese dove oltre l'80% degli occupati lavora nell'informale. La proiezione ONU al 2030 risulta negativa; per una stima meno influenzata da quel crollo proponiamo modelli ARIMA."
          },
          {
                "n": "−70%",
                "t": "Svalutazione del naira dopo la liberalizzazione del 2023. Insieme alla fine dei sussidi sul carburante, con prezzi triplicati, ha portato l'inflazione alimentare oltre il 40%."
          }
    ],
    limits: "Analisi descrittiva basata su indici già costruiti. Le cause del calo del 2019–21 restano un'ipotesi da verificare.",
    links: [{ label: "Report (PDF)", href: "assets/reports/nigeria-agenda-2030.pdf", kind: "pdf" }],
    map: { x: 0.2, y: 0.44 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "nigeria-fp",
    title: "Pianificazione familiare in Nigeria",
    short: "Pianificazione familiare",
    theme: "demografia",
    start: "2025-05", end: "2025-05",
    period: "Mag 2025",
    course: "Demografia sociale", degree: "lt",
    kind: "Lavoro di coppia · presentazione",
    team: "Con Alessandro Magnani",
    kpi: "18%", kpiLabel: "di donne che usano contraccettivi, contro il 65% della media mondiale",
    objective: "Spiegare perché la fecondità nigeriana resta sopra i cinque figli per donna, analizzando l'accesso alla contraccezione e le politiche di pianificazione familiare.",
    data: "Serie storiche dal 1990 su fecondità totale, prevalenza contraccettiva per metodo e unmet need (fonti internazionali ONU e World Bank).",
    strategy: [
      { t: "Fecondità", d: "Andamento del TFT dagli anni '60: crescita fino agli anni '80, poi un calo lento." },
      { t: "Contraccezione", d: "Prevalenza totale e per tipo, metodi moderni e tradizionali, con un focus su pillola e preservativo." },
      { t: "Bisogno insoddisfatto", d: "Unmet need per contraccezione nel tempo e confronto con la media mondiale e subsahariana." },
      { t: "Politiche", d: "Obiettivi nazionali al 2030 e iniziative del settore privato (PSHAN)." }
    ],
    methods: ["Fecondità (TFT)", "Prevalenza contraccettiva", "Unmet need", "Analisi delle politiche"],
    software: ["R"],
    results: [
          {
                "n": "> 5",
                "t": "Figli per donna: in calo dagli anni '80, ma ancora molto sopra la media africana e mondiale."
          },
          {
                "n": "5% → 18%",
                "t": "Prevalenza contraccettiva dal 1990 a oggi (media mondiale circa 65%). I metodi moderni toccano il massimo nel 2019 (oltre il 17%) e scendono al 15% nel 2022; quelli tradizionali restano tra il 3% e il 6%."
          },
          {
                "n": "< 3% · < 5%",
                "t": "Uso di pillola e preservativo, frenato da resistenze culturali e religiose, soprattutto nel nord. Il preservativo è stato promosso più per prevenire l'HIV che come contraccettivo."
          },
          {
                "n": "18,9%",
                "t": "Unmet need nel 2021 (tra il 13% e il 20% negli ultimi trent'anni): in linea con l'Africa subsahariana, più del doppio della media mondiale (circa 8%) e oltre il 50% in alcune aree del nord."
          },
          {
                "n": "27%",
                "t": "Obiettivo di prevalenza contraccettiva moderna al 2030. Il piano destina l'1% del bilancio sanitario alla salute riproduttiva e i progetti PSHAN puntano a servizi integrati in tutti i 774 distretti."
          }
    ],
    links: [{ label: "Presentazione (PDF)", href: "assets/reports/nigeria-pianificazione-familiare.pdf", kind: "pdf" }],
    map: { x: 0.12, y: 0.8 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "nigeria-transizione",
    title: "Nigeria: un gigante demografico in transizione",
    short: "Transizione in Nigeria",
    theme: "demografia",
    start: "2025-04", end: "2025-05",
    period: "Apr – Mag 2025",
    course: "Demografia sociale", degree: "lt",
    kind: "Lavoro di coppia · presentazione",
    team: "Con Alessandro Magnani",
    kpi: "375 mln", kpiLabel: "abitanti previsti in Nigeria entro il 2050",
    objective: "Ricostruire in quale fase della transizione demografica si trova la Nigeria e cosa implica per il suo futuro, collegando i numeri al contesto economico e sociale.",
    data: "Serie 1960–2023 di natalità, mortalità, crescita, speranza di vita, dipendenza e urbanizzazione (World Bank DataBank, Our World in Data), più le proiezioni ONU.",
    strategy: [
      { t: "Struttura per età", d: "Piramidi delle età animate dal 1960 a oggi per mostrare quanto la popolazione sia giovane." },
      { t: "Fasi della transizione", d: "Lettura congiunta di tassi di natalità, mortalità e incremento naturale in tre periodi: 1960–80, 1980–2000 e 2000–2023." },
      { t: "Indicatori collegati", d: "Speranza di vita, indice di dipendenza, urbanizzazione e mortalità, fecondità e partecipazione femminile." },
      { t: "Scenari futuri", d: "Proiezioni di popolazione e confronto con Paesi che hanno già completato la transizione." }
    ],
    methods: ["Transizione demografica", "Piramidi delle età", "Tassi grezzi", "Indice di dipendenza", "Proiezioni"],
    software: ["R"],
    results: [
          {
                "n": "3,12%",
                "t": "Picco della crescita annua nel 1980: la natalità è al massimo (49‰ nel 1978) e la mortalità scende da 26‰ a 19,5‰. È la seconda fase della transizione."
          },
          {
                "n": "26 → 12‰",
                "t": "Mortalità tra il 1960 e il 2023. La natalità cala davvero solo dal 2010 (33‰ nel 2023): la Nigeria entra ora nella terza fase."
          },
          {
                "n": "35 → 55",
                "t": "Anni di speranza di vita dal 1960 a oggi, con un salto di dieci anni in due decenni, più rapido che nei Paesi europei, ma ancora dieci anni sotto la media africana."
          },
          {
                "n": "> 90",
                "t": "Indice di dipendenza nel 1980: oltre 90 persone a carico ogni 100 in età lavorativa, quasi tutte bambini. Finché resta così alto il dividendo demografico è fuori portata."
          },
          {
                "n": "7,5 · 2,9",
                "t": "Figli per donna negli stati di Yobe (nord) e Rivers (sud). Il TFT nazionale è sceso da 5,7 (2008) a 4,8 (2023), ma con divari enormi; usa contraccettivi il 20% delle donne sposate, mentre il 41% vorrebbe limitare le nascite."
          },
          {
                "n": "3,1",
                "t": "Figli per donna previsti al 2040, ancora lontani dal livello di sostituzione (2,1): la popolazione supererà i 375 milioni entro il 2050."
          }
    ],
    links: [{ label: "Presentazione (PDF)", href: "assets/reports/nigeria-transizione-demografica.pdf", kind: "pdf" }],
    map: { x: 0.15, y: 0.62 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "carclaims",
    title: "Car Claims: riconoscere le frodi assicurative",
    short: "Frodi assicurative",
    theme: "ml",
    start: "2025-01", end: "2025-02",
    period: "Gen – Feb 2025",
    course: "Data Mining e Machine Learning", degree: "lt",
    kind: "Lavoro di gruppo",
    team: "Con D'Angelo, Lucchesi, Vitolla",
    kpi: "6%", kpiLabel: "di frodi tra 15.420 sinistri: classi molto sbilanciate",
    objective: "Costruire un modello predittivo che riconosca le richieste di risarcimento auto fraudolente a partire dalle informazioni sul sinistro, sull'assicurato e sulla polizza.",
    data: "Dataset Carclaims: 15.420 sinistri (14.497 legittimi e 923 fraudolenti) con 32 covariate categoriali e numeriche e la variabile target FraudFound.",
    strategy: [
      { t: "Pulire", d: "Eliminazione delle variabili a varianza quasi nulla (near-zero variance), come franchigia e presenza di testimoni." },
      { t: "Dividere", d: "Partizione in training (63%), test (32%) e score (5%), con il set di score tenuto da parte fino alla fine." },
      { t: "Bilanciare e selezionare", d: "Oversampling con ROSE fino al 50/50 sul training e selezione delle variabili con Boruta (15 variabili sopra l'importanza media)." },
      { t: "Addestrare 9 modelli", d: "Logistico, KNN, PLS, rete neurale, lasso, naive Bayes, albero, random forest e gradient boosting, ottimizzati sull'AUC e con preprocessing specifico (Box-Cox, standardizzazione, collinearità)." },
      { t: "Valutare e scegliere la soglia", d: "Controllo dell'overfitting con l'ASE, curve ROC e lift con probabilità a posteriori corrette per il bilanciamento, confronto al terzo decile e soglia scelta massimizzando l'F1." }
    ],
    methods: ["Near-zero variance", "ROSE", "Boruta", "Gradient boosting", "Random forest", "Curve ROC e lift", "Soglia F1"],
    software: ["R"],
    results: [
          {
                "n": "15",
                "t": "Variabili più importanti della media secondo Boruta, tra cui responsabilità del sinistro, età, marca e prezzo del veicolo, tipo di polizza e calendario del sinistro."
          },
          {
                "n": "3 su 9",
                "t": "Modelli ancora in overfitting anche dopo aver ridotto la complessità: KNN, albero e random forest (controllo sull'ASE)."
          },
          {
                "n": "Boosting",
                "t": "Le curve ROC non bastavano per scegliere, quindi abbiamo usato le curve lift con le probabilità corrette per il bilanciamento ROSE: al terzo decile il gradient boosting ha il cumulative gain più alto."
          },
          {
                "n": "0,25",
                "t": "Soglia che massimizza l'F1. Sul set di score, mai usato prima, il modello ottiene precision 0,17 e F1 0,19."
          }
    ],
    limits: "Il modello finale non è soddisfacente e lo abbiamo detto chiaramente: con il 6% di frodi e queste covariate, anche il classificatore migliore produce molti falsi positivi.",
    links: [
      { label: "Report (PDF)", href: "assets/reports/carclaims-report.pdf", kind: "pdf" },
      { label: "Schema della pipeline (PDF)", href: "assets/reports/carclaims-pipeline.pdf", kind: "pdf" }
    ],
    map: { x: 0.92, y: 0.12 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "orim",
    title: "Vent'anni di immigrazione in Lombardia",
    short: "Immigrazione in Lombardia",
    theme: "demografia",
    start: "2024-11", end: "2024-12",
    period: "Nov – Dic 2024",
    course: "Demografia sociale", degree: "lt",
    kind: "Elaborato di gruppo · presentazione",
    team: "Elaborato di gruppo",
    kpi: "2001–21", kpiLabel: "indagini ORIM sulla popolazione con background straniero",
    objective: "Descrivere come è cambiata in vent'anni la popolazione con background migratorio in Lombardia: chi è, da dove viene, come vive e quanto è integrata.",
    data: "Indagini ORIM 2001–2021 su adulti con background straniero, provenienti da Paesi a forte pressione migratoria e intervistati in Lombardia.",
    strategy: [
      { t: "Caratteristiche demografiche", d: "Rapporto di mascolinità, piramidi delle età, Paesi di origine e strutture familiari nel tempo." },
      { t: "Lavoro", d: "Evoluzione della condizione professionale." },
      { t: "Integrazione", d: "Costruzione e lettura di uno o più indicatori di integrazione." }
    ],
    methods: ["Rapporto di mascolinità", "Piramidi delle età", "Indicatori di integrazione", "Analisi descrittiva"],
    software: ["R"],
    results: [
          {
                "n": "1,57 → 0,96",
                "t": "Rapporto di mascolinità (uomini per ogni donna) tra il picco del 2002 e il 2017: un'immigrazione nata soprattutto maschile si femminilizza e scende sotto la parità."
          },
          {
                "n": "2,5 → 1,2",
                "t": "Le provenienze africane restano le più maschili ma convergono. L'Asia è stabile intorno a 1,4; Europa e Americhe sono a prevalenza femminile (0,5–0,7), un segnale del peso del lavoro di cura."
          },
          {
                "t": "Il resto dell'elaborato (piramidi, Paesi di origine, famiglie, lavoro e integrazione) era nella presentazione, che non è online. È il primo progetto sulle migrazioni, un tema che ritorna nella tesi triennale e in quella magistrale."
          }
    ],
    figures: [
          {
                "src": "assets/img/orim-mascolinita-totale.png",
                "cap": "Rapporto di mascolinità totale, 2001–2017"
          },
          {
                "src": "assets/img/orim-mascolinita-continenti.png",
                "cap": "Rapporto di mascolinità per continente di origine"
          }
    ],
    links: [],
    map: { x: 0.06, y: 0.93 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "raccolto",
    title: "Resa agricola: dal modello lineare al logistico",
    short: "Resa agricola",
    theme: "modelli",
    start: "2024-10", end: "2024-11",
    period: "Ott – Nov 2024",
    course: "Data Mining e Machine Learning", degree: "lt",
    kind: "Lavoro di gruppo",
    team: "Con D'Angelo, Lucchesi, Vitolla",
    kpi: "R² 0,48 → 0,93", kpiLabel: "migliorando il modello lineare un passo alla volta",
    objective: "Spiegare la resa di un raccolto (kg) a partire dalle pratiche colturali e dai fertilizzanti usati, costruendo un modello lineare che rispetti tutte le assunzioni, e poi passare a un modello di classificazione.",
    data: "Dataset di produzione agricola con variabile risposta continua (raccolto in kg), covariate sulle pratiche colturali e sui fertilizzanti (per esempio NPKS e SSP) e valori mancanti non MCAR.",
    strategy: [
      { t: "Preparare", d: "Ridenominazione e creazione di variabili, imputazione dei mancanti con MICE, collinearità controllata con VIF e TOL." },
      { t: "Linearità", d: "Box-Cox sulla risposta (λ = 0,3, poi log) e trasformazioni delle covariate suggerite da un GAM, con RESET test." },
      { t: "Punti influenti e selezione", d: "Rimozione delle osservazioni oltre la soglia della distanza di Cook e selezione stepwise con BIC." },
      { t: "Eteroschedasticità", d: "Test di Breusch-Pagan e White, una iterazione IRLS, errori standard di White e bootstrap per la robustezza dei coefficienti." },
      { t: "Versione binaria", d: "Raccolto sopra o sotto la mediana (425 kg): regressione logistica con selezione AIC, interazione NPKS × SSP, GAM e rimozione dei punti influenti (DiffChiSq)." }
    ],
    methods: ["Regressione lineare", "MICE", "VIF / TOL", "Box-Cox", "GAM", "Distanza di Cook", "IRLS", "Bootstrap", "Regressione logistica"],
    software: ["R"],
    results: [
          {
                "n": "0,48 → 0,73",
                "t": "R² del modello lineare passando al logaritmo della risposta (Box-Cox) e alle trasformazioni delle covariate suggerite dal GAM: linearità migliore e meno eteroschedasticità."
          },
          {
                "n": "0,93",
                "t": "R² dopo aver rimosso i punti influenti con la distanza di Cook. Il RESET test non rifiuta più la corretta specificazione e la selezione con BIC non toglie potere esplicativo."
          },
          {
                "n": "1 IRLS",
                "t": "Basta un'iterazione IRLS perché il test di White non rifiuti l'omoschedasticità (la seconda peggiora). Inferenza con errori standard di White e coefficienti confermati dagli intervalli bootstrap."
          },
          {
                "n": "AUC 0,911",
                "t": "Modello logistico (raccolto sopra o sotto la mediana di 425 kg): da AUC 0,875 e accuratezza 0,787 del modello pieno a 0,911 e 0,818 dopo il GAM e la rimozione dei punti influenti (DiffChiSq), con lo pseudo-R² da 0,36 a 0,48."
          },
          {
                "n": "OR 94",
                "t": "L'odds ratio dell'interazione tra i fertilizzanti NPKS e SSP sembra enorme ma non è significativo: solo due casi li usano entrambi."
          }
    ],
    links: [{ label: "Report (DOCX)", href: "assets/reports/resa-agricola-modelli.docx", kind: "doc" }],
    map: { x: 0.56, y: 0.2 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "diabete",
    title: "Rischio di diabete e stili di vita",
    short: "Rischio diabete",
    theme: "dm",
    start: "2026-08", end: "2026-09",
    period: "Ago – Set 2026",
    course: "Analisi dei dati (Data mining)", degree: "lm",
    kind: "Esercitazione su prova d'esame (30/06/2023)",
    team: "Lavoro individuale",
    kpi: "13%", kpiLabel: "di diabetici: la sfida è non ignorare la classe rara",
    objective: "Capire se consumo di frutta e verdura e attività fisica sono fattori di rischio per il diabete negli adulti, e prevedere la probabilità che un individuo sia diabetico.",
    data: "Behavioral Risk Factor Surveillance System 2015 del CDC: 374.441 adulti statunitensi intervistati per telefono. Variabili selezionate: frutta, verdura, alcol, fumo, BMI, attività fisica, sesso, stato civile e istruzione.",
    strategy: [
      { t: "Preparare", d: "Selezione delle variabili, ricodifica dei fattori e trattamento di “non sa / non risponde” come mancanti mascherati, non come categorie informative." },
      { t: "Dividere senza mescolare", d: "75% stima e 25% verifica; la stima è a sua volta divisa in cb1/cb2 per il tuning, così la verifica resta intatta fino al confronto finale." },
      { t: "Confrontare molti modelli", d: "Logistica con stepwise, LDA e QDA, lasso e ridge (CV a 10 fold), GAM con scelta stepwise dei gradi di libertà, PolyMARS, albero potato, AdaBoost e random forest." },
      { t: "Scegliere la soglia", d: "Con il 13% di positivi la soglia 0,5 premia chi non trova nessun caso: la soglia ottimale per l'F1 è scelta su cb1/cb2, senza data leakage." },
      { t: "Valutare le probabilità", d: "Curve lift e ROC e calibration plot per verificare che le probabilità stimate siano affidabili." }
    ],
    methods: ["Logistica", "LDA / QDA", "Lasso e ridge", "GAM", "PolyMARS", "AdaBoost", "Random forest", "Soglia F1", "Calibrazione"],
    software: ["R (glmnet, gam, polspline, ada, ranger)"],
    results: [
      "La leaderboard a soglia fissa mostra perché l'errore di classificazione è una metrica fuorviante con classi sbilanciate. La leaderboard finale, con soglie ottimizzate per ogni modello, confronta i modelli su F1, falsi positivi e falsi negativi.",
      "L'esercizio è utile soprattutto come pipeline riutilizzabile e senza leakage per problemi di classificazione con eventi rari."
    ],
    links: [{ label: "Codice R", href: "assets/code/diabete.R", kind: "code" }],
    map: { x: 0.8, y: 0.62 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "bici",
    title: "Bike sharing a Washington: prevedere la domanda",
    short: "Bike sharing",
    theme: "dm",
    start: "2026-08", end: "2026-08",
    period: "Ago 2026",
    course: "Analisi dei dati (Data mining)", degree: "lm",
    kind: "Esercitazione su prova d'esame (27/08/2024)",
    team: "Lavoro individuale",
    kpi: "3,5 mln", kpiLabel: "noleggi Capital Bikeshare nel 2022",
    objective: "Prevedere il numero di noleggi nelle stazioni di Capital Bikeshare (Washington DC), capire in quali condizioni meteo servono più bici e stimare il fabbisogno giornaliero per tipo di bici e tipo di cliente.",
    data: "Noleggi 2022 aggregati per stazione di partenza, data, ora, tipo di bici (classica, docked, elettrica) e tipo di cliente, più i dati meteo giornalieri (temperatura percepita, umidità, precipitazioni, vento…).",
    strategy: [
      { t: "Preparare", d: "Unione di noleggi e meteo per data, ore raggruppate in quattro fasce ([0,6), [6,12), [12,18), [18,24)) e imputazione dei mancanti." },
      { t: "Dividere", d: "70% stima e 30% verifica; la stima è divisa in cb1/cb2 per scegliere gli iperparametri fuori campione." },
      { t: "Confrontare i modelli", d: "Lineare e stepwise (AIC), lasso con λ scelto sul MSE, MARS potato su cb2, albero di regressione potato, bagging e random forest con mtry scelto sull'errore out-of-bag." },
      { t: "Classifica finale", d: "Tutti i modelli valutati sull'insieme di verifica con MSE e MAE." },
      { t: "Dal modello alla gestione", d: "Previsioni orarie del modello migliore sommate per giorno, tipo di bici e tipo di cliente per stimare il fabbisogno di ogni stazione; effetti meteo letti con i grafici parziali del MARS." }
    ],
    methods: ["Feature engineering", "Stepwise AIC", "Lasso", "MARS", "Alberi di regressione", "Bagging", "Random forest", "Errore OOB"],
    software: ["R (glmnet, earth, tree, ipred, ranger, tidyverse)"],
    results: [
      "Il risultato è una pipeline completa, dalla domanda aziendale alla previsione del fabbisogno giornaliero per stazione, con un confronto onesto tra modelli su dati mai usati per la stima.",
      "Il MARS rende leggibile l'effetto di temperatura percepita e umidità sulla domanda."
    ],
    links: [{ label: "Codice R", href: "assets/code/bici.R", kind: "code" }],
    map: { x: 0.86, y: 0.36 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "case",
    title: "Case a Milano: prezzi per 145 zone",
    short: "Case a Milano",
    theme: "dm",
    start: "2026-08", end: "2026-08",
    period: "Ago 2026",
    course: "Analisi dei dati (Data mining)", degree: "lm",
    kind: "Esercitazione su prova d'esame (17/07/2024)",
    team: "Lavoro individuale",
    kpi: "145", kpiLabel: "zone di Milano, alcune con pochissimi annunci",
    objective: "Prevedere il prezzo di vendita delle case a Milano in funzione delle loro caratteristiche, con previsioni affidabili anche per le zone in cui gli annunci sono pochissimi.",
    data: "12.800 annunci Immobiliare.it: metri quadrati, stanze, bagni, piano, ascensore, classe energetica, condizioni, anno di costruzione, riscaldamento, parcheggio, una descrizione testuale e la zona (145 in tutto).",
    strategy: [
      { t: "Estrarre dal testo", d: "Variabili 0/1 ricavate dalle descrizioni (fibra ottica, porta di sicurezza, …)." },
      { t: "Ricodificare", d: "Mancanti trattati come categoria “missing”, piani raggruppati in classi, piani dell'edificio in fasce." },
      { t: "Confrontare i modelli", d: "Lineare, stepwise, lasso, MARS, albero e random forest, con le zone ricodificate per i modelli ad albero (oltre 32 livelli)." },
      { t: "Partial pooling per zona", d: "Modello a effetti misti con intercetta casuale per zona (1 | zona): ogni quartiere riceve un premio o uno sconto sul prezzo, al netto delle altre caratteristiche." },
      { t: "Leggere lo shrinkage", d: "Effetto di zona confrontato con il numero di annunci: le zone con 2–3 osservazioni vengono attratte verso la media cittadina." }
    ],
    methods: ["Text features", "Lasso", "MARS", "Random forest", "Modelli a effetti misti", "Partial pooling"],
    software: ["R (lme4, glmnet, earth, tree, ranger, tidyverse)"],
    results: [
      "Il modello misto risponde alla richiesta principale: una stima del prezzo in ogni zona, anche dove i dati sono pochi, senza i valori estremi che darebbe una stima separata per zona.",
      "Il grafico dello shrinkage mostra in modo chiaro il compromesso tra la media di zona e quella cittadina."
    ],
    links: [{ label: "Codice R", href: "assets/code/casemilano.R", kind: "code" }],
    map: { x: 0.74, y: 0.05 }
  },
  /* ------------------------------------------------------------------ */
  {
    id: "uganda",
    title: "Punti d'acqua in Uganda: funzionano ancora?",
    short: "Acqua in Uganda",
    theme: "dm",
    start: "2026-08", end: "2026-08",
    period: "Ago 2026",
    course: "Analisi dei dati (Data mining)", degree: "lm",
    kind: "Esercitazione su prova d'esame (26/06/2024)",
    team: "Lavoro individuale",
    kpi: "9", kpiLabel: "classificatori confrontati sullo stato dei punti d'acqua",
    objective: "Prevedere lo stato dei punti d'acqua rurali in Uganda (funzionante, da riparare, non funzionante, abbandonato, …) per aiutare a decidere quali riparare per primi.",
    data: "Water Point Data Exchange (WPdx): tutti i punti d'acqua condivisi in Uganda (pozzi, sorgenti, rubinetti), con dati su tecnologia, gestione, popolazione servita e anno di installazione.",
    strategy: [
      { t: "Pulire", d: "Eliminazione di identificativi, testi e variabili ridondanti o successive all'esito, e imputazione con la mediana di popolazione, capacità e anno di installazione." },
      { t: "Creare indicatori", d: "Criticità (popolazione assegnata su popolazione locale) e pressione (popolazione assegnata su capacità d'uso) di ogni punto d'acqua." },
      { t: "Dividere", d: "75% stima e 25% verifica, con split interno cb1/cb2 (70/30) per il tuning." },
      { t: "Confrontare 9 classificatori", d: "Multinomiale con stepwise AIC, LDA, lasso multinomiale, albero (rpart), MARS, bagging, boosting (adabag), SVM radiale e random forest, ognuno con il proprio iperparametro scelto su cb1/cb2." },
      { t: "Valutare", d: "Matrice di confusione multiclasse e tasso d'errore sull'insieme di verifica." }
    ],
    methods: ["Classificazione multiclasse", "Feature engineering", "Lasso multinomiale", "MARS", "Bagging e boosting", "SVM", "Random forest"],
    software: ["R (nnet, MASS, glmnet, rpart, earth, ipred, adabag, e1071, ranger)"],
    results: [
      "Il risultato è un confronto sistematico di nove famiglie di modelli su un problema concreto, in cui prevedere un guasto prima che venga segnalato può cambiare l'accesso all'acqua di intere comunità.",
      "Gli indicatori di pressione e criticità traducono la logistica del servizio in variabili utili al modello."
    ],
    links: [{ label: "Codice R", href: "assets/code/uganda.R", kind: "code" }],
    map: { x: 0.9, y: 0.55 }
  }
];

/* Collegamenti tra progetti (usati nella modalità Grafo) */
const LINKS = [
  ["nigeria-transizione", "nigeria-fp", "Nigeria"],
  ["nigeria-transizione", "nigeria-sdg", "Nigeria"],
  ["nigeria-fp", "nigeria-sdg", "Nigeria"],
  ["orim", "mighty", "migranti in Lombardia"],
  ["mighty", "tesi-magistrale", "migrazioni"],
  ["orim", "tesi-magistrale", "migrazioni"],
  ["proiezioni", "tesi-magistrale", "dinamiche di popolazione"],
  ["proiezioni", "nigeria-transizione", "proiezioni"],
  ["mighty", "specchio", "survey e modelli ordinali"],
  ["specchio", "flegrei", "stesso corso, dati survey"],
  ["flegrei", "ipog", "stesso corso"],
  ["mighty", "flegrei", "salute e percezione"],
  ["ipog", "nigeria-sdg", "indici compositi"],
  ["carclaims", "diabete", "classi sbilanciate, soglia F1"],
  ["carclaims", "raccolto", "stesso corso"],
  ["diabete", "uganda", "classificazione"],
  ["bici", "case", "regressione, MARS e RF"],
  ["bici", "uganda", "ensemble"],
  ["raccolto", "case", "modelli lineari"],
  ["raccolto", "diabete", "GAM e logistica"],
  ["mighty", "diabete", "salute"]
];
