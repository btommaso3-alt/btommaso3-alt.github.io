# =========================================================================================
# PIPELINE DI DATA MINING: PREVISIONE NOLEGGI BICICLETTE (REGRESSIONE)
# =========================================================================================
# 
# 1. OBIETTIVO E IMPOSTAZIONE DEL PROBLEMA
#    Il task richiede di prevedere il numero di noleggi di biciclette ('y') sulla base di 
#    caratteristiche storiche e meteorologiche (problema di Regressione Quantitativa).
#
# 2. DATA PREPROCESSING E PULIZIA
#    - Importazione dataset e casting delle variabili temporali (Date) e categoriali (factor).
#    - Feature Engineering: l'orario grezzo (hr) è stato categorizzato in 'fascia_oraria'.
#    - Gestione NA: imputazione logica applicata sui valori mancanti della variabile 'severerisk'.
#    - Merge: Join tra noleggi e meteo usando la data come chiave.
#
# 3. SPLIT DEI DATI (STRATEGIA DI VALIDAZIONE)
#    - Dataset diviso in Stima (sss = 70%) e Verifica (vvv = 30%). Il set di Verifica ('vvv')
#      viene tenuto rigorosamente da parte e usato SOLO per il calcolo dell'errore finale.
#    - Il set di Stima ('sss') è ulteriormente partizionato in cb1 (70%) e cb2 (30%) 
#      per consentire l'addestramento e il Tuning (selezione iperparametri) fuori campione.
#
# 4. MODELLI ESTIMATI E METODI DI TUNING
#    A. Modello Lineare Base e Stepwise:
#       - Stima: Su intero set di stima ('sss').
#       - Tuning: Nessuno per il base. Stepwise usa selezione Backward basata su AIC.
#    B. Regressione Penalizzata (Lasso):
#       - Preprocessing: Standardizzazione esplicita delle covariate numeriche tramite scale().
#       - Stima: Modello addestrato sul set di addestramento ('cb1').
#       - Tuning: Ricerca del parametro di penalità ottimo ('lambda') valutando l'Errore
#         Quadratico Medio (MSE) sul set di validazione ('cb2').
#    C. MARS (Multivariate Adaptive Regression Splines):
#       - Stima: Fase di crescita (Forward) fino a 20 termini sul set 'cb1'.
#       - Tuning: Potatura valutata sul set 'cb2' per estrarre il parametro ottimo 'nprune' 
#         (numero di funzioni base/cerniera).
#       - Refitting: Modello ri-addestrato su tutto l'insieme 'sss' con il 'nprune' ottimo.
#    D. Albero di Regressione:
#       - Stima: Saturazione massima su 'cb1' forzando vincoli di crescita quasi nulli.
#       - Tuning: Potatura (Pruning) testata su 'cb2' minimizzando la devianza fuori campione
#         per estrarre il parametro ottimo 'J' (numero di nodi foglia).
#    E. Ensemble - Bagging:
#       - Stima: Aggregazione Bootstrap (20 alberi) su tutto 'sss'. Nessun tuning necessario
#         poiché il Bagging non soffre di overfitting all'aumentare degli alberi B.
#       - Valutazione: Errore Out-Of-Bag (OOB) calcolato internamente.
#    F. Ensemble - Random Forest:
#       - Stima: 100 alberi stimati su 'sss' esplorando un numero ridotto di covariate ai nodi.
#       - Tuning: Ottimizzazione del parametro 'mtry' (numero di variabili esplorate per split)
#         tramite iterazione (lapply) basandosi sull'errore Out-Of-Bag (OOB). Nessun bisogno
#         di usare cb1/cb2 poiché il metodo OOB è un validatore interno nativo non distorto.
#
# 5. VALUTAZIONE FINALE E LEADERBOARD
#    - Tutti i modelli finali effettuano le previsioni sul dataset 'vvv'.
#    - Le metriche di valutazione (Errore Quadratico Medio - MSE, Errore Assoluto Medio - MAE)
#      vengono tabulate in un dataframe 'tab_confronto' ordinato dal migliore al peggiore.
# =========================================================================================

# ------------------------------------------------------------------------------
# 0. PULIZIA DELL'AMBIENTE E CARICAMENTO LIBRERIE
# ------------------------------------------------------------------------------
rm(list = ls())
library(tidyverse)
library(dplyr)
library(ggplot2)
library(glmnet)    # Penalizzazioni (Lasso/Ridge)
library(earth)     # MARS
library(plotmo)    # Effetti marginali MARS
library(tree)      # Alberi decisionali
library(ipred)     # Bagging
library(ranger)    # Random Forest veloce

