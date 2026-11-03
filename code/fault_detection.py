"""Chapter 10, Section 10.3: data-driven fault detection and diagnosis
(PCA monitoring and k-nearest neighbours).
The data are generated with the models of the report: the TC-310 loop of Section 6.3.7
(E-104) and the
synthesis loop of Section 10.2 (plant_model.loop)."""

import numpy as np, json
from scipy import stats
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import confusion_matrix
import plant_model as PM

VARS = [
    'T19 (°C)',
    'T20 (°C)',
    'Steam to E-104 (kg/s)',
    'TC-310 output (mA)',
    'Methanol product (kmol/h)',
    'Recycle, Stream 24 (kmol/h)',
    'Purge, Stream 25 (kmol/h)',
    'F-101 level (m)',
]
BASE = np.array([72.19, 200.0, 13.901, 12.0, 1049.12, 12926.75, 1436.31, 0.90])
NOISE = np.array([0.30, 0.10, 0.05, 0.03, 2.0, 15.0, 2.0, 0.005])
# TC-310 loop (Table 6.13) and Cohen-Coon PID (Table 6.15)
kv, kp, kd, km, tv, tp, tm = 1.3125, 9.195, 1.0, 0.16, 0.10, 0.475, 0.25
Kc, tI, tD = 1.067, 0.675, 0.112
DT_IN = 200.0 - 72.19  # temperature rise of the gas in E-104, degC


def loop_state(fx=1.0, phi=0.10):
    """Steady synthesis loop for a relative catalyst activity fx and a purge fraction phi."""
    x1, x2 = PM.X1, PM.X2
    PM.X1, PM.X2 = x1 * fx, x2 * fx
    r0 = PM.plant(0.40, phi, 0.90)
    PM.X1, PM.X2 = x1, x2
    return r0


U0 = 4.0 + 13.901 / kv  # TC-310 output at the design point, mA


def simulate(fault=0, minutes=600, onset=100, seed=0):
    rng = np.random.default_rng(seed)
    dt = 0.002
    n = int(minutes / dt)
    spm = int(1 / dt)
    m = 13.901
    T = Tm = I = Dm = 0.0
    out = []
    d = w = 0.0  # slow drift of T19 and of the MPW feed rate
    lin = PM.BASE_R
    targ = np.zeros(4)
    proc = np.zeros(4)
    load = 0.0
    for k in range(n):
        t = k * dt
        f = max(0.0, t - onset)
        if k % spm == 0:  # once per minute
            d += -d / 30.0 + 0.25 * rng.normal()  # T19 drift (degC)
            w += -w / 60.0 + 0.0008 * rng.normal()  # relative change of the MPW feed rate
            fx, phi = 1.0, 0.10
            if fault == 4:
                fx = 1.0 - 0.10 * min(f / 400.0, 1.0)  # F4 catalyst deactivation
            if fault == 5 and f > 0:
                phi = 0.115  # F5 leak through the purge valve
            r = loop_state(fx, phi) if (fault in (4, 5) and f > 0) else lin
            targ = np.array(
                [
                    (1 + w) * r['MeOH'] - lin['MeOH'],
                    (1 + w) * r['S24'] - lin['S24'],
                    (1 + w) * r['purge'] - lin['purge'],
                    0.45 * ((1 + w) * r['S26'] / lin['S26'] - 1),
                ]
            )
            load = -DT_IN * (
                (1 + w) * r['S20'] / lin['S20'] - 1
            )  # more gas gives a lower outlet T
        kv_f = (
            kv * (1 - 0.20 * min(f / 300.0, 1.0)) if fault == 1 else kv
        )  # F1 fouling of E-104
        bias = 3.0 * min(f / 200.0, 1.0) if fault == 3 else 0.0  # F3 drift of TT-310
        proc += dt * (targ - proc) / np.array([20.0, 20.0, 20.0, 5.0])
        e = -(Tm + bias)  # set point 200 degC (deviation 0)
        Dm += dt * ((Tm + bias) - Dm) / (0.1 * tD)
        u = U0 + Kc * km * (e + (I + dt * e) / tI - tD * ((Tm + bias) - Dm) / (0.1 * tD))
        if 4.0 < u < 20.0:
            I += dt * e  # integral action stops when the output saturates
        u = min(max(u, 4.0), 20.0)  # 4-20 mA output range of TC-310
        if not (fault == 2 and f > 0):
            m += dt * (-m + kv_f * (u - 4.0)) / tv  # F2: valve stuck
        T += dt * (-T + kp * (m - 13.901) + kd * (d + load)) / tp
        Tm += dt * (-Tm + T) / tm
        if k % spm == 0:
            x = np.array(
                [d, Tm + bias, m - 13.901, u - 12.0, proc[0], proc[1], proc[2], proc[3]]
            )
            out.append(BASE + x + NOISE * rng.normal(size=8))
    return np.array(out)


