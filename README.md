<div align="center">

# Kinetic Drive

### Interactive Kinetic Analysis for Mammalian Cell Culture

<br>

**[→ Open the live app](https://ebalderasr.github.io/Kinetic-Drive/)**

<br>

[![Stack](https://img.shields.io/badge/Stack-Vanilla_JS_·_Plotly_·_MathJax-4A90D9?style=for-the-badge)]()
[![Focus](https://img.shields.io/badge/Focus-CHO_·_Upstream_Bioprocessing-34C759?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-See_LICENSE-blue?style=for-the-badge)](./LICENSE)
[![Part of](https://img.shields.io/badge/Part_of-Host_Cell_Lab_Suite-5856D6?style=for-the-badge)](https://github.com/ebalderasr)

</div>

---

## What is Kinetic Drive?

Kinetic Drive is a **browser-based kinetic analysis tool** for mammalian cell culture data. It transforms discrete sampling data — viable cell density, glucose, lactate, and product concentration — into the standard kinetic and stoichiometric parameters used in upstream bioprocess development.

The app is built around the workflows that upstream scientists and process engineers actually use at the bench: interval-by-interval calculation of $\mu$, IVCD, specific consumption and production rates, and biomass and product yields.

No installation. No server. Runs entirely in the browser.

---

## Why it matters

In biopharmaceutical manufacturing, understanding cell physiology goes beyond measuring final titer. Process development requires **precise, interval-resolved kinetic analysis** to:

- identify growth phases and metabolic shifts,
- quantify specific productivity ($q_P$) for clone selection and process optimization,
- detect early signs of nutrient limitation or metabolic stress,
- compare conditions across runs with normalized, per-cell metrics.

Kinetic Drive makes this analysis immediate and interactive — removing the spreadsheet friction that slows down bench-side decision-making.

---

## Modules

### Module 1 — Teaching & Analysis (real dataset)

Walks through the complete calculation pipeline using a real **CHO fed-batch dataset** (9 days, sampled daily):

| Variable | Description |
|----------|-------------|
| $X_v$ | Viable cell density (10⁶ cells/mL) |
| Viability (%) | Culture health indicator |
| Glucose (g/L → mM) | Primary carbon source |
| Lactate (g/L → mM) | Metabolic byproduct |
| Product (mg/L) | Recombinant protein titer |

**What you can do:**
- Select any time interval to compute local kinetics
- View step-by-step arithmetic substitution for every parameter
- Inspect interactive Plotly charts with synchronized hover across growth and metabolite curves
- Export the full results table as CSV

### Module 2 — Simulator (sandbox)

A **logistic growth model** with maintenance coefficients lets users manipulate biological parameters and observe their downstream effects in real time:

| Adjustable parameter | Biological meaning |
|----------------------|--------------------|
| $\mu_{max}$ | Maximum specific growth rate |
| $X_{v,0}$ | Initial inoculum density |
| $X_{v,max}$ | Carrying capacity |
| $q_P$ | Specific productivity |

Use this module to explore how growth rate, nutrient exhaustion, and productivity trade-offs interact — before running experiments.

---

## Computed parameters

| Parameter | Formula | Units |
|-----------|---------|-------|
| Specific growth rate | $\mu \approx \dfrac{\ln X_{v,2} - \ln X_{v,1}}{t_2 - t_1}$ | day⁻¹ |
| IVCD (trapezoidal) | $IVCD \approx \sum_i \dfrac{X_{v,i} + X_{v,i+1}}{2}(t_{i+1} - t_i)$ | 10⁶ cells·day/mL |
| Specific glucose consumption | $q_{Glc} \approx \dfrac{Glc_1 - Glc_2}{IVCD_{\Delta t}}$ | pmol/cell/day |
| Specific production rate | $q_P \approx \dfrac{P_2 - P_1}{IVCD_{\Delta t}}$ | pg/cell/day |
| Biomass yield | $Y_{X/S} = \dfrac{\Delta X_v}{\Delta S}$ | cells/mmol |
| Product yield | $Y_{P/S} = \dfrac{\Delta P}{\Delta S}$ | mg/mmol |

All calculations follow per-interval logic, reflecting the phase-dependent physiology of CHO cultures rather than fitting a single global constant.

---

## Tech stack

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Plotly.js](https://img.shields.io/badge/Plotly.js-3F4F75?style=flat-square&logo=plotly&logoColor=white)
![MathJax](https://img.shields.io/badge/MathJax-A52A2A?style=flat-square)

Fully static — no backend, no build step, no dependencies to install. Deploy anywhere that serves HTML.

---

## Part of Host Cell Lab Suite

Kinetic Drive is one tool in the **Host Cell** suite of offline-ready, bench-side bioprocess calculators:

| Tool | Description |
|------|-------------|
| [**Kinetic Drive**](https://github.com/ebalderasr/Kinetic-Drive) | Kinetic & stoichiometric analysis for fed-batch cultures |
| [**CellSplit**](https://github.com/ebalderasr/CellSplit) | Cell passaging calculator from Neubauer counts |
| [**PulseGrowth**](https://github.com/ebalderasr/PulseGrowth) | Growth kinetics (μ, doubling time, IVCD) and feed corrections |
| [**MolarPrep**](https://github.com/ebalderasr/MolarPrep) | Stock solution and dilution planning |
| [**DiluteIt**](https://github.com/ebalderasr/DiluteIt) | Universal dilution calculator (C1V1 = C2V2) |

---

## Author

**Emiliano Balderas Ramírez**
Bioengineer · PhD Candidate in Biochemical Sciences
Instituto de Biotecnología (IBt), UNAM

[![LinkedIn](https://img.shields.io/badge/LinkedIn-emilianobalderas-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/emilianobalderas/)
[![Email](https://img.shields.io/badge/Email-ebalderas%40live.com.mx-D14836?style=flat-square&logo=gmail&logoColor=white)](mailto:ebalderas@live.com.mx)

---

## License & use

This tool is provided for educational and research purposes. The sample dataset included (`Datos.csv`) represents real experimental data from a CHO fed-batch culture. See `LICENSE` for terms.

---

<div align="center"><i>Kinetic Drive — from raw sampling data to per-cell kinetics, in the browser.</i></div>
