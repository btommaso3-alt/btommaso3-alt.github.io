# ============================================================================
#   PIPELINE DI ANALISI - CLASSIFICAZIONE BINARIA (rischio diabete)
# ============================================================================
#
# OBIETTIVO
#   Prevedere la probabilita' che un individuo sia diabetico (y = 1) a
#   partire da variabili comportamentali/socio-demografiche (alimentazione,
#   fumo, alcol, BMI, attivita' fisica, sesso, stato civile, istruzione),
#   confrontando piu' famiglie di modelli e selezionando quella con il
#   miglior compromesso errore/interpretabilita'.
#
# STRATEGIA GENERALE
#   1. PREPARAZIONE DATI: selezione delle variabili, ricodifica dei
#      fattori, trattamento delle categorie "non sa/non risponde" /
#      "rifiuta la risposta" come valori mancanti mascherati (ricodificate
#      a NA e rimosse con na.omit, non trattate come categorie
#      informative), rimozione dei livelli di fattore rimasti vuoti
#      (droplevels) per evitare colonne fantasma in model.matrix.
#
#   2. SPLIT: quattro ruoli distinti dei dati, MAI mescolati tra loro:
#        - id_stima    (75% del totale) -> stima finale di ogni modello
#        - id_verifica (25% del totale) -> valutazione onesta e confronto
#                                           finale tra tutti i modelli
#        - cb1/cb2 (sotto-split di id_stima, 75/25) -> usati SIA per il
#          tuning degli iperparametri SIA per il tuning della soglia di
#          classificazione (sezione 15), cosi' che id_verifica resti
#          "vergine" fino al confronto finale.
#
#   3. Ogni modello segue lo stesso schema in 4 passi:
#        (a) TUNING IPERPARAMETRI: scelti valutando l'errore su cb2 dopo
#            aver stimato il modello su cb1 (dove il modello lo richiede).
#            Gli iperparametri ottimi vengono salvati nella lista hp[[]],
#            cosi' da poterli riusare in sezione 15 anche dopo i vari
#            rm() di pulizia di fine sezione;
#        (b) RISTIMA: il modello con gli iperparametri ottimi viene
#            ristimato su tutto id_stima (piu' dati = stima piu' stabile);
#        (c) VALUTAZIONE: previsione e calcolo degli errori su
#            id_verifica (soglia di default 0.5), mai usato prima in
#            nessuna fase di tuning;
#        (d) REGISTRAZIONE: la previsione viene salvata in
#            lista_previsioni per il confronto finale.
#
#   4. LEADERBOARD (soglia 0.5): tutte le previsioni su id_verifica
#      vengono valutate con la stessa metrica (fun.errori) e ordinate per
#      errore di classificazione crescente. NOTA: con una prevalenza
#      della classe positiva del ~13%, questa leaderboard tende a
#      premiare modelli che non individuano quasi nessun caso positivo
#      (vedi commento in sezione 14).
#
#   5. TUNING DELLA SOGLIA (sezione 15): per ciascun modello, la soglia
#      di classificazione ottima (che massimizza l'F1-score) viene
#      scelta rifittando il modello su SOLO cb1 e valutando su cb2 -
#      MAI su id_verifica, per evitare data leakage nella scelta della
#      soglia. La soglia trovata viene poi applicata, a valle, alle
#      previsioni gia' calcolate dal modello finale (fit su id_stima)
#      sull'insieme id_verifica, producendo una leaderboard finale
#      "a soglia ottimizzata" per ogni modello.
#
# DETTAGLIO STIMA / TUNING / VALIDAZIONE PER MODELLO
#
#   - Regressione logistica: stima completa (tutte le variabili) su
#     id_stima; selezione delle variabili con step() backward (AIC).
#
#   - LDA / QDA: stima diretta su id_stima (LDA via model.matrix, QDA via
#     formula). Nessun iperparametro.
#
#   - Lasso / Ridge (glmnet): lambda tunato con cv.glmnet (10-fold CV
#     interna su id_stima). Modello finale con lambda.min. Richiedono
#     model.matrix.
#
#   - GAM: selezione stepwise dei gradi di liberta' delle spline
#     (df = 2/3/4) via step.Gam() a partire dal modello nullo. NOTA: lo
#     scope di step.Gam() qui costruito include solo le variabili
#     numeriche; le variabili categoriali (SEX, MARITAL, X_EDUCAG,
#     X_SMOKER3, X_TOTINDA) non vengono considerate come possibili
#     termini del modello. E' una limitazione nota di questa
#     implementazione (non corretta in questa versione, su richiesta,
#     ma segnalata perche' probabile concausa delle scarse prestazioni
#     del GAM in leaderboard).
#
#   - MARS (polymars): stima su cb1, con cb2 come insieme di arresto
#     anticipato. Richiede model.matrix.
#
#   - Albero (tree): albero massimale su cb1, potato scegliendo il
#     numero di foglie che minimizza l'errore su cb2, poi riapplicato a
#     un albero massimale ristimato su tutto id_stima.
#
#   - Bagging (ipred): tuning di nbagg su cb1/cb2.
#
#   - Boosting (ada): tuning di n.iter su cb1/cb2.
#
#   - Random Forest (ranger): tuning di mtry (num.trees fisso) su
#     cb1/cb2.
#
#   - SVM (e1071, radiale): tuning del costo su cb1/cb2.
#
# METRICHE
#   tabella.sommario() / fun.errori(): errore totale, falsi positivi,
#   falsi negativi, F1-score. lift.roc(): curva di lift e curva ROC.
#   metriche_soglia(): le stesse metriche calcolate su una griglia di
#   soglie di classificazione (sezione 15).
# ============================================================================


# ============================================================================
# 0. SETUP GENERALE
# ============================================================================

rm(list = ls())
gc()
set.seed(2024)

message(">>> [SETUP] Caricamento librerie necessarie...")

pkgs <- c("MASS", "glmnet", "gam", "polspline", "tree", "ipred", "ada",
          "ranger", "e1071", "skimr", "dplyr")

for (p in pkgs) {
  if (!requireNamespace(p, quietly = TRUE)) install.packages(p, dependencies = TRUE)
  suppressPackageStartupMessages(library(p, character.only = TRUE))
}

message(">>> [SETUP] Librerie caricate con successo.\n")


# ============================================================================
# 1. FUNZIONI PERSONALIZZATE DI VALUTAZIONE
# ============================================================================

# ---- 1.1 tabella.sommario --------------------------------------------------
tabella.sommario <- function(previsti, osservati) {
  n <- table(previsti, osservati)
  err.tot <- 1 - sum(diag(n)) / sum(n)
  fn <- n[1, 2] / (n[1, 2] + n[2, 2])
  fp <- n[2, 1] / (n[1, 1] + n[2, 1])
  print(n)
  cat("errore totale: ", format(err.tot), "\n")
  cat("falsi positivi & falsi negativi: ", format(c(fp, fn)), "\n")
  invisible(n)
}

