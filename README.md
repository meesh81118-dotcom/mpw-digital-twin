# MPW Gasification Complex – Digital Twin

**3D presentation:** https://meesh81118-dotcom.github.io/mpw-digital-twin/presentation/ — a live, interactive tour from orbit down to the plant in Jubail Industrial City (arrow keys to move, click any unit for its data).

Interactive digital twin of the mixed-plastic-waste (MPW) gasification plant that produces methanol and hydrogen in Jubail Industrial City. It was prepared for Chapter 10, *Smart and Sustainable Plant*, of the senior design project.

**Open the tool:** https://meesh81118-dotcom.github.io/mpw-digital-twin/

The site runs entirely in the browser. It needs no installation and no server. One button (**Reset all**) returns every page to the design point.

| Page | Content |
|---|---|
| Overview | Key figures of the complex, the five process sections and a live snapshot of the twin |
| Process | Detailed flowsheet of Figures 3.79 and 4.18: equipment symbols, live flows, a data sheet for every unit, a stream table and a heat-integration view |
| Operations | Set points β, φ, ρ and feed rate; AI search for the design point, safe operation, maximum profit, maximum throughput, maximum methanol or maximum hydrogen |
| Heat integration | Pinch analysis (problem table, composite and grand composite curves), ΔTmin trade-off, area target, heat-exchanger network, comparison with Aspen Energy Analyzer, and the effect of heat integration on energy, economics, environment, equipment, control and operation |
| Control | TC-310 loop simulator (P, PI, PID; five tuning methods of Table 6.15), Routh stability, the instrument loop index and both P&IDs |
| Economics | Cash flow, NPV against interest rate, bare-module costs, cost of manufacturing, tornado sensitivity and the Monte Carlo simulation of Appendix G |
| Market | Prices of 2025–2026, the risk levels of the 2026 Gulf and Red Sea crisis and 14 scenarios, each also solved at the AI set point |
| Monitoring | PCA fault detection (T², Q) and k-NN diagnosis of five faults |
| e-Methanol | Solar e-methanol from the purge gas |
| Validation | Every model checked against the values of the report |

## Files

* `index.html` – the published site (a single file built from `site/`).
* `pid_base.webp`, `pid_hi.webp` – the P&IDs of Figures 6.22 and 6.26.
* `site/` – source files of the site; `python3 build.py` rebuilds `index.html`.
* `code/` – the Python scripts of Appendices G and H (NumPy, SciPy and scikit-learn). Run `plant_model.py` first; each script prints its results and saves them to a small JSON file.
