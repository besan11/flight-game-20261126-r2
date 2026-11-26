// The HUD: big high-contrast numbers (altitude, speed, heading, fuel,
// wind, compass strip, throttle, waypoint) plus the title and debrief
// overlays. All DOM, so it stays readable when the screenshot is shrunk.
import { relativeBearing } from './missions.js';
import { windHeading } from './weather.js';

function el(id) {
  return document.getElementById(id);
}

export class HUD {
  constructor() {
    this.els = {
      alt: el('hud-alt'),
      spd: el('hud-spd'),
      hdg: el('hud-hdg'),
      fuel: el('hud-fuel'),
      fuelBar: el('hud-fuelbar'),
      thr: el('hud-thr'),
      thrBar: el('hud-thrbar'),
      wind: el('hud-wind'),
      compass: el('hud-compass'),
      wp: el('hud-wp-text'),
      wpArrow: el('hud-wparrow'),
      score: el('hud-score'),
      sortie: el('hud-sortie'),
      msg: el('hud-msg'),
      stall: el('hud-stall'),
      damage: el('hud-damage'),
      title: el('screen-title'),
      debrief: el('screen-debrief'),
      debriefBody: el('debrief-body'),
      titleBrief: el('title-brief'),
      titleName: el('title-sortie'),
    };
  }

  /** Compass strip: ticks every 30 degrees with the cardinal letters. */
  compassStrip(headingDeg) {
    const labels = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    let html = '';
    for (let d = -60; d <= 60; d += 15) {
      const deg = ((Math.round(headingDeg) + d) % 360 + 360) % 360;
      const snapped = Math.round(deg / 15) * 15 % 360;
      const label = labels[snapped] || String(snapped).padStart(3, '0');
      html += `<span class="tick${d === 0 ? ' centre' : ''}">${label}</span>`;
    }
    return html;
  }

  update(plane, mission, wind, time) {
    const e = this.els;
    e.alt.textContent = `${Math.round(plane.altitudeFeet())}`;
    e.spd.textContent = `${Math.round(plane.speedKnots())}`;
    e.hdg.textContent = `${String(Math.round(plane.headingDegrees())).padStart(3, '0')}°`;
    const fuelPct = Math.round((plane.fuel / 100) * 100);
    e.fuel.textContent = `${fuelPct}%`;
    e.fuelBar.style.width = `${fuelPct}%`;
    e.fuelBar.className = `barfill${fuelPct < 25 ? ' low' : ''}`;
    e.thr.textContent = `${Math.round(plane.throttle * 100)}%`;
    e.thrBar.style.width = `${Math.round(plane.throttle * 100)}%`;
    e.wind.textContent = `${Math.round(wind.speed)} m/s ${String(Math.round(windHeading(wind))).padStart(3, '0')}°`;
    e.compass.innerHTML = this.compassStrip(plane.headingDegrees());
    e.score.textContent = String(mission.score);
    e.sortie.textContent = mission.def.name;
    e.damage.textContent = plane.damage > 0 ? `DAMAGE ${Math.round(plane.damage)}%` : '';
    const info = mission.targetInfo(plane);
    if (info) {
      const rel = relativeBearing(plane.headingDegrees(), info.bearing);
      // rel > 0 means the target is to the left: point the arrow left.
      const arrow = rel > 25 ? '⬅' : rel < -25 ? '➤' : rel > 8 ? '↖' : rel < -8 ? '↗' : '⬆';
      e.wp.textContent = `${info.name} — ${Math.round(info.dist)} m`;
      e.wpArrow.textContent = arrow;
      e.wpArrow.style.transform = `rotate(${Math.max(-90, Math.min(90, -rel))}deg)`;
    } else {
      e.wp.textContent = 'All mail delivered — land home!';
      e.wpArrow.textContent = '⬆';
    }
    e.stall.style.display = plane.stalled ? 'block' : 'none';
    if (mission.message && time < mission.messageUntil) {
      e.msg.textContent = mission.message;
      e.msg.style.display = 'block';
    } else {
      e.msg.style.display = 'none';
    }
  }

  showTitle(sortieIndex, def) {
    this.els.title.style.display = 'flex';
    this.els.debrief.style.display = 'none';
    this.els.titleName.textContent = def.name;
    this.els.titleBrief.textContent = def.brief;
    document.getElementById('title-sortie-num').textContent = `SORTIE ${sortieIndex + 1} OF 3`;
  }

  hideTitle() {
    this.els.title.style.display = 'none';
  }

  showDebrief(mission, plane) {
    const grade = mission.finalGrade();
    const rows = mission.landings.map((l) => `<tr><td>${l.strip}</td><td class="grade-${l.grade}">${l.grade}</td><td>+${l.points}</td></tr>`).join('');
    this.els.debriefBody.innerHTML = `
      <div class="debrief-grade grade-${grade}">${grade}</div>
      <div class="debrief-title">${mission.failed ? 'SORTIE FAILED' : 'SORTIE COMPLETE'}</div>
      <div class="debrief-sub">${mission.failed ? mission.failReason : mission.def.name}</div>
      <table class="debrief-table">
        <tr><td>Mail delivered</td><td>${mission.parcelsCollected} / ${mission.parcels.length}</td></tr>
        <tr><td>Rings flown</td><td>${mission.ringsPassed} / ${mission.rings.length}</td></tr>
        <tr><td>Time</td><td>${Math.round(mission.time)} s</td></tr>
        <tr><td>Fuel left</td><td>${Math.round(plane.fuel)}%</td></tr>
        <tr><td>Damage</td><td>${Math.round(plane.damage)}%</td></tr>
        ${mission.timeBonus ? `<tr><td>Time bonus</td><td>+${mission.timeBonus}</td></tr>` : ''}
        ${rows}
        <tr class="total"><td>SCORE</td><td>${mission.score}</td></tr>
      </table>
      <div class="debrief-hint">Press ENTER for the next sortie — R to fly this one again</div>`;
    this.els.debrief.style.display = 'flex';
  }

  hideDebrief() {
    this.els.debrief.style.display = 'none';
  }
}
