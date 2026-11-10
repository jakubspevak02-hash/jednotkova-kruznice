/**
 * canvas.js — Vykreslovací modul (HTML5 Canvas).
 *
 * Zajišťuje vykreslení kartézské soustavy souřadnic, jednotkové kružnice,
 * křivek funkcí, inverzních funkcí včetně osy souměrnosti y = x (čárkovaně),
 * asymptot, pomocných os a význačných bodů.
 */
const Plotter = (() => {
  'use strict';

  const COLORS = {
    gridMajor: '#1e293b',
    gridMinor: 'rgba(30, 41, 59, 0.45)',
    axis: '#64748b',
    axisLabel: '#94a3b8',
    asymptote: '#ef4444',
    asymptoteText: '#f87171',
    guide: 'rgba(245, 158, 11, 0.38)',
    identityLine: 'rgba(244, 63, 94, 0.55)',
    inverseCurve: '#f43f5e',
    pointPx: '#10b981',
    pointPy: '#3b82f6',
    pointSpecial: '#f59e0b',
  };

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const SCALE = 26; // 1 jednotka = 26 px (rozsah -10 až +10)

    function clear() {
      ctx.clearRect(0, 0, width, height);
    }

    function drawAxesArrows() {
      ctx.strokeStyle = COLORS.axis;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      // Osa X
      ctx.moveTo(10, cy);
      ctx.lineTo(width - 10, cy);
      ctx.moveTo(width - 18, cy - 5);
      ctx.lineTo(width - 10, cy);
      ctx.lineTo(width - 18, cy + 5);
      // Osa Y
      ctx.moveTo(cx, height - 10);
      ctx.lineTo(cx, 10);
      ctx.moveTo(cx - 5, 18);
      ctx.lineTo(cx, 10);
      ctx.lineTo(cx + 5, 18);
      ctx.stroke();

      ctx.fillStyle = COLORS.axisLabel;
      ctx.font = 'bold 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('x', width - 15, cy - 14);
      ctx.fillText('y', cx + 14, 15);
    }

    function drawCartesianGrid(piAxis = false) {
      clear();

      const maxUnits = Math.floor(cx / SCALE);
      ctx.lineWidth = 1;

      for (let i = -maxUnits; i <= maxUnits; i++) {
        if (i === 0) continue;
        const x = cx + i * SCALE;
        const y = cy - i * SCALE;

        ctx.strokeStyle = i % 2 === 0 ? COLORS.gridMajor : COLORS.gridMinor;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      drawAxesArrows();

      ctx.fillStyle = COLORS.axis;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      for (let i = -8; i <= 8; i += 2) {
        if (i === 0) continue;
        const x = cx + i * SCALE;
        const y = cy - i * SCALE;

        if (!piAxis) {
          ctx.strokeStyle = '#475569';
          ctx.beginPath();
          ctx.moveTo(x, cy - 4);
          ctx.lineTo(x, cy + 4);
          ctx.stroke();
          ctx.fillText(i.toString().replace('-', '−'), x, cy + 6);
        }

        ctx.strokeStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(cx - 4, y);
        ctx.lineTo(cx + 4, y);
        ctx.stroke();
        ctx.save();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString().replace('-', '−'), cx - 7, y);
        ctx.restore();
      }

      if (piAxis) {
        const piMarks = [
          { val: -2 * Math.PI, label: '−2π' },
          { val: (-3 * Math.PI) / 2, label: '−3π/2' },
          { val: -Math.PI, label: '−π' },
          { val: -Math.PI / 2, label: '−π/2' },
          { val: Math.PI / 2, label: 'π/2' },
          { val: Math.PI, label: 'π' },
          { val: (3 * Math.PI) / 2, label: '3π/2' },
          { val: 2 * Math.PI, label: '2π' },
        ];
        ctx.fillStyle = COLORS.axisLabel;
        piMarks.forEach((m) => {
          const px = cx + m.val * SCALE;
          if (px < 16 || px > width - 16) return;
          ctx.strokeStyle = COLORS.axis;
          ctx.beginPath();
          ctx.moveTo(px, cy - 5);
          ctx.lineTo(px, cy + 5);
          ctx.stroke();
          ctx.fillText(m.label, px, cy + 7);
        });
      }

      ctx.fillStyle = COLORS.axis;
      ctx.fillText('0', cx - 8, cy + 6);
    }

    function drawLineGuide(item, isAsymptote = false) {
      ctx.save();
      ctx.setLineDash(isAsymptote ? [6, 5] : [4, 4]);
      ctx.strokeStyle = isAsymptote ? COLORS.asymptote : COLORS.guide;
      ctx.lineWidth = isAsymptote ? 1.8 : 1.3;

      if (item.type === 'v') {
        const px = cx + item.value * SCALE;
        if (px >= 0 && px <= width) {
          ctx.beginPath();
          ctx.moveTo(px, 0);
          ctx.lineTo(px, height);
          ctx.stroke();
          if (item.label) {
            ctx.fillStyle = COLORS.asymptoteText;
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, px + 6, 22);
          }
        }
      } else if (item.type === 'h') {
        const py = cy - item.value * SCALE;
        if (py >= 0 && py <= height) {
          ctx.beginPath();
          ctx.moveTo(0, py);
          ctx.lineTo(width, py);
          ctx.stroke();
          if (item.label) {
            ctx.fillStyle = COLORS.asymptoteText;
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(item.label, width - 14, py - 8);
          }
        }
      }
      ctx.restore();
    }

    /**
     * Vykreslí čárkovanou osu I. a III. kvadrantu (y = x) pro zrcadlení inverzní funkce.
     */
    function drawIdentityAxis() {
      ctx.save();
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = COLORS.identityLine;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(width, 0);
      ctx.stroke();

      ctx.fillStyle = COLORS.inverseCurve;
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('osa souměrnosti y = x', width - 14, 14);
      ctx.restore();
    }

    function drawCurve(fn, color = '#10b981', lineWidth = 3, dashed = false) {
      ctx.save();
      if (dashed) ctx.setLineDash([8, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      let drawing = false;
      let prevPy = null;

      for (let px = 0; px <= width; px += 0.25) {
        const x = (px - cx) / SCALE;
        const y = fn(x);

        if (!Number.isFinite(y)) {
          drawing = false;
          prevPy = null;
          continue;
        }

        const py = cy - y * SCALE;

        // Přerušení čáry při skoku přes svislou asymptotu
        if (prevPy !== null && Math.abs(py - prevPy) > height * 0.85) {
          drawing = false;
        }

        if (py >= -height && py <= height * 2) {
          if (!drawing) {
            ctx.moveTo(px, py);
            drawing = true;
          } else {
            ctx.lineTo(px, py);
          }
          prevPy = py;
        } else {
          drawing = false;
          prevPy = null;
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    function drawPoint(pt) {
      if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
      const px = cx + pt.x * SCALE;
      const py = cy - pt.y * SCALE;
      if (px < -10 || px > width + 10 || py < -10 || py > height + 10) return;

      if (pt.kind === 'hole') {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = COLORS.pointSpecial;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        return;
      }

      const color =
        pt.kind === 'px'
          ? COLORS.pointPx
          : pt.kind === 'py'
          ? COLORS.pointPy
          : COLORS.pointSpecial;

      const r = pt.kind === 'special' ? 6.2 : 5.2;

      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (pt.label) {
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(pt.label, px + 8, py - 5);
      }
    }

    function drawUnitCircleScene(data) {
      const { angle, rad, sin, cos } = data;
      const radius = 190;
      const px = cx + cos * radius;
      const py = cy - sin * radius;

      clear();

      ctx.strokeStyle = COLORS.gridMajor;
      ctx.lineWidth = 1;
      const step = radius / 2;
      for (let x = cx % step; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = cy % step; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      drawAxesArrows();

      ctx.fillStyle = COLORS.axisLabel;
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('1', cx + radius + 12, cy + 14);
      ctx.fillText('−1', cx - radius - 16, cy + 14);
      ctx.fillText('1', cx - 14, cy - radius - 8);
      ctx.fillText('−1', cx - 16, cy + radius + 10);
      ctx.fillText('0', cx - 10, cy + 12);

      ctx.strokeStyle = COLORS.axisLabel;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (angle > 0) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, 40, 0, -rad, true);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, -rad, true);
        ctx.stroke();
      }

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.beginPath();
      ctx.moveTo(cx, py);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, cy);
      ctx.stroke();

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, cy);
      ctx.lineTo(px, py);
      ctx.stroke();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();

      ctx.font = 'bold 13px Inter, system-ui, sans-serif';
      if (Math.abs(cos * radius) > 35) {
        ctx.fillStyle = '#60a5fa';
        ctx.fillText('cos α', cx + (cos * radius) / 2, cy + (sin >= 0 ? 16 : -16));
      }
      if (Math.abs(sin * radius) > 35) {
        ctx.fillStyle = '#f87171';
        ctx.fillText('sin α', px + (cos >= 0 ? 26 : -26), cy - (sin * radius) / 2);
      }

      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    function render(analysis, options = {}) {
      if (analysis.custom === 'circle') {
        drawUnitCircleScene(analysis);
        return;
      }

      drawCartesianGrid(Boolean(analysis.piAxis));

      if (analysis.guides) {
        analysis.guides.forEach((g) => drawLineGuide(g, false));
      }
      if (analysis.asymptotes) {
        analysis.asymptotes.forEach((a) => drawLineGuide(a, true));
      }

      // Pokud je zapnuto zobrazení inverzní funkce, vykreslíme osu y = x a křivku f⁻¹(x)
      if (options.showInverse) {
        drawIdentityAxis();
        if (analysis.inverse && analysis.inverse.available && analysis.inverse.fn) {
          drawCurve(analysis.inverse.fn, COLORS.inverseCurve, 2.75, false);
        }
      }

      if (analysis.fn) {
        drawCurve(analysis.fn, analysis.color || '#10b981', 3, false);
      }
      if (analysis.points) {
        analysis.points.forEach((pt) => drawPoint(pt));
      }
    }

    function pointerToAngle(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX - cx;
      const y = cy - (clientY - rect.top) * scaleY;
      let deg = (Math.atan2(y, x) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      return Math.round(deg);
    }

    return { render, pointerToAngle };
  }

  return { create };
})();
