# ---- 0. LIBRERIE -------------------------------------------------------
pacchetti <- c("nnet", "MASS", "glmnet", "rpart", "earth",
               "ipred", "adabag", "e1071", "ranger")
invisible(lapply(pacchetti, function(p)
  if (!requireNamespace(p, quietly = TRUE)) install.packages(p)))
invisible(lapply(pacchetti, library, character.only = TRUE))

set.seed(2024)



dati = read.csv("Uganda.csv")


library(skimr)

dati$report_date <- NULL 
dati$source <- NULL
dati$clean_country_id <- NULL
dati$clean_country_name <- NULL
dati$clean_adm3 <- NULL
dati$clean_adm4 <- NULL
dati$activity_id <- NULL
dati$scheme_id <- NULL
dati$wpdx_id <- NULL
dati$subjective_quality <- NULL
dati$installer <- NULL
dati$rehabilitator <- NULL
dati$X <- NULL
dati$orig_lnk <- NULL
dati$notes <- NULL
dati$facility_type <- NULL
dati$created_timestamp <- NULL
dati$dataset_title <- NULL
dati$days_since_report <- NULL
dati$clean_adm2 <- NULL
dati$rehab_year <- NULL
dati$fecal_coliform_presence <- NULL
dati$rehab_priority <- NULL
dati$would_gain_access <- NULL
dati$fecal_coliform_value <- NULL
dati$status_id <- NULL
dati$water_tech_clean <- NULL
dati$water_source_clean <- NULL 

dati$local_population = ifelse(is.na(dati$local_population), median(dati$local_population, na.rm = TRUE), dati$local_population)
dati$assigned_population = ifelse(is.na(dati$assigned_population), median(dati$assigned_population, na.rm = TRUE), dati$assigned_population)
dati$criticality = ifelse(dati$local_population == 0,  dati$assigned_population / 1,  dati$assigned_population / dati$local_population)
dati$usage_cap = ifelse(is.na(dati$usage_cap), median(dati$usage_cap, na.rm = TRUE), dati$usage_cap)
dati$pressure = dati$assigned_population / dati$usage_cap
dati$install_year = ifelse(is.na(dati$install_year), median(dati$install_year, na.rm = TRUE), dati$install_year)


dati[sapply(dati, is.character)] <- lapply(dati[sapply(dati, is.character)], as.factor)

# 2. Grafico della distribuzione di install_year
library(ggplot2)
ggplot(dati, aes(x = install_year)) +
  geom_histogram(binwidth = 1, fill = "steelblue", color = "black", na.rm = TRUE) +
  theme_minimal() +
  labs(
    title = "Distribuzione di install_year", 
    x = "Anno di installazione", 
    y = "Frequenza"
  )



posizione = which(names(dati)=="status_clean")
names(dati)[posizione]="y"





# ---- 1. FUNZIONE DI VALUTAZIONE (fornita — non modificare) --------------
fun.errori_multiclasse <- function(previsti, osservati) {
  # Creazione della matrice di confusione
  n <- table(factor(previsti, levels = unique(osservati)),
             factor(osservati, levels = unique(osservati)))
  
  # Errore totale (Accuracy complementare)
  err.tot <- 1 - sum(diag(n)) / sum(n)
  
  # Inizializzazione delle metriche per ogni classe
  classi <- colnames(n)
  fp <- numeric(length(classi)) # Falsi positivi
  fn <- numeric(length(classi)) # Falsi negativi
  
  for (i in seq_along(classi)) {
    tp <- n[i, i]                     # True positives per la classe i
    fp[i] <- sum(n[i, ]) - tp         # Falsi positivi per la classe i
    fn[i] <- sum(n[, i]) - tp         # Falsi negativi per la classe i
  }
  
  precision <- diag(n) / rowSums(n)           # Precision per classe
  recall <- diag(n) / colSums(n)              # Recall per classe
  f1 <- 2 * (precision * recall) / (precision + recall) # F1-score per classe
  
  print(n)
  cat("Errore totale: ", format(err.tot), "\n")
  for (i in seq_along(classi)) {
    cat("Classe:", classi[i], "\n")
    cat("  Precisione:", format(precision[i]),
        " Recall:", format(recall[i]),
        " F1:", format(f1[i]), "\n")
  }
  invisible(list(confusion_matrix = n,
                 total_error = err.tot,
                 precision = precision,
                 recall = recall,
                 F1 = f1))
}

# Funzione "muta" (nessuna stampa) usata SOLO dentro i loop di tuning,
# per non spammare la console — la leaderboard finale usa sempre
# fun.errori_multiclasse
fun.errore_rapido <- function(previsti, osservati) {
  mean(as.character(previsti) != as.character(osservati))
}





