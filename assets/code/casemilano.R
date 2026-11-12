# ==============================================================================
# 0. INIZIALIZZAZIONE E LIBRERIE
# ==============================================================================
rm(list = ls())

library(tidyverse)
library(dplyr)
library(ggplot2)
library(glmnet)    # Penalizzazioni (Lasso/Ridge)
library(earth)     # MARS
library(tree)      # Alberi decisionali
library(ranger)    # Random Forest veloce
library(skimr)     # Statistiche descrittive
library(lme4)      # Modelli a Effetti Misti (Fondamentale per il mercato immobiliare e zone rare)

# setwd("percorso/della/cartella/Dati")

# ==============================================================================
# 1. CARICAMENTO DATI E CREAZIONE DUMMY
# ==============================================================================
dati <- read.csv("casemilano.csv", fileEncoding = "latin1") 

# Trasformazione testuale delle caratteristiche in colonne booleane (0/1)
fibra       <- grepl("fibra ottica", dati$altre.caratteristiche, fixed = TRUE)
porta       <- grepl("porta di sicurezza", dati$altre.caratteristiche, fixed = TRUE)
terrazza    <- grepl("terrazza", dati$altre.caratteristiche, fixed = TRUE) | grepl("terrace", dati$altre.caratteristiche, fixed = TRUE)
cantina     <- grepl("cantina", dati$altre.caratteristiche, fixed = TRUE)
citofono    <- grepl("videocitofono", dati$altre.caratteristiche, fixed = TRUE)
allarme     <- grepl("sistema d'allarme", dati$altre.caratteristiche, fixed = TRUE)
cancello    <- grepl("cancello elettrico", dati$altre.caratteristiche, fixed = TRUE)
attico      <- grepl("attico", dati$altre.caratteristiche, fixed = TRUE)
piscina     <- grepl("piscina", dati$altre.caratteristiche, fixed = TRUE) | grepl("pool", dati$altre.caratteristiche, fixed = TRUE)
arredato    <- grepl("arredato", dati$altre.caratteristiche, fixed = TRUE)
giardino    <- grepl("giardino privato", dati$altre.caratteristiche, fixed = TRUE) | grepl("private garden", dati$altre.caratteristiche, fixed = TRUE)
portinaio   <- grepl("portinaio tutto il giorno", dati$altre.caratteristiche, fixed = TRUE) | grepl("full day concierge", dati$altre.caratteristiche, fixed = TRUE)

df_dummy_12 <- data.frame(
  dummy_fibra_ottica = as.integer(fibra),
  dummy_porta_sicura = as.integer(porta),
  dummy_terrazza     = as.integer(terrazza),
  dummy_cantina      = as.integer(cantina),
  dummy_citofono     = as.integer(citofono),
  dummy_allarme      = as.integer(allarme),
  dummy_cancello     = as.integer(cancello),
  dummy_attico       = as.integer(attico),
  dummy_piscina      = as.integer(piscina),
  dummy_arredato     = as.integer(arredato),
  dummy_giardino     = as.integer(giardino),
  dummy_portinaio    = as.integer(portinaio)
)

dati <- cbind(dati, df_dummy_12)
rm(df_dummy_12) # Pulizia ambiente

# ==============================================================================
# 2. TRASFORMAZIONE VARIABILI E GESTIONE VALORI MANCANTI
# ==============================================================================
# Rimuovo colonne non predittive
dati$altre.caratteristiche <- NULL
dati$s <- NULL
dati$w <- NULL
dati$disponibile <- NULL
dati$spese.condominiali <- NULL

# Ricodifica manuale delle logiche factor e imputazione dei "missing"
dati$parcheggio <- as.factor(ifelse(dati$parcheggio == "no", "no", "si"))
dati$classe.di.efficienza.energetica <- as.factor(ifelse(dati$classe.di.efficienza.energetica %in% c("a","b","c", "d", "e", "f", "g"), dati$classe.di.efficienza.energetica, "missing"))
dati$numero.bagni <- as.factor(ifelse(is.na(dati$numero.bagni), "missing", dati$numero.bagni))
dati$riscaldamento.centralizzato <- as.factor(ifelse(is.na(dati$riscaldamento.centralizzato), "missing", dati$riscaldamento.centralizzato))
dati$condizioni <- as.factor(ifelse(is.na(dati$condizioni), "missing", dati$condizioni))
dati$ascensore <- as.factor(ifelse(is.na(dati$ascensore), "missing", dati$ascensore))
dati$numero.stanze <- as.factor(dati$numero.stanze)
dati$zona <- as.factor(dati$zona)

