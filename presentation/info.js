// Equipment data sheets of the unit panel: size, operating conditions, nozzles (streams), control loops and safety.
// Every value is taken from the design report: Chapter 3 and Appendix C (design summaries), Table 8.7 (materials and cost),
// Chapter 2 and Table 4.12 (streams), Tables 6.18–6.26 (control), Chapter 7 (PHA Table 7.7, HAZOP Tables 7.10–7.12,
// Dow F&EI Table 7.8, inherent safety Table 7.9, LOPA Section 7.4) and Section 10.4 (fault monitoring).

// hazard pictograms shown on the safety tab
export const HAZ = {
  flam: ['Flammable gas', 'H₂ 4–75 %, CO 12.5–74 % in air'],
  liq: ['Flammable liquid', 'methanol, flash point 11 °C'],
  toxic: ['Toxic gas', 'CO, TLV 25 ppm, IDLH 1,200 ppm'],
  hot: ['High temperature', 'above the auto-ignition point'],
  press: ['High pressure', 'stored energy of the 50-bar loop'],
  vac: ['Vacuum', 'air can leak in'],
  dust: ['Combustible dust', 'plastic fines and stored MPW'],
  steam: ['Steam under pressure', 'boiler water and steam drums'],
  mech: ['Rotating machinery', 'shafts, knives and seals'],
};

// risk levels of the course matrix (Table 7.6): colour of the chip
export const RISK = {Undesirable: '#c2410c', Marginal: '#b7791f', 'No action': '#2f855a', Moderate: '#b7791f', Acceptable: '#2f855a'};

// pseudo-streams for the nozzles that are not numbered in the PFD
const S = (t, d) => ({t, d});

