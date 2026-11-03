"""Economic model and Monte Carlo simulation of the MPW-to-methanol and hydrogen plant (Chapter 8).
Reproduces the base-case NPV (Section 8.2.2) and the Monte Carlo results (Section 8.3.8)."""
import numpy as np

H = 7920.0 # operating hours per year
SAR = 3.75 # SAR per US$
GJ_MW = 3.6 * H # GJ per MW-year
FCI_BASE = 478400128.68 # fixed-capital investment, US$ (Section 8.1.3)
MACRS5 = [20, 32, 19.2, 11.52, 11.52, 5.76] # % of FCI, 5-year MACRS

BASE = dict(
    meoh_kgh=33701.388, h2_kgh=7806.986, mpw_kgh=37879.0, # Chapter 3
    p_meoh=393.0, p_h2=2473.0, p_mpw=80.0, # US$/t
    p_elec=0.23 / SAR, p_ng=2.50, p_water=8.04 / SAR, # US$/kWh, US$/MMBtu, US$/m3
    p_ww=3.64 / SAR, p_sw=69.16 / SAR / 1000.0, eta_f=0.85,
    cat_cost=(71198 + 17752) * 80.0 / 4.0, # US$/yr
    mem_cost=6040 * 5000.0 * 840.9 / 797.9 * 0.8 / 5.0, # US$/yr
    COL=78 * 132222 / SAR, land=0.0, # land granted by the government
    W_total=22533.2 + 823.07 + 28551.90 + 2083.0 + 5 * 228.0 + 1500.0 + 810.59, # kW
    Q_R101=145.67, Q_heat=25.92758, # MW, fired heat (R-101 and E-101)
    Q_CW=12.39579 + 20.62523 + 18.843 + 17.772 + 28.55190, # MW
    Q_steam=14.22877 * (28.3 - 13.0) / 28.3 + 24.62219, # MW exported
    bfw=28.3 + 44.6, proc_water=98.58747, ww=8.538 + 28.58746, # m3/h
    wc=0.10, salvage=0.05, tax=0.025, i=0.10, fci_mult=1.0, op_factor=1.0)


def com_d(p, FCI, f):
    """Cost of manufacturing without depreciation, at fraction f of capacity."""
    meoh = p['meoh_kgh'] * H / 1000 * f
    h2 = p['h2_kgh'] * H / 1000 * f
    mpw = p['mpw_kgh'] * H / 1000 * f
    rev = meoh * p['p_meoh'] + h2 * p['p_h2']
    CRM = (mpw * p['p_mpw'] + (p['proc_water'] + p['bfw']) * H * f * p['p_water']
           + p['cat_cost'] + p['mem_cost'])
    fe = p['p_ng'] / 1.055056 / p['eta_f'] # US$/GJ of heat
    CUT = (p['W_total'] * H * f * p['p_elec']
           + p['Q_R101'] / p['eta_f'] * GJ_MW * f / 1.055056 * p['p_ng']
           + p['Q_heat'] * GJ_MW * f * fe
           + p['Q_CW'] * 1000 / (4.0 * 10) / 1025 * 3600 * H * f * p['p_sw']
           - p['Q_steam'] * GJ_MW * f * fe)
    CWT = p['ww'] * H * f * p['p_ww']
    coef = (0.146 - 0.032 + 0.010) / 0.81
    return rev, coef * FCI + 2.73 * p['COL'] + 1.23 * (CRM + CUT + CWT) + p['land']


def npv(p):
    """Year-by-year cash flow and net present value."""
    FCI = FCI_BASE * p['fci_mult']
    WC, S = p['wc'] * FCI, p['salvage'] * FCI
    total, carry = 0.0, 0.0
    for y in range(23):
        cf = 0.0
        if y in (1, 2):
            cf -= 0.5 * FCI
        if y == 2:
            cf -= WC
        k = y - 3
        if k >= 0:
            f = [0.75, 0.90][k] if k < 2 else 1.0
            R, C = com_d(p, FCI, f * p['op_factor'])
            d = MACRS5[k] / 100 * FCI if k < 6 else 0.0
            ti = R - C - d
            if ti < 0:
                carry, taxable = carry - ti, 0.0
            else:
                use = min(carry, ti); carry -= use; taxable = ti - use
            cf += ti - p['tax'] * taxable + d
        if y == 22:
            cf += WC + S
        total += cf / (1 + p['i']) ** y
    return total


if __name__ == '__main__':
    print(f'Base-case NPV = {npv(BASE) / 1e6:,.2f} million US$')
    rng = np.random.default_rng(2026)
    tri = lambda lo, mode, hi: rng.triangular(lo, mode, hi)
    results = []
    for _ in range(4000):
        q = dict(BASE)
        q['p_meoh'] = tri(300, 393, 520)
        q['p_h2'] = tri(2000, 2473, 2800)
        q['fci_mult'] = tri(0.85, 1.00, 1.25)
        q['p_mpw'] = tri(50, 80, 120)
        q['p_elec'] = BASE['p_elec'] * tri(0.95, 1.00, 1.25)
        q['p_ng'] = tri(2.20, 2.50, 3.20)
        q['op_factor'] = tri(0.90, 1.00, 1.01)
        results.append(npv(q))
    x = np.array(results) / 1e6
    print(f'Mean NPV = {x.mean():,.1f} M$; P(NPV > 0) = {(x > 0).mean() * 100:.1f} %')
    print(f'P10 = {np.percentile(x, 10):,.0f} M$; P50 = {np.percentile(x, 50):,.0f} M$; P90 = {np.percentile(x, 90):,.0f} M$')