# ------------------------------------------------------------------------------
# 1. LETTURA DEI DATASET
# ------------------------------------------------------------------------------
bici <- read.csv("bici2022.csv", stringsAsFactors = TRUE)
meteo <- read.csv("meteo2022.csv", stringsAsFactors = TRUE)

# ------------------------------------------------------------------------------
# 2. PREPROCESSING E PULIZIA PRELIMINARE DEI DATI
# ------------------------------------------------------------------------------
# Conversione chiavi in formato Date
bici$date <- as.Date(bici$date, format = "%Y-%m-%d")
meteo$date <- as.Date(meteo$date, format = "%Y-%m-%d")

# Codifica esplicita variabili categoriali
bici$fest <- as.factor(bici$fest)
bici$rideable_type <- as.factor(bici$rideable_type)
bici$member_casual <- as.factor(bici$member_casual)
bici$start_station_id <- as.factor(bici$start_station_id)

# Raggruppamento orario in fasce orarie disgiunte
bici$fascia_oraria <- NA
bici$fascia_oraria[bici$hr >= 0  & bici$hr < 6]  <- "[0,6)"
bici$fascia_oraria[bici$hr >= 6  & bici$hr < 12] <- "[6,12)"
bici$fascia_oraria[bici$hr >= 12 & bici$hr < 18] <- "[12,18)"
bici$fascia_oraria[bici$hr >= 18 & bici$hr < 24] <- "[18,24)"
bici$fascia_oraria <- as.factor(bici$fascia_oraria)

# Rimozione colonne inutili o ridondanti
bici$hr <- NULL
bici$X <- NULL
meteo$X <- NULL
meteo$name <- NULL

# Rinominiamo la variabile risposta 'N' in 'y' per standardizzare la sintassi
bici$y <- bici$N
bici$N <- NULL

# ------------------------------------------------------------------------------
# 3. ANALISI ESPLORATIVA E GESTIONE VALORI MANCANTI (NA)
# ------------------------------------------------------------------------------
# Imputazione logica per i missing (es. valore minimo 10 per severerisk)
meteo$severerisk[is.na(meteo$severerisk)] <- 10

# Rimozione variabili con troppi NA irrecuperabili o ID sparsi
meteo$windgust <- NULL
bici$start_station_id <- NULL

# ------------------------------------------------------------------------------
# 4. MERGE DEI DATASET E SUDDIVISIONE STIMA/VERIFICA
# ------------------------------------------------------------------------------
dati <- merge(bici, meteo, by = "date", all.x = TRUE)

# Estrazione set di stima globale (70%) e verifica (30%)
set.seed(67)
id_stima <- sample(1:nrow(dati), round(nrow(dati) * 0.7))

dati$dataset <- "verifica"
dati$dataset[id_stima] <- "stima"

sss <- dati[dati$dataset == "stima", ]
vvv <- dati[dati$dataset == "verifica", ]
dati <- NULL # Svuotamento RAM

# Suddivisione del set di stima in Training (cb1, 70%) e Validation (cb2, 30%)
set.seed(67)
cb1 <- sample(1:length(id_stima), length(id_stima) * 0.70)
cb2 <- setdiff(1:length(id_stima), cb1)

bici <- NULL
meteo <- NULL

# ------------------------------------------------------------------------------
# 5. FUNZIONE DI ERRORE E INIZIALIZZAZIONE LEADERBOARD
# ------------------------------------------------------------------------------
get_err <- function(y_hat, y_oss = vvv$y) {
  mse <- mean((y_hat - y_oss)^2)
  mae <- mean(abs(y_hat - y_oss))
  return(data.frame(mse = mse, mae = mae))
}

tab_confronto <- data.frame(Modello = character(), MSE = numeric(), MAE = numeric(), stringsAsFactors = FALSE)

# ==============================================================================
# 6. MODELLI LINEARI (BASE E STEPWISE)
# ==============================================================================
# Modello Lineare Base (OLS) su tutto sss
m_lin <- lm(y ~ rideable_type + member_casual + lat + long + end_lat + end_long + fest + fascia_oraria + 
              tempmax + tempmin + feelslike + humidity + precipprob + precipcover + preciptype + 
              snow + snowdepth + windspeed + winddir + sealevelpressure + cloudcover + visibility + 
              solarradiation + uvindex + severerisk + moonphase + icon, data = sss)

