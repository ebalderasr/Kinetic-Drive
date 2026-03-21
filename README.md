<div align="center">

# Kinetic Drive

### Interactive kinetic analysis for mammalian cell culture

<a href="https://ebalderasr.github.io/Kinetic-Drive/">
  <img src="logo_app.png" alt="Kinetic Drive" width="120">
</a>

<br>

**[→ Open the live app](https://ebalderasr.github.io/Kinetic-Drive/)**

<br>

[![Stack](https://img.shields.io/badge/Stack-Vanilla_JS_·_Plotly_·_MathJax-4A90D9?style=for-the-badge)]()
[![Focus](https://img.shields.io/badge/Focus-CHO_·_Upstream_Bioprocessing-34C759?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)
[![Part of](https://img.shields.io/badge/Part_of-Host_Cell_Lab_Suite-5856D6?style=for-the-badge)](https://github.com/ebalderasr)

</div>

---

## What is Kinetic Drive?

Kinetic Drive is a **browser-based kinetic analysis tool** for mammalian cell culture data. It transforms discrete sampling data — viable cell density, glucose, lactate, and product concentration — into the standard kinetic and stoichiometric parameters used in upstream bioprocess development.

The app is built around the workflows that upstream scientists and process engineers actually use at the bench: interval-by-interval calculation of $\mu$, IVCD, specific consumption and production rates, and biomass and product yields.

No installation. No server. Runs entirely in the browser.

---

## Why it matters

In biopharmaceutical manufacturing, understanding cell physiology goes beyond measuring final titer. Process development requires precise, interval-resolved kinetic analysis to:

- identify growth phases and metabolic shifts
- quantify specific productivity ($q_P$) for clone selection and process optimization
- detect early signs of nutrient limitation or metabolic stress
- compare conditions across runs with normalized, per-cell metrics

Kinetic Drive makes this analysis immediate and interactive — removing the spreadsheet friction that slows down bench-side decision-making.

---

## How it works

### Module 1 — Teaching & Analysis

Walks through the complete calculation pipeline using a real CHO fed-batch dataset (9 days, sampled daily):

| Variable | Description |
|---|---|
| $X_v$ | Viable cell density (10⁶ cells/mL) |
| Viability (%) | Culture health indicator |
| Glucose (g/L → mM) | Primary carbon source |
| Lactate (g/L → mM) | Metabolic byproduct |
| Product (mg/L) | Recombinant protein titer |

Select any time interval to compute local kinetics. For each parameter, the app shows a step-by-step arithmetic substitution so every number is traceable. Interactive Plotly charts keep growth and metabolite curves synchronized on hover. Results can be exported as CSV.

### Module 2 — Simulator

A logistic growth model with maintenance coefficients lets users manipulate biological parameters and observe their downstream effects in real time:

| Parameter | Biological meaning |
|---|---|
| $\mu_{max}$ | Maximum specific growth rate |
| $X_{v,0}$ | Initial inoculum density |
| $X_{v,max}$ | Carrying capacity |
| $q_P$ | Specific productivity |

Use this module to explore how growth rate, nutrient exhaustion, and productivity trade-offs interact — before running experiments.

---

## Methods

All calculations follow per-interval logic, reflecting the phase-dependent physiology of CHO cultures rather than fitting a single global constant.

| Parameter | Formula | Units |
|---|---|---|
| Specific growth rate | $\mu \approx \dfrac{\ln X_{v,2} - \ln X_{v,1}}{t_2 - t_1}$ | day⁻¹ |
| IVCD | $IVCD \approx \sum_i \dfrac{X_{v,i} + X_{v,i+1}}{2}(t_{i+1} - t_i)$ | 10⁶ cells·day/mL |
| Specific glucose consumption | $q_{Glc} \approx \dfrac{Glc_1 - Glc_2}{IVCD_{\Delta t}}$ | pmol/cell/day |
| Specific production rate | $q_P \approx \dfrac{P_2 - P_1}{IVCD_{\Delta t}}$ | pg/cell/day |
| Biomass yield | $Y_{X/S} = \dfrac{\Delta X_v}{\Delta S}$ | cells/mmol |
| Product yield | $Y_{P/S} = \dfrac{\Delta P}{\Delta S}$ | mg/mmol |

---

## Features

| | |
|---|---|
| **Interval-resolved** | All parameters computed per time interval — no single global fit |
| **Step-by-step substitution** | Full arithmetic shown for every calculation, traceable from raw data |
| **Interactive charts** | Plotly.js plots with synchronized hover across all variables |
| **Simulator** | Logistic growth model for exploring parameter trade-offs before experiments |
| **CSV export** | Download the full results table in one click |
| **No installation** | Fully static — opens in any modern browser, no dependencies |

---

## Tech stack

**Frontend**

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

**Visualization & math**

![Plotly.js](https://img.shields.io/badge/Plotly.js-3F4F75?style=flat-square&logo=plotly&logoColor=white)
![MathJax](https://img.shields.io/badge/MathJax-A52A2A?style=flat-square)

Fully static — no backend, no build step, no dependencies to install.

---

## Project structure

```
Kinetic-Drive/
├── index.html              ← markup only
├── style.css               ← all custom styles
├── logo_app.png
├── logo.png
├── Datos.csv               ← sample CHO fed-batch dataset (real experimental data)
└── js/
    ├── app.js              ← all application logic
    └── translations.js     ← translation strings (ES / EN)
```

---

## Author

**Emiliano Balderas Ramírez**
Bioengineer · PhD Candidate in Biochemical Sciences
Instituto de Biotecnología (IBt), UNAM

[![LinkedIn](https://img.shields.io/badge/LinkedIn-emilianobalderas-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/emilianobalderas/)
[![Email](https://img.shields.io/badge/Email-ebalderas%40live.com.mx-D14836?style=flat-square&logo=gmail&logoColor=white)](mailto:ebalderas@live.com.mx)

---

## Related

[**CellSplit**](https://github.com/ebalderasr/CellSplit) — Neubauer cell counting and passage planning for CHO cultures.

[**Clonalyzer 2**](https://github.com/ebalderasr/Clonalyzer-2) — fed-batch kinetics analysis with clone comparisons and publication-ready plots.

[**CellBlock**](https://github.com/ebalderasr/CellBlock) — shared biosafety cabinet scheduling for cell culture research groups.

---

<div align="center"><i>Kinetic Drive — from raw sampling data to per-cell kinetics, in the browser.</i></div>
