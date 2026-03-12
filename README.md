<<<<<<< HEAD
# Kinetic-Drive
=======
# 🧬 Kinetic Drive: The CHO Bioprocess Engine

> **"Don't just watch them grow, master the flow."**

**Kinetic Drive** es un recurso educativo interactivo diseñado para desglosar la complejidad de la cinética y estequiometría en cultivos de células de mamífero (CHO). A diferencia de los sistemas microbianos, el análisis de células CHO requiere un enfoque riguroso en la integración de la biomasa y el manejo de balances de masa en medios complejos.

Esta herramienta integra la metodología de cálculo de **Clonalyzer**  para transformar datos crudos de laboratorio en parámetros cinéticos de alta precisión.

---

## 🚀 Características Principales

* 
**Análisis de Datos Reales**: Procesa variables primarias (Xv, Glucosa, Lactato, Producto) para calcular tasas dinámicas por intervalo.


* 
**Dualidad Matemática**: Presenta cada parámetro en su **forma continua** (definición teórica) y **forma discreta** (implementación computacional).


* **Simulador Didáctico**: Sandbox interactivo con crecimiento logístico para explorar cómo la $\mu_{max}$ y los rendimientos afectan el agotamiento de nutrientes.
* 
**Integración de IVCD**: Visualización clara de la Integral de Densidad Celular Viable, el "puente" indispensable para normalizar consumos en cultivos de larga duración.



---

## 🔬 El Núcleo Científico

### Velocidad Específica de Crecimiento ($\mu$)

Calculada como la pendiente del logaritmo natural de la densidad celular viable respecto al tiempo:


$$\mu = \frac{\ln(X_2) - \ln(X_1)}{t_2 - t_1}$$

### Integral de Densidad Celular Viable (IVCD)

Fundamental para procesos CHO. Representa la exposición total de biomasa en el sistema y se calcula mediante la regla del trapecio:


$$IVCD_{\Delta t} \approx \left( \frac{X_1 + X_2}{2} \right) \Delta t$$

### Rendimientos y Medios Complejos

La herramienta aborda el concepto de **Rendimiento Aparente** ($Y_{X/S}$), esencial cuando se trabaja con medios como **Cellvento® CHO 200** de Merck.

* **Nota Técnica**: En medios complejos, la glucosa no es la única fuente de carbono. El balance estequiométrico considera "asteriscos" fisiológicos donde aminoácidos y piruvato contribuyen al metabolismo central.

---

## 🛠️ Tecnologías Usadas

* **Plotly.js**: Gráficas interactivas con sincronización de *hover* para análisis multivariable.
* **MathJax**: Renderizado profesional de ecuaciones en LaTeX.
* **Tailwind CSS**: Interfaz moderna, responsiva y orientada a la experiencia de usuario (UX).

---

## 📂 Despliegue en GitHub Pages

Para publicar esta herramienta:

1. Sube el archivo `index.html` a un repositorio nuevo llamado `Kinetic-Drive`.
2. Ve a **Settings > Pages**.
3. En "Build and deployment", selecciona la rama `main` y la carpeta `/ (root)`.
4. ¡Listo! Tu masterclass interactiva estará disponible en la web.

---

## 👨‍🔬 Sobre el Autor

**Emiliano Balderas Ramírez** 
>>>>>>> f044afd (v1)
