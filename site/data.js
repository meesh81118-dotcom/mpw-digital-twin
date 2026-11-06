// ===== Report data used by the site (tables of the report) =====
const SNAME = {1: 'MPW feed', 2: 'Shredded MPW to R-101', 3: 'Process water', 4: 'Water / steam from E-101', 5: 'Superheated steam (600 °C)', 6: 'Steam bypass to M-101',
 7: 'Gasifying steam to R-101', 8: 'Raw syngas and char', 9: 'Solid residue (char and ash)', 10: 'Clean syngas', 11: 'Unshifted syngas bypass', 12: 'Syngas to the shift',
 13: 'Syngas and steam to E-103', 14: 'Cooled syngas to R-102', 15: 'Shifted gas to ME-101', 16: 'Hydrogen product', 17: 'Retentate to C-101', 18: 'Compressed fresh gas',
 19: 'Synthesis feed', 20: 'Reactor feed (200 °C)', 21: 'Reactor effluent', 22: 'Cooled effluent (40 °C)', 23: 'Flash vapour', 24: 'Recycle gas', 25: 'Purge gas',
 26: 'Crude methanol', 27: 'Column feed (1 bar)', 28: 'Wastewater (T-101 bottoms)', 29: 'Methanol product', 30: 'Suction condensate', 31: 'Recycle to M-102',
 32: 'Boiling water E-107 → E-106', 33: 'Boiling water E-106 → E-103', 34: 'Saturated steam E-103 → E-102', 35: 'Syngas E-102 → E-103', 36: 'Suction gas to E-106',
 37: 'Suction gas E-106 → E-104', 38: 'Suction gas E-104 → SC-1', 39: 'Effluent E-107 → reboiler', 40: 'Effluent reboiler → E-104 / E-101', 41: 'Effluent branch E-104 → E-105', 42: 'Effluent branch E-101 → E-105'};
const HI_STREAM_T = {32: 100.00, 33: 100.00, 34: 100.00, 35: 547.64, 36: 639.40, 37: 400.91, 38: 109.22, 39: 193.19, 40: 109.22, 41: 82.32, 42: 63.86};
const INSTR = [
 ['WC-101', 'MPW feed (screw feeders)', 'PI', 'Feeder speed', 'Feed'], ['LC-102', 'E-101 A/B drum level', 'PI', 'SP of FC-103', 'Feed'], ['FC-103', 'Process water, Stream 3', 'PI', 'Water valve', 'Feed'],
 ['PC-104', 'Steam header pressure', 'PI', 'Flue gas to E-101', 'Feed'], ['TC-105', 'Superheated steam, Stream 5', 'PID', 'E-102 bypass', 'Feed'], ['FY/FC-106', 'Gasifying steam, Stream 7', 'Ratio, PI', 'Steam valve', 'Gasification'],
 ['FC-107', 'Steam bypass, Stream 6', 'PI', 'Steam valve', 'Feed'], ['TC-108 / FC-109', 'R-101 bed temperature', 'PID / PI', 'Fuel gas', 'Gasification'], ['FC-113', 'Syngas bypass, Stream 11', 'PI', 'Bypass valve', 'Gasification'],
 ['TC-114 *', 'Water leaving the E-101 preheater (Stream 4)', 'PID', 'Effluent bypass of E-101', 'Feed'], ['TC-202', 'R-102 inlet, Stream 14', 'PID', 'E-103 bypass', 'Shift'], ['PC-203 / LC-204', 'E-103 steam drum', 'PI / PI', 'Steam / BFW', 'Shift'],
 ['PC-206 / LC-207', 'R-102 cooler drum', 'PI / PI', 'Steam / BFW', 'Shift'], ['AC-208', 'CO slip, Stream 15', 'PID', 'SP of FC-107', 'Shift'], ['PC-210', 'Permeate pressure, Stream 16', 'PI', 'Speed of C-102', 'Shift'],
 ['PC-301', 'C-101 suction, Stream 17', 'PI', 'Speed of C-101', 'Synthesis'], ['FC-302', 'C-101 anti-surge', 'PI', 'Spill-back valve', 'Synthesis'], ['TC-321 / TC-322', 'SC-1 / SC-2 outlet (C-101 suction)', 'PID / PID', 'Cooling water / chilled water', 'Synthesis'],
 ['LC-323', 'C-101 knock-out drum', 'PI', 'Condensate valve', 'Synthesis'], ['PC-324', 'Recycle gas, Stream 31', 'PI', 'Speed of C-101R', 'Synthesis'], ['TC-303 to TC-306', 'Intercoolers IC-1 to IC-4', 'PID', 'Cooling water', 'Synthesis'],
 ['AC-308', 'Stoichiometric number, Stream 19', 'PID', 'SP of FC-113', 'Synthesis'], ['TC-310', 'R-103 inlet, Stream 20', 'PID', 'Steam (base) / gas bypass (HI)', 'Synthesis'], ['TC-312 / PC-313', 'R-103 temperature / steam pressure', 'PID / PI', 'Steam valve', 'Synthesis'],
 ['LC-314', 'R-103 steam-drum level', 'PI', 'BFW valve', 'Synthesis'], ['TC-316 / FC-317', 'E-105 outlet, Stream 22', 'PID / PI', 'Cooling water', 'Synthesis'], ['LC-318', 'F-101 level', 'P', 'V-101 (Stream 26)', 'Synthesis'],
 ['PC-319', 'Loop pressure', 'PI', 'Purge, Stream 25', 'Synthesis'], ['PC-402', 'T-101 pressure', 'PI', 'Condenser cooling water', 'Purification'], ['LC-403', 'Reflux-drum level', 'PI', 'Distillate, Stream 29', 'Purification'],
 ['FFC-404', 'Reflux ratio', 'PI', 'Reflux valve', 'Purification'], ['AC-405', 'Distillate purity', 'PID', 'Ratio of FFC-404', 'Purification'], ['TC-406 / FC-408', 'T-101 bottom temperature', 'PID / PI', 'LP steam (base) / effluent bypass (HI)', 'Purification'],
 ['LC-407', 'T-101 sump level', 'PI', 'Bottoms, Stream 28', 'Purification']];
