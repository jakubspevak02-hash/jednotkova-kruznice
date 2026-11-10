/**
 * ui.js — Uživatelské rozhraní, obousměrná vazba (Slider + Number Input),
 * plynulá animace parametrů (requestAnimationFrame), modul inverzních funkcí
 * a sazba matematiky přes KaTeX.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------
  // Pomocné funkce pro sazbu matematiky přes KaTeX
  // ---------------------------------------------------------
  function renderTexToString(tex, displayMode = false) {
    if (window.katex) {
      try {
        return window.katex.renderToString(tex, {
          displayMode,
          throwOnError: false,
          strict: false,
        });
      } catch (_) {
        return tex;
      }
    }
    return tex;
  }

  function setTex(el, tex, displayMode = false) {
    if (!el) return;
    el.innerHTML = renderTexToString(tex, displayMode);
  }

  function renderMixedHtml(el, html) {
    if (!el) return;
    if (!html) {
      el.innerHTML = '';
      return;
    }
    const formatted = html
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, tex) => renderTexToString(tex, true))
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, tex) => renderTexToString(tex, false));
    el.innerHTML = formatted;
  }

  // ---------------------------------------------------------
  // Stav aplikace
  // ---------------------------------------------------------
  let currentSection = 'functions';
  let currentMode = 'circle';
  let showInverse = false;

  // Stav animace (requestAnimationFrame)
  const anim = {
    active: false,
    paramKey: null,
    direction: 1,
    rafId: null,
    lastTime: 0,
    intAccumulator: 0,
  };

  // Inicializace výchozích parametrů pro všechny režimy z MathCore
  const defaultState = {};
  MathCore.order.forEach((modeKey) => {
    defaultState[modeKey] = {};
    MathCore.modes[modeKey].params.forEach((p) => {
      defaultState[modeKey][p.key] = p.value;
    });
  });

  const state = JSON.parse(JSON.stringify(defaultState));

  // Pomocná validace a oříznutí číselného vstupu
  function sanitizeParamValue(paramDef, rawVal, fallbackVal) {
    let val = Number(rawVal);
    if (!Number.isFinite(val)) return fallbackVal;
    val = Math.max(paramDef.min, Math.min(paramDef.max, val));
    if (paramDef.isInteger) {
      val = Math.round(val);
    } else {
      val = MathCore.round(val, 2);
    }
    if (paramDef.avoid !== undefined && Math.abs(val - paramDef.avoid) < 0.05) {
      val = val >= paramDef.avoid ? paramDef.avoid + 0.1 : paramDef.avoid - 0.1;
      val = MathCore.round(Math.max(paramDef.min, Math.min(paramDef.max, val)), 2);
    }
    return val;
  }

  // Vrátí primární číselný parametr pro animaci v aktuálním režimu (např. a, k, angle)
  function getDefaultAnimParamKey(modeKey) {
    const numParam = MathCore.modes[modeKey].params.find((p) => p.type !== 'choice');
    return numParam ? numParam.key : null;
  }

  // ---------------------------------------------------------
  // Inicializace po načtení DOM
  // ---------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('mainCanvas');
    const plotter = Plotter.create(canvas);

    const spaNavButtons = document.querySelectorAll('[data-spa-target]');
    const spaSections = document.querySelectorAll('[data-spa-section]');
    const modeTabsContainer = document.getElementById('modeTabs');
    const controlsContainer = document.getElementById('controlsContainer');
    const playPauseMasterBtn = document.getElementById('playPauseBtn');
    const inverseToggle = document.getElementById('inverseToggle');
    const resetBtn = document.getElementById('resetBtn');

    const eduTitle = document.getElementById('eduTitle');
    const eduSubtitle = document.getElementById('eduSubtitle');
    const eduGeneralFormula = document.getElementById('eduGeneralFormula');
    const liveEqValue = document.getElementById('liveEqValue');
    const inverseCard = document.getElementById('inverseCard');
    const inverseCardContent = document.getElementById('inverseCardContent');
    const propsGrid = document.getElementById('propsGrid');
    const theoryContent = document.getElementById('theoryContent');

    // Vyčkáme na načtení KaTeXu, pokud ještě nebyl připraven
    window.addEventListener('load', () => {
      buildModeTabs();
      buildControls(currentMode);
      updateView();
    });

    // -------------------------------------------------------
    // 1. SPA Navigace (Funkce / Geometrie / Příprava na maturitu)
    // -------------------------------------------------------
    function switchSpaSection(targetKey) {
      currentSection = targetKey;
      if (targetKey !== 'functions') {
        stopAnimation();
      }

      spaNavButtons.forEach((btn) => {
        const isActive = btn.dataset.spaTarget === targetKey;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      spaSections.forEach((sec) => {
        const isVisible = sec.dataset.spaSection === targetKey;
        sec.classList.toggle('hidden', !isVisible);
      });

      if (targetKey === 'functions') {
        updateView();
      }
    }

    spaNavButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        switchSpaSection(btn.dataset.spaTarget);
      });
    });

    // -------------------------------------------------------
    // 2. Generování karet kategorií funkcí
    // -------------------------------------------------------
    function buildModeTabs() {
      modeTabsContainer.innerHTML = '';
      MathCore.order.forEach((modeKey) => {
        const meta = MathCore.modes[modeKey];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `nav-btn${modeKey === currentMode ? ' active' : ''}`;
        btn.dataset.mode = modeKey;

        const titleSpan = document.createElement('span');
        titleSpan.textContent = meta.short || meta.title;

        const formulaSmall = document.createElement('small');
        setTex(formulaSmall, meta.navTex, false);

        btn.append(titleSpan, formulaSmall);
        btn.addEventListener('click', () => selectMode(modeKey));
        modeTabsContainer.appendChild(btn);
      });
    }

    // -------------------------------------------------------
    // 3. Obousměrné ovládací prvky (Posuvník + Number Input + Play)
    // -------------------------------------------------------
    function syncControlRowUI(modeKey, paramDef, val) {
      const sliderEl = document.getElementById(`slider-${modeKey}-${paramDef.key}`);
      const numEl = document.getElementById(`num-${modeKey}-${paramDef.key}`);
      const badgeEl = document.getElementById(`badge-${modeKey}-${paramDef.key}`);

      if (sliderEl && document.activeElement !== sliderEl) {
        sliderEl.value = val;
      } else if (sliderEl && anim.active && anim.paramKey === paramDef.key) {
        sliderEl.value = val;
      }

      if (numEl && document.activeElement !== numEl) {
        numEl.value = paramDef.isInteger ? Math.round(val) : MathCore.round(val, 2);
      }

      if (badgeEl && typeof paramDef.display === 'function') {
        setTex(badgeEl, paramDef.display(val), false);
      }
    }

    function buildControls(modeKey) {
      controlsContainer.innerHTML = '';
      const meta = MathCore.modes[modeKey];
      const modeState = state[modeKey];

      meta.params.forEach((paramDef) => {
        if (paramDef.type === 'choice') {
          const choiceGroup = document.createElement('div');
          choiceGroup.className = 'trig-selector';

          paramDef.options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `trig-btn${modeState[paramDef.key] === opt.value ? ' active' : ''}`;
            renderMixedHtml(btn, `\\(${opt.tex}\\) &nbsp;(${opt.label})`);

            btn.addEventListener('click', () => {
              modeState[paramDef.key] = opt.value;
              choiceGroup.querySelectorAll('.trig-btn').forEach((b) => b.classList.remove('active'));
              btn.classList.add('active');
              updateView();
            });
            choiceGroup.appendChild(btn);
          });

          controlsContainer.appendChild(choiceGroup);
          return;
        }

        // Skupina pro číselný parametr: Hlavička + Řádek (Slider + Number Input + Play tlačítko)
        const group = document.createElement('div');
        group.className = 'slider-group';

        const header = document.createElement('div');
        header.className = 'slider-header';

        const label = document.createElement('label');
        label.className = 'param-name';
        const sliderId = `slider-${modeKey}-${paramDef.key}`;
        label.setAttribute('for', sliderId);
        renderMixedHtml(label, paramDef.label);

        const rightMeta = document.createElement('div');
        rightMeta.className = 'slider-meta-right';

        // Pokud má parametr speciální symbolický výpis (např. násobky π/12 nebo stupně), zobrazíme odznak
        if (typeof paramDef.display === 'function') {
          const badge = document.createElement('span');
          badge.className = 'param-val';
          badge.id = `badge-${modeKey}-${paramDef.key}`;
          setTex(badge, paramDef.display(modeState[paramDef.key]), false);
          rightMeta.appendChild(badge);
        }

        // Lokální tlačítko Play/Pause pro daný parametr
        const paramPlayBtn = document.createElement('button');
        paramPlayBtn.type = 'button';
        paramPlayBtn.className = 'btn-param-play';
        paramPlayBtn.id = `play-${modeKey}-${paramDef.key}`;
        paramPlayBtn.title = 'Plynule animovat tento parametr';
        paramPlayBtn.textContent = '▶';
        paramPlayBtn.addEventListener('click', () => {
          toggleAnimation(paramDef.key);
        });
        rightMeta.appendChild(paramPlayBtn);

        header.append(label, rightMeta);

        // Řádek s posuvníkem a číselným polem (<input type="number">)
        const inputRow = document.createElement('div');
        inputRow.className = 'slider-input-row';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = sliderId;
        slider.min = paramDef.min;
        slider.max = paramDef.max;
        slider.step = paramDef.step;
        slider.value = modeState[paramDef.key];

        const numInput = document.createElement('input');
        numInput.type = 'number';
        numInput.className = 'param-number-input';
        numInput.id = `num-${modeKey}-${paramDef.key}`;
        numInput.min = paramDef.min;
        numInput.max = paramDef.max;
        numInput.step = paramDef.isInteger ? '1' : '0.1';
        numInput.value = modeState[paramDef.key];
        numInput.setAttribute('aria-label', `Číselná hodnota parametru ${paramDef.key}`);

        // Událost 1: Pohyb posuvníku -> okamžitě aktualizuje číselné pole i graf
        slider.addEventListener('input', (e) => {
          if (anim.active && anim.paramKey === paramDef.key) {
            stopAnimation();
          }
          const val = sanitizeParamValue(paramDef, e.target.value, modeState[paramDef.key]);
          modeState[paramDef.key] = val;
          slider.value = val;
          numInput.value = paramDef.isInteger ? Math.round(val) : MathCore.round(val, 2);
          syncControlRowUI(modeKey, paramDef, val);
          updateView();
        });

        // Událost 2: Ruční vepsání čísla -> okamžitě posune posuvník a překreslí graf
        numInput.addEventListener('input', (e) => {
          if (anim.active && anim.paramKey === paramDef.key) {
            stopAnimation();
          }
          const raw = e.target.value.trim();
          if (raw === '' || raw === '-' || raw === '.') return;
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) return;

          const val = sanitizeParamValue(paramDef, parsed, modeState[paramDef.key]);
          modeState[paramDef.key] = val;
          slider.value = val;
          syncControlRowUI(modeKey, paramDef, val);
          updateView();
        });

        // Při opuštění číselného pole (blur) zarovnáme text na platnou vyčištěnou hodnotu
        numInput.addEventListener('blur', () => {
          const val = sanitizeParamValue(paramDef, numInput.value, modeState[paramDef.key]);
          modeState[paramDef.key] = val;
          slider.value = val;
          numInput.value = paramDef.isInteger ? Math.round(val) : MathCore.round(val, 2);
          syncControlRowUI(modeKey, paramDef, val);
          updateView();
        });

        inputRow.append(slider, numInput);
        group.append(header, inputRow);
        controlsContainer.appendChild(group);
      });

      updateAnimationButtonsUI();
    }

    // -------------------------------------------------------
    // 4. Plynulá animace parametrů pomocí requestAnimationFrame
    // -------------------------------------------------------
    function updateAnimationButtonsUI() {
      const meta = MathCore.modes[currentMode];
      const defaultKey = getDefaultAnimParamKey(currentMode);
      const activeKey = anim.active ? anim.paramKey : defaultKey;

      if (playPauseMasterBtn) {
        playPauseMasterBtn.classList.toggle('playing', anim.active);
        playPauseMasterBtn.textContent = anim.active
          ? `⏸ Pozastavit (${activeKey})`
          : `▶ Přehrát (${defaultKey})`;
      }

      meta.params.forEach((p) => {
        if (p.type === 'choice') return;
        const btn = document.getElementById(`play-${currentMode}-${p.key}`);
        const slider = document.getElementById(`slider-${currentMode}-${p.key}`);
        const isThisPlaying = anim.active && anim.paramKey === p.key;
        if (btn) {
          btn.classList.toggle('playing', isThisPlaying);
          btn.textContent = isThisPlaying ? '⏸' : '▶';
        }
        if (slider) {
          // Během animace povolíme jemný krok pro dokonale plynulý pohyb posuvníku
          slider.step = isThisPlaying && !p.isInteger ? 'any' : p.step;
        }
      });
    }

    function stopAnimation() {
      if (anim.rafId) {
        cancelAnimationFrame(anim.rafId);
        anim.rafId = null;
      }
      anim.active = false;
      updateAnimationButtonsUI();
    }

    function startAnimation(paramKey) {
      const meta = MathCore.modes[currentMode];
      const paramDef = meta.params.find((p) => p.key === paramKey);
      if (!paramDef) return;

      anim.active = true;
      anim.paramKey = paramKey;
      anim.lastTime = performance.now();
      anim.intAccumulator = state[currentMode][paramKey];
      updateAnimationButtonsUI();

      function tick(now) {
        if (!anim.active) return;
        const dt = Math.min((now - anim.lastTime) / 1000, 0.1);
        anim.lastTime = now;

        const span = paramDef.max - paramDef.min;
        // Celý průchod z min do max trvá cca 4,5 sekundy
        const speed = span / 4.5;

        let nextVal =
          (paramDef.isInteger ? anim.intAccumulator : state[currentMode][paramKey]) +
          anim.direction * speed * dt;

        if (nextVal >= paramDef.max) {
          nextVal = paramDef.max;
          anim.direction = -1;
        } else if (nextVal <= paramDef.min) {
          nextVal = paramDef.min;
          anim.direction = 1;
        }

        // Plynulé přeskočení zakázané hodnoty (např. základ logaritmu a = 1)
        if (paramDef.avoid !== undefined && Math.abs(nextVal - paramDef.avoid) < 0.06) {
          nextVal = paramDef.avoid + anim.direction * 0.07;
        }

        anim.intAccumulator = nextVal;
        const cleanVal = paramDef.isInteger ? Math.round(nextVal) : MathCore.round(nextVal, 2);
        state[currentMode][paramKey] = cleanVal;

        syncControlRowUI(currentMode, paramDef, cleanVal);
        updateView();

        anim.rafId = requestAnimationFrame(tick);
      }

      anim.rafId = requestAnimationFrame(tick);
    }

    function toggleAnimation(paramKey) {
      const targetKey = paramKey || getDefaultAnimParamKey(currentMode);
      if (anim.active && anim.paramKey === targetKey) {
        stopAnimation();
      } else {
        stopAnimation();
        startAnimation(targetKey);
      }
    }

    if (playPauseMasterBtn) {
      playPauseMasterBtn.addEventListener('click', () => {
        toggleAnimation(anim.active ? anim.paramKey : getDefaultAnimParamKey(currentMode));
      });
    }

    // -------------------------------------------------------
    // 5. Přepínač inverzní funkce
    // -------------------------------------------------------
    if (inverseToggle) {
      inverseToggle.addEventListener('change', (e) => {
        showInverse = Boolean(e.target.checked);
        updateView();
      });
    }

    // -------------------------------------------------------
    // 6. Aktualizace plátna a výukového panelu s KaTeXem
    // -------------------------------------------------------
    function selectMode(modeKey) {
      stopAnimation();
      currentMode = modeKey;
      modeTabsContainer.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.mode === modeKey);
      });
      canvas.classList.toggle('interactive-cursor', modeKey === 'circle');
      buildControls(modeKey);
      updateView();
    }

    function updateView() {
      const meta = MathCore.modes[currentMode];
      const analysis = meta.analyze(state[currentMode]);

      // Vykreslení na plátno (včetně případné inverzní funkce a osy y = x)
      plotter.render(analysis, { showInverse });

      // Hlavička výukového panelu
      eduTitle.textContent = analysis.title || meta.title;
      eduSubtitle.textContent = meta.subtitle;
      setTex(eduGeneralFormula, analysis.generalTex || meta.generalTex, false);

      // Hlavní předpis funkce vysázený v display režimu KaTeXu
      setTex(liveEqValue, analysis.equation, true);

      // Modul pro inverzní funkci ve výukovém panelu
      if (inverseCard && inverseCardContent) {
        inverseCard.classList.toggle('hidden', !showInverse);
        if (showInverse && analysis.inverse) {
          renderMixedHtml(inverseCardContent, analysis.inverse.explanationHtml);
        }
      }

      // Karty vlastností funkce
      propsGrid.innerHTML = '';
      analysis.props.forEach((p) => {
        const card = document.createElement('div');
        card.className = `prop-card${p.wide ? ' full-width' : ''}`;

        const labelEl = document.createElement('span');
        labelEl.className = 'prop-label';
        labelEl.textContent = p.label;

        const valEl = document.createElement('div');
        const toneClass = p.tone ? ` text-${p.tone}` : '';
        valEl.className = `prop-val${toneClass}`;
        renderMixedHtml(valEl, p.value);

        card.append(labelEl, valEl);

        if (p.note) {
          const noteEl = document.createElement('span');
          noteEl.className = 'prop-note';
          renderMixedHtml(noteEl, p.note);
          card.appendChild(noteEl);
        }

        propsGrid.appendChild(card);
      });

      // Maturitní teorie
      renderMixedHtml(theoryContent, meta.theory);
    }

    // -------------------------------------------------------
    // 7. Reset parametrů a interakce s jednotkovou kružnicí
    // -------------------------------------------------------
    resetBtn.addEventListener('click', () => {
      stopAnimation();
      state[currentMode] = JSON.parse(JSON.stringify(defaultState[currentMode]));
      buildControls(currentMode);
      updateView();
    });

    let isDragging = false;
    function handlePointerOnCircle(clientX, clientY) {
      if (currentMode !== 'circle') return;
      if (anim.active) stopAnimation();
      const deg = plotter.pointerToAngle(clientX, clientY);
      state.circle.angle = deg;
      const paramDef = MathCore.modes.circle.params[0];
      syncControlRowUI('circle', paramDef, deg);
      updateView();
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (currentMode !== 'circle') return;
      isDragging = true;
      canvas.setPointerCapture(e.pointerId);
      handlePointerOnCircle(e.clientX, e.clientY);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isDragging || currentMode !== 'circle') return;
      handlePointerOnCircle(e.clientX, e.clientY);
    });

    canvas.addEventListener('pointerup', () => {
      isDragging = false;
    });

    // Spuštění aplikace
    buildModeTabs();
    selectMode(currentMode);
  });
})();