# ---- 1.2 fun.errori ---------------------------------------------------
# Normalizza SEMPRE "osservati" a 0/1 in modo esplicito, qualunque sia il
# tipo in ingresso (factor "FALSE"/"TRUE", logical, o gia' 0/1). Questo
# evita il bug gia' incontrato in precedenza, in cui as.numeric() su un
# fattore con livelli "FALSE"/"TRUE" restituiva il CODICE del livello
# (1/2) invece del valore booleano (0/1).
fun.errori <- function(previsti, osservati) {
  if (is.factor(osservati))  osservati <- osservati == "TRUE"
  osservati <- as.numeric(osservati)
  
  pr_f   <- factor(previsti,  levels = c(FALSE, TRUE))
  true_f <- factor(osservati, levels = c(0, 1))
  tabella <- table(pr_f, true_f)
  tabella <- matrix(tabella, nrow = 2, ncol = 2,
                    dimnames = list(c("FALSE", "TRUE"), c("0", "1")))
  c("ce" = 1 - sum(diag(tabella)) / sum(tabella),
    "fp" = tabella[2, 1] / (tabella[1, 1] + tabella[2, 1]),
    "fn" = tabella[1, 2] / (tabella[1, 2] + tabella[2, 2]),
    "F1" = 2 * tabella[2, 2] / (2 * tabella[2, 2] + tabella[2, 1] + tabella[1, 2]))
}

# ---- 1.3 ec -------------------------------------------------------------
ec <- function(previsti, osservati) {
  tmp <- table(previsti, osservati)
  1 - sum(diag(tmp)) / sum(tmp)
}

# ---- 1.4 estrai_prob -----------------------------------------------------
estrai_prob <- function(x) {
  if (inherits(x, "ranger.prediction")) return(x$predictions[, 2])
  if (is.matrix(x) && ncol(x) == 2)     return(x[, 2])
  if (is.matrix(x))                      return(as.vector(x[, 1]))
  return(as.vector(x))
}

# ---- 1.5 lift.roc ----------------------------------------------------------
# Nota d'uso: passare SEMPRE il fattore originale (es. dati$y[id_verifica])
# come "osservati": la conversione a 0/1 e' gestita internamente.
lift.roc <- function(previsti, osservati, titolo = "", plot.it = TRUE) {
  osservati <- as.numeric(as.factor(osservati)) - 1
  
  ok <- complete.cases(previsti, osservati)
  n_scartate <- sum(!ok)
  if (n_scartate > 0) {
    warning(n_scartate, " osservazioni con NA sono state escluse dal calcolo di lift.roc",
            " (probabile causa: valori mancanti/livelli non gestiti dal modello).")
  }
  previsti  <- previsti[ok]
  osservati <- osservati[ok]
  
  ord <- order(previsti, decreasing = TRUE)
  osservati_ord <- osservati[ord]
  
  n          <- length(osservati)
  n_pos_tot  <- sum(osservati == 1)
  prevalenza <- n_pos_tot / n
  
  frac_soggetti <- (1:n) / n
  pos_cumulati  <- cumsum(osservati_ord)
  lift          <- (pos_cumulati / (1:n)) / prevalenza
  
  sensib   <- pos_cumulati / n_pos_tot
  fp_cum   <- cumsum(1 - osservati_ord)
  specif_c <- fp_cum / (n - n_pos_tot)
  
  if (plot.it) {
    op <- par(mfrow = c(1, 2))
    plot(frac_soggetti, lift, type = "l", lwd = 2, col = "steelblue",
         xlab = "Frazione di soggetti previsti",
         ylab = "Fattore di miglioramento (lift)",
         main = paste("Curva di Lift", titolo))
    abline(h = 1, lty = 2, col = "gray50")
    
    plot(specif_c, sensib, type = "l", lwd = 2, col = "tomato",
         xlab = "1 - specificita'", ylab = "sensibilita'",
         main = paste("Curva ROC", titolo), xlim = c(0, 1), ylim = c(0, 1))
    abline(0, 1, lty = 2, col = "gray50")
    par(op)
  }
  
  invisible(list(frac_soggetti = frac_soggetti, lift = lift,
                 specif_c = specif_c, sensib = sensib))
}

# ---- 1.6 scala_su_train ----------------------------------------------------
scala_su_train <- function(dataset_completo, indice_train) {
  dataset_completo <- as.data.frame(dataset_completo)
  col_numeriche <- sapply(dataset_completo, is.numeric)
  dati_train_num <- dataset_completo[indice_train, col_numeriche, drop = FALSE]
  medie_train <- colMeans(dati_train_num, na.rm = TRUE)
  sd_train    <- apply(dati_train_num, 2, sd, na.rm = TRUE)
  dataset_scalato <- dataset_completo
  matrice_scalata <- scale(dataset_completo[, col_numeriche, drop = FALSE],
                           center = medie_train, scale = sd_train)
  dataset_scalato[, col_numeriche] <- as.data.frame(matrice_scalata)
  dataset_scalato
}

# ---- 1.7 funzione_finale ---------------------------------------------------
funzione_finale <- function(dati,
                            perc_stima = 0.75,
                            perc_rib   = 0.5,
                            target     = "y",
                            ribilancia = TRUE,
                            cv = FALSE,
                            k  = 4) {
  y           <- dati[[target]]
  n           <- nrow(dati)
  id_stima    <- sample(n, floor(perc_stima * n))
  id_verifica <- setdiff(1:n, id_stima)
  
  if (ribilancia) {
    mm       <- id_stima[y[id_stima] == 1]
    vv       <- sample(id_stima[y[id_stima] == 0],
                       round(length(mm) * (1 - perc_rib) / perc_rib))
    id_stima <- c(mm, vv)
  }
  
  if (!cv) return(list(id_stima = id_stima, id_verifica = id_verifica))
  
  n_trim   <- floor(length(id_stima) / k) * k
  cv_id_sb <- matrix(sample(id_stima, n_trim), ncol = k)
  
  if (!ribilancia) {
    return(list(id_stima = id_stima, id_verifica = id_verifica, cv_id_sb = cv_id_sb))
  }
  
  dim_cv <- round(min(sapply(1:k, function(i) sum(y[cv_id_sb[, i]] == 1))) / perc_rib)
  cv_id  <- matrix(NA_integer_, dim_cv, k)
  for (i in 1:k) {
    id_tmp     <- cv_id_sb[, i]
    mm         <- id_tmp[y[id_tmp] == 1]
    vv         <- sample(id_tmp[y[id_tmp] == 0], dim_cv - length(mm))
    cv_id[, i] <- c(mm, vv)
  }
  
  list(id_stima = id_stima, id_verifica = id_verifica,
       cv_id_sb = cv_id_sb, cv_id = cv_id)
}

