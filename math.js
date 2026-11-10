/**
 * math.js — Matematické jádro vizualizéru.
 *
 * Čisté výpočty bez závislosti na DOM nebo canvasu.
 * Každý režim (typ funkce) definuje:
 *   - metadata (název, obecný předpis, teorii),
 *   - parametry pro posuvníky a číselné vstupy (rozsah, krok, výchozí hodnota),
 *   - funkci analyze(params), která vrací:
 *       * data pro vykreslení grafu (canvas.js),
 *       * kompletní maturitní rozbor vlastností (D(f), H(f), monotonie,
 *         lokální a globální extrémy, parita, omezenost, průsečíky, asymptoty),
 *       * analytický popis a křivku inverzní funkce f⁻¹.
 *
 * Veškeré matematické zápisy jsou v TeXu (sazba přes KaTeX).
 * V HTML textech se inline matematika zapisuje mezi oddělovače \( ... \).
 */
const MathCore = (() => {
  'use strict';

  const EPS = 1e-9;
  const t = String.raw;

  // ---------------------------------------------------------
  // Číselné pomocníky
  // ---------------------------------------------------------
  const clean = (v) => (Math.abs(v) < EPS ? 0 : v);
  const isInt = (v) => Math.abs(v - Math.round(v)) < EPS;
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

  function round(v, d = 2) {
    const f = 10 ** d;
    const r = Math.round(clean(v) * f) / f;
    return r === 0 ? 0 : r;
  }

  /** Číslo v TeXu s desetinnou čárkou (česká konvence). */
  function num(v, d = 2) {
    return String(round(v, d)).replace('.', '{,}');
  }

  /** Číslo jako prostý text pro popisky na plátně. */
  function plain(v, d = 1) {
    return String(round(v, d)).replace('.', ',').replace('-', '−');
  }

  // ---------------------------------------------------------
  // TeX pomocníky
  // ---------------------------------------------------------
  const im = (tex) => t`\(${tex}\)`;
  const pt = (x, y, d = 2) => t`\left[${num(x, d)};\ ${num(y, d)}\right]`;
  const ptPlain = (x, y) => `[${plain(x)}; ${plain(y)}]`;
  const R = t`\mathbb{R}`;

  /** Mnohočlen z dvojic [koeficient, proměnná] se správnými znaménky. */
  function poly(terms) {
    let s = '';
    for (const [coef, v] of terms) {
      const c = round(coef, 2);
      if (c === 0) continue;
      const abs = Math.abs(c);
      const k = v && abs === 1 ? '' : num(abs);
      if (s === '') s = (c < 0 ? '-' : '') + k + v;
      else s += (c < 0 ? ' - ' : ' + ') + k + v;
    }
    return s || '0';
  }

  /** Přičtení konstanty: „ + 3“, „ - 1{,}5“ nebo prázdný řetězec. */
  function tail(c) {
    const r = round(c, 2);
    if (r === 0) return '';
    return r < 0 ? t` - ${num(-r)}` : t` + ${num(r)}`;
  }

  /** Základ mocniny – neceločíselný nebo záporný v závorce. */
  const baseTex = (a) => (isInt(round(a, 2)) && a >= 0 ? num(a) : t`\left(${num(a)}\right)`);

  /** Zlomek (p/q)·π v základním tvaru, např. \frac{3\pi}{4}. */
  function piRational(p, q) {
    const pRound = Math.round(p);
    if (pRound === 0) return '0';
    const sign = pRound < 0 !== q < 0 ? '-' : '';
    let a = Math.abs(pRound);
    let b = Math.abs(q);
    const g = gcd(a, b);
    a /= g;
    b /= g;
    const top = a === 1 ? t`\pi` : t`${a}\pi`;
    return b === 1 ? sign + top : t`${sign}\frac{${top}}{${b}}`;
  }

  /** Položka výukového panelu. */
  const prop = (label, value, note = '', tone = '', wide = false) => ({
    label,
    value,
    note,
    tone,
    wide,
  });

  const I = {
    negInfZeroCl: t`\left(-\infty;\ 0\right\rangle`,
    zeroInfCl: t`\left\langle 0;\ \infty\right)`,
    negInfZero: t`\left(-\infty;\ 0\right)`,
    zeroInf: t`\left(0;\ \infty\right)`,
  };

  // ---------------------------------------------------------
  // Přesné hodnoty goniometrických funkcí (tabulkové úhly)
  // ---------------------------------------------------------
  const TRIG_TABLE = {
    0: { s: '0', c: '1', tg: '0', cotg: null },
    30: { s: t`\frac{1}{2}`, c: t`\frac{\sqrt{3}}{2}`, tg: t`\frac{\sqrt{3}}{3}`, cotg: t`\sqrt{3}` },
    45: { s: t`\frac{\sqrt{2}}{2}`, c: t`\frac{\sqrt{2}}{2}`, tg: '1', cotg: '1' },
    60: { s: t`\frac{\sqrt{3}}{2}`, c: t`\frac{1}{2}`, tg: t`\sqrt{3}`, cotg: t`\frac{\sqrt{3}}{3}` },
  };

  function exactTrig(deg, sin, cos) {
    const dRound = Math.round(deg);
    if (Math.abs(deg - dRound) > 1e-4) return null;
    const d = ((dRound % 360) + 360) % 360;
    const row = TRIG_TABLE[d % 90];
    if (!row) return null;
    const odd = Math.floor(d / 90) % 2 === 1;
    const sgn = (v, mag) => (mag === '0' ? '0' : (v < -EPS ? '-' : '') + mag);
    const tMag = odd ? row.cotg : row.tg;
    return {
      sin: sgn(sin, odd ? row.c : row.s),
      cos: sgn(cos, odd ? row.s : row.c),
      tan: tMag === null ? null : sgn(sin * cos, tMag),
    };
  }

  function exactOrApprox(name, exact, value) {
    if (exact == null) return t`${name} \approx ${num(value, 4)}`;
    if (/^-?\d$/.test(exact)) return t`${name} = ${exact}`;
    return t`${name} = ${exact} \approx ${num(value, 4)}`;
  }

  // =========================================================
  // DEFINICE REŽIMŮ
  // =========================================================
  const modes = {};

  // ---------------------------------------------------------
  // 1. Jednotková kružnice
  // ---------------------------------------------------------
  modes.circle = {
    title: 'Jednotková kružnice',
    short: 'Kružnice',
    navTex: t`\sin\alpha,\ \cos\alpha`,
    subtitle: 'Definice goniometrických funkcí pomocí souřadnic bodu M na kružnici o poloměru 1.',
    generalTex: t`\sin^2\alpha + \cos^2\alpha = 1`,
    params: [
      {
        key: 'angle',
        label: t`Úhel \(\alpha\) (ve stupních)`,
        min: 0,
        max: 360,
        step: 1,
        value: 45,
        isInteger: true,
        display: (v) => t`${num(v, 1)}^\circ`,
      },
    ],
    theory: t`
      <p><strong>Jednotková kružnice</strong> má střed v počátku \([0;\ 0]\) a poloměr \(r = 1\). Každému orientovanému úhlu \(\alpha\) odpovídá právě jeden bod \(M\) na kružnici.</p>
      <ul>
        <li><strong>Kosinus</strong> je \(x\)-ová souřadnice bodu \(M\), <strong>sinus</strong> je jeho \(y\)-ová souřadnice: \(M = [\cos\alpha;\ \sin\alpha]\).</li>
        <li>Z Pythagorovy věty plyne <strong>goniometrická jednička</strong> \(\sin^2\alpha + \cos^2\alpha = 1\).</li>
        <li><strong>Oblouková míra</strong>: \(\alpha_{\mathrm{rad}} = \frac{\pi}{180^\circ}\cdot\alpha^\circ\), tedy \(180^\circ = \pi\).</li>
        <li><strong>Tangens</strong>: \(\operatorname{tg}\alpha = \frac{\sin\alpha}{\cos\alpha}\), definován pro \(\alpha \neq 90^\circ + k\cdot 180^\circ\).</li>
      </ul>`,
    analyze({ angle }) {
      const rad = (angle * Math.PI) / 180;
      const sin = clean(Math.sin(rad));
      const cos = clean(Math.cos(rad));
      const tanDefined = Math.abs(cos) > EPS;
      const tan = tanDefined ? sin / cos : NaN;
      const ex = exactTrig(angle, sin, cos);

      const intAngle = Math.round(angle);
      const isWhole = Math.abs(angle - intAngle) < 1e-3;
      const g = isWhole ? gcd(intAngle, 180) || 180 : 1;
      const niceRad = isWhole && (intAngle === 0 || 180 / g <= 12);
      const radTex = intAngle === 0 && isWhole ? '0' : niceRad ? piRational(intAngle, 180) : t`${num(rad, 3)}\,\mathrm{rad}`;
      const rel = niceRad ? '=' : t`\approx`;

      let quadrant;
      const normDeg = ((angle % 360) + 360) % 360;
      if (Math.abs(normDeg % 90) < 1e-3) quadrant = 'Koncové rameno leží na souřadnicové ose';
      else if (normDeg < 90) quadrant = t`I. kvadrant: \(\sin\alpha > 0,\ \cos\alpha > 0\)`;
      else if (normDeg < 180) quadrant = t`II. kvadrant: \(\sin\alpha > 0,\ \cos\alpha < 0\)`;
      else if (normDeg < 270) quadrant = t`III. kvadrant: \(\sin\alpha < 0,\ \cos\alpha < 0\)`;
      else quadrant = t`IV. kvadrant: \(\sin\alpha < 0,\ \cos\alpha > 0\)`;

      const sq = (v) => (v < 0 ? t`\left(${num(v, 3)}\right)^2` : t`${num(v, 3)}^2`);

      return {
        custom: 'circle',
        angle,
        rad,
        sin,
        cos,
        equation: t`\alpha = ${num(angle, 1)}^\circ ${rel} ${radTex},\qquad M = ${pt(cos, sin, 3)}`,
        inverse: {
          available: false,
          explanationHtml: t`Jednotková kružnice zobrazuje goniometrické poměry v závislosti na úhlu \(\alpha\). Pro zobrazení inverzních goniometrických křivek (\(\arcsin, \arccos, \operatorname{arctg}\)) přepněte na kartu <strong>Goniometrické</strong>.`,
        },
        props: [
          prop('Sinus (svislá úsečka)', im(exactOrApprox(t`\sin\alpha`, ex && ex.sin, sin)), t`Souřadnice \(y\) bodu \(M\) na kružnici.`, 'red'),
          prop('Kosinus (vodorovná úsečka)', im(exactOrApprox(t`\cos\alpha`, ex && ex.cos, cos)), t`Souřadnice \(x\) bodu \(M\) na kružnici.`, 'blue'),
          prop(
            'Tangens',
            tanDefined ? im(exactOrApprox(t`\operatorname{tg}\alpha`, ex && ex.tan, tan)) : t`\(\operatorname{tg}\alpha\) není definován`,
            im(t`\operatorname{tg}\alpha = \frac{\sin\alpha}{\cos\alpha}`),
            'green'
          ),
          prop('Kvadrant a znaménka', quadrant, t`Oblouková míra: \(${radTex}\)`, 'amber'),
          prop('Parita goniometrických funkcí', t`\(\cos(-\alpha) = \cos\alpha\) (sudá)<br>\(\sin(-\alpha) = -\sin\alpha\) (lichá)`, t`\(\operatorname{tg}(-\alpha) = -\operatorname{tg}\alpha\) (lichá)`),
          prop('Omezenost a extrémy na kružnici', im(t`-1 \leq \sin\alpha \leq 1,\quad -1 \leq \cos\alpha \leq 1`), im(t`${sq(sin)} + ${sq(cos)} = 1`), 'purple'),
        ],
      };
    },
  };

  // ---------------------------------------------------------
  // 2. Lineární funkce  y = ax + b
  // ---------------------------------------------------------
  modes.linear = {
    title: 'Lineární funkce',
    short: 'Lineární',
    navTex: t`ax + b`,
    subtitle: 'Grafem je přímka se směrnicí a a úsekem b na ose y.',
    generalTex: t`y = ax + b`,
    params: [
      { key: 'a', label: t`Směrnice přímky \(a\)`, min: -5, max: 5, step: 0.1, value: 1 },
      { key: 'b', label: t`Úsek na ose \(y\) — \(b\)`, min: -8, max: 8, step: 0.5, value: 2 },
    ],
    theory: t`
      <p>Grafem lineární funkce \(y = ax + b\) je vždy <strong>přímka</strong>.</p>
      <ul>
        <li><strong>Směrnice \(a\)</strong> určuje sklon: \(a = \operatorname{tg}\varphi\), kde \(\varphi\) je orientovaný úhel s kladnou poloosou \(x\).</li>
        <li><strong>Absolutní člen \(b\)</strong> posouvá graf ve směru osy \(y\) a udává průsečík \(P_y = [0;\ b]\).</li>
        <li>Pro \(a \neq 0\) je funkce <strong>prostá</strong> na celém \(\mathbb{R}\) a má inverzní funkci \(f^{-1}(x) = \frac{x - b}{a}\).</li>
      </ul>`,
    analyze({ a, b }) {
      a = clean(a);
      b = clean(b);
      const points = [{ x: 0, y: b, kind: 'py', label: `Py${ptPlain(0, b)}` }];
      let px;
      if (a !== 0) {
        const x0 = -b / a;
        points.push({ x: x0, y: 0, kind: 'px', label: `Px${ptPlain(x0, 0)}` });
        px = im(t`P_x = ${pt(x0, 0)}`);
      } else {
        px = b === 0 ? t`\(P_x\): celá osa \(x\)` : t`\(P_x\) neexistuje`;
      }

      let parity = 'Ani sudá, ani lichá';
      let parityNote = t`Platí \(f(-x) \neq f(x)\) i \(f(-x) \neq -f(x)\).`;
      if (a === 0 && b === 0) {
        parity = 'Sudá i lichá zároveň';
        parityNote = 'Nulová funkce y = 0.';
      } else if (a === 0) {
        parity = t`Sudá: \(f(-x) = f(x) = ${num(b)}\)`;
        parityNote = t`Souměrná podle osy \(y\).`;
      } else if (b === 0) {
        parity = t`Lichá: \(f(-x) = -f(x)\)`;
        parityNote = 'Přímá úměrnost souměrná podle počátku [0; 0].';
      }

      const phi = (Math.atan(a) * 180) / Math.PI;
      const mono =
        a > 0
          ? t`Ostře rostoucí na \(\left(-\infty;\ \infty\right)\)`
          : a < 0
          ? t`Ostře klesající na \(\left(-\infty;\ \infty\right)\)`
          : t`Konstantní na \(\left(-\infty;\ \infty\right)\) (neroste ani neklesá)`;

      const extremes =
        a !== 0
          ? 'Nemá lokální ani globální extrémy'
          : t`Globální minimum i maximum \(y = ${num(b)}\) v každém bodě \(x \in ${R}\)`;

      const bounded =
        a !== 0
          ? 'Neomezená shora ani zdola'
          : t`Omezená shora i zdola (\(\inf f = \sup f = ${num(b)}\))`;

      // Inverzní funkce
      let inverse;
      if (a === 0) {
        inverse = {
          available: false,
          explanationHtml: t`Pro \(a = 0\) je funkce <strong>konstantní</strong> (\(y = ${num(b)}\)), není prostá na žádném intervalu, a proto k ní <strong>neexistuje inverzní funkce</strong>.`,
        };
      } else {
        const invFormula = b === 0 ? t`f^{-1}(x) = \frac{x}{${num(a)}}` : t`f^{-1}(x) = \frac{x ${b > 0 ? '-' : '+'} ${num(Math.abs(b))}}{${num(a)}}`;
        inverse = {
          available: true,
          isInjective: true,
          fn: (x) => (x - b) / a,
          formulaTex: invFormula,
          dfTex: R,
          hfTex: R,
          dfInvTex: R,
          hfInvTex: R,
          explanationHtml: t`Lineární funkce pro \(a \neq 0\) je <strong>prostá</strong> na celém \(\mathbb{R}\). Výměnou proměnných \(x \leftrightarrow y\) v rovnici \(y = ax + b\) dostáváme \[${invFormula}\] Role oborů se vymění: \(D(f^{-1}) = H(f) = \mathbb{R}\) a \(H(f^{-1}) = D(f) = \mathbb{R}\).`,
        };
      }

      return {
        equation: t`y = ${poly([[a, 'x'], [b, '']])}`,
        fn: (x) => a * x + b,
        color: '#3b82f6',
        points,
        inverse,
        props: [
          prop('Definiční obor a obor hodnot', `${im(t`D(f) = ${R}`)}<br>${im(a === 0 ? t`H(f) = \{${num(b)}\}` : t`H(f) = ${R}`)}`, 'Množina vstupů a výstupů funkce.', 'blue'),
          prop('Monotonie', mono, t`Směrnice \(a = \operatorname{tg}\varphi \implies \varphi \approx ${num(phi, 1)}^\circ\).`, 'green'),
          prop('Extrémy (globální a lokální)', extremes, a !== 0 ? 'Přímka pokračuje do ±∞.' : 'Nabývá jedné hodnoty.', 'purple'),
          prop('Parita funkce', parity, parityNote, 'amber'),
          prop('Omezenost', bounded, a !== 0 ? t`\(\lim_{x\to\pm\infty} f(x) = \pm\infty\)` : 'Hodnoty leží v jednobodové množině.', 'red'),
          prop('Průsečíky s osami', `${px}<br>${im(t`P_y = ${pt(0, b)}`)}`, 'Zelený bod na ose x, modrý na ose y.'),
        ],
      };
    },
  };

  // ---------------------------------------------------------
  // 3. Kvadratická funkce  y = ax² + bx + c
  // ---------------------------------------------------------
  modes.quadratic = {
    title: 'Kvadratická funkce',
    short: 'Kvadratická',
    navTex: t`ax^2 + bx + c`,
    subtitle: 'Grafem je parabola s vrcholem V a osou souměrnosti rovnoběžnou s osou y.',
    generalTex: t`y = ax^2 + bx + c,\ a \neq 0`,
    params: [
      { key: 'a', label: t`Kvadratický koeficient \(a\)`, min: -4, max: 4, step: 0.1, value: 1 },
      { key: 'b', label: t`Lineární koeficient \(b\)`, min: -6, max: 6, step: 0.5, value: -2 },
      { key: 'c', label: t`Absolutní člen \(c\)`, min: -8, max: 8, step: 0.5, value: -3 },
    ],
    theory: t`
      <p>Grafem kvadratické funkce \(y = ax^2 + bx + c\), \(a \neq 0\), je <strong>parabola</strong>.</p>
      <ul>
        <li><strong>Vrchol paraboly</strong>: \(V = \left[-\frac{b}{2a};\ c - \frac{b^2}{4a}\right]\). V něm funkce nabývá svého <strong>globálního extrému</strong>.</li>
        <li><strong>Vrcholový tvar</strong>: \(y = a(x - x_V)^2 + y_V\).</li>
        <li><strong>Inverzní funkce</strong>: Protože parabola není prostá na celém \(\mathbb{R}\), omezujeme definiční obor na pravé rameno \(\langle x_V;\ \infty)\), kde je funkce prostá, a získáme větev odmocniny \(f^{-1}(x) = x_V + \sqrt{\frac{x - y_V}{a}}\).</li>
      </ul>`,
    analyze({ a, b, c }) {
      a = clean(a);
      b = clean(b);
      c = clean(c);

      if (a === 0) {
        const lin = modes.linear.analyze({ a: b, b: c });
        lin.title = 'Kvadratická funkce (degenerovaná pro a = 0 na přímku)';
        return lin;
      }

      const equation = t`y = ${poly([[a, 'x^2'], [b, 'x'], [c, '']])}`;
      const fn = (x) => a * x * x + b * x + c;
      const points = [{ x: 0, y: c, kind: 'py', label: `Py${ptPlain(0, c)}` }];

      const xv = clean(-b / (2 * a));
      const yv = clean(c - (b * b) / (4 * a));
      let D = clean(b * b - 4 * a * c);

      let roots;
      if (D > 0) {
        const s = Math.sqrt(D);
        const [x1, x2] = [(-b - s) / (2 * a), (-b + s) / (2 * a)].sort((p, q) => p - q);
        points.push({ x: x1, y: 0, kind: 'px', label: 'x₁' }, { x: x2, y: 0, kind: 'px', label: 'x₂' });
        roots = im(t`P_{x_1} = ${pt(x1, 0)},\ P_{x_2} = ${pt(x2, 0)}`);
      } else if (D === 0) {
        points.push({ x: xv, y: 0, kind: 'px', label: `Px${ptPlain(xv, 0)}` });
        roots = im(t`P_x = ${pt(xv, 0)}`) + ' (dvojnásobný)';
      } else {
        roots = t`\(P_x\): žádný v \(\mathbb{R}\) (\(D < 0\))`;
      }
      points.push({ x: xv, y: yv, kind: 'special', label: `V${ptPlain(xv, yv)}` });

      const H = a > 0 ? t`\left\langle ${num(yv)};\ \infty\right)` : t`\left(-\infty;\ ${num(yv)}\right\rangle`;
      const left = t`\left(-\infty;\ ${num(xv)}\right\rangle`;
      const right = t`\left\langle ${num(xv)};\ \infty\right)`;

      const mono =
        a > 0
          ? t`Ostře klesající na \(${left}\),<br>ostře rostoucí na \(${right}\)`
          : t`Ostře rostoucí na \(${left}\),<br>ostře klesající na \(${right}\)`;

      const extremes =
        a > 0
          ? t`Globální (i lokální) minimum v bodě \(V = ${pt(xv, yv)}\) (hodnota \(y_{\min} = ${num(yv)}\)). Maximum nemá.`
          : t`Globální (i lokální) maximum v bodě \(V = ${pt(xv, yv)}\) (hodnota \(y_{\max} = ${num(yv)}\)). Minimum nemá.`;

      const parity =
        b === 0
          ? t`Sudá funkce (\(b = 0 \implies f(-x) = f(x)\))`
          : t`Ani sudá, ani lichá (osa souměrnosti \(x = ${num(xv)} \neq 0\))`;

      const bounded =
        a > 0
          ? t`Omezená zdola (\(\inf f = ${num(yv)}\)), shora neomezená`
          : t`Omezená shora (\(\sup f = ${num(yv)}\)), zdola neomezená`;

      // Inverzní funkce na pravém rameni x ∈ ⟨xv; ∞)
      const radNum = yv === 0 ? 'x' : t`x ${yv > 0 ? '-' : '+'} ${num(Math.abs(yv))}`;
      const radInside = a === 1 ? radNum : t`\frac{${radNum}}{${num(a)}}`;
      const invFormula = xv === 0 ? t`f^{-1}(x) = \sqrt{${radInside}}` : t`f^{-1}(x) = ${num(xv)} + \sqrt{${radInside}}`;

      const inverse = {
        available: true,
        isInjective: false,
        restrictedDomainTex: right,
        fn: (x) => {
          const val = (x - yv) / a;
          return val < 0 ? NaN : xv + Math.sqrt(val);
        },
        formulaTex: invFormula,
        dfTex: right,
        hfTex: H,
        dfInvTex: H,
        hfInvTex: right,
        explanationHtml: t`Kvadratická funkce není na \(\mathbb{R}\) prostá. Zúžíme-li však definiční obor na pravé rameno \(D_{\text{prostá}}(f) = ${right}\), je zde funkce ryze monotónní (prostá) a má inverzní funkci \[${invFormula}\] Role oborů si vymění místa: \(D(f^{-1}) = H(f) = ${H}\) a \(H(f^{-1}) = D_{\text{prostá}}(f) = ${right}\).`,
      };

      return {
        equation,
        fn,
        color: '#8b5cf6',
        points,
        guides: [{ type: 'v', value: xv }],
        inverse,
        props: [
          prop('Definiční obor a obor hodnot', `${im(t`D(f) = ${R}`)}<br>${im(t`H(f) = ${H}`)}`, im(t`Diskriminant D = ${num(D)}`), 'blue'),
          prop('Monotonie (růst a pokles)', mono, t`Bod obratu ve vrcholu \(x_V = ${num(xv)}\).`, 'green'),
          prop('Extrémy (globální a lokální)', extremes, 'Extrém leží přímo ve vrcholu paraboly.', 'purple'),
          prop('Parita funkce', parity, t`Souměrná podle přímky \(x = ${num(xv)}\).`, 'amber'),
          prop('Omezenost', bounded, a > 0 ? 'Parabola otevřená nahoru.' : 'Parabola otevřená dolů.', 'red'),
          prop('Průsečíky s osami', `${roots}<br>${im(t`P_y = ${pt(0, c)}`)}`, 'Zelené body na ose x, modrý na ose y.'),
        ],
      };
    },
  };

  // ---------------------------------------------------------
  // 4. Mocninná funkce  y = a·xⁿ, n ∈ ℤ
  // ---------------------------------------------------------
  modes.power = {
    title: 'Mocninná funkce',
    short: 'Mocninná',
    navTex: t`ax^n`,
    subtitle: 'Vlastnosti závisí na tom, zda je exponent n sudý či lichý, kladný či záporný.',
    generalTex: t`y = ax^n,\ n \in \mathbb{Z}`,
    params: [
      { key: 'a', label: t`Koeficient \(a\)`, min: -4, max: 4, step: 0.5, value: 1 },
      { key: 'n', label: t`Exponent \(n \in \mathbb{Z}\)`, min: -4, max: 5, step: 1, value: 3, isInteger: true },
    ],
    theory: t`
      <p>Chování mocninné funkce \(y = ax^n\) určuje exponent \(n \in \mathbb{Z}\):</p>
      <ul>
        <li><strong>\(n > 0\) sudé</strong>: funkce je <strong>sudá</strong>, má globální extrém v počátku \([0;\ 0]\) a je omezená z jedné strany.</li>
        <li><strong>\(n > 0\) liché</strong>: funkce je <strong>lichá</strong>, prostá a neomezená; na celém \(\mathbb{R}\) má inverzní funkci \(f^{-1}(x) = \sqrt[n]{\frac{x}{a}}\).</li>
        <li><strong>\(n < 0\)</strong>: \(0 \notin D(f)\), souřadnicové osy \(x = 0\) a \(y = 0\) jsou <strong>asymptotami</strong>.</li>
      </ul>`,
    analyze({ a, n }) {
      a = clean(a);
      n = Math.round(n);
      const noZero = n <= 0;
      const even = n % 2 === 0;

      let equation;
      if (a === 0) equation = 'y = 0';
      else if (n === 0) equation = t`y = ${num(a)},\ x \neq 0`;
      else if (n === 1) equation = t`y = ${poly([[a, 'x']])}`;
      else {
        equation = t`y = ${poly([[a, t`x^{${n}}`]])}`;
        if (n < 0) equation += t` = \frac{${num(a)}}{${n === -1 ? 'x' : t`x^{${-n}}`}}`;
      }

      const fn = (x) => (noZero && Math.abs(x) < EPS ? NaN : a * x ** n);
      const points = [];
      const asymptotes = [];
      if (a !== 0 && n < 0) {
        asymptotes.push({ type: 'v', value: 0, label: 'x = 0' }, { type: 'h', value: 0, label: 'y = 0' });
      }
      if (a !== 0 && n !== 0) {
        const yMinus = a * (-1) ** n;
        points.push({ x: 1, y: a, kind: 'special', label: ptPlain(1, a) });
        points.push({ x: -1, y: yMinus, kind: 'special', label: ptPlain(-1, yMinus) });
      }
      if (n > 0) points.push({ x: 0, y: 0, kind: 'px', label: 'P[0; 0]' });
      if (n === 0) points.push({ x: 0, y: a, kind: 'hole', label: '' });

      const D = noZero ? t`${R} \setminus \{0\}` : R;
      let H;
      if (a === 0) H = t`\{0\}`;
      else if (n === 0) H = t`\{${num(a)}\}`;
      else if (n > 0) H = even ? (a > 0 ? I.zeroInfCl : I.negInfZeroCl) : R;
      else H = even ? (a > 0 ? I.zeroInf : I.negInfZero) : t`${R} \setminus \{0\}`;

      let mono = 'Konstantní';
      if (a !== 0 && n !== 0) {
        const inc = a > 0;
        if (n > 0 && !even) mono = inc ? t`Ostře rostoucí na \(${R}\)` : t`Ostře klesající na \(${R}\)`;
        else if (n > 0)
          mono = inc
            ? t`Ostře klesající na \(${I.negInfZeroCl}\),<br>ostře rostoucí na \(${I.zeroInfCl}\)`
            : t`Ostře rostoucí na \(${I.negInfZeroCl}\),<br>ostře klesající na \(${I.zeroInfCl}\)`;
        else if (!even)
          mono = inc
            ? t`Ostře klesající na \(${I.negInfZero}\) a na \(${I.zeroInf}\)`
            : t`Ostře rostoucí na \(${I.negInfZero}\) a na \(${I.zeroInf}\)`;
        else
          mono = inc
            ? t`Ostře rostoucí na \(${I.negInfZero}\),<br>ostře klesající na \(${I.zeroInf}\)`
            : t`Ostře klesající na \(${I.negInfZero}\),<br>ostře rostoucí na \(${I.zeroInf}\)`;
      }

      let extremes = 'Nemá lokální ani globální extrémy';
      if (a === 0 || n === 0) {
        extremes = 'Konstantní funkce – každé x je neostrým extrémem';
      } else if (n > 0 && even) {
        extremes =
          a > 0
            ? t`Globální (i lokální) minimum v bodě \(P = [0;\ 0]\), \(y_{\min} = 0\). Maximum nemá.`
            : t`Globální (i lokální) maximum v bodě \(P = [0;\ 0]\), \(y_{\max} = 0\). Minimum nemá.`;
      }

      let bounded = 'Neomezená shora ani zdola';
      if (a === 0 || n === 0) bounded = 'Omezená shora i zdola';
      else if (even) {
        bounded =
          a > 0
            ? t`Omezená zdola (\(\inf f = 0\)), shora neomezená`
            : t`Omezená shora (\(\sup f = 0\)), zdola neomezená`;
      }

      const parity =
        a === 0 || even
          ? t`Sudá funkce: \(f(-x) = f(x)\)`
          : t`Lichá funkce: \(f(-x) = -f(x)\)`;

      const intercepts =
        n > 0
          ? im(t`P_x = P_y = [0;\ 0]`)
          : 'Žádné průsečíky s osami';

      // Inverzní funkce
      let inverse;
      if (a === 0 || n === 0) {
        inverse = {
          available: false,
          explanationHtml: t`Konstantní funkce není prostá, proto k ní <strong>neexistuje inverzní funkce</strong>.`,
        };
      } else if (!even) {
        // Liché n -> prostá na celém D(f)
        const absN = Math.abs(n);
        const frac = a === 1 ? 'x' : t`\frac{x}{${num(a)}}`;
        const invFormula =
          n === 1
            ? t`f^{-1}(x) = ${frac}`
            : n === -1
            ? t`f^{-1}(x) = \frac{${num(a)}}{x}`
            : n > 0
            ? t`f^{-1}(x) = \sqrt[${absN}]{${frac}}`
            : t`f^{-1}(x) = \sqrt[${absN}]{\frac{${num(a)}}{x}}`;

        inverse = {
          available: true,
          isInjective: true,
          fn: (x) => {
            if (n < 0 && Math.abs(x) < EPS) return NaN;
            const u = n > 0 ? x / a : a / x;
            return Math.sign(u) * Math.abs(u) ** (1 / absN);
          },
          formulaTex: invFormula,
          dfTex: D,
          hfTex: H,
          dfInvTex: H,
          hfInvTex: D,
          explanationHtml: t`Pro lichý exponent \(n = ${n}\) je funkce <strong>prostá</strong> na celém definičním oboru \(D(f) = ${D}\). Inverzní funkcí je \[${invFormula}\] Platí \(D(f^{-1}) = H(f) = ${H}\) a \(H(f^{-1}) = D(f) = ${D}\).`,
        };
      } else {
        // Sudé n -> zúžení na x >= 0 (resp. x > 0)
        const absN = Math.abs(n);
        const restrD = n > 0 ? I.zeroInfCl : I.zeroInf;
        const frac = a === 1 ? 'x' : t`\frac{x}{${num(a)}}`;
        const invFormula =
          absN === 2
            ? n > 0
              ? t`f^{-1}(x) = \sqrt{${frac}}`
              : t`f^{-1}(x) = \sqrt{\frac{${num(a)}}{x}}`
            : n > 0
            ? t`f^{-1}(x) = \sqrt[${absN}]{${frac}}`
            : t`f^{-1}(x) = \sqrt[${absN}]{\frac{${num(a)}}{x}}`;

        inverse = {
          available: true,
          isInjective: false,
          restrictedDomainTex: restrD,
          fn: (x) => {
            if (n < 0 && Math.abs(x) < EPS) return NaN;
            const u = n > 0 ? x / a : a / x;
            if (u < 0 || (n < 0 && u <= 0)) return NaN;
            return u ** (1 / absN);
          },
          formulaTex: invFormula,
          dfTex: restrD,
          hfTex: H,
          dfInvTex: H,
          hfInvTex: restrD,
          explanationHtml: t`Pro sudý exponent \(n = ${n}\) je funkce sudá (není prostá na celém \(D(f)\)). Po zúžení na kladnou poloosu \(D_{\text{prostá}}(f) = ${restrD}\) získáme inverzní funkci \[${invFormula}\] Role oborů se vymění: \(D(f^{-1}) = H(f) = ${H}\) a \(H(f^{-1}) = ${restrD}\).`,
        };
      }

      return {
        equation,
        fn,
        color: '#10b981',
        points,
        asymptotes,
        inverse,
        props: [
          prop('Definiční obor a obor hodnot', `${im(t`D(f) = ${D}`)}<br>${im(t`H(f) = ${H}`)}`, n < 0 ? 'V počátku je funkce nedefinovaná.' : 'Polynomiální mocninná funkce.', 'blue'),
          prop('Monotonie (růst a pokles)', mono, n < 0 ? 'Intervaly nelze sjednotit!' : '', 'green'),
          prop('Extrémy (globální a lokální)', extremes, even && n > 0 ? 'Bod obratu v počátku [0; 0].' : 'Monotónní větve nemají extrém.', 'purple'),
          prop('Parita funkce', parity, even ? 'Souměrná podle osy y.' : 'Souměrná podle počátku [0; 0].', 'amber'),
          prop('Omezenost', bounded, a !== 0 && n < 0 ? t`Asymptoty: \(x = 0,\ y = 0\).` : '', 'red'),
          prop('Průsečíky a význačné body', intercepts, a !== 0 && n !== 0 ? t`Prochází body \([1;\ ${num(a)}]\) a \([-1;\ ${num(a * (-1) ** n)}]\).` : ''),
        ],
      };
    },
  };

  // ---------------------------------------------------------
  // 5. Exponenciální funkce  y = aˣ + c
  // ---------------------------------------------------------
  modes.exponential = {
    title: 'Exponenciální funkce',
    short: 'Exponenciální',
    navTex: t`a^x + c`,
    subtitle: 'Exponenciální růst či pokles s vodorovnou asymptotou y = c.',
    generalTex: t`y = a^x + c,\ a > 0,\ a \neq 1`,
    params: [
      { key: 'a', label: t`Základ \(a > 0,\ a \neq 1\)`, min: 0.2, max: 4, step: 0.1, value: 2, avoid: 1 },
      { key: 'c', label: t`Svislý posun \(c\)`, min: -6, max: 6, step: 0.5, value: -1 },
    ],
    theory: t`
      <p>Exponenciální funkce má proměnnou v exponentu: \(y = a^x + c\), kde \(a > 0\), \(a \neq 1\).</p>
      <ul>
        <li>Protože \(a^x > 0\) pro každé \(x \in \mathbb{R}\), je funkce <strong>zdola omezená</strong> hodnotou \(c\) a přímka \(y = c\) je její <strong>vodorovnou asymptotou</strong>.</li>
        <li>Funkce je na celém \(\mathbb{R}\) <strong>prostá</strong>; inverzní funkcí je logaritmická funkce \(f^{-1}(x) = \log_a(x - c)\).</li>
      </ul>`,
    analyze({ a, c }) {
      c = clean(c);
      const points = [{ x: 0, y: 1 + c, kind: 'py', label: `Py${ptPlain(0, 1 + c)}` }];
      let px = t`\(P_x\): žádný (\(c \geq 0\))`;
      if (-c > 0) {
        const x0 = Math.log(-c) / Math.log(a);
        points.push({ x: x0, y: 0, kind: 'px', label: `Px${ptPlain(x0, 0)}` });
        px = im(t`P_x = \left[\log_{${num(a)}} ${num(-c)};\ 0\right] \approx ${pt(x0, 0)}`);
      }
      const grows = a > 1;
      const H = t`\left(${num(c)};\ \infty\right)`;

      const argTex = c === 0 ? 'x' : t`\left(x ${c > 0 ? '-' : '+'} ${num(Math.abs(c))}\right)`;
      const invFormula = t`f^{-1}(x) = \log_{${num(a)}} ${argTex}`;

      return {
        equation: t`y = ${baseTex(a)}^{x}${tail(c)}`,
        fn: (x) => a ** x + c,
        color: '#10b981',
        points,
        asymptotes: [{ type: 'h', value: c, label: `y = ${plain(c)}` }],
        inverse: {
          available: true,
          isInjective: true,
          fn: (x) => (x <= c ? NaN : Math.log(x - c) / Math.log(a)),
          formulaTex: invFormula,
          dfTex: R,
          hfTex: H,
          dfInvTex: H,
          hfInvTex: R,
          explanationHtml: t`Exponenciální funkce je na celém \(\mathbb{R}\) <strong>prostá</strong>. Inverzní funkcí je logaritmická funkce \[${invFormula}\] Všimněte si dokonalé výměny oborů: \(D(f^{-1}) = H(f) = ${H}\) a \(H(f^{-1}) = D(f) = \mathbb{R}\). Vodorovná asymptota \(y = ${num(c)}\) se zrcadlením podle \(y = x\) mění na svislou asymptotu \(x = ${num(c)}\).`,
        },
        props: [
          prop('Definiční obor a obor hodnot', `${im(t`D(f) = ${R}`)}<br>${im(t`H(f) = ${H}`)}`, t`Vodorovná asymptota: \(y = ${num(c)}\).`, 'blue'),
          prop('Monotonie (růst a pokles)', grows ? t`Ostře rostoucí na \(\left(-\infty;\ \infty\right)\) (\(a > 1\))` : t`Ostře klesající na \(\left(-\infty;\ \infty\right)\) (\(0 < a < 1\))`, 'Funkce je prostá na celém ℝ.', 'green'),
          prop('Extrémy (globální a lokální)', 'Nemá lokální ani globální extrémy', t`Hodnotě \(y = ${num(c)}\) se pouze blíží, ale nikdy jí nedosáhne.`, 'purple'),
          prop('Parita funkce', 'Ani sudá, ani lichá', t`Platí \(a^{-x} = \frac{1}{a^x} \neq \pm a^x\).`, 'amber'),
          prop('Omezenost', t`Omezená zdola (\(\inf f = ${num(c)}\)), shora neomezená`, im(t`\lim_{x \to ${grows ? '-' : '+'}\infty} f(x) = ${num(c)}`), 'red'),
          prop('Průsečíky s osami', `${px}<br>${im(t`P_y = ${pt(0, 1 + c)}`)}`, 'Zelený bod na ose x, modrý na ose y.'),
        ],
      };
    },
  };

  // ---------------------------------------------------------
  // 6. Logaritmická funkce  y = logₐ(x) + c
  // ---------------------------------------------------------
  modes.logarithmic = {
    title: 'Logaritmická funkce',
    short: 'Logaritmická',
    navTex: t`\log_a x + c`,
    subtitle: 'Inverzní funkce k exponenciální funkci, svislá asymptota x = 0.',
    generalTex: t`y = \log_a x + c,\ a > 0,\ a \neq 1`,
    params: [
      { key: 'a', label: t`Základ \(a > 0,\ a \neq 1\)`, min: 0.2, max: 4, step: 0.1, value: 2, avoid: 1 },
      { key: 'c', label: t`Svislý posun \(c\)`, min: -6, max: 6, step: 0.5, value: 0 },
    ],
    theory: t`
      <p>Logaritmická funkce je <strong>inverzní k exponenciální</strong>: \(y = \log_a x + c \iff x = a^{y - c}\).</p>
      <ul>
        <li>Argument logaritmu musí být kladný, proto \(D(f) = (0;\ \infty)\) a osa \(y\) (\(x = 0\)) je <strong>svislou asymptotou</strong>.</li>
        <li>Funkce není omezená shora ani zdola (\(H(f) = \mathbb{R}\)) a nemá žádné extrémy.</li>
      </ul>`,
    analyze({ a, c }) {
      c = clean(c);
      const x0 = a ** -c;
      const points = [
        { x: 1, y: c, kind: 'special', label: ptPlain(1, c) },
        { x: x0, y: 0, kind: 'px', label: `Px${ptPlain(x0, 0)}` },
      ];
      const pxTex = c === 0 ? t`P_x = ${pt(1, 0)}` : t`P_x = \left[${baseTex(a)}^{${num(-c)}};\ 0\right] \approx ${pt(x0, 0)}`;
      const expTerm = c === 0 ? 'x' : t`x ${c > 0 ? '-' : '+'} ${num(Math.abs(c))}`;
      const invFormula = t`f^{-1}(x) = ${baseTex(a)}^{${expTerm}}`;

      return {
        equation: t`y = \log_{${num(a)}} x${tail(c)}`,
        fn: (x) => (x <= 0 ? NaN : Math.log(x) / Math.log(a) + c),
        color: '#06b6d4',
        points,
        asymptotes: [{ type: 'v', value: 0, label: 'x = 0' }],
        inverse: {
          available: true,
          isInjective: true,
          fn: (x) => a ** (x - c),
          formulaTex: invFormula,
          dfTex: I.zeroInf,
          hfTex: R,
          dfInvTex: R,
          hfInvTex: I.zeroInf,
          explanationHtml: t`Logaritmická funkce je <strong>prostá</strong> na celém \(D(f) = (0;\ \infty)\). Její inverzní funkcí je exponenciální funkce \[${invFormula}\] Definiční obor a obor hodnot si vyměnily role: \(D(f^{-1}) = H(f) = \mathbb{R}\) a \(H(f^{-1}) = D(f) = (0;\ \infty)\).`,
        },
        props: [
          prop('Definiční obor a obor hodnot', `${im(t`D(f) = \left(0;\ \infty\right)`)}<br>${im(t`H(f) = ${R}`)}`, t`Svislá asymptota: \(x = 0\).`, 'blue'),
          prop('Monotonie (růst a pokles)', a > 1 ? t`Ostře rostoucí na \(\left(0;\ \infty\right)\) (\(a > 1\))` : t`Ostře klesající na \(\left(0;\ \infty\right)\) (\(0 < a < 1\))`, 'Funkce je prostá na (0; ∞).', 'green'),
          prop('Extrémy (globální a lokální)', 'Nemá lokální ani globální extrémy', 'Nabývá libovolně velkých i malých hodnot.', 'purple'),
          prop('Parita funkce', 'Ani sudá, ani lichá', t`Definiční obor \((0;\ \infty)\) není souměrný podle nuly.`, 'amber'),
          prop('Omezenost', 'Neomezená shora ani zdola', t`Pro \(x \to 0^+\) i \(x \to \infty\) míří k \(\pm\infty\).`, 'red'),
          prop('Průsečíky a význačný bod', im(pxTex) + t`<br>\(P_y\): žádný`, t`Význačný bod \([1;\ ${num(c)}]\).`),
        ],
      };
    },
  };

  // ---------------------------------------------------------
  // 7. Funkce s absolutní hodnotou  y = |ax + b| + c
  // ---------------------------------------------------------
  modes.abs = {
    title: 'Funkce s absolutní hodnotou',
    short: 'Abs. hodnota',
    navTex: t`|ax + b| + c`,
    subtitle: 'Graf tvaru „V“ se zlomem v nulovém bodě výrazu v absolutní hodnotě.',
    generalTex: t`y = |ax + b| + c`,
    params: [
      { key: 'a', label: t`Sklon ramen \(a\)`, min: -5, max: 5, step: 0.5, value: 1 },
      { key: 'b', label: t`Vnitřní člen \(b\)`, min: -6, max: 6, step: 0.5, value: -2 },
      { key: 'c', label: t`Svislý posun \(c\)`, min: -6, max: 6, step: 0.5, value: -1 },
    ],
    theory: t`
      <p>Absolutní hodnota \(|u|\) je vždy nezáporná (\(|u| \geq 0\)).</p>
      <ul>
        <li><strong>Bod zlomu (vrchol)</strong>: Z rovnice \(ax + b = 0\) plyne \(x_V = -\frac{b}{a}\) a \(y_V = c\). V bodě \(V = [x_V;\ c]\) má funkce <strong>globální minimum</strong>.</li>
        <li>Funkce je <strong>zdola omezená</strong> hodnotou \(c\), shora neomezená.</li>
      </ul>`,
    analyze({ a, b, c }) {
      a = clean(a);
      b = clean(b);
      c = clean(c);

      if (a === 0) {
        return modes.linear.analyze({ a: 0, b: Math.abs(b) + c });
      }

      const y0 = Math.abs(b) + c;
      const points = [{ x: 0, y: y0, kind: 'py', label: `Py${ptPlain(0, y0)}` }];
      const equation = t`y = \left|${poly([[a, 'x'], [b, '']])}\right|${tail(c)}`;
      const fn = (x) => Math.abs(a * x + b) + c;

      const xv = clean(-b / a);
      points.push({ x: xv, y: c, kind: 'special', label: `V${ptPlain(xv, c)}` });

      let px;
      if (c > 0) px = t`\(P_x\): žádný (\(c > 0\))`;
      else if (c === 0) {
        points.push({ x: xv, y: 0, kind: 'px', label: '' });
        px = im(t`P_x = ${pt(xv, 0)}`) + ' (dotyk vrcholem)';
      } else {
        const [x1, x2] = [(-b + c) / a, (-b - c) / a].sort((p, q) => p - q);
        points.push({ x: x1, y: 0, kind: 'px', label: 'x₁' }, { x: x2, y: 0, kind: 'px', label: 'x₂' });
        px = im(t`P_{x_1} = ${pt(x1, 0)},\ P_{x_2} = ${pt(x2, 0)}`);
      }

      const xvT = num(xv);
      const leftInt = t`\left(-\infty;\ ${xvT}\right\rangle`;
      const rightInt = t`\left\langle ${xvT};\ \infty\right)`;
      const H = t`\left\langle ${num(c)};\ \infty\right)`;

      const absA = Math.abs(a);
      const numPart = c === 0 ? 'x' : t`x ${c > 0 ? '-' : '+'} ${num(Math.abs(c))}`;
      const fracPart = absA === 1 ? numPart : t`\frac{${numPart}}{${num(absA)}}`;
      const invFormula = xv === 0 ? t`f^{-1}(x) = ${fracPart}` : t`f^{-1}(x) = ${xvT} + ${fracPart}`;

      const inverse = {
        available: true,
        isInjective: false,
        restrictedDomainTex: rightInt,
        fn: (x) => (x < c ? NaN : xv + (x - c) / absA),
        formulaTex: invFormula,
        dfTex: rightInt,
        hfTex: H,
        dfInvTex: H,
        hfInvTex: rightInt,
        explanationHtml: t`Funkce tvaru „V“ není prostá na celém \(\mathbb{R}\). Po zúžení na pravé rameno \(D_{\text{prostá}}(f) = ${rightInt}\), kde ostře roste, má inverzní polopřímku \[${invFormula}\] Platí \(D(f^{-1}) = H(f) = ${H}\) a \(H(f^{-1}) = ${rightInt}\).`,
      };

      return {
        equation,
        fn,
        color: '#f59e0b',
        points,
        guides: [{ type: 'v', value: xv }],
        inverse,
        props: [
          prop('Definiční obor a obor hodnot', `${im(t`D(f) = ${R}`)}<br>${im(t`H(f) = ${H}`)}`, 'Všechny hodnoty leží nad úrovní vrcholu.', 'blue'),
          prop('Monotonie (růst a pokles)', t`Ostře klesající na \(${leftInt}\),<br>ostře rostoucí na \(${rightInt}\)`, t`Bod zlomu v \(x_V = ${xvT}\).`, 'green'),
          prop('Extrémy (globální a lokální)', t`Globální (i lokální) minimum v bodě \(V = ${pt(xv, c)}\) (\(y_{\min} = ${num(c)}\)). Maximum nemá.`, 'Ve vrcholu má graf ostrý hrot.', 'purple'),
          prop('Parita funkce', b === 0 ? t`Sudá funkce (\(b = 0 \implies |-ax| = |ax|\))` : t`Ani sudá, ani lichá (osa souměrnosti \(x = ${xvT} \neq 0\))`, 'Neperiodická.', 'amber'),
          prop('Omezenost', t`Omezená zdola (\(\inf f = ${num(c)}\)), shora neomezená`, t`Pro \(x \to \pm\infty\) platí \(f(x) \to \infty\).`, 'red'),
          prop('Průsečíky s osami', `${px}<br>${im(t`P_y = ${pt(0, y0)}`)}`, 'Zelené body na ose x, modrý na ose y.'),
        ],
      };
    },
  };

  // ---------------------------------------------------------
  // 8. Lineární lomená funkce  y = k / (x − m) + n
  // ---------------------------------------------------------
  modes.rational = {
    title: 'Lineární lomená funkce',
    short: 'Lineární lomená',
    navTex: t`\frac{k}{x - m} + n`,
    subtitle: 'Grafem je rovnoosá hyperbola se středem S[m; n] a dvěma asymptotami.',
    generalTex: t`y = \frac{k}{x - m} + n,\ k \neq 0`,
    params: [
      { key: 'k', label: t`Koeficient \(k\)`, min: -6, max: 6, step: 0.5, value: 2 },
      { key: 'm', label: t`Vodorovný posun \(m\) (svislá asymptota)`, min: -6, max: 6, step: 0.5, value: 1 },
      { key: 'n', label: t`Svislý posun \(n\) (vodorovná asymptota)`, min: -6, max: 6, step: 0.5, value: 1 },
    ],
    theory: t`
      <p>Lineární lomená funkce v asymptotickém tvaru \(y = \frac{k}{x - m} + n\) (\(k \neq 0\)) má grafem <strong>rovnoosou hyperbolu</strong>.</p>
      <ul>
        <li><strong>Asymptoty</strong>: svislá \(x = m\) a vodorovná \(y = n\); jejich průsečík \(S = [m;\ n]\) je středem souměrnosti.</li>
        <li>Funkce je <strong>prostá</strong> na celém \(D(f) = \mathbb{R} \setminus \{m\}\) a její inverzní funkcí je opět lineární lomená funkce \(f^{-1}(x) = \frac{k}{x - n} + m\).</li>
      </ul>`,
    analyze({ k, m, n }) {
      k = clean(k);
      m = clean(m);
      n = clean(n);
      const points = [];
      const asymptotes = [];

      if (k === 0) {
        points.push({ x: m, y: n, kind: 'hole', label: '' });
        return {
          equation: t`y = ${num(n)},\ x \neq ${num(m)}`,
          fn: (x) => (Math.abs(x - m) < EPS ? NaN : n),
          color: '#a855f7',
          points,
          inverse: {
            available: false,
            explanationHtml: t`Pro \(k = 0\) je funkce konstantní na \(\mathbb{R} \setminus \{${num(m)}\}\), není prostá a nemá inverzní funkci.`,
          },
          props: [
            prop('Definiční obor a obor hodnot', `${im(t`D(f) = ${R} \setminus \{${num(m)}\}`)}<br>${im(t`H(f) = \{${num(n)}\}`)}`, '', 'blue'),
            prop('Monotonie', 'Konstantní na obou intervalech', '', 'green'),
            prop('Extrémy', 'Neostré extrémy v každém bodě', '', 'purple'),
            prop('Parita', 'Obecná', '', 'amber'),
            prop('Omezenost', 'Omezená shora i zdola', '', 'red'),
            prop('Asymptoty', t`Nejde o hyperbolu (\(k = 0\))`, ''),
          ],
        };
      }

      asymptotes.push(
        { type: 'v', value: m, label: `x = ${plain(m)}` },
        { type: 'h', value: n, label: `y = ${plain(n)}` }
      );
      points.push({ x: m, y: n, kind: 'special', label: `S${ptPlain(m, n)}` });

      let py = t`\(P_y\): žádný (\(0 \notin D(f)\))`;
      if (m !== 0) {
        const y0 = -k / m + n;
        points.push({ x: 0, y: y0, kind: 'py', label: `Py${ptPlain(0, y0)}` });
        py = im(t`P_y = ${pt(0, y0)}`);
      }
      let px = t`\(P_x\): žádný (\(n = 0\))`;
      if (n !== 0) {
        const x0 = m - k / n;
        points.push({ x: x0, y: 0, kind: 'px', label: `Px${ptPlain(x0, 0)}` });
        px = im(t`P_x = ${pt(x0, 0)}`);
      }

      const denom = poly([[1, 'x'], [-m, '']]);
      const invDenom = poly([[1, 'x'], [-n, '']]);
      const equation = t`y = \frac{${num(k)}}{${denom}}${tail(n)}`;
      const invFormula = t`f^{-1}(x) = \frac{${num(k)}}{${invDenom}}${tail(m)}`;

      const L = t`\left(-\infty;\ ${num(m)}\right)`;
      const Rr = t`\left(${num(m)};\ \infty\right)`;
      const dfTex = t`${R} \setminus \{${num(m)}\}`;
      const hfTex = t`${R} \setminus \{${num(n)}\}`;

      return {
        equation,
        fn: (x) => (Math.abs(x - m) < EPS ? NaN : k / (x - m) + n),
        color: '#a855f7',
        points,
        asymptotes,
        inverse: {
          available: true,
          isInjective: true,
          fn: (x) => (Math.abs(x - n) < EPS ? NaN : k / (x - n) + m),
          formulaTex: invFormula,
          dfTex,
          hfTex,
          dfInvTex: hfTex,
          hfInvTex: dfTex,
          explanationHtml: t`Lineární lomená funkce je pro \(k \neq 0\) <strong>prostá</strong> na celém \(D(f)\). Zrcadlením podle osy \(y = x\) si vymění role asymptoty \(x = m\) a \(y = n\): \[${invFormula}\] Platí \(D(f^{-1}) = H(f) = ${hfTex}\) a \(H(f^{-1}) = D(f) = ${dfTex}\).`,
        },
        props: [
          prop('Definiční obor a obor hodnot', `${im(t`D(f) = ${dfTex}`)}<br>${im(t`H(f) = ${hfTex}`)}`, t`Asymptoty: \(x = ${num(m)},\ y = ${num(n)}\).`, 'blue'),
          prop(
            'Monotonie (růst a pokles)',
            k > 0
              ? t`Ostře klesající na \(${L}\)<br>a ostře klesající na \(${Rr}\)`
              : t`Ostře rostoucí na \(${L}\)<br>a ostře rostoucí na \(${Rr}\)`,
            'Pozor: na sjednocení intervalů monotónní není!',
            'green'
          ),
          prop('Extrémy (globální a lokální)', 'Nemá lokální ani globální extrémy', 'Větve hyperboly míří u asymptot do ±∞.', 'purple'),
          prop(
            'Parita a souměrnost',
            m === 0 && n === 0 ? t`Lichá funkce (\(y = \frac{k}{x}\))` : 'Ani sudá, ani lichá',
            t`Střed souměrnosti \(S = ${pt(m, n)}\).`,
            'amber'
          ),
          prop('Omezenost', 'Neomezená shora ani zdola', t`\(\lim_{x\to m^\pm} f(x) = \pm\infty\)`, 'red'),
          prop('Průsečíky s osami', `${px}<br>${py}`, 'Zelený bod na ose x, modrý na ose y.'),
        ],
      };
    },
  };

  // ---------------------------------------------------------
  // 9. Goniometrické funkce  y = a·f(b(x − c)) + d
  // ---------------------------------------------------------
  const TRIG_FN = {
    sin: { tex: t`\sin`, invTex: t`\arcsin`, f: Math.sin, invF: Math.asin, name: 'sinus' },
    cos: { tex: t`\cos`, invTex: t`\arccos`, f: Math.cos, invF: Math.acos, name: 'kosinus' },
    tan: { tex: t`\operatorname{tg}`, invTex: t`\operatorname{arctg}`, f: Math.tan, invF: Math.atan, name: 'tangens' },
  };

  modes.trig = {
    title: 'Goniometrické funkce',
    short: 'Goniometrické',
    navTex: t`a\,f(b(x - c)) + d`,
    subtitle: 'Periodické funkce: sinusoida, kosinusoida a tangentoida.',
    generalTex: t`y = a \cdot f\big(b(x - c)\big) + d`,
    params: [
      {
        key: 'fn',
        type: 'choice',
        label: 'Funkce',
        value: 'sin',
        options: [
          { value: 'sin', tex: t`\sin x`, label: 'sinus' },
          { value: 'cos', tex: t`\cos x`, label: 'kosinus' },
          { value: 'tan', tex: t`\operatorname{tg} x`, label: 'tangens' },
        ],
      },
      { key: 'a', label: t`Amplituda \(a\)`, min: -4, max: 4, step: 0.5, value: 2 },
      { key: 'b', label: t`Frekvence \(b\) (mění periodu)`, min: 0.5, max: 3, step: 0.5, value: 1 },
      {
        key: 'c12',
        label: t`Fázový posun \(c\) (v násobcích \(\frac{\pi}{12}\))`,
        min: -12,
        max: 12,
        step: 1,
        value: 0,
        isInteger: true,
        display: (v) => piRational(v, 12),
      },
      { key: 'd', label: t`Svislý posun \(d\)`, min: -4, max: 4, step: 0.5, value: 0 },
    ],
    theory: t`
      <p>Vliv parametrů u zobecněné goniometrické funkce \(y = a \cdot f\big(b(x - c)\big) + d\):</p>
      <ul>
        <li><strong>\(|a|\) – amplituda</strong>: pro \(\sin\) a \(\cos\) je funkce <strong>omezená</strong> s oborem hodnot \(H(f) = \langle d - |a|;\ d + |a|\rangle\).</li>
        <li><strong>\(b\) – frekvence</strong>: perioda je \(T = \frac{2\pi}{b}\) pro \(\sin, \cos\) a \(T = \frac{\pi}{b}\) pro \(\operatorname{tg}\).</li>
        <li><strong>Inverzní cyklometrické funkce</strong> (\(\arcsin, \arccos, \operatorname{arctg}\)) vznikají zúžením goniometrické funkce na jeden hlavní interval monotonie.</li>
      </ul>`,
    analyze({ fn, a, b, c12, d }) {
      a = clean(a);
      b = Math.max(0.1, clean(b));
      c12 = Math.round(c12);
      d = clean(d);

      const T = TRIG_FN[fn];
      const isTan = fn === 'tan';
      const bn = Math.round(b * 2);
      const isHalfIntB = Math.abs(b * 2 - bn) < 1e-3;
      const c = (c12 * Math.PI) / 12;

      const evalF = (x) => a * T.f(b * (x - c)) + d;
      const fnSafe = isTan ? (x) => (Math.abs(Math.cos(b * (x - c))) < EPS ? NaN : evalF(x)) : evalF;

      const inner = c12 === 0 ? 'x' : t`x ${c12 > 0 ? '-' : '+'} ${piRational(Math.abs(c12), 12)}`;
      const arg = b === 1 ? inner : c12 === 0 ? t`${num(b)}x` : t`${num(b)}\left(${inner}\right)`;
      const call = arg === 'x' ? t`${T.tex} x` : t`${T.tex}\left(${arg}\right)`;
      const aStr = a === 1 ? '' : a === -1 ? '-' : num(a);
      const equation = a === 0 ? t`y = ${num(d)}` : t`y = ${aStr}${call}${tail(d)}`;

      const periodVal = isTan ? Math.PI / b : (2 * Math.PI) / b;
      const periodTex = isHalfIntB ? (isTan ? piRational(2, bn) : piRational(4, bn)) : t`${num(periodVal)}`;
      const halfStep = isHalfIntB ? piRational(2, bn) : t`${num(Math.PI / b)}`;
      const asymBase = isHalfIntB ? piRational(c12 * bn + 12, 12 * bn) : t`${num(c + Math.PI / (2 * b))}`;

      const asymptotes = [];
      if (isTan && a !== 0) {
        for (let k = -40; k <= 40; k++) {
          const x = c + Math.PI / (2 * b) + (k * Math.PI) / b;
          if (Math.abs(x) <= 10.5) asymptotes.push({ type: 'v', value: x, label: '' });
        }
        if (asymptotes.length) {
          const nearest = asymptotes.reduce((p, q) => (Math.abs(q.value) < Math.abs(p.value) ? q : p));
          nearest.label = `x = ${plain(nearest.value, 2)}`;
        }
      }

      const points = [];
      const y0 = fnSafe(0);
      let py = t`\(P_y\): žádný (\(0 \notin D(f)\))`;
      if (Number.isFinite(y0)) {
        points.push({ x: 0, y: y0, kind: 'py', label: `Py${ptPlain(0, y0)}` });
        py = im(t`P_y = ${pt(0, y0)}`);
      }

      if (a !== 0) {
        const r = -d / a;
        const P = isTan ? Math.PI : 2 * Math.PI;
        let u0s = [];
        if (isTan) u0s = [Math.atan(r)];
        else if (Math.abs(r) <= 1 + 1e-12) {
          const rr = Math.max(-1, Math.min(1, r));
          u0s = fn === 'sin' ? [Math.asin(rr), Math.PI - Math.asin(rr)] : [Math.acos(rr), -Math.acos(rr)];
        }
        const zeros = [];
        u0s.forEach((u0) => {
          for (let k = -40; k <= 40; k++) {
            const x = c + (u0 + k * P) / b;
            if (Math.abs(x) <= 10.5 && !zeros.some((z) => Math.abs(z - x) < 1e-5)) zeros.push(x);
          }
        });
        zeros.forEach((x) => points.push({ x, y: 0, kind: 'px', label: '' }));
      }

      const absA = Math.abs(a);
      const yMin = d - absA;
      const yMax = d + absA;
      const D = isTan ? t`${R} \setminus \left\{ ${asymBase} + k\cdot ${halfStep};\ k \in \mathbb{Z} \right\}` : R;
      const H = a === 0 ? t`\{${num(d)}\}` : isTan ? R : t`\left\langle ${num(yMin)};\ ${num(yMax)}\right\rangle`;

      // Hlavní interval monotonie a extrémy
      let mono;
      let extremes;
      let bounded;

      if (a === 0) {
        mono = 'Konstantní na celém ℝ';
        extremes = t`Konstantní hodnota \(y = ${num(d)}\)`;
        bounded = 'Omezená shora i zdola';
      } else if (isTan) {
        const tLeft = num(c - Math.PI / (2 * b));
        const tRight = num(c + Math.PI / (2 * b));
        mono =
          a > 0
            ? t`Ostře rostoucí na každém intervalu \(\left(${tLeft} + kT;\ ${tRight} + kT\right)\)`
            : t`Ostře klesající na každém intervalu \(\left(${tLeft} + kT;\ ${tRight} + kT\right)\)`;
        extremes = 'Nemá lokální ani globální extrémy';
        bounded = 'Neomezená shora ani zdola';
      } else {
        const phaseMax = fn === 'sin' ? (a > 0 ? Math.PI / 2 : -Math.PI / 2) : a > 0 ? 0 : Math.PI;
        const phaseMin = fn === 'sin' ? (a > 0 ? -Math.PI / 2 : Math.PI / 2) : a > 0 ? Math.PI : 0;
        const xMax = c + phaseMax / b;
        const xMin = c + phaseMin / b;
        points.push(
          { x: xMax, y: yMax, kind: 'special', label: `Max${ptPlain(xMax, yMax)}` },
          { x: xMin, y: yMin, kind: 'special', label: `Min${ptPlain(xMin, yMin)}` }
        );
        const i1 = Math.min(xMin, xMax);
        const i2 = Math.max(xMin, xMax);
        mono =
          xMin < xMax
            ? t`Ostře rostoucí na \(\left\langle ${num(i1)} + kT;\ ${num(i2)} + kT\right\rangle\),<br>ostře klesající na \(\left\langle ${num(i2)} + kT;\ ${num(i1 + periodVal)} + kT\right\rangle\)`
            : t`Ostře klesající na \(\left\langle ${num(i1)} + kT;\ ${num(i2)} + kT\right\rangle\),<br>ostře rostoucí na \(\left\langle ${num(i2)} + kT;\ ${num(i1 + periodVal)} + kT\right\rangle\)`;
        extremes = t`Globální maxima \(y_{\max} = ${num(yMax)}\) v \(x \approx ${num(xMax)} + kT\),<br>globální minima \(y_{\min} = ${num(yMin)}\) v \(x \approx ${num(xMin)} + kT\)`;
        bounded = t`Omezená shora i zdola: \(${num(yMin)} \leq f(x) \leq ${num(yMax)}\)`;
      }

      let parity = 'Ani sudá, ani lichá (obecný posun)';
      if (a === 0) parity = 'Sudá funkce';
      else if (d === 0 && c12 === 0) {
        parity = fn === 'cos' ? t`Sudá funkce: \(\cos(-x) = \cos x\)` : t`Lichá funkce: \(f(-x) = -f(x)\)`;
      }

      // Inverzní cyklometrická funkce na hlavním intervalu
      let inverse;
      if (a === 0) {
        inverse = {
          available: false,
          explanationHtml: 'Konstantní funkce není prostá a nemá inverzní funkci.',
        };
      } else {
        const uLeft = fn === 'cos' ? c : c - Math.PI / (2 * b);
        const uRight = fn === 'cos' ? c + Math.PI / b : c + Math.PI / (2 * b);
        const brL = isTan ? '(' : t`\left\langle `;
        const brR = isTan ? ')' : t`\right\rangle`;
        const restrD = t`${brL}${num(uLeft)};\ ${num(uRight)}${brR}`;

        const numArg = d === 0 ? 'x' : t`x ${d > 0 ? '-' : '+'} ${num(Math.abs(d))}`;
        const fracArg = a === 1 ? numArg : t`\frac{${numArg}}{${num(a)}}`;
        const scaleB = b === 1 ? '' : t`\frac{1}{${num(b)}}`;
        const cShift = c12 === 0 ? '' : t`${piRational(c12, 12)} + `;
        const invFormula = t`f^{-1}(x) = ${cShift}${scaleB}${T.invTex}\left(${fracArg}\right)`;

        inverse = {
          available: true,
          isInjective: false,
          restrictedDomainTex: restrD,
          fn: (x) => {
            const u = (x - d) / a;
            if (!isTan && Math.abs(u) > 1) return NaN;
            return c + T.invF(u) / b;
          },
          formulaTex: invFormula,
          dfTex: restrD,
          hfTex: H,
          dfInvTex: H,
          hfInvTex: restrD,
          explanationHtml: t`Periodická funkce není na \(\mathbb{R}\) prostá. Zúžíme-li ji na hlavní interval monotonie \(D_{\text{prostá}}(f) = ${restrD}\), získáme <strong>cyklometrickou funkci</strong> \[${invFormula}\] Platí \(D(f^{-1}) = H(f) = ${H}\) a \(H(f^{-1}) = ${restrD}\).`,
        };
      }

      return {
        title: `Goniometrická funkce – ${T.name}`,
        generalTex: t`y = a \cdot ${T.tex}\big(b(x - c)\big) + d`,
        equation,
        fn: fnSafe,
        color: '#10b981',
        piAxis: true,
        points,
        asymptotes,
        guides: a !== 0 && !isTan ? [{ type: 'h', value: d }] : [],
        inverse,
        props: [
          prop('Definiční obor a obor hodnot', `${im(t`D(f) = ${D}`)}<br>${im(t`H(f) = ${H}`)}`, im(t`Perioda T = ${periodTex} \approx ${num(periodVal)}`), 'blue'),
          prop('Monotonie (růst a pokles)', mono, t`Opakuje se s periodou \(T \approx ${num(periodVal)}\).`, 'green'),
          prop('Extrémy (globální a lokální)', extremes, isTan ? 'Větvemi prochází do ±∞.' : 'Vyznačeny oranžovými body na základní vlně.', 'purple'),
          prop('Parita a periodicita', parity, im(t`T = ${periodTex}`), 'amber'),
          prop('Omezenost', bounded, isTan ? 'Svislé asymptoty v bodech neexistence.' : im(t`Amplituda |a| = ${num(absA)}`), 'red'),
          prop('Průsečík s osou y', py, 'Zelené body na plátně vyznačují kořeny na ose x.'),
        ],
      };
    },
  };

  const order = ['circle', 'linear', 'quadratic', 'power', 'exponential', 'logarithmic', 'abs', 'rational', 'trig'];

  return { modes, order, num, plain, round, clean, piRational };
})();