# Accorpamento logico dei piani
dati$piano_grp <- dati$piano
dati$piano_grp[dati$piano %in% c("1", "2", "3")] <- "Bassi (1-3)"
dati$piano_grp[dati$piano %in% c("4", "5", "6")] <- "Medi (4-6)"
dati$piano_grp[dati$piano %in% c("7", "8", "9")] <- "Alti (7-9)"
dati$piano_grp[dati$piano %in% c("piano terra", "soppalco")] <- "Terra/Soppalco"
dati$piano <- factor(dati$piano_grp, levels = c("seminterrato", "Terra/Soppalco", "Bassi (1-3)", "Medi (4-6)", "Alti (7-9)"))
dati$piano_grp <- NULL

# Piani totali dell'edificio (Raggruppamento tramite cut)
dati$numero.totale.piani.edificio <- as.numeric(ifelse(dati$numero.totale.piani.edificio == "1 piano" | is.na(dati$numero.totale.piani.edificio), 1, dati$numero.totale.piani.edificio))
dati$numero.totale.piani.edificio <- cut(dati$numero.totale.piani.edificio, breaks = c(0, 1, 5, 10, 15, Inf), labels = c("1", "2-5", "6-10", "11-15", ">15"))

# Pulizia rigorosa e finale di qualsiasi NA residuo per impedire blocchi matematici
dati <- na.omit(dati)

# Salviamo questo dataset base per i modelli classici
dati_factor <- dati 

# ==============================================================================
# 3. ESPLORAZIONE DATI (EDA)
# ==============================================================================
skim(dati_factor)

par(mfrow=c(2,3))
plot(dati_factor$prezzo, main="Prezzo")
hist(dati_factor$prezzo, main="Istogramma Prezzo")
plot(dati_factor$metri.quadrati, dati_factor$prezzo, main="Mq vs Prezzo")
plot(dati_factor$anno.di..Costruzione, dati_factor$prezzo, xlim = c(1900,2025), main="Anno vs Prezzo")
plot(dati_factor$numero.stanze, dati_factor$prezzo, main="Stanze vs Prezzo")
plot(dati_factor$classe.di.efficienza.energetica, dati_factor$prezzo, main="Classe En. vs Prezzo")
par(mfrow=c(1,1)) 

# ==============================================================================
# 4. DATA SPLITTING E INIZIALIZZAZIONE LEADERBOARD
# ==============================================================================
n <- nrow(dati_factor)

set.seed(123)
idx_verifica <- sample(1:n, round(0.30 * n))
idx_stima_tot <- setdiff(1:n, idx_verifica)

set.seed(28)
idx_cb1 <- sample(idx_stima_tot, trunc(length(idx_stima_tot) * 3/4))
idx_cb2 <- setdiff(idx_stima_tot, idx_cb1)

# Assegnazione di servizio che verrà poi sganciata per evitare l'errore "nuovo livello"
dati_factor$set_modello <- character(n)
dati_factor$set_modello[idx_verifica] <- "verifica"
dati_factor$set_modello[idx_cb1] <- "cb1"
dati_factor$set_modello[idx_cb2] <- "cb2"

# Funzione metriche 
get_err <- function(y_hat, y_oss) {
  mse <- mean((y_hat - y_oss)^2, na.rm = TRUE)
  mae <- mean(abs(y_hat - y_oss), na.rm = TRUE)
  return(data.frame(mse = mse, mae = mae))
}

tab_confronto <- data.frame(Modello = character(), MSE = numeric(), MAE = numeric(), stringsAsFactors = FALSE)

# ==============================================================================
# 5. MODELLI LINEARI (BASE E STEPWISE)
# ==============================================================================
# Estrazione set e successiva distruzione della colonna set_modello
dati_cb1_f <- dati_factor[dati_factor$set_modello == "cb1", ]
dati_cb2_f <- dati_factor[dati_factor$set_modello == "cb2", ]
dati_stima_f <- dati_factor[dati_factor$set_modello != "verifica", ]
dati_verifica_f <- dati_factor[dati_factor$set_modello == "verifica", ]

dati_cb1_f$set_modello <- NULL
dati_cb2_f$set_modello <- NULL
dati_stima_f$set_modello <- NULL
dati_verifica_f$set_modello <- NULL

# Ora si può usare la formula pulita "prezzo ~ ."
m_lin <- lm(prezzo ~ ., data = dati_stima_f)
p_lin <- predict(m_lin, newdata = dati_verifica_f)

err_lin <- get_err(p_lin, dati_verifica_f$prezzo)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "Modello Lineare Base", MSE = err_lin$mse, MAE = err_lin$mae))