# ---- 1.8 metriche_soglia / grafico_soglia ----------------------------------
# Usate in sezione 15 per il tuning della soglia di classificazione.
metriche_soglia <- function(previsti_prob, osservati, soglie = seq(0.02, 0.90, by = 0.01)) {
  if (is.factor(osservati)) osservati <- osservati == "TRUE"
  osservati_num <- as.numeric(osservati)
  out <- lapply(soglie, function(s) {
    pred_bin <- previsti_prob > s
    m <- fun.errori(pred_bin, osservati_num)
    data.frame(soglia       = s,
               accuracy     = 1 - m["ce"],
               sensibilita  = 1 - m["fn"],
               specificita  = 1 - m["fp"],
               bal_accuracy = (1 - m["fn"] + 1 - m["fp"]) / 2,
               F1           = m["F1"])
  })
  do.call(rbind, out)
}

grafico_soglia <- function(tab_soglie, titolo = "") {
  matplot(tab_soglie$soglia,
          cbind(tab_soglie$accuracy, tab_soglie$sensibilita,
                tab_soglie$specificita, tab_soglie$bal_accuracy,
                tab_soglie$F1),
          type = "l", lty = 1, lwd = 2,
          col = c("black", "tomato", "steelblue", "darkorange", "forestgreen"),
          xlab = "soglia di classificazione", ylab = "valore della metrica",
          main = paste("Metriche al variare della soglia", titolo),
          ylim = c(0, 1))
  legend("bottomleft",
         legend = c("Accuracy", "Sensibilita' (recall)", "Specificita'",
                    "Bal. accuracy", "F1-score"),
         col = c("black", "tomato", "steelblue", "darkorange", "forestgreen"),
         lty = 1, lwd = 2, cex = 0.75, bg = "white")
}

message(">>> [SETUP] Funzioni personalizzate definite: tabella.sommario, ",
        "fun.errori, ec, estrai_prob, lift.roc, scala_su_train, funzione_finale, ",
        "metriche_soglia, grafico_soglia.\n")


# ============================================================================
# 2. IMPORT E PREPARAZIONE DEI DATI
# ============================================================================

message(">>> [DATI] Import del dataset...")

dati <- read.csv("diabete.csv", stringsAsFactors = TRUE)
names(dati)[which(names(dati) == "diabete")] <- "y"
dati$y <- as.factor(dati$y)

stopifnot(exists("dati"))
stopifnot("y" %in% names(dati))

str(dati)
cat("\nDistribuzione della risposta (dataset originale):\n")
print(table(dati$y))
print(prop.table(table(dati$y)))

# ---- 2.1 Selezione delle variabili -----------------------------------------
skim(dati)

var_selezionate <- c("y", "X_VEGESUM", "X_FRUTSUM", "X_DRNKWEK", "X_SMOKER3",
                     "X_BMI5", "X_TOTINDA", "SEX", "MARITAL", "X_EDUCAG")
dati <- dati[, var_selezionate]
skim(dati)

# ---- 2.2 Riscalatura delle variabili numeriche -----------------------------
dati$X_VEGESUM <- dati$X_VEGESUM / 100
dati$X_FRUTSUM <- dati$X_FRUTSUM / 100
dati$X_DRNKWEK <- dati$X_DRNKWEK / 100
dati$X_BMI5    <- dati$X_BMI5    / 100

# ---- 2.3 Ricodifica dei fattori --------------------------------------------
dati$X_SMOKER3 <- factor(dati$X_SMOKER3,
                         levels = c(1, 2, 3, 4, 9),
                         labels = c("fumatore attuale-fuma tutti i giorni",
                                    "fumatore attuale-fuma qualche giorno",
                                    "precedente fumatore",
                                    "non ha mai fumato",
                                    "non sa/non risponde"))

dati$SEX <- factor(dati$SEX,
                   levels = c(1, 2),
                   labels = c("maschio", "femmina"))

dati$X_EDUCAG <- factor(dati$X_EDUCAG,
                        levels = c(1, 2, 3, 4, 9),
                        labels = c("non ha finito le superiori",
                                   "ha finito le superiori",
                                   "ha seguito l'universita'",
                                   "si e' laureato",
                                   "non sa/non risponde"))

dati$MARITAL <- factor(dati$MARITAL,
                       levels = c(1, 2, 3, 4, 5, 6, 9),
                       labels = c("sposato",
                                  "divorziato",
                                  "vedovo",
                                  "separato",
                                  "mai sposato",
                                  "membro di coppia non sposata",
                                  "rifiuta la risposta"))

dati$X_TOTINDA <- factor(dati$X_TOTINDA,
                         levels = c(1, 2, 9),
                         labels = c("ha svolto attivita' fisica",
                                    "non ha svolto attivita' fisica",
                                    "non sa/non risponde"))

# ---- 2.4 Trattamento delle categorie "non sa/non risponde" ----------------
message(">>> [DATI] Ricodifica delle categorie 'non sa/non risponde' a NA...")

dati$X_SMOKER3[dati$X_SMOKER3 == "non sa/non risponde"] <- NA
dati$X_EDUCAG[dati$X_EDUCAG   == "non sa/non risponde"] <- NA
dati$X_TOTINDA[dati$X_TOTINDA == "non sa/non risponde"] <- NA
dati$MARITAL[dati$MARITAL     == "rifiuta la risposta"] <- NA

n_prima <- nrow(dati)
dati <- na.omit(dati)
dati <- droplevels(dati)
cat("Righe rimosse per NA/categorie mancanti:", n_prima - nrow(dati),
    "su", n_prima, "\n")

skim(dati)

cat("\nDistribuzione della risposta (dataset finale):\n")
print(table(dati$y))
print(prop.table(table(dati$y)))

idy <- which(names(dati) == "y")

message(">>> [DATI] Preparazione completata.\n")


# ============================================================================
# 3. SPLIT STIMA / VERIFICA + SOTTOINSIEMI DI TUNING (cb1 / cb2)
# ============================================================================

message(">>> [SPLIT] Creazione insieme di stima e verifica...")

set.seed(67)
n_totale <- nrow(dati)

id_stima    <- sample(1:n_totale, 0.75 * n_totale)
id_verifica <- setdiff(1:n_totale, id_stima)

cb1 <- sample(id_stima, size = 0.75 * length(id_stima))
cb2 <- setdiff(id_stima, cb1)

cat("Dimensione insieme di stima   :", length(id_stima), "\n")
cat("Dimensione insieme di verifica:", length(id_verifica), "\n")
cat("Dimensione cb1 (tuning-train) :", length(cb1), "\n")
cat("Dimensione cb2 (tuning-valid) :", length(cb2), "\n")

