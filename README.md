# MPW Gasification Complex – Digital Twin

**Authors:** Meshari A. Almuhaysin and Mohammed F. Alotaibi — Department of Chemical Engineering, King Saud University.

**3D presentation:** https://meesh81118-dotcom.github.io/mpw-digital-twin/presentation/ — a live, interactive tour from orbit down to the plant in Jubail Industrial City (arrow keys to move, click any unit for its data). The **Digital twin** button (or the T key) returns to the twin at the sheet and settings the viewer left.

Interactive digital twin of the mixed-plastic-waste (MPW) gasification plant that produces methanol and hydrogen in Jubail Industrial City. It was prepared for Chapter 10, *Smart and Sustainable Plant*, of the senior design project.

**Open the tool:** https://meesh81118-dotcom.github.io/mpw-digital-twin/

The site runs entirely in the browser. The **Share** button copies a link that reopens the twin with the same feed, set points and market. It needs no installation and no server. One button (**Reset all**) returns every page to the design point.

| Page | Content |
|---|---|
| Overview | Key figures of the complex, the five process sections and a live snapshot of the twin |
| Process | Detailed flowsheet of Figures 3.79 and 4.18: equipment symbols, live flows, a data sheet for every unit, a stream table and a heat-integration view |
| Operations | Set points β, φ, ρ and feed rate; AI search for the design point, safe operation, maximum profit, maximum throughput, maximum methanol or maximum hydrogen |
| Heat integration | Pinch analysis (problem table, composite and grand composite curves), ΔTmin trade-off, area target, heat-exchanger network, comparison with Aspen Energy Analyzer, and the effect of heat integration on energy, economics, environment, equipment, control and operation |
| Control | TC-310 loop simulator (P, PI, PID; five tuning methods of Table 6.15), Routh stability, the instrument loop index and both P&IDs |
| Economics | Economic inputs (prices, equipment costs, land, construction period, operating life, cost index, escalation, depreciation, tax and working capital), cash flow, NPV against interest rate and time, bare-module costs, cost of manufacturing, tornado sensitivity and the Monte Carlo simulation of Appendix G |
| Market | Prices of 2025–2026, the risk levels of the 2026 Gulf and Red Sea crisis and 14 scenarios, each also solved at the AI set point |
| Monitoring | PCA fault detection (T², Q) and k-NN diagnosis of five faults |
| e-Methanol | Solar e-methanol from the purge gas |
| Validation | Every model checked against the values of the report |
| Feedstock lab | Polymer mix (HDPE, LDPE, PP, PS, PET, PVC), moisture and inerts of the waste, a pre-treatment line and its AI optimum; the R-101 balance of Section 2.2 is solved for any feed, and the feed drives every other sheet. Feed-quality alarms (HCl, furnace duty, ash, gas quality, flammability), the fingerprint of each polymer and a day of 288 truck deliveries |
| Sustainability and Vision 2030 | The journey of the carbon (Sankey), the CO₂ ledger against the routes the plant replaces with editable emission factors, the national goals served and the 4R circular-carbon framework |

## Files

* `index.html` – the published site (a single file built from `site/`).
* `pid_base.webp`, `pid_hi.webp` – the P&IDs of Figures 6.22 and 6.26.
* `art/` – line drawings of the plant and its units, rendered from the project's 3D model.
* `fonts/` – IBM Plex Sans and Big Shoulders Display, used under the SIL Open Font License (licence texts included).
* `site/` – source files of the site; `python3 build.py` rebuilds `index.html`.
* `code/` – the Python scripts of Appendices G and H (NumPy, SciPy and scikit-learn). Run `plant_model.py` first; each script prints its results and saves them to a small JSON file.

## Design

The site is laid out as the plant's own drawing set: every page is a numbered sheet with its title block (drawing number, source chapter, authors and issue date), the overview opens with the live mass balance of the complex, and the drawings come straight from the 3D model. Light theme: whiteprint; dark theme: blueprint.

## Copyright

© 2026 Meshari A. Almuhaysin and Mohammed F. Alotaibi. All rights reserved. See `LICENSE`: the pages may be viewed in a browser, but no part of this work may be copied, republished or reused without the written permission of the authors.