lvl  <- levels(dati$y)
n    <- nrow(dati)

# ---- 3. SPLIT stima (75%) / verifica (25%) -----------------------------
id_stima    <- sample(seq_len(n), 0.75 * n)
id_verifica <- setdiff(seq_len(n), id_stima)

stima    <- dati[id_stima, ]
verifica <- dati[id_verifica, ]
y_verifica <- verifica$y

# ---- 4. SPLIT interno cb1 (70%) / cb2 (30%) su "stima" -----------------
n_stima <- nrow(stima)
cb1 <- sample(seq_len(n_stima), 0.70 * n_stima)
cb2 <- setdiff(seq_len(n_stima), cb1)

train_cb1 <- stima[cb1, ]
train_cb2 <- stima[cb2, ]
y_cb1 <- train_cb1$y
y_cb2 <- train_cb2$y

# ---- 5. MATRICI DI DISEGNO (per Lasso / SVM) ---------------------------
# Costruite una sola volta e riusate: garantisce coerenza delle colonne
# dummy tra stima, cb1, cb2 e verifica
frm <- y ~ .
x_stima    <- model.matrix(frm, data = stima)[, -1]
x_cb1      <- model.matrix(frm, data = train_cb1)[, -1]
x_cb2      <- model.matrix(frm, data = train_cb2)[, -1]
x_verifica <- model.matrix(frm, data = verifica)[, -1]

# ---- 6. STRUTTURE DI OUTPUT ---------------------------------------------
tab_confronto <- data.frame(Modello = character(), Errore = numeric())
lista_probs   <- list()   # matrici di probabilita' per il calibration plot

aggiungi_riga <- function(tab, nome, previsti, osservati) {
  cat("\n==============================\n", nome, "\n==============================\n")
  err <- fun.errori_multiclasse(previsti, osservati)$total_error
  rbind(tab, data.frame(Modello = nome, Errore = err))
}

# =========================================================================
# MODELLO 1 — MULTINOMIALE (stepwise AIC)
# =========================================================================
m_multi_full <- multinom(y ~ ., data = stima, trace = FALSE, maxit = 300)
m_multi <- step(m_multi_full, trace = 0)

pr_multi_class <- predict(m_multi, newdata = verifica, type = "class")
pr_multi_prob  <- predict(m_multi, newdata = verifica, type = "probs")

tab_confronto <- aggiungi_riga(tab_confronto, "Multinomiale (step AIC)",
                               pr_multi_class, y_verifica)
lista_probs[["Multinomiale"]] <- pr_multi_prob





# =========================================================================
# MODELLO 2 — LDA
# =========================================================================
m_lda <- lda(y ~ ., data = stima)
pr_lda <- predict(m_lda, newdata = verifica)

tab_confronto <- aggiungi_riga(tab_confronto, "LDA", pr_lda$class, y_verifica)
lista_probs[["LDA"]] <- pr_lda$posterior

# =========================================================================
# MODELLO 3 — LASSO MULTINOMIALE (tuning lambda su cb1/cb2)
# =========================================================================
grid_lambda <- 10^seq(2, -4, length.out = 10)

m_lasso_cb1 <- glmnet(x_cb1, y_cb1, family = "multinomial",
                      alpha = 1, lambda = grid_lambda)

pr_cb2_class <- predict(m_lasso_cb1, newx = x_cb2, s = grid_lambda, type = "class")
err_lambda <- apply(pr_cb2_class, 2, fun.errore_rapido, osservati = y_cb2)
lambda_best <- grid_lambda[which.min(err_lambda)]

plot(log(grid_lambda), err_lambda, type = "l",
     xlab = "log(lambda)", ylab = "errore su cb2",
     main = "Lasso multiclasse — tuning hold-out")
abline(v = log(lambda_best), col = 2, lwd = 2)

# Rifitto su tutto lo "stima" con il lambda scelto
m_lasso_final <- glmnet(x_stima, stima$y, family = "multinomial",
                        alpha = 1, lambda = grid_lambda)

pr_lasso_class <- as.vector(predict(m_lasso_final, newx = x_verifica,
                                    s = lambda_best, type = "class"))
pr_lasso_prob  <- predict(m_lasso_final, newx = x_verifica,
                          s = lambda_best, type = "response")[, , 1]

tab_confronto <- aggiungi_riga(tab_confronto, "Lasso", pr_lasso_class, y_verifica)
lista_probs[["Lasso"]] <- pr_lasso_prob

# =========================================================================
# MODELLO 4 — ALBERO DI CLASSIFICAZIONE (rpart, potatura su cb1/cb2)
# =========================================================================
m_tree_grow <- rpart(y ~ ., data = train_cb1, method = "class",
                     control = rpart.control(cp = 0, minsplit = 5, xval = 0))