message(">>> [SPLIT] Split completato.\n")

lista_previsioni <- list()

# Lista che accumula, per ciascun modello, gli iperparametri ottimi scelti
# su cb1/cb2: serve in sezione 15 per rifittare i modelli SOLO su cb1
# (senza cb2) e poter cosi' scegliere la soglia di classificazione su cb2
# senza data leakage. Viene popolata mano a mano nelle sezioni 4-13,
# cosi' sopravvive ai vari rm() di pulizia di fine sezione.
hp <- list()


# ============================================================================
# 4. REGRESSIONE LOGISTICA (con selezione STEPWISE backward)
# ============================================================================

message(">>> [LOGISTICA] Stima del modello completo e selezione stepwise...")

m_log      <- glm(y ~ ., data = dati[id_stima, ], family = "binomial")
m_step_log <- step(m_log, direction = "backward")

hp$logistica_formula <- formula(m_step_log)

message(">>> [LOGISTICA] Selezione stepwise completata.")
summary(m_step_log)

pr_logit <- predict(m_step_log, newdata = dati[id_verifica, ], type = "response")

message(">>> [LOGISTICA] Valutazione sull'insieme di verifica:")
tabella.sommario(pr_logit > 0.5, dati$y[id_verifica])
lift.roc(pr_logit, dati$y[id_verifica], titolo = "- Logistica stepwise")

lista_previsioni[["Logistica stepwise"]] <- pr_logit

rm(m_log)
gc()
message(">>> [LOGISTICA] Fine sezione.\n")


# ============================================================================
# 5. ANALISI DISCRIMINANTE: LDA e QDA
# ============================================================================

message(">>> [LDA] Costruzione della matrice del disegno e stima...")

X_stima <- model.matrix(y ~ ., data = dati[id_stima, ])[, -1]
y_stima <- dati$y[id_stima]

m_lda <- lda(x = X_stima, grouping = y_stima)
print(m_lda)

X_verifica <- model.matrix(y ~ ., data = dati[id_verifica, ])[, -1]

pr_lda_obj <- predict(m_lda, newdata = X_verifica)
pr_lda <- pr_lda_obj$posterior[, 2]

message(">>> [LDA] Valutazione sull'insieme di verifica:")
tabella.sommario(pr_lda > 0.5, dati$y[id_verifica])
lift.roc(pr_lda, dati$y[id_verifica], titolo = "- LDA")

lista_previsioni[["LDA"]] <- pr_lda

message(">>> [QDA] Stima (attenzione: si rompe con collinearita' o poche osservazioni per gruppo)...")

m_qda <- qda(y ~ ., data = dati[id_stima, ])
pr_qda_obj <- predict(m_qda, newdata = dati[id_verifica, ])
pr_qda <- pr_qda_obj$posterior[, 2]

message(">>> [QDA] Valutazione sull'insieme di verifica:")
tabella.sommario(pr_qda > 0.5, dati$y[id_verifica])
lift.roc(pr_qda, dati$y[id_verifica], titolo = "- QDA")

lista_previsioni[["QDA"]] <- pr_qda

rm(X_stima, y_stima, X_verifica, pr_lda_obj, pr_qda_obj)
gc()
message(">>> [LDA/QDA] Fine sezione.\n")


# ============================================================================
# 6. LASSO E RIDGE (glmnet) -- RICHIEDONO model.matrix
# ============================================================================

message(">>> [LASSO/RIDGE] Costruzione delle matrici del disegno...")

x_stima <- model.matrix(y ~ . - 1, data = dati[id_stima, ])
x_ver   <- model.matrix(y ~ . - 1, data = dati[id_verifica, ])

y_stima_fac <- dati$y[id_stima]

# ---- 6.1 LASSO (alpha = 1) --------------------------------------------
message(">>> [LASSO] Tuning di lambda tramite cv.glmnet (10-fold, family binomial)...")

p_lasso_cv <- cv.glmnet(x_stima, y_stima_fac, alpha = 1,
                        family = "binomial", nfolds = 10)
plot(p_lasso_cv)

l_best_lasso <- p_lasso_cv$lambda.min
hp$lambda_lasso <- l_best_lasso
cat("Lambda ottimo (lasso):", l_best_lasso, "\n")

pr_lasso <- as.vector(predict(p_lasso_cv, newx = x_ver, s = l_best_lasso, type = "response"))

message(">>> [LASSO] Valutazione sull'insieme di verifica:")
tabella.sommario(pr_lasso > 0.5, dati$y[id_verifica])
lift.roc(pr_lasso, dati$y[id_verifica], titolo = "- Lasso")

lista_previsioni[["Lasso"]] <- pr_lasso

c_lasso <- coef(p_lasso_cv, s = l_best_lasso)
var_lasso <- rownames(c_lasso)[c_lasso[, 1] != 0 & rownames(c_lasso) != "(Intercept)"]
cat("Variabili selezionate dal Lasso (", length(var_lasso), "):\n")
print(var_lasso)

# ---- 6.2 RIDGE (alpha = 0) --------------------------------------------
message(">>> [RIDGE] Tuning di lambda tramite cv.glmnet (10-fold, family binomial)...")

p_ridge_cv <- cv.glmnet(x_stima, y_stima_fac, alpha = 0,
                        family = "binomial", nfolds = 10)
plot(p_ridge_cv)

l_best_ridge <- p_ridge_cv$lambda.min
hp$lambda_ridge <- l_best_ridge
cat("Lambda ottimo (ridge):", l_best_ridge, "\n")

pr_ridge <- as.vector(predict(p_ridge_cv, newx = x_ver, s = l_best_ridge, type = "response"))

message(">>> [RIDGE] Valutazione sull'insieme di verifica:")
tabella.sommario(pr_ridge > 0.5, dati$y[id_verifica])
lift.roc(pr_ridge, dati$y[id_verifica], titolo = "- Ridge")

lista_previsioni[["Ridge"]] <- pr_ridge

rm(x_stima, x_ver, y_stima_fac, c_lasso)
gc()
message(">>> [LASSO/RIDGE] Fine sezione.\n")


# ============================================================================
# 7. GAM LOGISTICO (con selezione stepwise dei gradi di liberta')
# ============================================================================

message(">>> [GAM] Individuazione variabili numeriche/fattoriali e stima del modello nullo...")

id_fattoriali <- which(sapply(dati, is.factor))
id_numeriche  <- setdiff(setdiff(1:ncol(dati), id_fattoriali), idy)

gam0 <- gam(y ~ 1, family = binomial, data = dati[id_stima, ])
sc   <- gam.scope(dati[id_stima, id_numeriche], arg = c("df=2", "df=3", "df=4"))

