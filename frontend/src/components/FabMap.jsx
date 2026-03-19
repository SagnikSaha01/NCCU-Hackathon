import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

const ZONE_W = 210;
const ZONE_H = 130;
const GAP = 16;

const zones = [
  { id: 'lithography-bay', name: 'Lithography Bay', row: 0, col: 0, abbr: 'LITHO' },
  { id: 'etch-chamber',    name: 'Etch Chamber',    row: 0, col: 1, abbr: 'ETCH' },
  { id: 'deposition',      name: 'Deposition',      row: 0, col: 2, abbr: 'DEP' },
  { id: 'cmp',             name: 'CMP',             row: 0, col: 3, abbr: 'CMP' },
  { id: 'metrology',       name: 'Metrology',       row: 1, col: 0, abbr: 'METRO' },
  { id: 'clean-station',   name: 'Clean Station',   row: 1, col: 1, abbr: 'CLEAN' },
  { id: 'hvac-unit-7',     name: 'HVAC Unit #7',    row: 1, col: 2, abbr: 'HVAC#7' },
  { id: 'chemical-storage',name: 'Chemical Storage',row: 1, col: 3, abbr: 'CHEM' },
];

const SVG_W = 4 * ZONE_W + 3 * GAP + 40;  // 928
const SVG_H = 2 * ZONE_H + GAP + 70;       // 346

function getZoneColor(particles) {
  if (particles > 1.0) return { fill: 'rgba(239,68,68,0.22)', stroke: '#ef4444' };
  if (particles > 0.3)  return { fill: 'rgba(234,179,8,0.18)', stroke: '#eab308' };
  return { fill: 'rgba(14,165,233,0.08)', stroke: '#1e2d4a' };
}

function getDotColor(particles) {
  if (particles > 1.0) return '#ef4444';
  if (particles > 0.3)  return '#eab308';
  return '#22c55e';
}

function getParticleColor(particles) {
  if (particles > 1.0) return '#ef4444';
  if (particles > 0.3)  return '#eab308';
  return '#22c55e';
}