cp_seq <- unique(m_tree_grow$cptable[, "CP"])
err_cp <- sapply(cp_seq, function(cp) {
  pr <- predict(prune(m_tree_grow, cp = cp), newdata = train_cb2, type = "class")
  fun.errore_rapido(pr, y_cb2)
})
cp_best <- cp_seq[which.min(err_cp)]

plot(cp_seq, err_cp, type = "b", xlab = "cp", ylab = "errore su cb2",
     main = "Potatura albero — tuning hold-out")
abline(v = cp_best, col = 2, lty = 2)

m_tree_final <- rpart(y ~ ., data = stima, method = "class",
                      control = rpart.control(cp = cp_best, minsplit = 5))

pr_tree_class <- predict(m_tree_final, newdata = verifica, type = "class")
pr_tree_prob  <- predict(m_tree_final, newdata = verifica, type = "prob")

tab_confronto <- aggiungi_riga(tab_confronto, "Albero (rpart)", pr_tree_class, y_verifica)
lista_probs[["Albero"]] <- pr_tree_prob

# =========================================================================
# MODELLO 5 — MARS (earth, tuning nprune su cb1/cb2)
# =========================================================================
grid_nprune <- seq(5, 30, by = 5)

err_nprune <- sapply(grid_nprune, function(np) {
  m_p <- earth(y ~ ., data = train_cb1, degree = 2, nprune = np)
  pr  <- predict(m_p, newdata = train_cb2, type = "class")
  fun.errore_rapido(pr, y_cb2)
})
nprune_best <- grid_nprune[which.min(err_nprune)]

plot(grid_nprune, err_nprune, type = "b", xlab = "nprune", ylab = "errore su cb2",
     main = "MARS — tuning hold-out")
abline(v = nprune_best, col = 2, lty = 2)

m_mars_final <- earth(y ~ ., data = stima, degree = 2, nprune = nprune_best)

pr_mars_class <- predict(m_mars_final, newdata = verifica, type = "class")
pr_mars_resp  <- predict(m_mars_final, newdata = verifica, type = "response")
# earth non produce vere probabilita' per risposte multiclasse: normalizzo
# a somma 1 per poterle usare nel calibration plot (quasi-probabilita')
pr_mars_prob <- pr_mars_resp / rowSums(pr_mars_resp)

tab_confronto <- aggiungi_riga(tab_confronto, "MARS (earth)", pr_mars_class, y_verifica)
lista_probs[["MARS"]] <- pr_mars_prob

# =========================================================================
# MODELLO 6 — BAGGING (ipred, tuning nbagg su cb1/cb2)
# =========================================================================
grid_nbagg <- c(25, 50, 100, 150)

err_nbagg <- sapply(grid_nbagg, function(nb) {
  m_b <- bagging(y ~ ., data = train_cb1, nbagg = nb)
  pr  <- predict(m_b, newdata = train_cb2, type = "class")
  fun.errore_rapido(pr, y_cb2)
})
nbagg_best <- grid_nbagg[which.min(err_nbagg)]

m_bag_final <- bagging(y ~ ., data = stima, nbagg = nbagg_best)

pr_bag_class <- predict(m_bag_final, newdata = verifica, type = "class")
pr_bag_prob  <- predict(m_bag_final, newdata = verifica, type = "prob")

tab_confronto <- aggiungi_riga(tab_confronto, "Bagging (ipred)", pr_bag_class, y_verifica)
lista_probs[["Bagging"]] <- pr_bag_prob

# =========================================================================
# MODELLO 7 — BOOSTING (adabag::boosting, tuning mfinal su cb1/cb2)
# =========================================================================
grid_mfinal <- c(20, 50, 100)

err_mfinal <- sapply(grid_mfinal, function(mf) {
  m_bo <- boosting(y ~ ., data = train_cb1, mfinal = mf,
                   control = rpart.control(maxdepth = 3))
  pr <- predict(m_bo, newdata = train_cb2)$class
  fun.errore_rapido(pr, y_cb2)
})
mfinal_best <- grid_mfinal[which.min(err_mfinal)]

m_boost_final <- boosting(y ~ ., data = stima, mfinal = mfinal_best,
                          control = rpart.control(maxdepth = 3))
pred_boost <- predict(m_boost_final, newdata = verifica)

pr_boost_class <- factor(pred_boost$class, levels = lvl)
pr_boost_prob  <- pred_boost$prob
colnames(pr_boost_prob) <- sort(lvl)   # adabag ordina le colonne alfabeticamente