message(">>> [GAM] Selezione stepwise in corso (puo' richiedere qualche minuto)...")
m_gam <- step.Gam(gam0, scope = sc, trace = FALSE)

hp$gam_formula <- formula(m_gam)

summary(m_gam)
par(mfrow = c(2, 2))
plot(m_gam, se = TRUE)
par(mfrow = c(1, 1))

pr_gam <- predict(m_gam, newdata = dati[id_verifica, ], type = "response")

message(">>> [GAM] Valutazione sull'insieme di verifica:")
prev_gam <- factor(pr_gam > 0.5, levels = c(FALSE, TRUE))
tabella.sommario(prev_gam, dati$y[id_verifica])
lift.roc(pr_gam, dati$y[id_verifica], titolo = "- GAM")

lista_previsioni[["GAM"]] <- pr_gam

rm(id_fattoriali, id_numeriche, gam0, sc)
gc()
message(">>> [GAM] Fine sezione.\n")


# ============================================================================
# 8. MARS (polspline::polymars)
# ============================================================================

message(">>> [MARS] Costruzione delle matrici e stima con polymars...")

X_cb1 <- model.matrix(y ~ . - 1, data = dati[cb1, ])
X_cb2 <- model.matrix(y ~ . - 1, data = dati[cb2, ])

m_mars <- polymars(response   = dati$y[cb1],
                   predictors = X_cb1,
                   ts.resp    = dati$y[cb2],
                   ts.pred    = X_cb2,
                   classify   = TRUE)

cat("Modello MARS - termini stimati:\n")
print(head(m_mars$model))

X_ver_mars  <- model.matrix(y ~ . - 1, data = dati[id_verifica, ])
pr_mars_obj <- predict(m_mars, X_ver_mars)
pr_mars     <- pr_mars_obj[, 2]

message(">>> [MARS] Valutazione sull'insieme di verifica:")
tabella.sommario(pr_mars > 0.5, dati$y[id_verifica])
lift.roc(pr_mars, dati$y[id_verifica], titolo = "- MARS")

lista_previsioni[["MARS"]] <- pr_mars

# NOTA: m_mars viene fittato direttamente su cb1 con cb2 come insieme di
# arresto anticipato (procedura nativa di polymars). Non serve quindi
# rifittarlo in sezione 15: verra' riusato tal quale, e per questo NON
# lo rimuoviamo qui (a differenza di X_cb1/X_cb2 che sono ingombranti).
rm(X_cb1, X_cb2, X_ver_mars, pr_mars_obj)
gc()
message(">>> [MARS] Fine sezione.\n")


# ============================================================================
# 9. ALBERO DI CLASSIFICAZIONE (package "tree", con potatura via prune.tree)
# ============================================================================

message(">>> [ALBERO] Stima dell'albero massimale su cb1...")
set.seed(67)
m_albero_max <- tree(formula = y ~ .,
                     data = dati[cb1, ],
                     control = tree.control(nobs = nrow(dati[cb1, ]),
                                            mindev = 0.0001))

message(">>> [ALBERO] Potatura (pruning) valutata sull'insieme cb2...")

prune_seq <- prune.tree(m_albero_max, newdata = dati[cb2, ], method = "deviance")

plot(prune_seq$size, prune_seq$dev, type = "b", pch = 16,
     xlab = "numero di foglie (size)",
     ylab = "errore di classificazione (misclass su cb2)",
     main = "Tuning albero di classificazione (prune.tree)")

size_validi <- prune_seq$size[prune_seq$size >= 2]
dev_validi  <- prune_seq$dev[prune_seq$size >= 2]

if (length(size_validi) == 0) {
  warning("Tutti i tagli producono un albero degenere: forzo j_best = 2.")
  j_best <- 2
} else {
  j_best <- size_validi[which.min(dev_validi)]
}
hp$leaves_tree <- j_best
cat("Numero di foglie ottimo selezionato:", j_best, "\n")
abline(v = j_best, col = "red", lty = 2)

m_albero_full <- tree(formula = y ~ .,
                      data = dati[id_stima, ],
                      control = tree.control(nobs = nrow(dati[id_stima, ]),
                                             mindev = 0.0001))
m_albero <- prune.tree(m_albero_full, best = j_best)

if (!inherits(m_albero, "tree")) {
  warning("Anche con j_best = ", j_best, " l'albero e' degenere: forzo best = 2.")
  m_albero <- prune.tree(m_albero_full, best = 2)
  hp$leaves_tree <- 2
}

plot(m_albero)
text(m_albero, pretty = 0, cex = 0.7)
title(main = "Albero di classificazione (potato)")

pr_tree <- predict(m_albero, newdata = dati[id_verifica, ], type = "vector")[, 2]

n_na_tree <- sum(is.na(pr_tree))
if (n_na_tree > 0) {
  cat("ATTENZIONE: predict.tree ha prodotto", n_na_tree,
      "valori NA su", length(pr_tree), "osservazioni di verifica.\n")
}

message(">>> [ALBERO] Valutazione sull'insieme di verifica:")
tabella.sommario(pr_tree[!is.na(pr_tree)] > 0.5, dati$y[id_verifica][!is.na(pr_tree)])
lift.roc(pr_tree, dati$y[id_verifica], titolo = "- Albero")

lista_previsioni[["Albero"]] <- pr_tree

rm(m_albero_max, prune_seq, size_validi, dev_validi, j_best, m_albero_full)
gc()
message(">>> [ALBERO] Fine sezione.\n")




# ============================================================================
# 11. BOOSTING (ada -- AdaBoost)
# ============================================================================

message(">>> [BOOSTING] Tuning del numero di iterazioni (n.iter) su cb1/cb2...")

id_x <- setdiff(seq_len(ncol(dati)), idy)

iter_seq <- c(50, 100, 200)
err_boost <- numeric(length(iter_seq))

for (i in seq_along(iter_seq)) {
  m_tmp  <- ada(x = dati[cb1, id_x], y = dati$y[cb1], iter = iter_seq[i])
  pr_tmp <- predict(m_tmp, newdata = dati[cb2, id_x], type = "prob")[, 2]
  err_boost[i] <- ec(pr_tmp > 0.5, dati$y[cb2])
  cat("iter =", iter_seq[i], "completato (errore:", round(err_boost[i], 4), ")\n")
}

# NOTA: nell'esecuzione precedente questa sezione falliva con l'errore
# "Argument n.iter not matched": la versione di 'ada' installata usa
# l'argomento "iter", non "n.iter". Corretto in entrambe le chiamate.

plot(iter_seq, err_boost, type = "b", pch = 16, col = "steelblue",
     xlab = "numero di iterazioni (iter)", ylab = "errore di classificazione (cb2)",
     main = "Tuning Boosting (AdaBoost)")

iter_best <- iter_seq[which.min(err_boost)]
hp$niter_boost <- iter_best
cat("iter ottimo selezionato:", iter_best, "\n")

