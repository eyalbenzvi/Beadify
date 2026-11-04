import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { ColorUsage, Pattern } from '../types';
import { contrastText } from '../lib/color';
import { boardsNeeded, columnLabel, totalBeads } from '../lib/pattern';
import { computeTiles } from '../lib/exportPdf';
import { drawPatternThumbnail } from '../lib/render';
import { PAGE_MARGIN, PAGE_SIZES, type PageSizeId } from '../lib/pageGeometry';

interface Props {
  pattern: Pattern;
  usage: ColorUsage[];
  title: string;
  showSymbols: boolean;
  pageSize: PageSizeId;
}

const CELL = 10;
const AXIS = 14;

/**
 * Print-only layout (hidden on screen). An overview + legend page followed by
 * one vector SVG page per pegboard section, so printouts stay razor sharp.
 */
export default function PrintView({ pattern, usage, title, showSymbols, pageSize }: Props) {
  const paper = PAGE_SIZES[pageSize];
  // Height available for a board grid: page minus margins and the page heading.
  const gridMaxH = paper.height - PAGE_MARGIN * 2 - 18;
  const symbols = useMemo(() => new Map(usage.map((u) => [u.color.id, u])), [usage]);
  const tiles = useMemo(() => computeTiles(pattern.width, pattern.height), [pattern.width, pattern.height]);
  const overview = useMemo(() => {
    const c = document.createElement('canvas');
    drawPatternThumbnail(c, pattern, Math.max(4, Math.min(16, Math.floor(1000 / Math.max(pattern.width, pattern.height)))));
    return c.toDataURL('image/png');
  }, [pattern]);
  const boards = boardsNeeded(pattern.width, pattern.height);

  return createPortal(
    <div className="print-only bg-white font-sans text-ink">
      <style>{`@page { size: ${paper.css}; margin: ${PAGE_MARGIN}mm; }`}</style>
      <section className="print-page">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <p className="mb-3 text-xs text-ink-muted">
          {pattern.width} × {pattern.height} pegs · {totalBeads(pattern).toLocaleString()} beads · {usage.length} colours ·{' '}
          {boards.total} pegboard{boards.total === 1 ? '' : 's'} ({boards.across} × {boards.down}) · Made with Beadify
        </p>
        <img src={overview} alt="Pattern overview" className="mx-auto mb-4 max-h-[110mm] max-w-full" style={{ imageRendering: 'pixelated' }} />
        <h2 className="mb-2 text-base font-bold">Colour legend</h2>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-line-strong text-left">
              <th className="py-1">Symbol</th>
              <th className="py-1">Code</th>
              <th className="py-1">Name</th>
              <th className="py-1">Brand</th>
              <th className="py-1">Hex</th>
              <th className="py-1 text-right">Count</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((u) => (
              <tr key={u.color.id} className="print-avoid-break border-b border-line-soft">
                <td className="py-0.5">
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-black"
                    style={{ background: u.color.hex, color: contrastText(u.color.rgb), border: '1px solid rgba(0,0,0,0.2)' }}
                  >
                    {u.symbol}
                  </span>
                </td>
                <td className="py-0.5 font-bold">{u.color.code}</td>
                <td className="py-0.5">{u.color.name}</td>
                <td className="py-0.5">{u.color.brand}</td>
                <td className="py-0.5 font-mono">{u.color.hex}</td>
                <td className="py-0.5 text-right font-bold">{u.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {tiles.map((t, i) => {
        const w = AXIS * 2 + t.w * CELL;
        const h = AXIS * 2 + t.h * CELL;
        return (
          <section key={`${t.x0}-${t.y0}`} className="print-page">
            <h2 className="text-base font-bold">
              Board {i + 1} of {tiles.length}
            </h2>
            <p className="mb-2 text-[10px] text-ink-muted">
              Columns {columnLabel(t.x0)}–{columnLabel(t.x0 + t.w - 1)}, rows {t.y0 + 1}–{t.y0 + t.h}
            </p>
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: `${gridMaxH}mm` }} xmlns="http://www.w3.org/2000/svg">
              {Array.from({ length: t.h }, (_, yy) =>
                Array.from({ length: t.w }, (_, xx) => {
                  const id = pattern.cells[(t.y0 + yy) * pattern.width + (t.x0 + xx)];
                  if (!id) return null;
                  const u = symbols.get(id);
                  if (!u) return null;
                  const x = AXIS + xx * CELL;
                  const y = AXIS + yy * CELL;
                  return (
                    <g key={`${xx}-${yy}`}>
                      <rect x={x} y={y} width={CELL} height={CELL} fill={u.color.hex} />
                      {showSymbols && (
                        <text
                          x={x + CELL / 2}
                          y={y + CELL * 0.72}
                          fontSize={u.symbol.length > 1 ? 4.6 : 6.4}
                          fontWeight={800}
                          textAnchor="middle"
                          fill={contrastText(u.color.rgb)}
                          fontFamily="Nunito, Arial, sans-serif"
                        >
                          {u.symbol}
                        </text>
                      )}
                    </g>
                  );
                }),
              )}
              {Array.from({ length: t.w + 1 }, (_, xx) => {
                const bold = (t.x0 + xx) % 5 === 0 || xx === t.w;
                return (
                  <line
                    key={`v${xx}`}
                    x1={AXIS + xx * CELL}
                    x2={AXIS + xx * CELL}
                    y1={AXIS}
                    y2={AXIS + t.h * CELL}
                    stroke={bold ? '#475569' : '#B4BCC8'}
                    strokeWidth={bold ? 0.6 : 0.25}
                  />
                );
              })}
              {Array.from({ length: t.h + 1 }, (_, yy) => {
                const bold = (t.y0 + yy) % 5 === 0 || yy === t.h;
                return (
                  <line
                    key={`h${yy}`}
                    x1={AXIS}
                    x2={AXIS + t.w * CELL}
                    y1={AXIS + yy * CELL}
                    y2={AXIS + yy * CELL}
                    stroke={bold ? '#475569' : '#B4BCC8'}
                    strokeWidth={bold ? 0.6 : 0.25}
                  />
                );
              })}
              {Array.from({ length: t.w }, (_, xx) => {
                const label = columnLabel(t.x0 + xx);
                const x = AXIS + xx * CELL + CELL / 2;
                return (
                  <g key={`c${xx}`} fontSize={label.length > 1 ? 4.5 : 5.5} fontWeight={700} fill="#475569" textAnchor="middle" fontFamily="Arial, sans-serif">
                    <text x={x} y={AXIS - 3.5}>
                      {label}
                    </text>
                    <text x={x} y={AXIS + t.h * CELL + 8}>
                      {label}
                    </text>
                  </g>
                );
              })}
              {Array.from({ length: t.h }, (_, yy) => {
                const label = String(t.y0 + yy + 1);
                const y = AXIS + yy * CELL + CELL * 0.7;
                return (
                  <g key={`r${yy}`} fontSize={label.length > 2 ? 4.2 : 5} fontWeight={700} fill="#475569" fontFamily="Arial, sans-serif">
                    <text x={AXIS - 2} y={y} textAnchor="end">
                      {label}
                    </text>
                    <text x={AXIS + t.w * CELL + 2} y={y}>
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </section>
        );
      })}
    </div>,
    document.body,
  );
}