# ---------------- PCA model from normal operation
Xn = np.vstack([simulate(0, 1000, seed=s) for s in (1, 2, 3)])  # 3,000 min of normal operation
mu, sd = Xn.mean(0), Xn.std(0, ddof=1)
Z = (Xn - mu) / sd
lam, P = np.linalg.eigh(np.cov(Z.T))
idx = np.argsort(lam)[::-1]
lam, P = lam[idx], P[:, idx]
cum = np.cumsum(lam) / lam.sum()
a = int(np.searchsorted(cum, 0.90) + 1)
nN = len(Z)
T2lim = a * (nN - 1) * (nN + 1) / (nN * (nN - a)) * stats.f.ppf(0.99, a, nN - a)
th = [np.sum(lam[a:] ** i) for i in (1, 2, 3)]
h0 = 1 - 2 * th[0] * th[2] / (3 * th[1] ** 2)
ca = stats.norm.ppf(0.99)
Qlim = th[0] * (
    ca * np.sqrt(2 * th[1] * h0**2) / th[0] + 1 + th[1] * h0 * (h0 - 1) / th[0] ** 2
) ** (1 / h0)


def monitor(X):
    Zx = (X - mu) / sd
    tt = Zx @ P[:, :a]
    T2 = np.sum(tt**2 / lam[:a], axis=1)
    E = Zx - tt @ P[:, :a].T
    Q = np.sum(E**2, axis=1)
    return T2, Q, E


def first_alarm(s, lim, onset=100, run=3):
    over = s > lim
    for i in range(onset, len(s) - run):
        if over[i : i + run].all():
            return i - onset
    return None


res = dict(
    vars=VARS,
    n_pc=a,
    explained=[float(v) for v in lam / lam.sum()],
    T2lim=float(T2lim),
    Qlim=float(Qlim),
)
Xt = simulate(0, 600, seed=5)
T2, Q, _ = monitor(Xt)
res['false_alarm'] = dict(
    T2=float(np.mean(T2 > T2lim) * 100),
    Q=float(np.mean(Q > Qlim) * 100),
    T2_alarm=first_alarm(T2, T2lim, onset=0),
    Q_alarm=first_alarm(Q, Qlim, onset=0),
)
names = {
    1: 'F1 Fouling of E-104',
    2: 'F2 TV-310 valve stuck',
    3: 'F3 Drift of TT-310 (+3 °C)',
    4: 'F4 Deactivation of the R-103 catalyst',
    5: 'F5 Leak through the purge valve',
}
res['faults'] = {}
data = {}
for fnum in range(1, 6):
    X = simulate(fnum, 600, seed=10 + fnum)
    T2, Q, E = monitor(X)
    data[fnum] = X
    dT, dQ = first_alarm(T2, T2lim), first_alarm(Q, Qlim)
    det = [v for v in (dT, dQ) if v is not None]
    t0 = 100 + (min(det) if det else 0)
    contrib = np.mean(E[t0 : t0 + 60] ** 2, axis=0)
    res['faults'][fnum] = dict(
        name=names[fnum],
        delay_T2=dT,
        delay_Q=dQ,
        contrib=[float(c) for c in contrib / contrib.sum()],
        T2=[float(v) for v in T2],
        Q=[float(v) for v in Q],
    )


# ---------------- diagnosis with k-nearest neighbours (trained and tested on different runs)
def windows(seed0):
    Xs, ys = [], []
    for fnum in range(0, 6):
        X = simulate(fnum, 600, seed=seed0 + fnum)
        Zx = (X - mu) / sd
        sel = Zx[300:] if fnum else Zx[100:]
        Xs.append(sel)
        ys += [fnum] * len(sel)
    return np.vstack(Xs), np.array(ys)


Xtr, ytr = windows(100)
Xte, yte = windows(200)
knn = KNeighborsClassifier(n_neighbors=5).fit(Xtr, ytr)
yp = knn.predict(Xte)
cm = confusion_matrix(yte, yp)
res['confusion'] = cm.tolist()
res['accuracy'] = float(np.trace(cm) / cm.sum() * 100)
# ---------------- data for the figures: signals of F1 and score plot
X1 = data[1]
res['signals_F1'] = dict(T20=[float(v) for v in X1[:, 1]], steam=[float(v) for v in X1[:, 2]], u=[float(v) for v in X1[:, 3]])
res['scores'] = {}
for fnum in range(0, 6):
    X = Xt if fnum == 0 else data[fnum]
    tt = ((X - mu) / sd) @ P[:, :2]
    sel = tt[100:] if fnum == 0 else tt[300:]
    res['scores'][fnum] = [[float(a1), float(a2)] for a1, a2 in sel[::10]]
json.dump(res, open('fdd_results.json', 'w'), indent=1)
print('PCs', a, 'cum', cum[:a], 'T2lim', T2lim, 'Qlim', Qlim, 'FA', res['false_alarm'])
for k, v in res['faults'].items():
    print(k, v['name'], v['delay_T2'], v['delay_Q'], [round(c, 2) for c in v['contrib']])
print(cm, res['accuracy'])