p_lin <- predict(m_lin, newdata = vvv)
err_lin <- get_err(p_lin, vvv$y)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "Modello Lineare Base", MSE = err_lin$mse, MAE = err_lin$mae, stringsAsFactors = FALSE))

# Selezione Stepwise (Backward basata sull'AIC)
m_step <- step(m_lin, direction = "backward", trace = 0)
p_step <- predict(m_step, newdata = vvv)
err_step <- get_err(p_step, vvv$y)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "Modello Lineare Stepwise", MSE = err_step$mse, MAE = err_step$mae, stringsAsFactors = FALSE))

# ==============================================================================
# 7. REGRESSIONE PENALIZZATA: LASSO (Standardizzazione Manaule & Tuning cb2)
# ==============================================================================
# Identificazione inequivocabile variabili numeriche
is_num <- sapply(sss, is.numeric)
var_espl_num <- names(sss)[is_num & names(sss) != "y"]

# Creazione copie scalate (Standardizzazione)
sss.scale <- sss
vvv.scale <- vvv
sss.scale[, var_espl_num] <- scale(sss.scale[, var_espl_num])
vvv.scale[, var_espl_num] <- scale(vvv.scale[, var_espl_num])

# Formula matrice disegno (senza intercetta fissa -1 per glmnet)
formula_matrice <- as.formula(y ~ rideable_type + member_casual + lat + long + end_lat + end_long + fest + 
                                fascia_oraria + tempmax + tempmin + feelslike + humidity + precipprob + 
                                precipcover + preciptype + snow + snowdepth + windspeed + winddir + 
                                sealevelpressure + cloudcover + visibility + solarradiation + uvindex + 
                                severerisk + moonphase + icon - 1)

x <- model.matrix(formula_matrice, data = sss.scale)
x_vvv <- model.matrix(formula_matrice, data = vvv.scale)

# Tuning Lasso su cb1 e cb2
lambda_grid <- 10^seq(3, -3, length=100)
m.lasso <- glmnet(x[cb1,], sss.scale$y[cb1], lambda = lambda_grid, alpha = 1, standardize = FALSE)

y.cb2 <- predict(m.lasso, newx = x[cb2,])
errori.cb2 <- apply((sss.scale$y[cb2] - y.cb2)^2, 2, mean)
lambda.ottimo <- m.lasso$lambda[which.min(errori.cb2)]

# Visualizzazione Tuning Lasso
plot(log(m.lasso$lambda), errori.cb2, ylab="Errore (MSE)", xlab=expression(log(lambda)), main="Tuning Lasso (MSE vs log-lambda)")
abline(v = log(lambda.ottimo), lty=2, col=2)

# Previsione ed estrazione coef.
y.lasso <- as.numeric(predict(m.lasso, newx = x_vvv, s = lambda.ottimo))
err_lasso <- get_err(y.lasso, vvv.scale$y)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "Lasso", MSE = err_lasso$mse, MAE = err_lasso$mae, stringsAsFactors = FALSE))

# ==============================================================================
# 8. MARS CON EARTH (Tuning nprune su cb2)
# ==============================================================================
# Formula selezionata (esplicitata per pulizia)
formula_mars <- y ~ rideable_type + member_casual + lat + long + end_lat + end_long + 
  fest + fascia_oraria + feelslike + humidity + precipprob + 
  precipcover + windspeed + cloudcover + visibility + 
  uvindex + severerisk + icon

# Addestramento Saturo su cb1
m_mars_cb1 <- earth(formula_mars, data = sss[cb1, ], degree = 2, nk = 20, pmethod = "backward")

# Ricerca (Tuning) del nprune ottimo valutato su cb2
max_termini <- length(m_mars_cb1$selected.terms)
griglia_nprune <- 2:max_termini
mse_cb2_mars <- numeric(length(griglia_nprune))

for (i in seq_along(griglia_nprune)) {
  pred_cb2 <- predict(m_mars_cb1, newdata = sss[cb2, ], nprune = griglia_nprune[i])
  mse_cb2_mars[i] <- mean((sss$y[cb2] - pred_cb2)^2)
}
best_nprune <- griglia_nprune[which.min(mse_cb2_mars)]

# Plot Tuning MARS
plot(griglia_nprune, mse_cb2_mars, type = "b", col = "forestgreen", pch = 16, lwd = 1.5,
     main = "Tuning MARS su cb2", xlab = "Numero termini (nprune)", ylab = "MSE cb2")
abline(v = best_nprune, col = "red", lty = 2, lwd = 2)

