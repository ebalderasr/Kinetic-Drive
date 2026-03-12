# 🧪 Kinetic Drive | Host Cell Lab Suite

> **Dynamic Bioprocess Analytics for Mammalian Cell Culture.**

**Kinetic Drive** is a interactive web application designed to teach and perform the essential calculations used to characterize mammalian cell cultures, specifically focused on **CHO cells**.

It is part of **Host Cell**, a growing suite of practical laboratory and bioprocess tools built by **Emiliano Balderas** (IBt-UNAM).

<p align="center">
<img src="logo.png" width="350" alt="Kinetic Drive Logo">
</p>

<p align="center">
<a href="[https://ebalderasr.github.io/Kinetic-Drive/](https://ebalderasr.github.io/Kinetic-Drive/)">
<img src="[https://img.shields.io/badge/](https://img.shields.io/badge/)🚀_Launch_Live_App-Kinetic_Drive-312e81?style=for-the-badge&labelColor=000000" alt="Launch Kinetic Drive App">
</a>
</p>

<p align="center">
<a href="[https://github.com/ebalderasr/Kinetic-Drive.git](https://github.com/ebalderasr/Kinetic-Drive.git)">Repo</a> •
<a href="[https://ebalderasr.github.io/Kinetic-Drive/](https://ebalderasr.github.io/Kinetic-Drive/)">Live App</a>
</p>

---

## What is Kinetic Drive?

**Kinetic Drive** bridges the gap between raw experimental data and biological interpretation. In the production of biotherapeutics, understanding the "engine" (the cell) requires more than just looking at final titers; it requires precise kinetic and stoichiometric analysis.

The app is divided into two main modules:

1. **Data Explanation (Real Case):** Walkthrough calculations using a real dataset of viable cell density ($X_v$), Glucose, Lactate, and Product.
2. **Didactic Simulator:** A "sandbox" where users can manipulate biological variables to observe how they impact the overall bioprocess.

---

## 🧬 Scientific Fundamentals

The application implements standard bioprocess engineering formulas to derive performance indicators from discrete sampling points.

### 1. Specific Growth Rate ($\mu$)

While growth is often assumed to be constant, Kinetic Drive calculates $\mu$ per interval to reflect the changing physiology of CHO cells.


$$\mu \approx \frac{\ln(X_{v,2}) - \ln(X_{v,1})}{t_2 - t_1}$$

### 2. Integral of Viable Cell Density (IVCD)

Unlike fast-growing microbial systems, mammalian cultures last for days. The **IVCD** represents the "total cell-hours" or "biomass exposure." It is the most critical parameter for normalizing consumption and production rates. The app uses the **trapezoidal rule**:


$$IVCD_{\Delta t} \approx \sum_{i} \left( \frac{X_{v,i} + X_{v,i+1}}{2} \right) (t_{i+1} - t_i)$$

### 3. Specific Consumption ($q_s$) and Production ($q_p$) Rates

These parameters answer the question: *How much is an individual cell consuming or producing per unit of time?*


$$q_G \approx \frac{Glc_1 - Glc_2}{IVCD_{\Delta t}}$$

$$q_P \approx \frac{P_2 - P_1}{IVCD_{\Delta t}}$$

### 4. Yields and "Apparent" Stoichiometry

The app calculates yields ($Y_{X/S}$, $Y_{P/S}$) as the ratio of produced biomas/product per consumed substrate.

---

## ⚡ Main Sections

### 🔍 Part 1: Explanation (Analysis of Real Data)

This section uses a sample dataset to show the step-by-step transformation of raw data into kinetics.

* **Interactive Selection:** Choose specific intervals (e.g., Day 2 to Day 4) to see the local math.
* **Synchronized Plotting:** Hover over Growth or Metabolite charts to see real-time data correlation.
* **Step-by-Step Breakdown:** View the exact arithmetic substitution for $\mu$, $IVCD$, $q_s$, and $q_p$ for the selected period.

### 🎮 Part 2: Simulator (The Sandbox)

This module uses a **Logistic Growth Model** combined with maintenance coefficients to simulate a batch culture.

* **Parameter Manipulation:** Adjust $\mu_{max}$, initial inoculum ($X_{v,0}$), carrying capacity ($X_{v,max}$), and specific productivity ($q_p$).
* **Trend Visualization:** Observe how increasing growth rate without optimizing yield leads to premature nutrient depletion.
* **Educational Tool:** Perfect for exploring the relationship between doubling time and substrate exhaustion.

---

## ✅ Unit Logic & Conversions

To maintain scientific consistency, the app follows industry-standard units:

* **Density ($X_v$):** $10^6$ cells/mL.
* **IVCD:** $10^6$ cells $\cdot$ day/mL (or h/mL).
* **Glucose/Lactate:** Internal conversion from g/L to **mM** for stoichiometric clarity.
* **Product:** mg/L.
* **Specific Rates:** Results provided in **pmol/cell/day** ($q_s$) and **pg/cell/day** ($q_p$).

---

## 👨‍🔬 Author

**Emiliano Balderas**
Biotechnology Engineer | PhD Student in Biochemistry
*Instituto de Biotecnología (IBt) - UNAM*

---

## 🧩 About Host Cell

**Host Cell** is a growing suite of practical lab and bioprocess tools focused on:

* **Clarity:** Making complex bioprocess math accessible.
* **Speed:** Quick analysis at the bench or in the office.
* **Reproducibility:** Standardizing how we report $q_p$ and $\mu$.

---

**Host Cell Lab Suite** – *Practical tools for high-performance biotechnology.*
