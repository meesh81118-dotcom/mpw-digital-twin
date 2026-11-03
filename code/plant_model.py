"""Reduced model of the MPW plant (Chapter 10, Section 10.2).
Inputs : beta = fraction of the clean syngas sent to the methanol section (D-102)
         phi  = purge fraction of D-103
         rho  = hydrogen recovery of the membrane ME-101
Output : production, utilities, equipment loads and the NPV (economic model of Appendix G)."""

import math
from appendix_g import BASE as P_BASE, npv  # economic model of Chapter 8 (Appendix G)

W_CIRC, W_C102, W_CHILL, Q_R102 = (
    823.07,
    28551.90,
    810.59,
    14.22877,
)  # kW, kW, kW, MW (Chapters 3 and 8)

# ---------- data of the material balance (Table 2.8)
S10 = {
    'H2': 5000.01,
    'CO': 2413.49,
    'CO2': 69.95,
    'CH4': 0.083,
    'H2O': 368.89,
}  # clean syngas, kmol/h
S7 = 2797.67  # steam to the gasifier at the design feed, kmol/h
X1, X2 = 0.16, 0.029998  # per-pass conversions of CO and CO2 in R-103
XH2 = 0.995  # largest per-pass conversion of H2 in R-103
VF_W, VF_M = 0.035050, 0.020571  # fraction of water and methanol leaving F-101 in the vapour
XCO_WGS = 0.90  # CO conversion in R-102
Y_W18 = 153.59 / (5067.44 - 153.59)  # water in Stream 18 per kmol of dry gas
PI = 1.8032e-3  # H2 permeance of ME-101, mol/(m2 s Pa0.5)
P1, P2 = 1.0e5, 0.04e5  # feed and permeate pressure of ME-101, Pa
A_INST = 6040.0  # installed membrane area, m2


def membrane(feed, rho):
    """Area of ME-101 for a recovery rho (plug flow, Sieverts' law, Section 3.5)."""
    nf = sum(feed.values())
    h2 = feed['H2']
    xf = h2 / nf
    xr = (1 - rho) * h2 / (nf - rho * h2)
    d1 = math.sqrt(P1 * xf) - math.sqrt(P2)
    d2 = math.sqrt(P1 * xr) - math.sqrt(P2)
    dlm = (d1 - d2) / math.log(d1 / d2)
    return rho * h2 / 3.6 / (PI * dlm)  # m2


def loop(S18, phi):
    """Synthesis loop M-102 -> R-103 -> F-101 -> D-103 solved by direct substitution."""
    rec = {k: 0.0 for k in ['H2', 'CO', 'CO2', 'CH4', 'H2O', 'MeOH']}
    for it in range(500):
        f = {k: S18.get(k, 0.0) + rec[k] for k in rec}  # Stream 19/20
        x1, x2 = X1 * f['CO'], X2 * f['CO2']
        s = min(1.0, XH2 * f['H2'] / (2 * x1 + 3 * x2))  # hydrogen limit
        x1, x2 = s * x1, s * x2
        out = {
            'H2': f['H2'] - 2 * x1 - 3 * x2,
            'CO': f['CO'] - x1,
            'CO2': f['CO2'] - x2,
            'CH4': f['CH4'],
            'H2O': f['H2O'] + x2,
            'MeOH': f['MeOH'] + x1 + x2,
        }
        vap = dict(out)
        vap['H2O'] = VF_W * out['H2O']
        vap['MeOH'] = VF_M * out['MeOH']
        liq = {'H2O': out['H2O'] - vap['H2O'], 'MeOH': out['MeOH'] - vap['MeOH']}
        new = {k: (1 - phi) * vap[k] for k in vap}
        err = max(abs(new[k] - rec[k]) for k in rec)
        rec = new
        if err < 1e-7:
            break
    return f, out, vap, liq, rec, x1, x2