message(">>> [BOOSTING] Stima del modello finale su tutto l'insieme di stima...")
m_boost_final <- ada(x = dati[id_stima, id_x], y = dati$y[id_stima], iter = iter_best)

varplot(m_boost_final)

pr_boost <- predict(m_boost_final, newdata = dati[id_verifica, id_x], type = "prob")[, 2]

message(">>> [BOOSTING] Valutazione sull'insieme di verifica:")
tabella.sommario(pr_boost > 0.5, dati$y[id_verifica])
lift.roc(pr_boost, dati$y[id_verifica], titolo = "- Boosting")

lista_previsioni[["Boosting"]] <- pr_boost

rm(iter_seq, err_boost, m_tmp, pr_tmp, iter_best)
gc()
message(">>> [BOOSTING] Fine sezione.\n")


# ============================================================================
# 12. RANDOM FOREST (ranger)
# ============================================================================

message(">>> [RANDOM FOREST] Tuning di mtry su cb1/cb2...")

nc <- max(1, parallel::detectCores(logical = TRUE) - 1)

ntree_fisso <- 300
m_vals <- c(2, 5, 7, 9)
err_rf <- numeric(length(m_vals))

for (m in seq_along(m_vals)) {
  m_rf_tmp <- ranger(y ~ ., data = dati[cb1, ], mtry = m_vals[m],
                     num.trees = ntree_fisso, num.threads = nc,
                     probability = TRUE)
  
  pr_tmp <- predict(m_rf_tmp, dati[cb2, ])
  err_rf[m] <- ec(pr_tmp$predictions[, 2] > 0.5, dati$y[cb2])
  
  cat("mtry =", m_vals[m], "completato (errore:", round(err_rf[m], 4), ")\n")
}

plot(m_vals, err_rf, type = "b", pch = 16, col = "steelblue",
     xlab = "mtry", ylab = "errore di classificazione (cb2)",
     main = "Tuning mtry (Random Forest)")

mtry_best <- m_vals[which.min(err_rf)]
hp$mtry_rf   <- mtry_best
hp$ntree_rf  <- ntree_fisso
cat("Parametri ottimi -> mtry:", mtry_best, " | num.trees fisso:", ntree_fisso, "\n")

message(">>> [RANDOM FOREST] Stima del modello finale su tutto l'insieme di stima...")
m_rf <- ranger(y ~ ., data = dati[id_stima, ], mtry = mtry_best,
               num.trees = ntree_fisso, num.threads = nc,
               probability = TRUE, importance = "impurity")

barplot(sort(importance(m_rf), decreasing = TRUE)[1:min(15, length(importance(m_rf)))],
        horiz = TRUE, las = 2, main = "Importanza delle variabili (RF)")

pr_rf_obj <- predict(m_rf, dati[id_verifica, ])
pr_rf <- pr_rf_obj$predictions[, 2]

message(">>> [RANDOM FOREST] Valutazione sull'insieme di verifica:")
tabella.sommario(pr_rf > 0.5, dati$y[id_verifica])
lift.roc(pr_rf, dati$y[id_verifica], titolo = "- Random Forest")

lista_previsioni[["Random Forest"]] <- pr_rf

rm(m_vals, err_rf, m_rf_tmp, pr_tmp, pr_rf_obj, ntree_fisso, mtry_best)
gc()
message(">>> [RANDOM FOREST] Fine sezione.\n")


# ============================================================================
# 14. LEADERBOARD A SOGLIA FISSA (0.5)
# ============================================================================
# NOTA: con una prevalenza della classe positiva del ~13%, questa
# leaderboard tende a premiare modelli che quasi non individuano casi
# positivi (errore totale basso, F1 vicino a zero). Va letta insieme
# alla leaderboard "a soglia ottimizzata" della sezione 15.

message(">>> [LEADERBOARD] Calcolo degli errori per tutti i modelli stimati (soglia 0.5)...")

y_ver_num <- as.numeric(dati$y[id_verifica] == "TRUE")
stopifnot(!anyNA(y_ver_num))

tab_confronto <- do.call(rbind, lapply(names(lista_previsioni), function(nome) {
  p <- estrai_prob(lista_previsioni[[nome]])
  metriche <- fun.errori(p > 0.5, y_ver_num)
  data.frame(Modello        = nome,
             Errore_totale  = round(metriche["ce"], 4),
             Falsi_positivi = round(metriche["fp"], 4),
             Falsi_negativi = round(metriche["fn"], 4),
             F1_score       = round(metriche["F1"], 4),
             row.names = NULL)
}))

tab_confronto <- tab_confronto[order(tab_confronto$Errore_totale), ]
rownames(tab_confronto) <- NULL

cat("\n============================================================\n")
cat(" LEADERBOARD (soglia 0.5) - ordinata per errore totale crescente\n")
cat("============================================================\n")
print(tab_confronto)

cat("\n--- Stessa leaderboard, ordinata per F1-score decrescente ---\n")
print(tab_confronto[order(-tab_confronto$F1_score), ])

barplot(tab_confronto$Errore_totale,
        names.arg = tab_confronto$Modello,
        las = 2, col = "steelblue",
        main = "Confronto errore di classificazione per modello (soglia 0.5)",
        ylab = "Errore di classificazione")

message("\n>>> [LEADERBOARD] Con soglia 0.5, il modello con errore totale piu' basso e': ",
        tab_confronto$Modello[1],
        " (errore = ", tab_confronto$Errore_totale[1], ") -- ma verificare l'F1-score",
        " prima di trarre conclusioni: vedi sezione 15.\n")


# ============================================================================
# 15. TUNING DELLA SOGLIA DI CLASSIFICAZIONE (senza data leakage)
# ============================================================================
# Per ciascun modello: rifit SOLO su cb1 (che esclude cb2), previsione su
# cb2, scelta della soglia che massimizza l'F1-score su cb2. La soglia
# trovata viene poi applicata alle previsioni GIA' calcolate dal modello
# finale (fit su id_stima) sull'insieme id_verifica -- mai usato per
# scegliere ne' gli iperparametri ne' la soglia.

message(">>> [SOGLIA] Inizio tuning della soglia per tutti i modelli (rifit su cb1)...\n")

soglie_ottime  <- list()
pred_cb2_tutte <- list()

# ---- 15.1 Logistica ---------------------------------------------------
m_log_cb1 <- glm(hp$logistica_formula, data = dati[cb1, ], family = "binomial")
pred_cb2_tutte[["Logistica stepwise"]] <- predict(m_log_cb1, newdata = dati[cb2, ], type = "response")
rm(m_log_cb1)

