# MPW Plant Digital Twin

Interactive digital twin of the mixed-plastic-waste (MPW) gasification plant for the production of methanol and hydrogen (Jubail Industrial City), prepared for Chapter 10 *Smart and Sustainable Plant* of the senior design project.

**Open the tool:** https://meesh81118-dotcom.github.io/mpw-digital-twin/

The page runs entirely in the browser (no installation, no server):

1. **Plant operation** – live flowsheet, equipment loads, NPV and the operating modes (design point, safe operation, maximum profit, maximum throughput, maximum methanol, maximum hydrogen).
2. **Market and crisis scenarios** – the scenarios of Chapter 8 (price changes, Gulf and Red Sea crisis, Hormuz and Houthi disruption levels, pre-war prices, gate fee, income tax) and an energy shock of the Russia–Ukraine type.
3. **Fault monitoring** – PCA monitoring (T² and Q) of the five faults of Section 10.3 with diagnosis and operator action.
4. **e-Methanol extension** – solar e-methanol from the purge gas (Section 10.4).
5. **Model and validation** – comparison with the values of the report.

## Codes

The folder `code` contains the Python scripts of Appendix H (NumPy, SciPy and scikit-learn). Run `plant_model.py` first; each script prints its results and saves them to a small JSON file.
