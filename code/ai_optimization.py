"""Chapter 10, Section 10.2: AI-assisted optimisation of the operating point.
Step 1  Latin hypercube design of experiments on the plant model
Step 2  Artificial neural network (surrogate model) of the NPV
Step 3  Sobol sensitivity indices from the surrogate
Step 4  Bayesian optimisation (Gaussian process + expected improvement)"""

import numpy as np, json, warnings

warnings.filterwarnings('ignore')
from scipy.stats import qmc, norm
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_absolute_error
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import Matern, ConstantKernel, WhiteKernel
from scipy.optimize import differential_evolution
import plant_model as PM

LOW = np.array([0.35, 0.08, 0.85])  # beta, phi, rho
HIGH = np.array([0.45, 0.12, 0.93])
NAMES = ['Syngas split to methanol, beta', 'Purge fraction, phi', 'H2 recovery of ME-101, rho']


def evaluate(x, p_meoh=393.0):
    r = PM.plant(*x)
    PM.P_BASE['p_meoh'] = p_meoh
    n, p = PM.economics(r)
    PM.P_BASE['p_meoh'] = 393.0
    return n, PM.feasible(r), r


# ---------------- Step 1: design of experiments
sampler = qmc.LatinHypercube(d=3, seed=2026)
X = qmc.scale(sampler.random(n=300), LOW, HIGH)
Y = np.array([evaluate(x)[0] for x in X])
# ---------------- Step 2: neural network
Xtr, Xte, Ytr, Yte = X[:240], X[240:], Y[:240], Y[240:]
sx, sy = StandardScaler().fit(Xtr), StandardScaler().fit(Ytr.reshape(-1, 1))
ann = MLPRegressor(
    hidden_layer_sizes=(20, 20),
    activation='tanh',
    solver='lbfgs',
    max_iter=5000,
    random_state=1,
)
ann.fit(sx.transform(Xtr), sy.transform(Ytr.reshape(-1, 1)).ravel())
predict = lambda x: sy.inverse_transform(
    ann.predict(sx.transform(np.atleast_2d(x))).reshape(-1, 1)
).ravel()
Ptr, Pte = predict(Xtr), predict(Xte)
res = dict(
    r2_train=r2_score(Ytr, Ptr),
    r2_test=r2_score(Yte, Pte),
    mae_test=mean_absolute_error(Yte, Pte),
    parity=[[float(a), float(b)] for a, b in zip(Yte, Pte)],
    Y_range=[float(Y.min()), float(Y.max())],
)
# ---------------- Step 3: Sobol indices (Saltelli sampling, Jansen estimators)
N = 20000
rng = np.random.default_rng(7)
A = LOW + (HIGH - LOW) * rng.random((N, 3))
B = LOW + (HIGH - LOW) * rng.random((N, 3))
fA, fB = predict(A), predict(B)
V = np.var(np.r_[fA, fB])
S1, ST = [], []
for i in range(3):
    ABi = A.copy()
    ABi[:, i] = B[:, i]
    fABi = predict(ABi)
    S1.append(float(1 - np.mean((fB - fABi) ** 2) / (2 * V)))
    ST.append(float(np.mean((fA - fABi) ** 2) / (2 * V)))
res['S1'], res['ST'] = S1, ST


# ---------------- Step 4: Bayesian optimisation on the plant model
def objective(x, p_meoh=393.0, step=0.0):
    n, ok, r = evaluate(x, p_meoh)
    if ok:
        return n
    worst = max(
        [r['A'] / PM.A_INST] + [r[k] / (f * PM.BASE_R[k]) for k, f in PM.LIMITS.items()]
    )
    return n - step - 300 * (worst - 1)  # penalty for loads above the design limits


u = lambda x: (x - LOW) / (HIGH - LOW)