export const INFO = {
  'HALL': {
    design: [['Zone area', '12,220 m² (with the crusher)'], ['Storage', 'about 3 days of feed'], ['Deliveries', '≈ 45 trucks of 20 t per day'], ['Annual feed', '300,000 t/y'], ['Operation', '7,920 h/y (330 days)']],
    outs: [1], haz: ['dust'],
    safety: [
      ['Fire in the stored plastic', 'Warehouse fire from a spark or hot surface (PHA 1)', 'Sprinklers, housekeeping and earthing of the equipment'],
      ['Combustible dust', 'Plastic fines can form an explosive cloud', 'Dust extraction and explosion vents'],
      ['Traffic and feed route', 'Trucks unload at the west bays', 'The plastic enters the process block directly and never crosses a road']],
    risk: {pha: 1, S: 'C', L: 2, level: 'Undesirable', after: 'Marginal with the safeguards'}},

  'CR-101': {
    design: [['Lines', '2 shredder–granulator lines of 18.9 t/h'], ['Product size', 'passes a 10 mm screen'], ['Installed power', '2,083 kW (2 × 1,050 kW motors)'], ['Specific energy', '50 kWh/t (+10 % margin)'], ['Materials', 'D2 tool-steel knives, carbon-steel housing'], ['Bare-module cost', '$186,740']],
    op: [['Feed', '37,879 kg/h at 30 °C'], ['Daily feed', '909 t/d'], ['Spare capacity', 'one line runs while the other is maintained']],
    ins: [1], outs: [2],
    loops: [['WC', '101', 'MPW feed rate → screw-feeder speed (fixes the plant throughput)']],
    haz: ['dust', 'mech'],
    safety: [
      ['Dust explosion', 'Plastic dust ignited by a hot surface or a spark in the crusher (PHA 1)', 'Dust extraction, explosion vents and earthing of all equipment'],
      ['Fire in the feed', 'Stored MPW is a combustible solid', 'Sprinklers and strict housekeeping'],
      ['Maintenance of the knives', 'Rotating rotors and sharp tool steel', 'Two parallel lines: one is isolated and maintained while the other runs'],
      ['Air with the feed', 'Air can follow the plastic into the gasifier (PHA 3)', 'Steam / N₂-purged lock hoppers after the screw feeders']],
    risk: {pha: 1, S: 'C', L: 2, level: 'Undesirable', after: 'Marginal with the safeguards'}},

  'E-101': {
    design: [['Duty (base design)', '70,379 kW'], ['Area', '3,637 m² (4 units)'], ['Fired heat after HI', '25,927.58 kW (firing −63 %)'], ['Material', 'Carbon steel'], ['Bare-module cost', '$2,012,680']],
    op: [['Water', '25 → 100 °C, then boiling'], ['Heat source', 'flue gas; effluent 40 → 42 after HI'], ['Steam pressure', '1.0 bar header']],
    ins: [3, 40], outs: [4, 42],
    loops: [['LC', '102', 'Drum level → set point of FC-103'], ['FC', '103', 'Process water, sets the steam production'], ['PC', '104', 'Header pressure → flue gas'], ['TC', '114', 'Preheated water 99.22 °C → effluent bypass (HI)']],
    haz: ['steam', 'hot'],
    safety: [
      ['Fired heating', 'Flame-out followed by re-ignition of the fuel gas in the fire box (PHA 4)', 'Burner management system, flame scanners and pre-purge before light-off'],
      ['Loss of boiler water', 'Tubes overheat when the drum level falls', 'Three-element level control LC-102 → FC-103'],
      ['Fewer ignition sources', 'Heat integration replaced most of the firing', 'Firing of E-101 falls by 63 %; E-102, E-104 and the reboiler need no fired heat'],
      ['Start-up', 'Integrated heat is not available at start-up', 'Start-up heaters and a bypass around each process–process exchanger']],
  },

  'E-102': {
    design: [['Duty', '27,363 kW'], ['Area', '1,734 m² (2 units)'], ['LMTD', '526.0 °C'], ['Material', '2.25Cr–1Mo tubes'], ['Bare-module cost', '$1,373,842']],
    op: [['Steam', '101 → 600 °C'], ['Hot side after HI', 'syngas 941.87 → 547.64 °C']],
    ins: [34, 13], outs: [5, 35],
    loops: [['TC', '105', 'Steam at 600 °C → syngas bypass of E-102 (HI)']],
    haz: ['hot', 'flam', 'toxic'],
    safety: [
      ['Hot syngas leak', 'H₂ + CO above the auto-ignition temperature at a flange or tube', 'Fixed H₂ and CO detectors and emergency shutdown (ESD)'],
      ['Tube leak', 'No steam to the gasifier (HAZOP node 1)', 'Low-flow alarm and FSLL interlock that stops the MPW feed'],
      ['Creep at 600 °C', 'Tube metal temperature', '2.25Cr–1Mo alloy tubes rated for the service']]},

  'D-101': {
    design: [['Vessel', '110.4 m³, D = 3.60 m, L = 10.80 m'], ['Gas flow', '110.34 m³/s'], ['Material', '1.25Cr–0.5Mo steel'], ['Bare-module cost', '$446,180']],
    op: [['Steam', '600 °C, 1.0 bar'], ['Split', '50,400 kg/h to R-101 (1.33 kg/kg MPW)']],
    ins: [5], outs: [7, 6],
    loops: [['FFC', '106', 'Steam-to-MPW ratio 1.33 kg/kg'], ['FC', '107', 'Steam bypass to M-101, set by AC-208']],
    haz: ['hot', 'steam'],
    safety: [
      ['No steam to the gasifier', 'D-101 valve fails closed: the bed defluidises and hot spots form (HAZOP node 1)', 'Low-flow alarm (FAL), FSLL interlock on the MPW feed, N₂ back-up fluidisation'],
      ['Superheated steam at 600 °C', 'Burns and high metal temperature', '1.25Cr–0.5Mo vessel and insulated piping'],
      ['Wrong steam ratio', 'Less steam gives more char and tar', 'Ratio control FY/FC-106 on the measured MPW feed']]},

  'R-101': {
    design: [['Trains', '5 identical units in parallel'], ['Refractory bore', 'D = 6.5 m'], ['Bed', 'expanded 1.00 m, settled 0.55 m'], ['Freeboard', '4.0 m (TDH 2.51 m)'], ['Volumes', 'bed 33.18 m³, freeboard 132.7 m³ per train'], ['Bed material', 'olivine 550 µm, 31,074 kg per train'], ['Heads', 'torispherical'], ['Materials', 'SA-516 Gr. 70 shell, ≥ 90 % Al₂O₃ refractory, Alloy 601 / SiC distributor'], ['Bare-module cost', '$113,422,863 (island)']],
    op: [['Temperature', '1,200 °C'], ['Pressure', '1.013 bar'], ['Steam-to-carbon', '1.09 mol/mol'], ['Velocity', '0.87 → 1.57 m/s (U<sub>mf</sub> 0.212 m/s)'], ['Gas residence time', '3.37 s'], ['Bed / distributor ΔP', '9.2 / 3.1 kPa'], ['Steam blower', '228 kW per train']],
    ins: [2, 7], outs: [8],
    loops: [['WC', '101', 'MPW feed → feeder speed'], ['FFC', '106', 'Steam / MPW = 1.33 kg/kg'], ['TC', '108', 'Bed 1,200 °C → fuel gas (FC-109)']],
    haz: ['hot', 'flam', 'toxic'],
    safety: [
      ['Hot syngas leak', 'H₂ + CO above its auto-ignition temperature at a flange, nozzle or hot spot (PHA 2)', 'Shell-temperature monitoring, fixed H₂ and CO detectors, ESD'],
      ['Air with the feed', 'Lock-hopper valve fails: flammable mixture in the freeboard (PHA 3)', 'Steam / N₂-purged lock hoppers, O₂ analyser on Stream 8 with trip'],
      ['Loss of steam', 'Bed defluidisation, carbon deposits and hot spots', 'FSLL interlock stops the MPW feed; N₂ back-up fluidisation'],
      ['Over-temperature', 'Refractory damage and sintering of the olivine', 'High-temperature trip on the fuel (TSHH) and shell skin thermocouples'],
      ['Blocked outlet', 'Pressure rise and jet fire', 'High-pressure alarm (PAH) and rupture disc to the flare'],
      ['Inherently safer', 'Steam gasification instead of oxygen or air', 'No air-separation unit and no O₂ mixed with the hydrogen-rich gas']],
    risk: {pha: 2, S: 'B', L: 3, level: 'Undesirable', after: 'Marginal with the safeguards'}},

  'CY-101': {
    design: [['Number', '15 (3 per gasifier train)'], ['Type', 'reverse flow, Stairmand high efficiency'], ['Body diameter', '3.50 m'], ['Overall height', '14.0 m'], ['Inlet', '1.75 × 0.70 m'], ['Gas outlet', 'D = 1.75 m'], ['Material', 'Carbon steel with refractory lining']],
    op: [['Gas flow', '267.1 m³/s at 1,200 °C, 1.0 bar'], ['Gas density', '0.0909 kg/m³'], ['Inlet velocity', '14.5 m/s'], ['Cut size d₅₀', '22.9 µm'], ['Efficiency at 100 µm', '95 %'], ['Pressure drop', '61 Pa']],
    ins: [8], outs: [10, 9],
    loops: [['PDI', '112', 'Cyclone ΔP (61 Pa) indicates blockage']],
    haz: ['hot', 'flam', 'toxic'],
    safety: [
      ['Blockage', 'Higher pressure: hot H₂ + CO leaks and jet fire (HAZOP node 1)', 'PDI-112 on every cyclone, PAH and rupture disc to the flare'],
      ['Tar condensation', 'A colder gasifier sends tar to CY-101 and E-103', 'Burner management and automatic reduction of the MPW feed'],
      ['Flammable syngas', 'Clean syngas has an LFL of 5.14 vol% (Table 7.5)', 'No air ingress; fixed H₂ and CO detectors']]},

  'D-102': {
    design: [['Vessel', '267.1 m³, D = 4.84 m, L = 14.52 m'], ['Gas flow', '267.14 m³/s'], ['Material', 'Refractory-lined carbon steel'], ['Bare-module cost', '$646,126']],
    op: [['Split β to methanol', '0.40'], ['Gas', '1,200 °C, 1.0 bar']],
    ins: [10], outs: [12, 11],
    loops: [['FC', '113', 'Syngas bypass, set by AC-308 (stoichiometric number)']],
    haz: ['hot', 'flam', 'toxic'],
    safety: [
      ['Toxic gas', 'CO cannot be smelled; TLV 25 ppm', 'Fixed CO detectors and personal monitors'],
      ['Hot flammable gas', 'Syngas at 1,200 °C above its auto-ignition point', 'Refractory lining, shell-temperature checks and ESD']]},

  'M-101': {
    design: [['Vessel', '214.2 m³, D = 4.50 m, L = 13.50 m'], ['Material', 'Refractory-lined carbon steel'], ['Bare-module cost', '$1,153,058']],
    op: [['Steam-to-CO ratio', '2.0'], ['Outlet', '941.87 °C, 1.0 bar']],
    ins: [12, 6], outs: [13],
    loops: [['AC', '208', 'CO slip of Stream 15 → set point of FC-107']],
    haz: ['hot', 'flam', 'toxic'],
    safety: [
      ['Hot syngas leak', 'H₂ + CO at 942 °C', 'Fixed H₂ and CO detectors and ESD'],
      ['Too little steam', 'Lower CO conversion in R-102', 'AC-208 adds steam through FC-107']]},

  'E-103': {
    design: [['Duty', '46,633 kW'], ['Area', '2,600 m² (3 units)'], ['Steam raised (base)', '71.8 t/h'], ['Material', '1.25Cr–0.5Mo tubes'], ['Bare-module cost', '$2,281,832']],
    op: [['Syngas', '547.64 → 270 °C (HI)'], ['Water side', 'boiling at 100 °C (HI); 40-bar steam in the base design']],
    ins: [35, 33], outs: [14, 34],
    loops: [['TC', '202', 'R-102 inlet 270 °C → syngas bypass of E-103'], ['PC', '203', 'Steam-drum pressure'], ['LC', '204', 'Steam-drum level → BFW']],
    haz: ['hot', 'flam', 'steam'],
    safety: [
      ['Loss of boiler feed water', 'Tube overheating and rupture; steam release (PHA 5)', 'LALL trip, PSV on the steam drum and back-up BFW pump'],
      ['Catalyst window', 'R-102 needs 149–316 °C', 'TC-202 holds 270 °C with the hot-gas bypass'],
      ['Hot syngas', 'H₂ + CO above the auto-ignition point', 'Alloy tubes and fixed gas detectors']],
    risk: {pha: 5, S: 'C', L: 3, level: 'Marginal', after: 'Marginal'}},

  'R-102': {
    design: [['Type', 'radial-flow packed bed, interbed-cooled'], ['Catalyst', 'Cu/ZnO/Al₂O₃, 1 mm pellets, 71,198 kg'], ['Beds', '6 in series, 0.40 m × 7.85 m'], ['Bed volume', '49.35 m³'], ['Shell', 'D = 5.40 m, overall height 9.7 m'], ['Heads', 'torispherical, 0.914 m deep'], ['Interbed coolers', '6 × 2,371 kW, 4,045 m²'], ['Material', 'AISI 304 internals, carbon-steel shell'], ['Bare-module cost', '$1,196,248']],
    op: [['Inlet / outlet', '270 °C, 1.013 → 0.963 bar'], ['CO conversion', '90 % (94.4 % of equilibrium)'], ['Residence time', '0.23 s'], ['GHSV', '3,355 h⁻¹'], ['Heat removed', '14.23 MW → 28.3 t/h steam at 28 bar'], ['H₂ produced', '1,303.28 kmol/h']],
    ins: [14], outs: [15],
    loops: [['PC', '206', 'Cooler drum 28 bar (230 °C)'], ['LC', '207', 'Cooler drum level → BFW'], ['AC', '208', 'CO slip → steam bypass'], ['TI', '205', 'Multipoint bed temperature, TAH < 316 °C']],
    haz: ['flam', 'toxic', 'steam'],
    safety: [
      ['Bed over-temperature', 'Catalyst damage above 316 °C', 'Multipoint TI-205 with high-temperature alarm (TAH)'],
      ['Loss of cooler water', 'Steam-drum tubes overheat (PHA 5)', 'LALL trip, PSV on the drum, back-up BFW pump'],
      ['Inherently safer cooling', 'Boiling water at a fixed 230 °C', 'Limits hot spots and prevents a runaway'],
      ['Non-toxic catalyst', 'No chromium in the shift catalyst', 'Cu/ZnO/Al₂O₃ removes the Cr(VI) hazard'],
      ['Low pressure', 'The shift works at about 1 bar', 'Small stored energy if a release occurs']],
    risk: {pha: 5, S: 'C', L: 3, level: 'Marginal', after: 'Marginal'}},

  'ME-101': {
    design: [['Membrane', 'Pd–Ag film 5 µm on porous SS 316L tubes'], ['Area', '6,040 m²'], ['Tubes', '25,230 × 0.0254 m × 3.0 m'], ['Modules', '26 (1,000 tubes each)'], ['H₂ permeance', '1.803 × 10⁻³ mol/(m²·s·Pa⁰·⁵)'], ['Bare-module cost', '$31,827,522']],
    op: [['Temperature', '270 °C'], ['Pressure', 'feed 1.00 bar, permeate 0.04 bar'], ['H₂ in feed / retentate', '58.26 % / 12.25 %'], ['Recovery / purity', '90 % / 99.99 %'], ['Stage cut', '0.524']],
    ins: [15], outs: [S('Permeate to C-102', '3,872.96 kmol/h, 0.04 bar, 99.99 % H₂'), 17],
    loops: [['PC', '210', 'Permeate 0.04 bar → speed of C-102'], ['TT', '212', 'Feed temperature, TAH / TAL'], ['AT', '213', 'H₂ purity 99.99 %, AAL'], ['PDI', '211', 'Module pressure drop']],
    haz: ['flam', 'vac', 'toxic'],
    safety: [
      ['Air leak into the permeate', 'Pure H₂ under vacuum forms an H₂–air mixture (4–75 %) (PHA 6)', 'O₂ analyser on the permeate, N₂ purge, leak testing and vacuum-pump interlock'],
      ['Lesson from an accident', 'O₂ once entered an H₂ tank through a membrane (South Korea)', 'O₂ analysers with automatic isolation of the H₂ system'],
      ['Membrane damage', 'Temperature outside the operating window', 'TT-212 alarms at the feed (270 °C)'],
      ['Off-spec hydrogen', 'A cracked film lets other gases through', 'AT-213 purity alarm and PDI-211 on the modules'],
      ['Low pressure', 'Feed at 1.0 bar, permeate at 0.04 bar', 'Small stored energy (inherent safety)']],
    risk: {pha: 6, S: 'B', L: 3, level: 'Undesirable', after: 'Marginal with the safeguards'}},

  'C-102': {
    design: [['Type', 'reciprocating, intercooled'], ['Pressure', '0.04 → 30 bar (ratio 750)'], ['Power', '28,552 kW (10 × 2,855 kW)'], ['Efficiency', '65 % isothermal'], ['Drive', 'explosion-proof electric motor'], ['Material', 'Carbon steel'], ['Bare-module cost', '$47,098,903']],
    op: [['Hydrogen', '1.076 kmol/s (3,872.96 kmol/h)'], ['Product', '61,831 t/y at 30 bar']],
    ins: [S('Permeate from ME-101', '3,872.96 kmol/h, 0.04 bar')], outs: [16],
    loops: [['PC', '210', 'Permeate pressure → compressor speed']],
    haz: ['flam', 'press', 'vac', 'mech'],
    safety: [
      ['Air ingress at the suction', 'The suction is under vacuum (0.04 bar)', 'O₂ analyser, N₂ purge and vacuum-pump interlock'],
      ['Hydrogen leak at 30 bar', 'Seal or gasket failure; H₂ ignites easily', 'H₂ detectors, ventilation and gasket inspection (lesson of 1985, Norway)'],
      ['Ignition by the drive', 'Electric motor in a hydrogen area', 'Explosion-proof drive'],
      ['Overpressure', 'Blocked discharge', 'Reliable pressure relief and frequent inspection (lesson of 2022, China)']]},

  'C-101': {
    design: [['Type', 'centrifugal, 5 stages, 4 intercoolers'], ['Pressure ratio', '2.187 per stage'], ['Polytropic efficiency', '76 / 75 / 74 / 72.5 / 70 %'], ['Theoretical work', '600.47 kJ/kg'], ['Power', '22,533 kW'], ['Intercoolers', '1,129 / 756 / 570 / 459 m²'], ['Material', 'Stainless steel 316L'], ['Bare-module cost', '$63,557,666']],
    op: [['Suction', '1.00 bar, 36.65 m³/s'], ['Discharge', '50.00 bar, 147 °C, 0.983 m³/s'], ['Intercooling', 'to 40 °C after every stage (17,772 kW)']],
    ins: [S('Suction gas (after SC-1 / SC-2)', '1.00 bar, 36.65 m³/s')], outs: [18],
    loops: [['PC', '301', 'Suction 1.0 bar → motor speed (VFD)'], ['FC', '302', 'Anti-surge spill-back'], ['TC', '303', 'Intercooler outlets 40 °C (TC-303 to 306)'], ['PI', '307', 'Discharge 50 bar, PAH']],
    haz: ['flam', 'toxic', 'press', 'mech'],
    safety: [
      ['Gas release at the seals', 'High-pressure H₂ / CO leaks and ignites (PHA 7)', 'Gas detectors and vibration monitoring'],
      ['Surge', 'Flow reversal damages the machine', 'Anti-surge control FC-302 with a spill-back line'],
      ['Overpressure', 'Blocked discharge', 'PSV on each stage and high-pressure alarm (PAH)'],
      ['Liquid in the suction', 'Condensate can damage the impellers', 'Knock-out drum with level control LC-323'],
      ['Ignition by the drive', 'Large motor in a gas area', 'Explosion-proof electric drive'],
      ['Wet-CO₂ corrosion', 'Water condenses with 27 % CO₂ into carbonic acid', 'SS 316L impellers, casing internals and intercooler tubes']],
    risk: {pha: 7, S: 'B', L: 3, level: 'Undesirable', after: 'Marginal with the safeguards'}},

  'SC': {
    design: [['SC-1', '6,857 m² (7 units), cooling water'], ['SC-2', '732 m², chilled water'], ['Knock-out drum', 'D = 4.50 m, H = 7.5 m (119.3 m³)'], ['Materials', 'SS 316L tubes; KO drum CS + 316L clad'], ['Bare-module cost', '$5,215,466 + $615,756 + $897,480']],
    op: [['SC-1 duty after HI', '20,625 kW'], ['SC-2 duty', '4,052.93 kW'], ['Outlet', '24.18 °C, 1.0 bar'], ['Condensate', '28,587 kg/h']],
    ins: [38], outs: [S('Suction gas to C-101', '24.18 °C, 1.0 bar'), 30],
    loops: [['TC', '321', 'SC-1 outlet → cooling water'], ['TC', '322', 'SC-2 outlet 24.18 °C → chilled water'], ['LC', '323', 'KO-drum level → condensate']],
    haz: ['flam', 'toxic'],
    safety: [
      ['Liquid carry-over', 'Water droplets reach the compressor', 'KO drum with level control and demister'],
      ['Gas leak', 'H₂ and CO at 1 bar', 'Fixed H₂ and CO detectors'],
      ['Cooling failure', 'Warmer suction gas raises the compressor power', 'TC-321 / TC-322 alarms on the outlet temperature']]},

  'E-104': {
    design: [['Type', 'TEMA NEN with shell expansion joint, 1 shell, 1 tube pass'], ['Duty', '23,818.78 kW'], ['Tubes', '1,025 × 25.40 mm × 4.88 m (14 BWG)'], ['Shell diameter', '1.121 m'], ['Area', '399.14 m²'], ['U / LMTD', '590.59 W/m²·°C / 101.14 °C'], ['Material', 'SS 316 tubes, carbon-steel shell'], ['Bare-module cost', '$488,651']],
    op: [['Syngas (tubes)', '72.19 → 200 °C, 50 bar, ΔP 0.132 / 0.50 bar'], ['Steam (shell, base)', '40 bar at 250.35 °C, ΔP 0.343 / 0.70 bar'], ['After HI', 'heated by suction gas 37 → 38 and effluent 40 → 41']],
    ins: [19, 37, 40], outs: [20, 38, 41],
    loops: [['TC', '310', 'R-103 inlet 200 °C, Cohen–Coon PID (Kc 1.07, τI 0.675, τD 0.112 min)']],
    haz: ['flam', 'press', 'hot'],
    safety: [
      ['Feed too hot', 'TV-310 fails open: hot spots and faster catalyst ageing (HAZOP node 2)', 'High-temperature alarm (TAH) on Stream 20'],
      ['Feed too cold', 'Lower methanol production', 'Low-temperature alarm (TAL)'],
      ['Hidden fouling', 'TC-310 hides the fouling by opening the valve', 'The digital twin detects it 24 min after it starts (PCA, Section 10.4)'],
      ['Stuck valve or drifting sensor', 'TV-310 stuck or TT-310 +3 °C', 'Detected after 5 and 119 min by the fault monitor']],
    risk: {pha: 'R2', S: 'C', L: 3, level: 'Marginal', after: 'Marginal with TAH'}},

  'R-103': {
    design: [['Type', 'multitubular packed bed, boiling-water cooled'], ['Tubes', '3,447 × 44.45 mm × 4.88 m'], ['Catalyst', 'Cu/ZnO/Al₂O₃, 6 × 6 mm, 17,752 kg (20 m³)'], ['Shell', 'D = 3.51 m, overall height 7.0 m'], ['Heads', '2:1 ellipsoidal, 0.878 m deep'], ['Transfer area', '2,349 m²'], ['Material', 'SS 316 tubes, carbon-steel shell'], ['Bare-module cost', '$2,188,759']],
    op: [['Temperature', '200 °C (isothermal)'], ['Pressure', '50.00 → 47.80 bar (ΔP 2.20 bar)'], ['CO conversion per pass', '18.60 % (95.7 % of equilibrium)'], ['Methanol formed', '714.40 kmol/h'], ['Residence time / GHSV', '2.6 s / 20,166 h⁻¹'], ['Coolant', 'boiling water 187 °C, 11.75 bar, 44.6 t/h steam']],
    ins: [20], outs: [21],
    loops: [['TC', '310', 'Inlet 200 °C (E-104)'], ['TC', '312', 'Catalyst 200 °C → steam pressure (PC-313)'], ['LC', '314', 'Steam-drum level → BFW'], ['AC', '308', 'Stoichiometric number → syngas bypass']],
    haz: ['flam', 'toxic', 'press', 'hot'],
    fei: ['74.3', 'Moderate', '19.0 m'],
    safety: [
      ['Loss of cooling', 'BFW pump trip: temperature runaway and overpressure (PHA 8, HAZOP R1)', 'TAH, TSHH trip (SIL 2) closing Stream 20, stand-by BFW pump and PSV to the flare'],
      ['Layers of protection', 'Alarm + operator 10⁻¹, SIS trip 10⁻², PSV 10⁻²', 'Mitigated frequency 10⁻⁶ per year, far below the 10⁻⁴ limit (LOPA)'],
      ['Overpressure', 'Blocked outlet or high C-101 discharge (R4)', 'PSV to the closed flare and high-pressure alarm (PAH)'],
      ['Gas in the steam', 'Tube leak sends CO and H₂ into the steam system (R6)', 'CO analyser on the steam-drum vent and tube leak tests'],
      ['Flammable feed', 'At 50 bar the feed has no upper flammable limit (Table 7.5)', 'Air ingress is treated as a major hazard: the loop is closed and leak-tight'],
      ['Safe layout', 'Highest fire and explosion index of the plant', 'No occupied building inside the 19.0 m radius of exposure']],
    risk: {pha: 8, S: 'B', L: 3, level: 'Undesirable', after: 'Marginal after the LOPA (10⁻⁶ /y)'}},

  'E-105': {
    design: [['Type', 'shell and tube, TEMA AES (floating head)'], ['Shells', '4 in parallel, 1 / 2 passes'], ['Tubes', '1,506 per shell, 19.05 mm × 6.10 m (14 BWG)'], ['Area', '2,199 m²'], ['U', '330 W/m²·°C (F<sub>t</sub> = 0.840)'], ['Material', 'SS 316 tubes, CS shell with 316L overlay'], ['Bare-module cost', '$3,474,660']],
    op: [['Effluent (shell)', '200 → 40 °C, 50 bar, 169.98 kg/s'], ['Cooling water (tubes)', '30 → 40 °C, 4.0 bar, 1,130.6 kg/s'], ['Duty', '47,235 kW (12,396 kW after HI)'], ['Condensation', 'dew point 129.2 °C, 1,526 kmol/h condensed'], ['Pressure drop', '0.70 / 1.00 bar shell, 0.64 / 1.00 bar tubes']],
    ins: [41, 42], outs: [22],
    loops: [['TC', '316', 'Effluent 40 °C → CW flow (FC-317)']],
    haz: ['flam', 'press', 'toxic'],
    safety: [
      ['Cooling-water failure', 'Less condensation; methanol lost to the recycle and purge (HAZOP node 3)', 'High-temperature alarm (TAH) and CW low-flow alarm'],
      ['Corrosion', 'Condensing water and CO₂ form carbonic acid', 'SS 316 tubes and 316L overlay on the shell']]},

  'F-101': {
    design: [['Orientation', 'vertical, wire-mesh demister 0.40 m'], ['Diameter', '3.50 m'], ['Height', '7.00 m tangent to tangent, 8.75 m overall'], ['Volume', '67.3 m³'], ['Liquid hold-up', '10 min, level 0.90 m'], ['Settling velocity', '0.208 m/s'], ['Material', 'SA-516 Gr. 70 + 3 mm 316L cladding'], ['Bare-module cost', '$5,474,053']],
    op: [['Pressure / temperature', '47.00 bar / 40 °C'], ['Vapour', '569,716 kg/h, 82.59 kg/m³'], ['Liquid', '42,229 kg/h, 808.9 kg/m³']],
    ins: [22], outs: [23, 26],
    loops: [['LC', '318', 'Level 0.90 m → V-101, P-only (Kc = 2)'], ['PC', '319', 'Loop 47 bar → purge valve']],
    haz: ['flam', 'liq', 'toxic', 'press'],
    fei: ['61.7', 'Moderate', '15.8 m'],
    safety: [
      ['Gas blow-by', 'Loss of level sends 47-bar gas to the 1-bar column (PHA 10)', 'LSLL trip closes V-101; PSV on T-101 sized for gas blow-by'],
      ['High level', 'Liquid carried into the recycle gas and C-101', 'High-high level alarm and trip (LSHH)'],
      ['Overpressure', 'Purge valve closed or recycle blocked', 'PSV to the flare and high-pressure alarm'],
      ['Leak of loop gas', 'The vapour holds 26.6 % CO', 'Fixed CO and H₂ detectors and personal CO monitors'],
      ['Small inventory', 'Liquid hold-up limited to 10 min', 'Less flammable and toxic material on site (inherent safety)'],
      ['Carbonic-acid attack', 'CO₂ at 34.3 bar partial pressure with free water', 'SA-516 Gr. 70 shell with 3 mm 316L cladding']],
    risk: {pha: 10, S: 'B', L: 3, level: 'Undesirable', after: 'Marginal with LSLL and PSV'}},

  'T-101': {
    design: [['Trays', '52 sieve trays, single-pass cross-flow (24 theoretical)'], ['Feed tray', '39 from the top'], ['Diameter / height', '3.38 m / 33.6 m'], ['Tray spacing', '0.60 m (1.5 m top and bottom)'], ['Condenser', '722 m², 18.84 MW'], ['Reboiler', 'kettle, 329 m², 19.98 MW'], ['Material', 'Carbon steel SA-516'], ['Bare-module cost', '$1,603,458 shell + $663,535 trays']],
    op: [['Pressure', '1.00 bar'], ['Top / bottom', '64.28 / 99.22 °C'], ['Reflux ratio', '0.8231 (1.20 R<sub>min</sub>)'], ['Relative volatility', '4.461'], ['Tray efficiency', '46.15 %'], ['Velocity', '1.90 / 3.68 m/s (flooding 2.71 / 5.26)'], ['Recovery', '99.9 % methanol, 99.0 % water']],
    ins: [27, 39], outs: [29, 28, 40],
    loops: [['PC', '402', 'Column 1.0 bar → condenser water'], ['FFC', '404', 'Reflux ratio 0.8231'], ['AC', '405', 'Distillate ≥ 99.5 mol% → reflux ratio'], ['TC', '406', 'Bottom 99.22 °C → effluent bypass (HI)'], ['LC', '403', 'Reflux drum'], ['LC', '407', 'Sump level']],
    haz: ['liq', 'toxic'],
    safety: [
      ['Methanol leak', 'Flash point 11 °C is below ambient: pool fire (PHA 11)', 'Dikes, foam system, drainage to a remote basin and hot-work permits'],
      ['Gas blow-by from F-101', 'Overpressure of the 1-bar column', 'PSV on T-101 sized for the blow-by'],
      ['Low pressure', 'The column runs at 1.0 bar', 'Small stored energy (inherent safety)'],
      ['Methanol in the wastewater', 'Methanol is toxic (TLV 200 ppm)', 'TC-406 holds the bottom at 99.22 °C so that almost no methanol leaves with the water']],
    risk: {pha: 11, S: 'C', L: 3, level: 'Marginal', after: 'Marginal'}},

  'TANKS': {
    design: [['Product', '266,915 t/y (809 t/d)'], ['Dispatch', 'pipeline to King Fahd Industrial Port; ≈ 27 tanker trucks per day (30 t)'], ['Distance to process', '30 m'], ['Zone', '9,600 m² with loading']],
    ins: [29], haz: ['liq', 'toxic'],
    safety: [
      ['Pool fire', 'Flammable liquid stored above its flash point', 'Bunds (dikes), foam system and drainage to a remote basin'],
      ['Fire during loading', 'Static discharge at the truck (lesson of 2012, USA)', 'Grounding, bonding and hot-work permits for every transfer'],
      ['Spacing', 'Escalation to the process block', 'Tank farm 30 m from the process area']]},

  'FLARE': {
    design: [['Exclusion radius', '16 m'], ['Distance to the process area', '72 m (minimum 60 m)'], ['Zone area', '2,280 m²']],
    haz: ['flam', 'hot'],
    safety: [
      ['Closed relief system', 'Every PSV and rupture disc discharges to the flare', 'No flammable or toxic gas is vented to the air'],
      ['Purge gas', 'The purge holds 26.6 % CO', 'It is burned in the gasifier furnace and never stored (PHA 9)'],
      ['Radiation', 'Heat from the flame', 'Exclusion radius of 16 m, 72 m from the process block']]},

  'CTOWER': {
    design: [['Cooling water', '51.86 MW after HI'], ['Flow', '≈ 1,241 kg/s (from 2,891 kg/s)'], ['Distance to process', '30 m'], ['Zone area', '4,004 m²']],
    safety: [
      ['Cooling-water failure', 'Initiating frequency 1 to 10⁻² per year (Table 7.13)', 'E-105 TAH and CW low-flow alarm'],
      ['Fail-safe valves', 'Loss of air or power', 'Coolant valves fail open; feed valves fail closed'],
      ['Fire water', 'Supply for the whole plant', 'Fire-water system with the utilities']]},

  'CONTROL': {
    design: [['Control loops', '34 (Table 6.26)'], ['Distance to process', '24 m, outside the 19.0 m F&EI radius'], ['Building', 'blast-resistant']],
    safety: [
      ['Safety instrumented trips', 'TSHH on R-103, LSLL on F-101, O₂ trip on the gasifier', 'Act independently of the basic control loops'],
      ['Early warning', 'PCA monitoring of eight signals (T², Q)', 'Five HAZOP faults found in 2 to 119 min, no false alarms'],
      ['Protected operators', 'Building outside every radius of exposure', '24 m from the process area']]},

  'ADMIN': {
    design: [['Distance to process block', '62 m'], ['Zone area', '8,140 m²'], ['Main gate', 'G1, open 24 h'], ['Services', 'administration, clinic, mosque, cafeteria, fire station']],
    safety: [
      ['Occupied buildings', 'People must stay outside the hazard zones', '62 m from the process block, beyond the 19.0 m radius of R-103'],
      ['Emergency response', 'Fire station and clinic', 'Near the main gate for fast access']]},

  'E-106': {
    design: [['Match', 'H2 → C2'], ['Area', '626 m²'], ['Material', 'SS tubes, carbon-steel shell'], ['Bare-module cost', '$558,949']],
    op: [['Duty', '15,356.16 kW'], ['Hot side', 'suction gas 639.40 → 400.91 °C'], ['Cold side', 'boiling water at 100 °C (vapour 0.44 → 0.69)']],
    ins: [36, 32], outs: [37, 33],
    haz: ['hot', 'flam', 'toxic'],
    safety: [
      ['Hot syngas', 'H₂ + CO at 639 °C', 'Fixed H₂ and CO detectors'],
      ['Water flow', 'The once-through boiling train needs a steady flow', 'FC-103 sets the water; start-up heaters kept as spare']]},

  'E-107': {
    design: [['Match', 'H3 → C2'], ['Area', '46 m²'], ['Material', 'SS tubes, carbon-steel shell'], ['Bare-module cost', '$208,326']],
    op: [['Duty', '1,328.67 kW'], ['Hot side', 'reactor effluent 199.95 → 193.19 °C'], ['Cold side', 'process water to boiling (vapour 0.42 → 0.44)']],
    ins: [21, 4], outs: [39, 32],
    haz: ['flam', 'press'],
    safety: [
      ['High-pressure effluent', 'Reactor effluent at 47.5 bar', 'Pressure relief of the synthesis loop to the flare'],
      ['Disturbances', 'An upset passes from one stream to the stream it heats', 'Bypass around each process–process exchanger']]},

  'C-101R': {
    design: [['Type', 'recycle wheel of the C-101 package'], ['Pressure', '47.00 → 50.00 bar'], ['Flow', '1.989 m³/s'], ['Power', '823 kW'], ['Material', 'SS 316L'], ['Bare-module cost', '$3,339,799']],
    ins: [24], outs: [31],
    loops: [['PC', '324', 'Recycle 50.0 bar → speed of C-101R']],
    haz: ['flam', 'toxic', 'press', 'mech'],
    safety: [
      ['Seal leak', 'H₂ / CO at 50 bar (PHA 7)', 'Gas detectors, vibration monitoring and PSV'],
      ['Ignition by the drive', 'Motor in a gas area', 'Explosion-proof electric drive']]},

  'D-103': {
    design: [['Vessel', '1.9 m³, D = 0.93 m, L = 2.80 m'], ['Material', 'CS + 316L cladding'], ['Bare-module cost', '$139,295']],
    op: [['Split', '90 % recycle, 10 % purge'], ['Conditions', '40 °C, 47 bar']],
    ins: [23], outs: [24, 25],
    loops: [['PC', '319', 'Loop pressure 47 bar → purge valve'], ['FI', '320', 'Purge flow 1,436 kmol/h']],
    haz: ['toxic', 'flam', 'press'],
    safety: [
      ['Fatal CO exposure', 'The purge holds 26.6 % CO (IDLH 1,200 ppm) (PHA 9)', 'Purge burned in the gasifier furnace, closed handling, no atmospheric vent, CO detectors'],
      ['No purge flow', 'Inert CO₂ builds up and the conversion drops', 'Low-flow alarm (FAL) and purge-composition analyser'],
      ['Leaking purge valve', 'Loss of loop gas', 'Found by the fault monitor in 2 min (Section 10.4)']],
    risk: {pha: 9, S: 'A', L: 4, level: 'Undesirable', after: 'Marginal with the safeguards'}},

  'V-101': {
    design: [['Arrangement', '2 globe valves in series, V-101A and V-101B'], ['Pressure', '47.0 → 3.5 → 1.0 bar'], ['C<sub>v</sub>', '8.2 / 34.3'], ['Sizes', '1 in anti-cavitation + 2 in globe'], ['Material', 'CS bodies, SS 316 trims']],
    ins: [26], outs: [27],
    loops: [['LC', '318', 'F-101 level, P-only (averaging)']],
    haz: ['liq', 'press'],
    safety: [
      ['Gas blow-by', 'Valve fails open on loss of level', 'LSLL closes V-101; PSV on T-101'],
      ['Cavitation', 'A single valve cannot take the whole drop', 'Two stages in series with an anti-cavitation trim'],
      ['No pump needed', 'The liquid flows by its own pressure', 'No pump seals to leak (inherent safety)']]},

  'M-102': {
    design: [['Vessel', '2.6 m³, D = 1.04 m, L = 3.12 m'], ['Gas flow', '2.640 m³/s'], ['Material', 'Carbon steel'], ['Bare-module cost', '$112,057']],
    ins: [18, 31], outs: [19],
    loops: [['AC', '308', 'Stoichiometric number of Stream 19 → FC-113']],
    haz: ['flam', 'press', 'toxic'],
    safety: [
      ['No feed flow', 'C-101 trip: back-flow from F-101', 'Low-flow alarm (FAL) and check valve on Stream 20'],
      ['Flammable at 50 bar', 'No upper flammable limit at the loop pressure', 'Air ingress is treated as a major hazard: closed, leak-tight loop']]},

  'WWT': {
    design: [['Stream', 'T-101 bottoms, 472.51 kmol/h'], ['Methanol', '1.05 kmol/h (33.65 kg/h)'], ['Reuse', 'recycled to the gasifier water feed (8.6 % of the water)']],
    ins: [28], haz: ['liq'],
    safety: [
      ['Methanol in the water', 'Discharge without treatment pollutes the water (PHA 12)', 'Recycle to the gasifier water feed and an online TOC analyser']],
    risk: {pha: 12, S: 'D', L: 3, level: 'Marginal', after: 'Marginal'}},
};
