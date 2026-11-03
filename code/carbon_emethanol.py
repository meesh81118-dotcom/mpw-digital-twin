"""Chapter 10, Section 10.4: carbon balance of the plant and the solar e-methanol
extension (phase 2)."""

import json

H = 7920.0  # operating hours per year (Chapter 8)
# ---------------- carbon balance (Table 2.8), kmol C/h
C_in = 2556.14  # carbon in the MPW (Stream 1)
C_out = {
    'Methanol product (Stream 29)': 1049.12,
    'Purge gas, CO + CO2 (Stream 25)': 382.20 + 1048.87,
    'Purge gas, CH4 + CH3OH (Stream 25)': 0.083 + 2.21,
    'Char (Stream 9)': 72.62,
    'Methanol in the column bottoms (Stream 28)': 1.05,
}
eta_C = C_out['Methanol product (Stream 29)'] / C_in * 100
# ---------------- e-methanol from the purge CO and CO2 with green hydrogen
CO, CO2 = 382.20, 1048.87  # kmol/h in the purge (Stream 25)
H2_purge = 1.22
X = 0.95  # overall carbon conversion in the e-methanol loop
LHV = {'CO': 282.99, 'H2': 241.82, 'MeOH': 676.2}  # MJ/kmol (lower heating values, [9])
E_spec = 55.0  # electrolyser energy, kWh/kg H2 (IRENA: 50-83 today)
p_ng, eta_f = 2.5, 0.85  # USD/MMBtu and furnace efficiency (Chapter 8)
EF_ng = 56100 / 1e6 * 3.6  # kg CO2/kWh of natural gas (IPCC 2006: 56,100 kg/TJ)
fuel_MW = (
    CO * LHV['CO'] + H2_purge * LHV['H2'] + 2.21 * LHV['MeOH']
) / 3600  # purge used as fuel today


def phase(f):
    """Share f of the purge sent to the e-methanol unit."""
    meoh = X * f * (CO + CO2)  # kmol/h
    h2 = X * f * (2 * CO + 3 * CO2) - f * H2_purge  # kmol/h of green hydrogen
    h2_kg = h2 * 2.016
    P_el = h2_kg * E_spec / 1000  # kg/h and MW
    ng_MW = f * fuel_MW / eta_f  # extra natural gas for the R-101 furnace
    co2_use = (
        X * f * (CO + CO2) * 44.01 * H / 1000
    )  # t CO2-equivalent kept in the product per year
    co2_ng = ng_MW * 1000 * EF_ng * H / 1000  # t CO2 per year from the extra natural gas
    return dict(
        f=f,
        meoh_t=meoh * 32.042 * H / 1000,
        h2_t=h2_kg * H / 1000,
        P_el=P_el,
        ng_MW=ng_MW,
        co2_use=co2_use,
        co2_ng=co2_ng,
        co2_net=co2_use - co2_ng,
        eta_C=(1049.12 + meoh) / C_in * 100,
        h2_per_t=h2_kg / (meoh * 32.042),
        water_t=h2 * 18.015 * H / 1000,  # water fed to the electrolyser (H2O -> H2 + 1/2 O2)
        o2_t=h2 / 2 * 31.998 * H / 1000,  # oxygen by-product
        water_made_t=X * f * CO2 * 18.015 * H / 1000,  # water formed by the CO2 reaction
    )


phases = [phase(f) for f in (0.10, 0.25, 0.50, 1.00)]
# ---------------- cost of e-methanol (100 % case)
CBM_syn = 20152604.0  # synthesis section of the plant (R-103 ... T-101, C-101R), Table 8.7
FCI_ratio = 478400128.68 / 298183405.96  # FCI / sum of CBM of the plant (Chapter 8)
P0 = 266915.0  # t/y of methanol of the main plant
i, n = 0.10, 20
CRF = i * (1 + i) ** n / ((1 + i) ** n - 1)


def emeoh_cost(ph, c_el, capex_kw, e_spec):
    Q = ph['meoh_t']
    FCI_syn = FCI_ratio * CBM_syn * (Q / P0) ** 0.6
    syn = FCI_syn * (CRF + 0.05) / Q  # USD/t
    h2_kg = ph['h2_per_t'] * 1000  # kg H2 per t methanol
    kw = ph['h2_t'] * 1000 / H * e_spec  # electrolyser kW
    elz = kw * capex_kw * (CRF + 0.02) / Q  # USD/t
    elec = h2_kg * e_spec * c_el  # USD/t
    ng = ph['ng_MW'] * 1000 * H * 3412.14 / 1e6 * p_ng / Q  # USD/t (1 kWh = 3,412 Btu)
    return dict(total=syn + elz + elec + ng, syn=syn, elz=elz, elec=elec, ng=ng)


ph = phases[-1]
scen = {
    'Today (PEM 1,000 USD/kW, 55 kWh/kg)': (1000.0, 55.0),
    '2050 (PEM 200 USD/kW, 45 kWh/kg)': (200.0, 45.0),
}
prices = [0.0104, 0.0124, 0.02, 0.03, 0.04, 0.05, 0.0613]
curve = {k: [emeoh_cost(ph, c, *v)['total'] for c in prices] for k, v in scen.items()}


def breakeven(capex, e, target):
    lo, hi = 0.0, 0.2
    for _ in range(60):
        m = (lo + hi) / 2
        if emeoh_cost(ph, m, capex, e)['total'] > target:
            hi = m
        else:
            lo = m
    return m


res = dict(
    C_in=C_in,
    C_out=C_out,
    eta_C=eta_C,
    fuel_MW=fuel_MW,
    phases=phases,
    CRF=CRF,
    prices=prices,
    curve=curve,
    detail_today_1p04=emeoh_cost(ph, 0.0104, 1000, 55),
    detail_2050_1p04=emeoh_cost(ph, 0.0104, 200, 45),
    detail_today_grid=emeoh_cost(ph, 0.0613, 1000, 55),
    be_today_393=breakeven(1000, 55, 393),
    be_2050_393=breakeven(200, 45, 393),
    be_today_800=breakeven(1000, 55, 800),
    FCI_ratio=FCI_ratio,
)
json.dump(res, open('carbon_results.json', 'w'), indent=1)
print('eta_C', eta_C, 'fuel', fuel_MW)
for p in phases:
    print({k: round(v, 3) for k, v in p.items()})
print({k: [round(v) for v in c] for k, c in curve.items()})
for k in ('detail_today_1p04', 'detail_2050_1p04', 'detail_today_grid'):
    print(k, {a: round(b, 1) for a, b in res[k].items()})
print('BE', res['be_today_393'], res['be_2050_393'], res['be_today_800'])