# Ri-addestramento MARS finale su intero sss con nprune bloccato all'ottimo
m_mars_finale <- earth(formula_mars, data = sss, degree = 2, nprune = best_nprune)
p_mars <- as.numeric(predict(m_mars_finale, newdata = vvv))

err_mars <- get_err(p_mars, vvv$y)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "MARS", MSE = err_mars$mse, MAE = err_mars$mae, stringsAsFactors = FALSE))

# ==============================================================================
# 9. ALBERO DI REGRESSIONE (Saturazione cb1 e Pruning cb2)
# ==============================================================================
# Fase di crescita esplosiva su cb1
m_tree <- tree(formula_mars, data = sss[cb1, ], split = "deviance",
               control = tree.control(nobs = length(cb1), minsize = 1, mindev = 0.001))

# Fase di potatura (Pruning) testata su cb2
prune_t <- prune.tree(m_tree, newdata = sss[cb2, ])
J_ottimo <- prune_t$size[which.min(prune_t$dev)]

# Plot Tuning Albero (Zoom sul minimo)
plot(prune_t, xlim = c(max(2, J_ottimo - 15), J_ottimo + 15), main="Tuning Albero (Focus Minimo)")
abline(v = J_ottimo, col = 2, lty = 2)

# Albero finale ottimalizzato e Previsione
m_tree_best <- prune.tree(m_tree, best = J_ottimo)
p_tree <- predict(m_tree_best, newdata = vvv)

err_tree <- get_err(p_tree, vvv$y)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "Albero Regressione", MSE = err_tree$mse, MAE = err_tree$mae, stringsAsFactors = FALSE))

rm(m_tree, prune_t) # Liberiamo RAM
gc()

# ==============================================================================
# 10. METODI ENSEMBLE: BAGGING
# ==============================================================================
B_bag <- 20 # B ridotto per limiti computazionali (ideale: 100-500)
set.seed(1234)

m_bag <- bagging(formula_mars, data = sss, nbagg = B_bag, coob = TRUE)
p_bag <- predict(m_bag, newdata = vvv)

err_bag <- get_err(p_bag, vvv$y)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "Bagging", MSE = err_bag$mse, MAE = err_bag$mae, stringsAsFactors = FALSE))

# ==============================================================================
# 11. METODI ENSEMBLE: RANDOM FOREST (Tuning mtry via Out-Of-Bag)
# ==============================================================================
ntrees <- 100      
colnum <- 2:4  # Griglia mtry (espandibile fino al num. max di covariate es. 2:15)

# Funzione per ricavare errore OOB per ogni mtry
run_rf <- function(mtry) {
  set.seed(1234 * mtry)
  ranfo <- ranger(formula_mars, data = sss, importance = "impurity", 
                  num.trees = ntrees, mtry = mtry)
  c(mtry, ranfo$prediction.error) 
}

cat("\nRicerca del parametro mtry tramite lapply...\n")
rf.err <- do.call(rbind, lapply(colnum, run_rf)) 
colnames(rf.err) <- c("mtry", "MSE_OOB")

# Plot Tuning RF
bestF <- colnum[which.min(rf.err[, 2])] 
plot(rf.err, type = "b", col = 1, lwd = 2, main = "Tuning Random Forest (OOB)", xlab = "mtry", ylab = "MSE OOB")
abline(v = bestF, lty = 2, col = 2, lwd = 2)

# Modello finale RF su intero sss con bestF
m_rf <- ranger(formula_mars, data = sss, num.trees = ntrees, mtry = bestF, importance = "impurity")
p_rf <- predict(rf, data = vvv)$predictions

err_rf <- get_err(p_rf, vvv$y)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "Random Forest", MSE = err_rf$mse, MAE = err_rf$mae, stringsAsFactors = FALSE))

# ==============================================================================
# 12. LEADERBOARD FINALE
# ==============================================================================
tab_confronto <- tab_confronto[order(tab_confronto$MSE), ]
cat("\n\n===== LEADERBOARD FINALE DEI MODELLI =====\n")
print(tab_confronto)