export default function FabMap({ readings = {} }) {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Defs for filters
    const defs = svg.append('defs');

    // Drop shadow for critical sensor dots
    const filter = defs.append('filter').attr('id', 'glow-red');
    filter.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const filterYellow = defs.append('filter').attr('id', 'glow-yellow');
    filterYellow.append('feGaussianBlur').attr('stdDeviation', 2).attr('result', 'coloredBlur');
    const feMerge2 = filterYellow.append('feMerge');
    feMerge2.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge2.append('feMergeNode').attr('in', 'SourceGraphic');

    // Row labels
    svg.append('text')
      .attr('x', 20)
      .attr('y', 14)
      .attr('font-size', '10px')
      .attr('fill', '#475569')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text('ROW 1');

    svg.append('text')
      .attr('x', 20)
      .attr('y', ZONE_H + GAP + 14)
      .attr('font-size', '10px')
      .attr('fill', '#475569')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text('ROW 2');

    // Draw each zone
    zones.forEach(zone => {
      const x = zone.col * (ZONE_W + GAP) + 20;
      const y = zone.row * (ZONE_H + GAP) + 18;
      const reading = readings[zone.id];
      const particles = reading ? reading.particles : 0.07;
      const colors = getZoneColor(particles);
      const dotColor = getDotColor(particles);
      const pColor = getParticleColor(particles);

      const g = svg.append('g').attr('transform', `translate(${x}, ${y})`);

      // Zone rect
      g.append('rect')
        .attr('width', ZONE_W)
        .attr('height', ZONE_H)
        .attr('rx', 8)
        .attr('fill', colors.fill)
        .attr('stroke', colors.stroke)
        .attr('stroke-width', particles > 1.0 ? 2 : 1.5);

      // Abbr label
      g.append('text')
        .attr('x', ZONE_W / 2)
        .attr('y', 18)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('fill', '#64748b')
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('font-weight', '400')
        .text(zone.abbr);

      // Full zone name
      g.append('text')
        .attr('x', ZONE_W / 2)
        .attr('y', 38)
        .attr('text-anchor', 'middle')
        .attr('font-size', '13px')
        .attr('fill', '#e2e8f0')
        .attr('font-weight', '700')
        .attr('font-family', 'Inter, sans-serif')
        .text(zone.name);

      // Particle reading
      g.append('text')
        .attr('x', ZONE_W / 2)
        .attr('y', 62)
        .attr('text-anchor', 'middle')
        .attr('font-size', '16px')
        .attr('fill', pColor)
        .attr('font-weight', '700')
        .attr('font-family', 'JetBrains Mono, monospace')
        .text(`${particles.toFixed(2)}`);

      g.append('text')
        .attr('x', ZONE_W / 2)
        .attr('y', 78)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', pColor)
        .attr('font-weight', '400')
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('opacity', 0.8)
        .text('p/m³');

      // Trend text
      const trend = reading ? reading.trend : 'stable';
      const trendSymbol = trend === 'spiking' ? '▲▲▲' : trend === 'rising' ? '▲' : trend === 'slightly-elevated' ? '↑' : '─';
      const trendColor = trend === 'spiking' ? '#ef4444' : trend === 'rising' ? '#eab308' : trend === 'slightly-elevated' ? '#eab308' : '#475569';

      g.append('text')
        .attr('x', ZONE_W / 2)
        .attr('y', 97)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', trendColor)
        .attr('font-family', 'JetBrains Mono, monospace')
        .text(trendSymbol + ' ' + trend.toUpperCase());

      // Sensor dot at bottom center
      const dotX = ZONE_W / 2;
      const dotY = ZONE_H - 14;

      const dotFilter = particles > 1.0 ? 'url(#glow-red)' : particles > 0.3 ? 'url(#glow-yellow)' : null;

      const dot = g.append('circle')
        .attr('cx', dotX)
        .attr('cy', dotY)
        .attr('r', 7)
        .attr('fill', dotColor);

      if (dotFilter) dot.attr('filter', dotFilter);

      // Pulse animation for elevated/critical
      if (particles > 0.3) {
        dot.classed('pulse', true);
      }
    });

    // Airflow arrows between row 0 zones
    for (let col = 0; col < 3; col++) {
      const arrowX = col * (ZONE_W + GAP) + 20 + ZONE_W + GAP / 2;
      const arrowY = 18 + ZONE_H / 2;

      svg.append('text')
        .attr('x', arrowX)
        .attr('y', arrowY + 6)
        .attr('text-anchor', 'middle')
        .attr('font-size', '20px')
        .attr('fill', 'rgba(148,163,184,0.45)')
        .text('›');
    }

    // Airflow arrows between row 1 zones
    for (let col = 0; col < 3; col++) {
      const arrowX = col * (ZONE_W + GAP) + 20 + ZONE_W + GAP / 2;
      const arrowY = ZONE_H + GAP + 18 + ZONE_H / 2;

      svg.append('text')
        .attr('x', arrowX)
        .attr('y', arrowY + 6)
        .attr('text-anchor', 'middle')
        .attr('font-size', '20px')
        .attr('fill', 'rgba(148,163,184,0.45)')
        .text('›');
    }

    // Column header labels (col numbers)
    const colLabels = ['Col 0', 'Col 1', 'Col 2', 'Col 3'];
    colLabels.forEach((label, col) => {
      const x = col * (ZONE_W + GAP) + 20 + ZONE_W / 2;
      svg.append('text')
        .attr('x', x)
        .attr('y', SVG_H - 6)
        .attr('text-anchor', 'middle')
        .attr('font-size', '8px')
        .attr('fill', '#334155')
        .attr('font-family', 'JetBrains Mono, monospace')
        .text(label);
    });

  }, [readings]);

  return (
    <svg
      ref={svgRef}
      width={SVG_W}
      height={SVG_H}
      style={{ maxWidth: '100%', height: 'auto' }}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
    />
  );
}