const HICTRL = [
 ['E-101 A/B', 'Boiler on flue gas; LC-102, PC-104', 'Preheater on effluent 40 → 42 and boiler on flue gas (smaller duty)', 'TC-114: effluent bypass of the preheater'],
 ['E-102', 'Superheater on flue gas; TC-105 on flue-gas bypass', 'Superheater on syngas 13 → 35', 'TC-105: syngas bypass of E-102'],
 ['E-106 (new)', '—', 'Evaporator on suction gas 36 → 37', 'No loop; outlet fixed by the boiling water'],
 ['E-103 A/B', 'Waste-heat boiler, 40-bar steam', 'Evaporator on syngas 35 → 14', 'TC-202: bypass keeps 270 °C at the R-102 inlet'],
 ['E-104', 'Heated by 40-bar steam; TC-310 on steam', 'Heated by suction gas 37 → 38 and effluent 40 → 41', 'TC-310: suction-gas bypass of E-104'],
 ['E-107 (new)', '—', 'Evaporator on effluent 21 → 39', 'No loop; temperature indicated'],
 ['Reboiler', 'LP steam; TC-406 → FC-408', 'Heated by effluent 39 → 40', 'TC-406: effluent bypass of the reboiler'],
 ['E-105', 'CW; TC-316 → FC-317', 'CW, smaller duty (41 + 42 → 22)', 'Unchanged'],
 ['Water / steam', 'FC-103 cascaded from LC-102', 'Once-through boiling train 4 → 32 → 33 → 34 → 5', 'FC-103 sets the steam production']];
const PIDM = {
 'ZN-U': {n: 'Ziegler–Nichols (ultimate gain)', PI: [2.89, 0.628], PID: [3.74, 0.377, 0.094], sim: [3.743, 0.377, 0.0942], rep: [2.41, 1.25, 1.81, 113, 2.35]},
 'ZN-RC': {n: 'Ziegler–Nichols (reaction curve)', PI: [0.63, 1.165], PID: [0.84, 0.700, 0.175], sim: [0.843, 0.700, 0.1750], rep: [4.02, 4.30, 2.46, 1, 0.84]},
 'CC': {n: 'Cohen–Coon (selected)', PI: [0.68, 0.475], PID: [1.07, 0.675, 0.112], sim: [1.067, 0.675, 0.1122], rep: [3.93, 3.28, 2.19, 13, 1.18]},
 'ITAE': {n: 'ITAE (load)', PI: [0.60, 0.573], PID: [0.94, 0.450, 0.134], sim: [0.938, 0.450, 0.1336], rep: [3.96, 3.30, 2.35, 22, 2.39]},
 'DS': {n: 'Direct synthesis (τc = θ)', PI: [0.35, 0.475], PID: [0.35, 0.475, 0.175], sim: [0.351, 0.475, 0.1750], rep: [5.41, 7.64, 4.29, 4, 3.17]}};
const CBM = [['R-101 (×5)', 'Gasification island', 113422863, 'gas'], ['C-101', 'Syngas compressor, 5 stages', 63557666, 'syn'], ['C-102', 'Hydrogen compressor', 47098903, 'wgs'],
 ['ME-101', 'Pd–Ag membrane', 31827522, 'wgs'], ['F-101', 'Flash drum', 5474053, 'syn'], ['SC-1', 'Suction cooler', 5215466, 'syn'], ['E-105', 'Effluent cooler', 3474660, 'syn'],
 ['C-101R', 'Recycle wheel', 3339799, 'syn'], ['R-102 IC', 'Interbed coolers', 2628756, 'wgs'], ['E-103', 'Pre-shift cooler', 2281832, 'wgs'], ['T-101 reb.', 'Reboiler', 2234933, 'pur'],
 ['R-103', 'Methanol reactor', 2188759, 'syn'], ['E-101', 'Preheater and boiler', 2012680, 'feed'], ['T-101', 'Column shell + trays', 2266993, 'pur'], ['IC-1 to IC-4', 'Intercoolers', 2702408, 'syn'],
 ['E-102', 'Superheater', 1373842, 'feed'], ['R-102', 'Shift reactor', 1196248, 'wgs'], ['M-101', 'Syngas–steam mixer', 1153058, 'wgs'], ['C-101 KO', 'Knock-out drum', 897480, 'syn'],
 ['D-102 / D-101 / D-103', 'Dividers', 1231601, 'gas'], ['SC-2', 'Suction chiller', 615756, 'syn'], ['E-106 / E-107', 'New HI evaporators', 767275, 'hi'], ['E-104', 'Synthesis-feed heater', 488651, 'syn'],
 ['T-101 cond.', 'Condenser', 433404, 'pur'], ['CR-101 / M-102', 'Shredders and mixer', 298797, 'feed']];