def plant(beta=0.40, phi=0.10, rho=0.90, feed=1.0):
    """feed = MPW feed rate / design feed rate (1.0 = 37,879 kg/h)."""
    S11 = {k: feed * beta * v for k, v in S10.items()}
    S12 = {k: feed * (1 - beta) * v for k, v in S10.items()}
    S6 = 2 * S12['CO'] - S12['H2O']  # steam/CO = 2.0 at R-102
    water = feed * S7 + S6  # process water (Stream 3)
    xw = XCO_WGS * S12['CO']  # R-102 extent
    S15 = {
        'H2': S12['H2'] + xw,
        'CO': S12['CO'] - xw,
        'CO2': S12['CO2'] + xw,
        'CH4': S12['CH4'],
        'H2O': 2 * S12['CO'] - xw,
    }
    A = membrane(S15, rho)
    H2p = rho * S15['H2']  # permeate, Stream 16
    S17 = dict(S15)
    S17['H2'] -= H2p
    dry = {k: S17[k] + S11[k] for k in ['H2', 'CO', 'CO2', 'CH4']}
    S18 = dict(dry)
    S18['H2O'] = Y_W18 * sum(dry.values())
    f, out, vap, liq, rec, x1, x2 = loop(S18, phi)
    D_MeOH = 0.999 * liq['MeOH']  # methanol product, T-101
    r = dict(
        S6=S6,
        water=water,
        S15=sum(S15.values()),
        A=A,
        H2p=H2p,
        S18=sum(S18.values()),
        S20=sum(f.values()),
        S23=sum(vap.values()),
        S24=sum(rec.values()),
        S26=sum(liq.values()),
        MeOH=D_MeOH,
        x1=x1,
        x2=x2,
        purge=phi * sum(vap.values()),
        S17=sum(S17.values()),
        feed=feed,
    )
    return r


BASE_R = plant()


def economics(r):
    """Scale the production and utilities of the base case (Chapter 8).
    Returns the NPV in million US$ and the parameters of the economic model."""
    b = BASE_R
    p = dict(P_BASE)
    p['mpw_kgh'] = P_BASE['mpw_kgh'] * r['feed']
    p['Q_R101'] = P_BASE['Q_R101'] * r['feed']  # gasifier heat follows the feed
    p['meoh_kgh'] = P_BASE['meoh_kgh'] * r['MeOH'] / b['MeOH']
    p['h2_kgh'] = P_BASE['h2_kgh'] * r['H2p'] / b['H2p']
    k18, k24, kh = r['S18'] / b['S18'], r['S24'] / b['S24'], r['H2p'] / b['H2p']
    W = (
        22533.2 * k18
        + W_CIRC * k24
        + W_C102 * kh
        + W_CHILL * r['S17'] / b['S17']
        + 2083
        + 5 * 228
        + 1500
    )
    p['W_total'] = W
    p['Q_CW'] = (
        12.396 * r['S20'] / b['S20']
        + 20.625 * r['S17'] / b['S17']
        + 18.843 * r['MeOH'] / b['MeOH']
        + 17.772 * k18
        + W_C102 / 1000 * kh
    )
    qr102 = Q_R102 * (28.3 - 13.0) / 28.3 * r['S15'] / b['S15']
    qr103 = (r['x1'] * 96547.3 + r['x2'] * 56581.2) / 3.6e6
    p['Q_steam'] = qr102 + qr103
    p['Q_heat'] = P_BASE['Q_heat'] + (r['water'] - b['water']) / b['water'] * (70.379 + 27.363)
    p['proc_water'] = P_BASE['proc_water'] * r['water'] / b['water']
    return npv(p) / 1e6, p


# allowed load / design load (R-102 stays at 100 % because its catalyst charge is fixed)
LIMITS = {'S20': 1.05, 'S23': 1.05, 'S18': 1.05, 'S15': 1.00, 'S26': 1.05, 'H2p': 1.05, 'feed': 1.05}


def feasible(r):
    ok = r['A'] <= A_INST * 1.0005
    for k, f in LIMITS.items():
        ok = ok and r[k] <= f * BASE_R[k] * (1 + 1e-9)
    return ok


if __name__ == '__main__':
    r = BASE_R
    n, p = economics(r)
    print({k: round(v, 3) for k, v in r.items()})
    print('NPV', n, 'MeOH t/y', p['meoh_kgh'] * 7.92, 'H2 t/y', p['h2_kgh'] * 7.92)