# ------------------------------------------------------------------------------
# SINTESI METODOLOGICA: RISPOSTA AI QUESITI DI BUSINESS
# ------------------------------------------------------------------------------
#
# QUESITO 1 (Condizioni Meteorologiche e Domanda):
# - Modelli impiegati: Random Forest (m_rf) e MARS (m_mars_finale).
# - Approccio: Si estrae l'importanza delle variabili (Impurity) dalla Random 
#   Forest per stilare un ranking dei predittori climatici più influenti. 
#   Successivamente, si utilizzano i Partial Dependence Plots (tramite plotmo 
#   sul modello MARS) per visualizzare l'effetto marginale e non lineare 
#   (le "soglie critiche") delle singole variabili meteo sui noleggi.
#
# QUESITO 2 (Fabbisogno Giornaliero per Tipo di Bici e Utente):
# - Previsioni impiegate: Output del modello Random Forest (p_rf) sul set di 
#   verifica (vvv), assunto come modello a minor RMSE.
# - Approccio: Poiché i dati storici e le previsioni sono a granularità oraria, 
#   è necessario un roll-up temporale. Tramite la libreria 'dplyr', si esegue 
#   un raggruppamento strutturale (group_by: date, rideable_type, member_casual) 
#   e si aggregano (sum) sia i noleggi reali (y) che quelli previsti (pred_y). 
#   Il dataframe risultante modella il fabbisogno giornaliero effettivo da 
#   fornire alla logistica.
# ------------------------------------------------------------------------------



# ==============================================================================
# 13. RISPOSTA AI QUESITI DI BUSINESS (INTERPRETAZIONE E PREVISIONE FABBISOGNO)
# ==============================================================================

# ------------------------------------------------------------------------------
# QUESITO 1: Capire in quali condizioni meteorologiche c'è più bisogno di bici
# ------------------------------------------------------------------------------
cat("\n--- Estrazione Importanza Variabili (Random Forest) ---\n")
# Estraiamo e ordiniamo l'importanza delle variabili (Impurity Gini)
importanza <- sort(rf$variable.importance, decreasing = TRUE)
print(importanza)

# Grafico delle top 15 variabili più importanti per rispondere al business
df_imp <- data.frame(Variabile = names(importanza), Importanza = as.numeric(importanza))[1:15, ]

ggplot(df_imp, aes(x = reorder(Variabile, Importanza), y = Importanza)) +
  geom_col(fill = "steelblue", color = "black") +
  coord_flip() +
  labs(title = "Variabili Critiche per il Fabbisogno di Biciclette",
       x = "Caratteristiche / Condizioni Meteo", 
       y = "Riduzione Totale Impurezza (Varianza)") +
  theme_minimal()

# Analisi approfondita degli effetti meteorologici non lineari tramite MARS
# (Isoliamo l'effetto di temperatura percepita e umidità sull'Insieme di Stima)
cat("\n--- Generazione Grafici degli Effetti Meteo (Partial Dependence) ---\n")
par(mfrow = c(1, 2))
plotmo(m_mars_finale, caption = "Effetto Isolato dei Fattori Meteo",
       degree1 = c("feelslike", "humidity"), degree2 = FALSE)

# ------------------------------------------------------------------------------
# QUESITO 2: Previsione del fabbisogno giornaliero per Tipo Bici e Tipo Utente
# ------------------------------------------------------------------------------
cat("\n--- Calcolo del Fabbisogno Giornaliero per Tipo Bici e Tipo Utente ---\n")

# Estraiamo le previsioni finali del modello vincente (es. Random Forest) sul Test Set
vvv$pred_y <- p_rf

# Per ottenere il fabbisogno giornaliero aggregato per "tipo", raggruppiamo 
# le previsioni orarie sul Test Set per data, tipo di mezzo e tipo di utente
fabbisogno_giornaliero <- vvv %>%
  group_by(date, rideable_type, member_casual) %>%
  summarise(
    Noleggi_Reali_Giornalieri = sum(y),
    Noleggi_Previsti_Giornalieri = sum(pred_y),
    .groups = 'drop'
  )

# Stampiamo un'anteprima delle previsioni del fabbisogno da consegnare alla gestione delle stazioni
print(head(fabbisogno_giornaliero, 10))

# Grafico di confronto per validare visivamente la bontà della previsione del fabbisogno
ggplot(fabbisogno_giornaliero, aes(x = Noleggi_Reali_Giornalieri, y = Noleggi_Previsti_Giornalieri, color = rideable_type)) +
  geom_point(alpha = 0.6) +
  geom_abline(intercept = 0, slope = 1, lty = 2, color = "red", lwd = 1) +
  facet_wrap(~member_casual) +
  labs(title = "Fabbisogno Giornaliero Aggregato: Reale vs Previsto",
       x = "Fabbisogno Reale (Somma Giornaliera)",
       y = "Fabbisogno Previsto dal Modello",
       color = "Tipo Bicicletta") +
  theme_minimal()