# ---- 15.2 LDA -----------------------------------------------------------
X_cb1_lda <- model.matrix(y ~ ., data = dati[cb1, ])[, -1]
X_cb2_lda <- model.matrix(y ~ ., data = dati[cb2, ])[, -1]
m_lda_cb1 <- lda(x = X_cb1_lda, grouping = dati$y[cb1])
pred_cb2_tutte[["LDA"]] <- predict(m_lda_cb1, newdata = X_cb2_lda)$posterior[, 2]
rm(X_cb1_lda, X_cb2_lda, m_lda_cb1)

# ---- 15.3 QDA -----------------------------------------------------------
m_qda_cb1 <- qda(y ~ ., data = dati[cb1, ])
pred_cb2_tutte[["QDA"]] <- predict(m_qda_cb1, newdata = dati[cb2, ])$posterior[, 2]
rm(m_qda_cb1)

# ---- 15.4 Lasso / Ridge --------------------------------------------------
x_cb1_glm <- model.matrix(y ~ . - 1, data = dati[cb1, ])
x_cb2_glm <- model.matrix(y ~ . - 1, data = dati[cb2, ])
y_cb1_fac <- dati$y[cb1]

m_lasso_cb1 <- glmnet(x_cb1_glm, y_cb1_fac, alpha = 1, family = "binomial",
                      lambda = hp$lambda_lasso)
pred_cb2_tutte[["Lasso"]] <- as.vector(predict(m_lasso_cb1, newx = x_cb2_glm, type = "response"))

m_ridge_cb1 <- glmnet(x_cb1_glm, y_cb1_fac, alpha = 0, family = "binomial",
                      lambda = hp$lambda_ridge)
pred_cb2_tutte[["Ridge"]] <- as.vector(predict(m_ridge_cb1, newx = x_cb2_glm, type = "response"))

rm(x_cb1_glm, x_cb2_glm, y_cb1_fac, m_lasso_cb1, m_ridge_cb1)

# ---- 15.5 GAM -------------------------------------------------------------
m_gam_cb1 <- gam(hp$gam_formula, family = binomial, data = dati[cb1, ])
pred_cb2_tutte[["GAM"]] <- predict(m_gam_cb1, newdata = dati[cb2, ], type = "response")
rm(m_gam_cb1)

# ---- 15.6 MARS ------------------------------------------------------------
# m_mars e' gia' stato fittato su cb1 in sezione 8: qui ci limitiamo a
# predire su cb2, senza alcun rifit.
X_cb2_mars <- model.matrix(y ~ . - 1, data = dati[cb2, ])
pred_cb2_tutte[["MARS"]] <- predict(m_mars, X_cb2_mars)[, 2]
rm(X_cb2_mars)

# ---- 15.7 Albero ------------------------------------------------------
m_tree_cb1 <- tree(formula = y ~ ., data = dati[cb1, ],
                   control = tree.control(nobs = nrow(dati[cb1, ]), mindev = 0.0001))
m_tree_cb1_pot <- prune.tree(m_tree_cb1, best = hp$leaves_tree)
if (!inherits(m_tree_cb1_pot, "tree")) m_tree_cb1_pot <- prune.tree(m_tree_cb1, best = 2)
pred_cb2_tutte[["Albero"]] <- predict(m_tree_cb1_pot, newdata = dati[cb2, ], type = "vector")[, 2]
rm(m_tree_cb1, m_tree_cb1_pot)


# ---- 15.9 Boosting ------------------------------------------------------
id_x <- setdiff(seq_len(ncol(dati)), idy)
m_boost_cb1 <- ada(x = dati[cb1, id_x], y = dati$y[cb1], iter = hp$niter_boost)
pred_cb2_tutte[["Boosting"]] <- predict(m_boost_cb1, newdata = dati[cb2, id_x], type = "prob")[, 2]
rm(m_boost_cb1)

# ---- 15.10 Random Forest ------------------------------------------------
m_rf_cb1 <- ranger(y ~ ., data = dati[cb1, ], mtry = hp$mtry_rf,
                   num.trees = hp$ntree_rf, num.threads = nc, probability = TRUE)
pred_cb2_tutte[["Random Forest"]] <- predict(m_rf_cb1, dati[cb2, ])$predictions[, 2]
rm(m_rf_cb1)


message(">>> [SOGLIA] Rifit su cb1 completato per tutti i modelli.\n")

# ---- 15.12 Calcolo soglia ottima per ciascun modello -----------------------
# Criterio: soglia che massimizza l'F1-score su cb2. Ogni modello ha una
# curva soglia -> metriche stampata come grafico diagnostico.
for (nome in names(pred_cb2_tutte)) {
  tab_s <- metriche_soglia(pred_cb2_tutte[[nome]], dati$y[cb2])
  grafico_soglia(tab_s, titolo = paste("-", nome, "(cb2)"))
  s_best <- tab_s$soglia[which.max(tab_s$F1)]
  abline(v = s_best, col = "red", lty = 2)
  soglie_ottime[[nome]] <- s_best
  cat("Soglia ottima (max F1, su cb2) per", nome, ":", round(s_best, 3), "\n")
}

# ---- 15.13 Leaderboard finale con soglie ottimizzate per modello ----------
# Applichiamo, per ciascun modello, la SUA soglia ottima alle previsioni
# GIA' calcolate dal modello finale (fit su id_stima) sull'insieme
# id_verifica -- mai toccato ne' per il tuning degli iperparametri ne'
# per il tuning della soglia.

message("\n>>> [LEADERBOARD SOGLIA] Calcolo della leaderboard con soglie ottimizzate...")

tab_confronto_soglia <- do.call(rbind, lapply(names(lista_previsioni), function(nome) {
  p <- estrai_prob(lista_previsioni[[nome]])
  s <- soglie_ottime[[nome]]
  metriche <- fun.errori(p > s, y_ver_num)
  data.frame(Modello        = nome,
             Soglia_ottima  = round(s, 3),
             Errore_totale  = round(metriche["ce"], 4),
             Falsi_positivi = round(metriche["fp"], 4),
             Falsi_negativi = round(metriche["fn"], 4),
             F1_score       = round(metriche["F1"], 4),
             row.names = NULL)
}))

tab_confronto_soglia <- tab_confronto_soglia[order(-tab_confronto_soglia$F1_score), ]
rownames(tab_confronto_soglia) <- NULL

cat("\n============================================================\n")
cat(" LEADERBOARD FINALE (soglia ottimizzata per modello)\n")
cat(" ordinata per F1-score decrescente\n")
cat("============================================================\n")
print(tab_confronto_soglia)

barplot(tab_confronto_soglia$F1_score,
        names.arg = tab_confronto_soglia$Modello,
        las = 2, col = "forestgreen",
        main = "Confronto F1-score per modello (soglia ottimizzata)",
        ylab = "F1-score", ylim = c(0,1))