const PRICES = [['Q4 2025', 360, 2250], ['Q1 2026', null, 2275], ['Q2 2026', 448.67, 2401], ['Q3 2026', 393, 2473], ['Sep 2026', 480, null], ['Oct–Nov 2026', 537.5, null]];
const RISK = [['Base case', 'Normal market', '0 %', '0 %', 0, '100 %', '0 %'], ['Mild disruption', 'Short-term rise in freight, fuel and insurance', '+5 %', '0 %', 25, '100 %', '+3 %'],
 ['Moderate disruption', 'Hormuz restricted, Red Sea threatened', '+14 %', '+3 %', 50, '95 %', '+5 %'], ['Severe disruption', 'Hormuz closed, Houthi blockade of Saudi ports', '+22 %', '+3 %', 90, '90 %', '+10 %'],
 ['Extreme disruption', 'Prolonged closure of both corridors, attacks on Jubail', '+37 %', '+5 %', 150, '80 %', '+15 %']];
const HEN = { // network of Section 4.2 (Table 4.9); column = position on the grid
 hot: [['H1', 941.87, 270, 'Syngas 13'], ['H2', 639.4, 66.26, 'Suction gas'], ['H3', 200, 129.19, 'Effluent (gas)'], ['H4', 129.19, 40, 'Effluent (cond.)'], ['H5', 64.28, 63.28, 'T-101 overhead'], ['H6', 66.26, 40, 'Suction (cond.)'], ['H7', 40, 24.18, 'Suction (chilled)']],
 cold: [['C1', 25, 100, 'Water preheat'], ['C2', 100, 101, 'Water boiling'], ['C3', 101, 600, 'Steam superheat'], ['C4', 99.22, 100.22, 'T-101 bottoms'], ['C5', 72.19, 200, 'Synthesis feed']],
 m: [['E-102', 'H1', 'C3', 27362.61, 1], ['E-103', 'H1', 'C2', 19270.49, 2], ['E-106', 'H2', 'C2', 15356.16, 3], ['E-104 (b)', 'H2', 'C5', 18781.45, 4], ['E-107', 'H3', 'C2', 1328.67, 5],
  ['Reb. (a)', 'H3', 'C4', 12496.43, 6], ['Reb. (b)', 'H4', 'C4', 7480.57, 7], ['E-104 (a)', 'H4', 'C5', 5037.33, 9], ['E-101', 'H4', 'C1', 8496.01, 10]],
 u: [['E-101 (fired)', 'HU', 'C2', 25927.58, 8], ['E-105', 'H4', 'CW', 12395.79, 11], ['SC-1 (H2)', 'H2', 'CW', 2766.14, 12], ['SC-1 (H6)', 'H6', 'CW', 17859.09, 12], ['Condenser', 'H5', 'CW', 18843.00, 13], ['SC-2', 'H7', 'CHW', 4052.93, 14]]};
const AEA = [['Minimum hot utility, QH,min (kW)', '25,927.58', '25,927.78', '0.00'], ['Minimum cold utility, QC,min (kW)', '55,916.95', '55,916.67', '0.00'], ['Chilled water (kW)', '4,052.93', '3,480.56', '14.12'],
 ['Cooling water (kW)', '51,864.02', '52,444.44', '1.12'], ['Hot / cold pinch (°C)', '109.22 / 99.22', '109.2 / 99.2', '0.02'], ['Heat recovered (kW)', '115,609.71', '115,625.00', '0.01'],
 ['Minimum number of units', '14', '14', '0.00'], ['Area target, counter-current (m²)', '—', '33,692', '—']];
const UTILHI = [['Hot utility (MW)', 141.54, 25.93, '81.7'], ['Cold utility of the network (MW)', 171.53, 55.92, '67.4'], ['Cooling water of the network (MW)', 120.84, 51.86, '57.1'],
 ['Net HP steam exported from E-103 (MW)', 22.81, 0.00, '—'], ['Heating cost ($/yr)', 12200135.49, 2060796.77, '83.1'], ['Cooling-water cost, all coolers ($/yr)', 2143935.26, 1259289.45, '41.3'],
 ['Steam export credit ($/yr)', -4381815.73, -2568469.24, '—'], ['Total annual utility cost ($/yr)', 49443423.50, 40232785.46, '18.6']];