def bayes_opt(p_meoh=393.0, n0=10, n_iter=60, seed=11):
    rng = np.random.default_rng(seed)
    Xb = list(qmc.scale(qmc.LatinHypercube(d=3, seed=seed).random(n0), LOW, HIGH))
    Yb = [objective(x, p_meoh) for x in Xb]
    kernel = ConstantKernel(1.0) * Matern(length_scale=[0.3, 0.3, 0.3], nu=2.5) + WhiteKernel(
        1e-4
    )
    for it in range(n_iter):
        gp = GaussianProcessRegressor(
            kernel=kernel, normalize_y=True, n_restarts_optimizer=2, random_state=0
        )
        gp.fit(u(np.array(Xb)), np.array(Yb))
        xb = Xb[int(np.argmax(Yb))]
        cand = np.r_[
            LOW + (HIGH - LOW) * rng.random((4000, 3)),
            np.clip(xb + rng.normal(0, 0.02, (2000, 3)) * (HIGH - LOW), LOW, HIGH),
        ]
        mu, sd = gp.predict(u(cand), return_std=True)
        fbest = max(Yb)
        z = (mu - fbest) / np.maximum(sd, 1e-9)
        ei = (mu - fbest) * norm.cdf(z) + sd * norm.pdf(z)
        xn = cand[np.argmax(ei)]
        Xb.append(xn)
        Yb.append(objective(xn, p_meoh))
    ib = int(np.argmax(Yb))
    return Xb[ib], list(np.maximum.accumulate(Yb))


xbest, hist = bayes_opt()
n, ok, r = evaluate(xbest)
res.update(
    bo_hist=[float(v) for v in hist],
    bo_x=[float(v) for v in xbest],
    bo_npv=float(n),
    bo_ok=bool(ok),
    bo_ann=float(predict(xbest)[0]),
    bo_r={k: float(v) for k, v in r.items()},
)
# ---------------- Step 5: best operating point for other methanol prices
res['prices'] = {}
for pm in [360.0, 393.0, 440.0, 480.0]:
    xp, h = bayes_opt(pm)
    n_opt = evaluate(xp, pm)[0]
    n_base = evaluate(np.array([0.40, 0.10, 0.90]), pm)[0]
    if n_opt < n_base:  # the design point is kept when no better point is found
        xp, n_opt = np.array([0.40, 0.10, 0.90]), n_base
    rr = evaluate(xp, pm)[2]
    res['prices'][pm] = dict(
        x=[float(v) for v in xp],
        npv_opt=float(n_opt),
        npv_base=float(n_base),
        meoh=float(rr['MeOH']),
        h2=float(rr['H2p']),
        ok=bool(evaluate(xp, pm)[1]),
    )
    # check with a full evolutionary search (thousands of runs of the plant model)
    de = differential_evolution(
        lambda x: -objective(x, pm, step=1.0),
        list(zip(LOW, HIGH)),
        seed=1,
        tol=1e-10,
        maxiter=400,
        polish=False,
    )
    res['prices'][pm].update(
        de_x=[float(v) for v in de.x], de_npv=float(-de.fun), de_nfev=int(de.nfev)
    )
# ---------------- Step 6: data for the figures of Section 10.2
res['doe'] = [[float(v) for v in x] + [float(y), bool(evaluate(x)[1])] for x, y in zip(X, Y)]


def point(beta, phi, rho):
    """NPV and feasibility of one set point (used for the response curves)."""
    n, ok, r = evaluate(np.array([beta, phi, rho]))
    return [float(beta), float(phi), float(rho), float(n), bool(ok)]


res['curves_phi'] = {}
for rho in (0.85, 0.88, 0.90, 0.93):
    res['curves_phi'][rho] = [point(0.40, phi, rho) for phi in np.linspace(0.08, 0.12, 21)]
res['curve_beta'] = [point(b, 0.10, 0.90) for b in np.linspace(0.35, 0.45, 21)]
for tag, x in (('design', [0.40, 0.10, 0.90]), ('optimum', xbest)):
    n, ok, r = evaluate(np.array(x))
    p = PM.economics(r)[1]
    keys = ('W_total', 'Q_CW', 'Q_steam', 'Q_heat', 'proc_water', 'meoh_kgh', 'h2_kgh')
    res['util_' + tag] = {k: float(p[k]) for k in keys}
json.dump(res, open('ai_results.json', 'w'), indent=1)
print({k: v for k, v in res.items() if k not in ('parity', 'bo_hist', 'bo_r')})