message("\n>>> [LEADERBOARD SOGLIA] Il modello con F1-score migliore e': ",
        tab_confronto_soglia$Modello[1],
        " (F1 = ", tab_confronto_soglia$F1_score[1],
        ", soglia = ", tab_confronto_soglia$Soglia_ottima[1], ")\n")

rm(id_x)
gc()
message(">>> [SOGLIA] Fine sezione.\n")







# ============================================================================
# 16. CALIBRATION PLOT (affidabilita' delle probabilita' previste)
# ============================================================================
# Un modello ben calibrato, tra i casi a cui assegna probabilita' vicina a
# p, dovrebbe avere effettivamente una proporzione di positivi vicina a p.
# Qui NON stiamo scegliendo ne' iperparametri ne' soglie: e' un
# diagnostico finale sui modelli gia' stimati, quindi valutarlo su
# id_verifica e' corretto e non introduce data leakage.

message(">>> [CALIBRAZIONE] Costruzione dei calibration plot su id_verifica...\n")

# ---- 16.1 Funzione di supporto: tabella di calibrazione --------------------
# Suddivide le probabilita' previste in "n_bin" gruppi di uguale
# numerosita' (per quantili), e per ciascun gruppo calcola:
#  - la probabilita' media prevista
#  - la frequenza osservata di positivi
#  - la numerosita' del gruppo (utile per pesare/valutare la stabilita')
tabella_calibrazione <- function(previsti_prob, osservati, n_bin = 10) {
  if (is.factor(osservati)) osservati <- osservati == "TRUE"
  osservati <- as.numeric(osservati)
  
  ok <- complete.cases(previsti_prob, osservati)
  previsti_prob <- previsti_prob[ok]
  osservati     <- osservati[ok]
  
  # Quantili come punti di taglio: bin di uguale numerosita' anche quando
  # la distribuzione delle probabilita' e' molto sbilanciata (tipico con
  # classi rare, dove molte probabilita' sono ammassate vicino a 0).
  tagli <- quantile(previsti_prob, probs = seq(0, 1, length.out = n_bin + 1),
                    na.rm = TRUE)
  tagli <- unique(tagli)   # evita bin vuoti se ci sono troppi valori ripetuti
  bin <- cut(previsti_prob, breaks = tagli, include.lowest = TRUE)
  
  agg <- data.frame(previsti_prob, osservati, bin)
  out <- do.call(rbind, lapply(split(agg, agg$bin), function(g) {
    data.frame(prob_media_prevista = mean(g$previsti_prob),
               freq_osservata      = mean(g$osservati),
               n                   = nrow(g))
  }))
  out[order(out$prob_media_prevista), ]
}

# ---- 16.2 Calibration plot combinato (tutti i modelli sovrapposti) --------
message(">>> [CALIBRAZIONE] Grafico combinato (tutti i modelli)...")

colori_modelli <- rainbow(length(lista_previsioni))
names(colori_modelli) <- names(lista_previsioni)

plot(0, 0, type = "n", xlim = c(0, 1), ylim = c(0, 1),
     xlab = "Probabilita' media prevista (per bin)",
     ylab = "Frequenza osservata di positivi (per bin)",
     main = "Calibration plot - confronto tra modelli (id_verifica)")
abline(0, 1, lty = 2, col = "gray40", lwd = 2)  # calibrazione perfetta

for (nome in names(lista_previsioni)) {
  p <- estrai_prob(lista_previsioni[[nome]])
  tab_cal <- tabella_calibrazione(p, dati$y[id_verifica])
  lines(tab_cal$prob_media_prevista, tab_cal$freq_osservata,
        type = "b", pch = 16, col = colori_modelli[nome], lwd = 1.5)
}

legend("topleft", legend = names(lista_previsioni), col = colori_modelli,
       lty = 1, pch = 16, cex = 0.65, bg = "white", ncol = 2)

# ---- 16.3 Calibration plot singolo per ciascun modello (con istogramma) ---
# Un grafico a due pannelli per modello: sopra la curva di calibrazione,
# sotto l'istogramma delle probabilita' previste (mostra dove si
# concentra la massa di probabilita', utile per interpretare quanto e'
# affidabile ciascun punto della curva sopra).
message(">>> [CALIBRAZIONE] Grafici individuali per modello...")

for (nome in names(lista_previsioni)) {
  p <- estrai_prob(lista_previsioni[[nome]])
  tab_cal <- tabella_calibrazione(p, dati$y[id_verifica])
  
  layout(matrix(c(1, 2), nrow = 2), heights = c(3, 1))
  
  par(mar = c(2, 4, 3, 1))
  plot(tab_cal$prob_media_prevista, tab_cal$freq_osservata,
       type = "b", pch = 16, col = "steelblue", lwd = 2,
       xlim = c(0, 1), ylim = c(0, 1),
       xlab = "", ylab = "Frequenza osservata",
       main = paste("Calibration plot -", nome))
  abline(0, 1, lty = 2, col = "gray40")
  
  par(mar = c(4, 4, 1, 1))
  hist(p, breaks = 30, col = "steelblue", border = "white",
       xlim = c(0, 1), main = "", xlab = "Probabilita' prevista")
  
  layout(1)  # ripristina il layout a un solo pannello per i grafici successivi
}

# ---- 16.4 Indice sintetico di calibrazione (opzionale) --------------------
# Expected Calibration Error (ECE): media pesata (per numerosita' del bin)
# dello scarto assoluto tra probabilita' media prevista e frequenza
# osservata. Valori piu' bassi = calibrazione migliore.
message(">>> [CALIBRAZIONE] Calcolo dell'Expected Calibration Error (ECE) per modello...")

tab_ece <- do.call(rbind, lapply(names(lista_previsioni), function(nome) {
  p <- estrai_prob(lista_previsioni[[nome]])
  tab_cal <- tabella_calibrazione(p, dati$y[id_verifica])
  ece <- sum(tab_cal$n * abs(tab_cal$prob_media_prevista - tab_cal$freq_osservata)) /
    sum(tab_cal$n)
  data.frame(Modello = nome, ECE = round(ece, 4))
}))

tab_ece <- tab_ece[order(tab_ece$ECE), ]
rownames(tab_ece) <- NULL

cat("\n============================================================\n")
cat(" CALIBRAZIONE - Expected Calibration Error (ECE) per modello\n")
cat(" (valori piu' bassi = probabilita' previste piu' affidabili)\n")
cat("============================================================\n")
print(tab_ece)

barplot(tab_ece$ECE, names.arg = tab_ece$Modello, las = 2, col = "darkorange",
        main = "Expected Calibration Error per modello",
        ylab = "ECE (scarto medio pesato)")

message(">>> [CALIBRAZIONE] Fine sezione.\n")

message(">>> [FINE SCRIPT] Analisi di classificazione binaria completata con successo.")