m_step <- step(m_lin, direction = "backward", trace = 0)
p_step <- predict(m_step, newdata = dati_verifica_f)

err_step <- get_err(p_step, dati_verifica_f$prezzo)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "Lineare Stepwise", MSE = err_step$mse, MAE = err_step$mae))

# ==============================================================================
# 6. REGRESSIONE PENALIZZATA (LASSO)
# ==============================================================================
# Identifico e standardizzo le sole variabili numeriche esplicative
is_num <- sapply(dati_factor, is.numeric)
var_espl_num <- names(dati_factor)[is_num & names(dati_factor) != "prezzo"]

dati_scale <- dati_factor
dati_scale[, var_espl_num] <- scale(dati_scale[, var_espl_num])

# Memorizzo gli indici dalle righe e poi elimino set_modello per creare la matrice
idx_cb1_s <- which(dati_scale$set_modello == "cb1")
idx_cb2_s <- which(dati_scale$set_modello == "cb2")
idx_ver_s <- which(dati_scale$set_modello == "verifica")

dati_scale$set_modello <- NULL 

# Creo matrice per glmnet
x_tot <- model.matrix(prezzo ~ . - 1, data = dati_scale)
y_tot <- dati_scale$prezzo

m_lasso <- glmnet(x_tot[idx_cb1_s, ], y_tot[idx_cb1_s], alpha = 1, standardize = FALSE)
y_cb2 <- predict(m_lasso, newx = x_tot[idx_cb2_s, ])
errori_cb2 <- apply((y_tot[idx_cb2_s] - y_cb2)^2, 2, mean)
lambda_ottimo <- m_lasso$lambda[which.min(errori_cb2)]

y_lasso <- as.numeric(predict(m_lasso, newx = x_tot[idx_ver_s, ], s = lambda_ottimo))
err_lasso <- get_err(y_lasso, y_tot[idx_ver_s])
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "Lasso", MSE = err_lasso$mse, MAE = err_lasso$mae))

# ==============================================================================
# 7. REGRESSIONE NON LINEARE (MARS)
# ==============================================================================
m_mars_cb1 <- earth(prezzo ~ ., data = dati_cb1_f, degree = 2, nk = 100, pmethod = "backward")
griglia_nprune <- if(length(m_mars_cb1$selected.terms) < 2) 2 else 2:length(m_mars_cb1$selected.terms)
mse_cb2_mars <- numeric(length(griglia_nprune))

# Tuning
for (i in seq_along(griglia_nprune)) {
  mod_pruned <- update(m_mars_cb1, nprune = griglia_nprune[i], ponly = TRUE)
  pred_cb2 <- predict(mod_pruned, newdata = dati_cb2_f)
  mse_cb2_mars[i] <- mean((dati_cb2_f$prezzo - pred_cb2)^2, na.rm = TRUE)
}
best_nprune <- griglia_nprune[which.min(mse_cb2_mars)]

m_mars_finale <- earth(prezzo ~ ., data = dati_stima_f, degree = 2, nprune = best_nprune)
p_mars <- as.numeric(predict(m_mars_finale, newdata = dati_verifica_f))

err_mars <- get_err(p_mars, dati_verifica_f$prezzo)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "MARS", MSE = err_mars$mse, MAE = err_mars$mae))

# ==============================================================================
# 8. MODELLO A EFFETTI MISTI (Random Intercept per la variabile zona)
# ==============================================================================
# Sostituiamo il parametro zona inserendolo come (1|zona) per attivare l'aggregazione parziale
var_fisse <- paste(setdiff(names(dati_stima_f), c("prezzo", "zona")), collapse = " + ")
form_mixed <- as.formula(paste("prezzo ~", var_fisse, "+ (1 | zona)"))

m_mixed <- lmer(form_mixed, data = dati_stima_f, REML = FALSE)
# allow.new.levels impedisce al modello di andare in blocco se trova nuove zone in verifica
p_mixed <- predict(m_mixed, newdata = dati_verifica_f, allow.new.levels = TRUE)

err_mixed <- get_err(p_mixed, dati_verifica_f$prezzo)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "Effetti Misti", MSE = err_mixed$mse, MAE = err_mixed$mae))

# ==============================================================================
# 9. PREPARAZIONE PER ALBERI E RF (Oltre i 32 livelli factor)
# ==============================================================================
dati_alberi <- dati_factor

# Creazione dummy massive per zona
dummy_zona <- as.data.frame(model.matrix(~ zona - 1, data = dati_alberi))
colnames(dummy_zona) <- make.names(colnames(dummy_zona))
dati_alberi <- cbind(dati_alberi, dummy_zona)
dati_alberi$zona <- NULL 