tab_confronto <- aggiungi_riga(tab_confronto, "Boosting (adabag)", pr_boost_class, y_verifica)
lista_probs[["Boosting"]] <- pr_boost_prob[, lvl]

# =========================================================================
# MODELLO 8 — SVM RADIALE (e1071, tuning cost/gamma su cb1/cb2)
# =========================================================================
grid_svm <- expand.grid(cost = c(0.1, 1, 10), gamma = c(0.01, 0.1, 1))

err_svm <- apply(grid_svm, 1, function(pars) {
  m_s <- svm(y ~ ., data = train_cb1, kernel = "radial",
             cost = pars[["cost"]], gamma = pars[["gamma"]])
  pr  <- predict(m_s, newdata = train_cb2)
  fun.errore_rapido(pr, y_cb2)
})
best_svm <- grid_svm[which.min(err_svm), ]

m_svm_final <- svm(y ~ ., data = stima, kernel = "radial",
                   cost = best_svm$cost, gamma = best_svm$gamma,
                   probability = TRUE)

pr_svm_class <- predict(m_svm_final, newdata = verifica)
pr_svm_prob  <- attr(predict(m_svm_final, newdata = verifica, probability = TRUE),
                     "probabilities")[, lvl]

tab_confronto <- aggiungi_riga(tab_confronto, "SVM (radiale)", pr_svm_class, y_verifica)
lista_probs[["SVM"]] <- pr_svm_prob

# =========================================================================
# MODELLO 9 — RANDOM FOREST (ranger, tuning mtry su cb1/cb2)
# =========================================================================
p <- ncol(stima) - 1
grid_mtry <- unique(pmax(1, pmin(p, round(seq(2, 2 * sqrt(p), length.out = 5)))))

err_mtry <- sapply(grid_mtry, function(m) {
  m_r <- ranger(y ~ ., data = train_cb1, num.trees = 300, mtry = m)
  pr  <- predict(m_r, data = train_cb2)$predictions
  fun.errore_rapido(pr, y_cb2)
})
mtry_best <- grid_mtry[which.min(err_mtry)]

plot(grid_mtry, err_mtry, type = "b", xlab = "mtry", ylab = "errore su cb2",
     main = "Random Forest — tuning hold-out")
abline(v = mtry_best, col = 2, lty = 2)

m_rf_final <- ranger(y ~ ., data = stima, num.trees = 500, mtry = mtry_best,
                     probability = TRUE, importance = "impurity")

pr_rf_prob  <- predict(m_rf_final, data = verifica)$predictions
pr_rf_class <- factor(colnames(pr_rf_prob)[apply(pr_rf_prob, 1, which.max)], levels = lvl)

tab_confronto <- aggiungi_riga(tab_confronto, "Random Forest (ranger)", pr_rf_class, y_verifica)
lista_probs[["Random Forest"]] <- pr_rf_prob[, lvl]

sort(m_rf_final$variable.importance, decreasing = TRUE)   # per commentare l'importanza variabili

# =========================================================================
# LEADERBOARD FINALE
# =========================================================================
tab_confronto <- tab_confronto[order(tab_confronto$Errore), ]
rownames(tab_confronto) <- NULL
print(tab_confronto)

# =========================================================================
# CALIBRATION PLOT (tutti i modelli)
# =========================================================================
fun.calibration_plot <- function(lista_probs, osservati, n_bin = 10) {
  # Per ciascun modello: prende la probabilita' massima (confidenza) di ogni
  # previsione e la confronta con la frequenza empirica di risposte corrette
  # nello stesso "bin" di confidenza (reliability diagram multiclasse)
  colori <- rainbow(length(lista_probs))
  plot(0:1, 0:1, type = "l", lty = 2, col = "grey40", lwd = 2,
       xlab = "Probabilita' prevista (confidenza)",
       ylab = "Frequenza osservata di risposte corrette",
       main = "Calibration Plot — confronto modelli")
  for (i in seq_along(lista_probs)) {
    prob_mat <- lista_probs[[i]]
    classi_previste <- colnames(prob_mat)[apply(prob_mat, 1, which.max)]
    confidenza <- apply(prob_mat, 1, max)
    corretto <- as.numeric(classi_previste == as.character(osservati))
    bin <- cut(confidenza, breaks = seq(0, 1, length.out = n_bin + 1), include.lowest = TRUE)
    media_conf <- tapply(confidenza, bin, mean)
    freq_oss   <- tapply(corretto, bin, mean)
    lines(media_conf, freq_oss, type = "b", col = colori[i], lwd = 2, pch = 16)
  }
  legend("bottomright", legend = names(lista_probs), col = colori,
         lwd = 2, pch = 16, bty = "n", cex = 0.8)
}

fun.calibration_plot(lista_probs, y_verifica, n_bin = 10)