# Splitting pulito
dati_cb1_a <- dati_alberi[dati_alberi$set_modello == "cb1", ]
dati_cb2_a <- dati_alberi[dati_alberi$set_modello == "cb2", ]
dati_stima_a <- dati_alberi[dati_alberi$set_modello != "verifica", ]
dati_verifica_a <- dati_alberi[dati_alberi$set_modello == "verifica", ]

dati_cb1_a$set_modello <- NULL
dati_cb2_a$set_modello <- NULL
dati_stima_a$set_modello <- NULL
dati_verifica_a$set_modello <- NULL

# ==============================================================================
# 10. ALBERO DI REGRESSIONE
# ==============================================================================
m_tree <- tree(prezzo ~ ., data = dati_cb1_a, split = "deviance", control = tree.control(nobs = nrow(dati_cb1_a), minsize = 1, mindev = 0.001))
prune_t <- prune.tree(m_tree, newdata = dati_cb2_a)
J_ottimo <- prune_t$size[which.min(prune_t$dev)]

m_tree_best <- prune.tree(m_tree, best = J_ottimo)
p_tree <- predict(m_tree_best, newdata = dati_verifica_a)

err_tree <- get_err(p_tree, dati_verifica_a$prezzo)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "Albero Regressione", MSE = err_tree$mse, MAE = err_tree$mae))
rm(m_tree, prune_t); gc()

# ==============================================================================
# 11. RANDOM FOREST
# ==============================================================================
colnum <- c(15, 30, 50, 100) 
run_rf <- function(mtry) {
  set.seed(123)
  ranfo <- ranger(prezzo ~ ., data = dati_stima_a, importance = "impurity", num.trees = 100, mtry = mtry)
  c(mtry, ranfo$prediction.error) 
}

rf_err <- do.call(rbind, lapply(colnum, run_rf)) 
bestF <- colnum[which.min(rf_err[, 2])] 

m_rf <- ranger(prezzo ~ ., data = dati_stima_a, num.trees = 200, mtry = bestF, importance = "impurity")
p_rf <- predict(m_rf, data = dati_verifica_a)$predictions

err_rf <- get_err(p_rf, dati_verifica_a$prezzo)
tab_confronto <- rbind(tab_confronto, data.frame(Modello = "Random Forest", MSE = err_rf$mse, MAE = err_rf$mae))

# Visualizza leaderboard ordinata
tab_confronto <- tab_confronto %>% arrange(MAE)
cat("\n--- LEADERBOARD MODELLI ---\n")
print(tab_confronto)


# ==============================================================================
# 12. ANALISI DEI PREZZI PER LE 145 ZONE DI MILANO (PARTIAL POOLING)
# ==============================================================================
# Il Modello a Effetti Misti è stato creato proprio per rispondere al quesito sulle
# zone. Tramite ranef() andiamo a estrarre il "premio o sconto" matematico assegnato 
# in euro a ciascun quartiere, depurato da tutte le altre variabili (es. metratura, piano).
# Il Partial Pooling fa sì che le zone con soli 2-3 dati convergano verso lo zero (la media città).

# 1. Quante osservazioni ci sono per ogni zona nel set di addestramento?
conteggio_zone <- dati_stima_f %>% count(zona, name = "N_osservazioni")

# 2. Estrazione degli effetti casuali per le zone generate dal modello
effetti_zona <- ranef(m_mixed)$zona
effetti_zona$zona <- rownames(effetti_zona)
colnames(effetti_zona)[1] <- "Effetto_Euro_Zona"

# 3. Unione e ordinamento dei dati
analisi_zone <- left_join(conteggio_zone, effetti_zona, by = "zona")
analisi_zone <- analisi_zone %>% arrange(N_osservazioni)

cat("\n--- VALUTAZIONE DELLE ZONE: PREMIO / SCONTO BASE ---\n")
print(analisi_zone)

# 4. Rappresentazione visiva dello Shrinkage
ggplot(analisi_zone, aes(x = N_osservazioni, y = Effetto_Euro_Zona)) +
  geom_point(alpha = 0.6, color = "dodgerblue", size = 2) +
  geom_hline(yintercept = 0, linetype = "dashed", color = "red") +
  scale_x_log10() + 
  labs(title = "Effetto del Quartiere vs. Volumi (Modello Misto)",
       x = "Numero di Osservazioni nel Quartiere (Scala Logaritmica)",
       y = "Premio/Sconto in Euro sul prezzo base",
       subtitle = "Il Partial Pooling tira i punti di sinistra verso lo zero") +
  theme_minimal()
