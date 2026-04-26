/* GridSight — single-component dashboard */
const { useState, useMemo, useEffect, useRef } = React;

/* Lucide icon adapter — renders the lucide UMD's icon-node arrays as SVG.
   Each entry in window.lucide is ["svg", attrs, [["path", attrs], ...]]. */
const LUCIDE = window.lucide;
function makeIcon(name) {
  const node = LUCIDE[name];
  if (!node) {
    return ({ size = 16 }) => <span style={{ display: 'inline-block', width: size, height: size }} />;
  }
  const [, baseAttrs, children] = node;
  return function Icon({ size = 16, color, strokeWidth, fill, className, style, ...rest }) {
    const attrs = {
      ...baseAttrs,
      width: size,
      height: size,
      stroke: color || 'currentColor',
      'stroke-width': strokeWidth ?? baseAttrs['stroke-width'],
      fill: fill || 'none',
      className,
      style,
      ...rest
    };
    // Map kebab attrs to React-friendly variants
    const reactAttrs = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'stroke-width') reactAttrs.strokeWidth = v;else
      if (k === 'stroke-linecap') reactAttrs.strokeLinecap = v;else
      if (k === 'stroke-linejoin') reactAttrs.strokeLinejoin = v;else
      reactAttrs[k] = v;
    }
    return (
      <svg {...reactAttrs}>
        {children.map((c, i) => {
          const [tag, a] = c;
          const ra = {};
          for (const [k, v] of Object.entries(a)) {
            if (k === 'stroke-width') ra.strokeWidth = v;else
            if (k === 'stroke-linecap') ra.strokeLinecap = v;else
            if (k === 'stroke-linejoin') ra.strokeLinejoin = v;else
            ra[k] = v;
          }
          return React.createElement(tag, { key: i, ...ra });
        })}
      </svg>);

  };
}

const Zap = makeIcon('Zap');
const TreePine = makeIcon('TreePine');
const ChevronDown = makeIcon('ChevronDown');
const Settings = makeIcon('Settings');
const Download = makeIcon('Download');
const X = makeIcon('X');
const Play = makeIcon('Play');
const Plus = makeIcon('Plus');
const Minus = makeIcon('Minus');
const Crosshair = makeIcon('Crosshair');
const Check = makeIcon('Check');
const Flag = makeIcon('Flag');
const FileText = makeIcon('FileText');
const ExternalLink = makeIcon('ExternalLink');
const UploadCloud = makeIcon('UploadCloud');
const LayoutGrid = makeIcon('LayoutGrid');
const Rows3 = makeIcon('Rows3');
const ArrowLeft = makeIcon('ArrowLeft');
const Clock = makeIcon('Clock');
const PlayCircle = makeIcon('PlayCircle');
const TimerIcon = makeIcon('Timer');

/* ----------------------------- Sample data ------------------------------ */

const FINDINGS = [
{ id: 'f01', sev: 'critical', t: '02:14', tSec: 134, title: 'Shattered porcelain disk', cls: 'insulator', lat: 38.6712, lon: -90.7156, nerc: 'FAC-003 §R2.1', marengo: 0.84, pegasus: 'high', tower: 'suspension tower, outer cross-arm', voltage: '345 kV' },
{ id: 'f02', sev: 'critical', t: '03:47', tSec: 227, title: 'Missing disk mid-string', cls: 'insulator', lat: 38.6731, lon: -90.7189, nerc: 'FAC-003 §R2.1', marengo: 0.79, pegasus: 'high', tower: 'tension tower, mid cross-arm', voltage: '345 kV' },
{ id: 'f03', sev: 'critical', t: '05:22', tSec: 322, title: 'Vegetation within MVCD (3.2 ft)', cls: 'vegetation', lat: 38.6754, lon: -90.7221, nerc: 'FAC-003 §R2', marengo: 0.91, pegasus: 'high', tower: 'span 14–15, conductor mid-span', voltage: '345 kV' },
{ id: 'f04', sev: 'high', t: '01:08', tSec: 68, title: 'Burn marks on insulator cap', cls: 'insulator', lat: 38.6698, lon: -90.7138, nerc: null, marengo: 0.72, pegasus: 'medium', tower: 'suspension tower, top cap', voltage: '345 kV' },
{ id: 'f05', sev: 'high', t: '04:15', tSec: 255, title: 'Vegetation encroachment 6.8 ft', cls: 'vegetation', lat: 38.6742, lon: -90.7203, nerc: 'FAC-003 §R2', marengo: 0.81, pegasus: 'high', tower: 'span 11–12, north side', voltage: '345 kV' },
{ id: 'f06', sev: 'high', t: '06:33', tSec: 393, title: 'Contaminated insulator string', cls: 'insulator', lat: 38.6776, lon: -90.7245, nerc: null, marengo: 0.68, pegasus: 'high', tower: 'tension tower, outer cross-arm', voltage: '345 kV' },
{ id: 'f07', sev: 'moderate', t: '00:42', tSec: 42, title: 'Surface contamination', cls: 'insulator', lat: 38.6685, lon: -90.7124, nerc: null, marengo: 0.61, pegasus: 'medium', tower: 'suspension tower, mid cross-arm', voltage: '345 kV' },
{ id: 'f08', sev: 'moderate', t: '02:51', tSec: 171, title: 'Vegetation 12 ft from conductor', cls: 'vegetation', lat: 38.6720, lon: -90.7172, nerc: null, marengo: 0.74, pegasus: 'medium', tower: 'span 8–9, south side', voltage: '345 kV' },
{ id: 'f09', sev: 'moderate', t: '04:48', tSec: 288, title: 'Minor disk chipping', cls: 'insulator', lat: 38.6748, lon: -90.7214, nerc: null, marengo: 0.59, pegasus: 'medium', tower: 'suspension tower, lower string', voltage: '345 kV' },
{ id: 'f10', sev: 'moderate', t: '05:55', tSec: 355, title: 'Vegetation 14 ft from conductor', cls: 'vegetation', lat: 38.6765, lon: -90.7232, nerc: null, marengo: 0.66, pegasus: 'medium', tower: 'span 16–17, north side', voltage: '345 kV' },
{ id: 'f11', sev: 'low', t: '01:35', tSec: 95, title: 'Possible contamination — unclear', cls: 'insulator', lat: 38.6705, lon: -90.7146, nerc: null, marengo: 0.52, pegasus: 'low', tower: 'suspension tower, outer string', voltage: '345 kV' },
{ id: 'f12', sev: 'low', t: '06:18', tSec: 378, title: 'Distant vegetation, monitor', cls: 'vegetation', lat: 38.6770, lon: -90.7239, nerc: null, marengo: 0.48, pegasus: 'medium', tower: 'span 18–19, treeline edge', voltage: '345 kV' }];


const INTACT = [
{ id: 'i01', t: '00:18', title: 'Insulator string — intact', lat: 38.6680, lon: -90.7115 },
{ id: 'i02', t: '02:38', title: 'Tower hardware — intact', lat: 38.6716, lon: -90.7165 },
{ id: 'i03', t: '04:02', title: 'Conductor span — intact', lat: 38.6739, lon: -90.7197 },
{ id: 'i04', t: '06:50', title: 'Insulator string — intact', lat: 38.6779, lon: -90.7251 }];


const SEV_ORDER = { critical: 0, high: 1, moderate: 2, low: 3 };
const SEV_COLOR = { critical: '#DC2626', high: '#EA580C', moderate: '#D97706', low: '#475569', intact: '#16A34A' };
const SEV_LABEL = { critical: 'CRITICAL', high: 'HIGH', moderate: 'MODERATE', low: 'LOW' };

const TOTAL_SECONDS = 420; // 7 minutes

/* ----------------------------- Helpers --------------------------------- */

function confidenceTier(m) {
  if (m >= 0.75) return 3;
  if (m >= 0.6) return 2;
  return 1;
}

function ConfidenceDots({ tier, color = '#0F172A' }) {
  const label = tier === 3 ? 'High confidence' : tier === 2 ? 'Medium confidence' : 'Low confidence';
  return (
    <span className="tt inline-flex items-center gap-[3px]">
      {[0, 1, 2].map((i) =>
      <span key={i} className="block rounded-full"
      style={{ width: 6, height: 6, background: i < tier ? color : '#E2E8F0' }} />
      )}
      <span className="tt-pop">{label}</span>
    </span>);

}

function SevDot({ sev, size = 8 }) {
  return <span className="block rounded-full" style={{ width: size, height: size, background: SEV_COLOR[sev] }} />;
}

function ClassGlyph({ cls, size = 12, color = '#fff' }) {
  if (cls === 'vegetation') return <TreePine size={size} color={color} strokeWidth={2.25} />;
  return <Zap size={size} color={color} strokeWidth={2.25} />;
}

/* ----------------------------- Header ---------------------------------- */

function Header({ findings, onBack }) {
  const counts = useMemo(() => {
    const o = { critical: 0, high: 0, moderate: 0, low: 0 };
    findings.forEach((f) => o[f.sev]++);
    return o;
  }, [findings]);
  const total = findings.length;

  return (
    <header
      className="h-16 bg-surface-panel border-b border-border flex items-center px-6"
      data-screen-label="Header">
      
      {/* Left: wordmark */}
      <div className="flex-1 flex items-center gap-3">
        <span className="text-[24px] font-semibold tracking-tight text-ink-primary leading-none">GridSight</span>
        {onBack && (
          <button
            onClick={onBack}
            className="h-7 inline-flex items-center gap-1 px-2 rounded-md border border-border bg-surface-panel text-[11px] font-medium text-ink-secondary hover:bg-surface-subtle"
          >
            <ArrowLeft size={12} /> Library
          </button>
        )}
      </div>

      {/* Center: corridor identity */}
      <div className="flex-1 flex flex-col items-center justify-center font-mono leading-tight">
        <div className="text-[12px] text-ink-secondary">Ameren MO 345 kV</div>
        <div className="text-[11px] text-ink-secondary">
          7 min · {total} findings · <span style={{ color: SEV_COLOR.critical }}>{counts.critical} critical</span>
        </div>
      </div>

      {/* Right: export, settings, badge */}
      <div className="flex-1 flex items-center justify-end gap-3">
        <ExportDropdown />
        <button
          aria-label="Settings"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-surface-panel text-ink-secondary hover:bg-surface-subtle">
          
          <Settings size={15} />
        </button>
        <span className="ml-1 font-mono text-[10px] tracking-[0.12em] text-ink-tertiary uppercase">
          Hackathon Demo
        </span>
      </div>
    </header>);

}

function ExportDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md border border-border bg-surface-panel text-[12px] font-medium text-ink-primary hover:bg-surface-subtle">
        
        <Download size={13} />
        Export
        <ChevronDown size={13} className="text-ink-tertiary" />
      </button>
      {open &&
      <div className="absolute right-0 top-9 w-44 bg-surface-panel border border-border rounded-md shadow-cardHover py-1 z-30">
          {[
        ['CSV', 'Findings table'],
        ['GeoJSON', 'Pins + corridor'],
        ['PDF Report', 'Full inspection']].
        map(([k, sub]) =>
        <button key={k} className="w-full text-left px-3 py-1.5 hover:bg-surface-subtle">
              <div className="text-[12px] font-medium text-ink-primary">{k}</div>
              <div className="text-[11px] text-ink-tertiary">{sub}</div>
            </button>
        )}
        </div>
      }
    </div>);

}

/* --------------------------- Findings list ----------------------------- */

function FilterChips({ active, setActive, counts }) {
  const all = FINDINGS.length;
  const items = [
  { k: 'all', label: 'All', n: all, dot: null },
  { k: 'critical', label: 'Critical', n: counts.critical, dot: SEV_COLOR.critical },
  { k: 'high', label: 'High', n: counts.high, dot: SEV_COLOR.high },
  { k: 'moderate', label: 'All', n: counts.moderate, dot: SEV_COLOR.moderate },
  { k: 'low', label: 'Low', n: counts.low, dot: SEV_COLOR.low }];


  function toggle(k) {
    if (k === 'all') {setActive(new Set(['all']));return;}
    const next = new Set(active);
    next.delete('all');
    if (next.has(k)) next.delete(k);else next.add(k);
    if (next.size === 0) next.add('all');
    setActive(next);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const isActive = active.has(it.k) || it.k === 'all' && active.has('all');
        return (
          <button
            key={it.k}
            onClick={() => toggle(it.k)}
            className={
            "h-7 inline-flex items-center gap-1.5 px-2 rounded-full text-[11px] font-medium transition-colors " + (
            isActive ?
            "bg-ink-primary text-white border border-ink-primary" :
            "bg-surface-panel text-ink-primary border border-border hover:bg-surface-subtle")
            }>
            
            {it.dot &&
            <span className="block rounded-full"
            style={{ width: 6, height: 6, background: it.dot, outline: isActive ? '1px solid rgba(255,255,255,0.3)' : 'none' }} />
            }
            <span>{it.label}</span>
            <span className={isActive ? "text-white/70 font-mono" : "text-ink-tertiary font-mono"}>{it.n}</span>
          </button>);

      })}
    </div>);

}

function FindingCard({ f, selected, onSelect }) {
  const tier = confidenceTier(f.marengo);
  return (
    <button
      onClick={() => onSelect(f.id)}
      className={
      "card-hover w-full text-left bg-surface-panel border rounded-md relative overflow-hidden " + (
      selected ?
      "border-brand ring-1 ring-brand" :
      "border-border")
      }>
      
      {/* Severity bar */}
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: SEV_COLOR[f.sev] }} />
      <div className="pl-3.5 pr-3 py-3">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-semibold tracking-[0.1em] uppercase"
            style={{ color: SEV_COLOR[f.sev] }}>
            
            {SEV_LABEL[f.sev]}
          </span>
          <span className="font-mono text-[10px] text-ink-tertiary">{f.id}</span>
        </div>
        <div className="mt-1 text-[14px] font-medium text-ink-primary leading-snug">
          {f.title}
        </div>
        <div className="mt-1.5 font-mono text-[11px] text-ink-secondary leading-snug">
          {f.t} · {f.lat.toFixed(4)}°N, {Math.abs(f.lon).toFixed(4)}°W · {f.voltage}
          <br />
          {f.tower}
        </div>
        <div className="mt-2 flex items-center justify-between">
          {f.nerc ?
          <span className="font-mono text-[10px] text-ink-secondary bg-surface-subtle border border-border rounded px-1.5 py-0.5">
              {f.nerc}
            </span> :
          <span />}
          <ConfidenceDots tier={tier} color={SEV_COLOR[f.sev]} />
        </div>
      </div>
    </button>);

}

function FindingsList({ findings, selectedId, setSelectedId, filters, setFilters, sort, setSort, showIntact, setShowIntact, width = 380 }) {
  const counts = useMemo(() => {
    const o = { critical: 0, high: 0, moderate: 0, low: 0 };
    FINDINGS.forEach((f) => o[f.sev]++);
    return o;
  }, []);

  const visible = useMemo(() => {
    let arr = [...FINDINGS];
    if (!filters.has('all')) {
      arr = arr.filter((f) => filters.has(f.sev));
    }
    if (sort === 'severity') arr.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev] || a.tSec - b.tSec);else
    if (sort === 'timestamp') arr.sort((a, b) => a.tSec - b.tSec);else
    if (sort === 'confidence') arr.sort((a, b) => b.marengo - a.marengo);else
    if (sort === 'class') arr.sort((a, b) => a.cls.localeCompare(b.cls) || SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
    return arr;
  }, [filters, sort]);

  return (
    <aside
      style={{ width: `${width}px` }}
      className="shrink-0 bg-surface-panel border border-border rounded-lg flex flex-col overflow-hidden"
      data-screen-label="Findings list">
      
      {/* Sticky controls */}
      <div className="px-4 pt-4 pb-3 border-b border-border bg-surface-panel" style={{ width: "372px" }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[12px] font-semibold tracking-[0.08em] uppercase text-ink-secondary">Findings</h2>
          <span className="font-mono text-[11px] text-ink-tertiary">{visible.length} / {FINDINGS.length}</span>
        </div>

        <FilterChips active={filters} setActive={setFilters} counts={counts} />

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <SortDropdown value={sort} onChange={setSort} />
        </div>

        <div className="mt-2 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <span className="relative inline-block w-7 h-4">
              <input
                type="checkbox"
                checked={showIntact}
                onChange={(e) => setShowIntact(e.target.checked)}
                className="sr-only peer" />
              
              <span className="absolute inset-0 rounded-full bg-border peer-checked:bg-sev-intact transition-colors" />
              <span className="absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform peer-checked:translate-x-3" />
            </span>
            <span className="text-[11px] text-ink-secondary">Show intact assets</span>
          </label>
          {showIntact &&
          <span className="font-mono text-[10px] text-sev-intact">+{INTACT.length}</span>
          }
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto thin-scroll p-3 space-y-2">
        {visible.map((f) =>
        <FindingCard
          key={f.id}
          f={f}
          selected={selectedId === f.id}
          onSelect={setSelectedId} />

        )}

        {showIntact && INTACT.map((i) =>
        <div key={i.id} className="border border-border rounded-md bg-surface-subtle px-3 py-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold tracking-[0.1em] uppercase" style={{ color: SEV_COLOR.intact }}>INTACT</div>
              <div className="text-[12px] text-ink-primary">{i.title}</div>
              <div className="font-mono text-[10px] text-ink-tertiary">{i.t} · {i.lat.toFixed(4)}°N, {Math.abs(i.lon).toFixed(4)}°W</div>
            </div>
            <Check size={14} color={SEV_COLOR.intact} />
          </div>
        )}
      </div>
    </aside>);

}

function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const labels = {
    severity: 'Severity (high → low)',
    timestamp: 'Timestamp',
    confidence: 'Confidence',
    class: 'Class'
  };

  return (
    <div className="relative w-full" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full h-8 inline-flex items-center justify-between px-2.5 rounded-md border border-border bg-surface-panel text-[12px] text-ink-primary hover:bg-surface-subtle">
        
        <span className="inline-flex items-center gap-1.5 text-ink-secondary">
          <span className="text-[10px] uppercase tracking-[0.08em]">Sort</span>
          <span className="text-ink-primary">{labels[value]}</span>
        </span>
        <ChevronDown size={13} className="text-ink-tertiary" />
      </button>
      {open &&
      <div className="absolute left-0 right-0 top-9 bg-surface-panel border border-border rounded-md shadow-cardHover py-1 z-20">
          {Object.entries(labels).map(([k, lbl]) =>
        <button
          key={k}
          onClick={() => {onChange(k);setOpen(false);}}
          className={"w-full text-left px-3 py-1.5 text-[12px] hover:bg-surface-subtle " + (value === k ? "text-brand font-medium" : "text-ink-primary")}>
          
              {lbl}
            </button>
        )}
        </div>
      }
    </div>);

}

/* ------------------------------ Map view ------------------------------- */

/* Project lat/lon to SVG coords inside the corridor bounds. */
const MAP_BOUNDS = { minLat: 38.6670, maxLat: 38.6790, minLon: -90.7270, maxLon: -90.7110 };
function project(lat, lon, w, h) {
  const x = (lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon) * w;
  const y = h - (lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat) * h;
  return { x, y };
}

function MapView({ findings, selectedId, setSelectedId, showIntact }) {
  const W = 100,H = 100; // viewBox units (percent-style)

  // Smooth corridor path through ordered findings (by time)
  const corridorPath = useMemo(() => {
    const pts = [...FINDINGS].sort((a, b) => a.tSec - b.tSec).map((f) => project(f.lat, f.lon, W, H));
    // Add anchors at start/end so the path leaves and exits the frame
    pts.unshift({ x: pts[0].x - 6, y: pts[0].y + 4 });
    pts.push({ x: pts[pts.length - 1].x + 6, y: pts[pts.length - 1].y - 4 });
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1],p1 = pts[i];
      const cx = (p0.x + p1.x) / 2,cy = (p0.y + p1.y) / 2;
      d += ` Q ${p0.x} ${p0.y}, ${cx} ${cy}`;
    }
    d += ` T ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
    return d;
  }, []);

  return (
    <section
      className="flex-1 min-w-0 bg-surface-panel border border-border rounded-lg relative overflow-hidden"
      data-screen-label="Map view">
      
      {/* Map background */}
      <div className="absolute inset-0 map-bg no-select" />

      {/* Faux water polygon + faint road lines for character */}
      <svg className="absolute inset-0 w-full h-full no-select" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* river */}
        <path d="M -2 78 C 14 70, 28 90, 46 76 S 80 64, 104 72 L 104 104 L -2 104 Z" fill="#DCE7EF" />
        {/* major roads */}
        <path d="M -2 38 C 24 34, 50 46, 76 38 S 104 30, 104 30" stroke="#CBD5E1" strokeWidth="0.6" fill="none" />
        <path d="M 22 -2 C 26 22, 18 50, 30 78 S 38 104, 38 104" stroke="#CBD5E1" strokeWidth="0.5" fill="none" />
        <path d="M 70 -2 C 66 26, 78 50, 72 80" stroke="#CBD5E1" strokeWidth="0.5" fill="none" />

        {/* Corridor inspection path */}
        <path d={corridorPath} stroke="#0369A1" strokeOpacity="0.6" strokeWidth="0.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={corridorPath} stroke="#0369A1" strokeOpacity="0.18" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </svg>

      {/* Pins layer (HTML for crisp icons) */}
      <div className="absolute inset-0" style={{ width: "143.2px" }}>
        {/* Critical haloes (50m radius — translucent fill) */}
        {FINDINGS.filter((f) => f.sev === 'critical').map((f) => {
          const { x, y } = project(f.lat, f.lon, 100, 100);
          return (
            <div key={'h' + f.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${x}%`, top: `${y}%`,
              width: 64, height: 64, transform: 'translate(-50%, -50%)',
              background: 'rgba(220,38,38,0.10)'
            }} />);

        })}

        {/* Intact pins (small) */}
        {showIntact && INTACT.map((i) => {
          const { x, y } = project(i.lat, i.lon, 100, 100);
          return (
            <div key={i.id}
            className="absolute rounded-full border-2 border-white shadow-pin"
            style={{
              left: `${x}%`, top: `${y}%`,
              width: 12, height: 12,
              transform: 'translate(-50%, -50%)',
              background: SEV_COLOR.intact
            }} />);

        })}

        {/* Finding pins */}
        {FINDINGS.map((f) => {
          const { x, y } = project(f.lat, f.lon, 100, 100);
          const isSelected = f.id === selectedId;
          return (
            <button
              key={f.id}
              onClick={() => setSelectedId(f.id)}
              className="absolute group"
              style={{
                left: `${x}%`, top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isSelected ? 20 : f.sev === 'critical' ? 12 : 10
              }}
              aria-label={`${SEV_LABEL[f.sev]} — ${f.title}`}>
              
              {/* Pulsing ring */}
              {isSelected &&
              <span
                className="pin-pulse-ring absolute rounded-full border-2"
                style={{
                  left: '50%', top: '50%',
                  width: 28, height: 28,
                  marginLeft: -14, marginTop: -14,
                  borderColor: SEV_COLOR[f.sev]
                }} />

              }
              <span
                className="block rounded-full shadow-pin border-2 border-white inline-flex items-center justify-center"
                style={{
                  width: 28, height: 28,
                  background: SEV_COLOR[f.sev],
                  outline: isSelected ? `2px solid ${SEV_COLOR[f.sev]}` : 'none',
                  outlineOffset: isSelected ? '2px' : 0
                }}>
                
                <ClassGlyph cls={f.cls} size={13} />
              </span>
            </button>);

        })}
      </div>

      {/* Top-left controls */}
      <div className="absolute top-4 left-4 flex flex-col bg-surface-panel border border-border rounded-md shadow-card overflow-hidden">
        <button className="h-8 w-8 inline-flex items-center justify-center text-ink-secondary hover:bg-surface-subtle border-b border-border"><Plus size={14} /></button>
        <button className="h-8 w-8 inline-flex items-center justify-center text-ink-secondary hover:bg-surface-subtle"><Minus size={14} /></button>
      </div>
      <button className="absolute top-[calc(1rem+72px)] left-4 h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md border border-border bg-surface-panel text-[11px] font-medium text-ink-primary hover:bg-surface-subtle shadow-card">
        <Crosshair size={12} /> Fit corridor
      </button>

      {/* Top-right layer toggle */}
      <LayerToggle />

      {/* Map attribution / legend */}
      <div className="absolute bottom-3 left-4 font-mono text-[10px] text-ink-tertiary bg-surface-panel/80 border border-border rounded px-1.5 py-0.5 backdrop-blur-0">
        38.66°N – 38.68°N  ·  −90.73°W – −90.71°W
      </div>

      {/* Map legend */}
      <div className="absolute bottom-3 right-4 bg-surface-panel border border-border rounded-md shadow-card px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary mb-1.5 font-semibold">Severity</div>
        <div className="flex items-center gap-3">
          {['critical', 'high', 'moderate', 'low'].map((s) =>
          <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-ink-secondary">
              <SevDot sev={s} />
              <span className="capitalize">{s}</span>
            </span>
          )}
        </div>
      </div>
    </section>);

}

function LayerToggle() {
  const [layer, setLayer] = useState('Light');
  return (
    <div className="absolute top-4 right-4 bg-surface-panel border border-border rounded-md shadow-card overflow-hidden flex">
      {['Light', 'Streets', 'Satellite'].map((l) =>
      <button
        key={l}
        onClick={() => setLayer(l)}
        className={
        "h-8 px-2.5 text-[11px] font-medium transition-colors " + (
        layer === l ?
        "bg-ink-primary text-white" :
        "text-ink-secondary hover:bg-surface-subtle")
        }>
        
          {l}
        </button>
      )}
    </div>);

}

/* ----------------------------- Detail panel ---------------------------- */

function DetailPanel({ f, onClose, width = 420 }) {
  if (!f) return null;
  const tier = confidenceTier(f.marengo);

  // Pegasus narrative tied to the selected finding (sample-data driven)
  const NARRATIVES = {
    f01: 'A porcelain insulator string on the outer cross-arm of a 345 kV suspension tower shows a clearly missing disk in the middle of the string. Surrounding hardware appears intact. Tower is part of a standard lattice steel configuration with twin-bundle conductors.',
    f02: 'Mid-string disk failure observed on a tension tower. Remaining disks on the string appear seated, but mechanical asymmetry from the missing element raises immediate flashover risk under wet conditions.',
    f03: 'Vegetation crown intrudes within the Minimum Vegetation Clearance Distance (MVCD) at mid-span. Measured clearance is 3.2 ft against an MVCD of approximately 4.5 ft for a 345 kV conductor. Hard violation.',
    f04: 'Burn-mark discoloration localized to the upper insulator cap suggests a recent flashover event. No conductor damage visible. Hardware geometry is preserved; functional status to be verified on-site.',
    f05: 'Tree crown encroaches the right-of-way at 6.8 ft horizontal clearance. Outside MVCD but inside the management buffer; trim recommended within the standard cycle.',
    f06: 'Heavy contamination across the porcelain string consistent with industrial fallout from the adjacent corridor. Increased leakage current likely; schedule washing.',
    f07: 'Light surface contamination on the porcelain disks. No mechanical or dielectric impact at present. Monitor through the seasonal cycle.',
    f08: 'Vegetation at 12 ft horizontal from the conductor. Outside the management buffer; tracking only.',
    f09: 'Minor edge chipping on a single disk, no exposed cement or pin. Mechanical capacity nominally intact.',
    f10: 'Vegetation at 14 ft horizontal from the conductor. Routine monitoring; no action this cycle.',
    f11: 'Possible surface contamination, but cross-arm shadow obscures the cap. Re-image on next pass with adjusted heading to confirm or dismiss.',
    f12: 'Distant treeline visible at the edge of the corridor. Several growing seasons away from the management buffer; record for trend.'
  };

  const REASONING = {
    critical:
    f.cls === 'vegetation' ?
    { word: 'Critical', body: 'Per NERC reference, vegetation inside the Minimum Vegetation Clearance Distance constitutes an active reliability risk. Crew dispatch required.' } :
    { word: 'Critical', body: 'Per NERC reference, missing porcelain disk indicates loss of mechanical and dielectric integrity. Immediate inspection required.' },
    high:
    f.cls === 'vegetation' ?
    { word: 'High', body: 'Encroachment is outside MVCD but inside the management buffer; risk of progression before next inspection cycle.' } :
    { word: 'High', body: 'Defect compromises insulator performance under stress conditions. Schedule corrective maintenance within the cycle.' },
    moderate: { word: 'Moderate', body: 'Condition is degraded but not service-affecting. Track and address during routine maintenance.' },
    low: { word: 'Low', body: 'Marginal indication. Re-confirm during the next scheduled inspection.' }
  };
  const reasoning = REASONING[f.sev];

  // Component details — null rows are omitted
  const componentRows = f.cls === 'insulator' ?
  [
  ['Component type', 'Insulator string (porcelain)'],
  ['Condition', f.sev === 'critical' ? 'Damaged' : f.sev === 'high' ? 'Degraded' : f.sev === 'moderate' ? 'Surface contamination' : 'Indeterminate'],
  ['Specific defects', f.id === 'f01' ? 'Missing disk, mid-string' :
  f.id === 'f02' ? 'Missing disk, mid-string' :
  f.id === 'f04' ? 'Burn marks, upper cap' :
  f.id === 'f06' ? 'Industrial fallout deposits' :
  f.id === 'f07' ? 'Light surface deposits' :
  f.id === 'f09' ? 'Edge chipping, single disk' :
  f.id === 'f11' ? 'Possible deposits — unclear' :
  null],
  ['Voltage class', f.voltage]].
  filter((r) => r[1] !== null) :
  [
  ['Component type', 'Vegetation (right-of-way)'],
  ['Condition', f.sev === 'critical' ? 'Within MVCD' : f.sev === 'high' ? 'Inside management buffer' : 'Tracking only'],
  ['Clearance', f.id === 'f03' ? '3.2 ft horizontal' :
  f.id === 'f05' ? '6.8 ft horizontal' :
  f.id === 'f08' ? '12 ft horizontal' :
  f.id === 'f10' ? '14 ft horizontal' :
  f.id === 'f12' ? '~22 ft horizontal' :
  null],
  ['Voltage class', f.voltage]].
  filter((r) => r[1] !== null);

  const combinedConf = f.pegasus === 'high' && f.marengo >= 0.75 ? 'high' :
  f.pegasus === 'low' || f.marengo < 0.55 ? 'low' :
  'medium';

  return (
    <aside
      key={f.id}
      style={{ width: `${width}px` }}
      className="panel-enter shrink-0 bg-surface-panel border border-border rounded-lg flex flex-col overflow-hidden shadow-panel"
      data-screen-label="Detail panel">
      
      {/* Sticky header */}
      <div className="h-14 px-4 flex items-center gap-2 border-b border-border bg-surface-panel">
        <span
          className="h-6 inline-flex items-center px-2 rounded-full text-[10px] font-semibold tracking-[0.1em] uppercase text-white"
          style={{ background: SEV_COLOR[f.sev] }}>
          
          {SEV_LABEL[f.sev]}
        </span>
        <span className="h-6 inline-flex items-center px-2 rounded-full text-[11px] text-ink-secondary bg-surface-subtle border border-border">
          {f.cls === 'insulator' ? 'Insulator damage' : 'Vegetation encroachment'}
        </span>
        <div className="flex-1" />
        <button
          onClick={onClose}
          aria-label="Close detail panel"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-secondary hover:bg-surface-subtle">
          
          <X size={15} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto thin-scroll">

        {/* 1. Hero clip */}
        <div className="px-4 pt-4">
          <div className="relative w-full aspect-video bg-[#0F172A] rounded-md overflow-hidden">
            {/* Faux frame: drone-style horizon */}
            <div className="absolute inset-0" style={{
              background:
              'radial-gradient(120% 80% at 50% 100%, #1E293B 0%, #0F172A 60%, #020617 100%)'
            }} />
            {/* faint scan lines */}
            <div className="absolute inset-0" style={{
              background: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 4px)'
            }} />
            {/* play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-white/10 border border-white/30 inline-flex items-center justify-center">
                <Play size={20} color="white" fill="white" />
              </div>
            </div>
            {/* timestamp overlay */}
            <div className="absolute top-2 left-2 font-mono text-[10px] text-white/70 px-1.5 py-0.5 bg-black/40 rounded">
              {f.t} / 07:00
            </div>
            <div className="absolute top-2 right-2 font-mono text-[10px] text-white/70 px-1.5 py-0.5 bg-black/40 rounded">
              REC · 1080p
            </div>
            {/* native-controls strip placeholder */}
            <div className="absolute left-0 right-0 bottom-0 h-7 bg-black/55 px-2 flex items-center gap-2">
              <Play size={12} color="white" fill="white" />
              <div className="flex-1 h-1 rounded-full bg-white/20 relative">
                <div className="absolute inset-y-0 left-0 rounded-full bg-white/80" style={{ width: '32%' }} />
              </div>
              <span className="font-mono text-[10px] text-white/80">00:04 / 00:15</span>
            </div>
          </div>
        </div>

        {/* 2. Spatial-temporal mini-card */}
        <div className="px-4 mt-6">
          <div className="grid grid-cols-3 gap-x-4 bg-surface-subtle border border-border rounded-md px-3 py-2.5 font-mono text-[12px] text-ink-primary leading-tight">
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary mb-1 font-sans not-italic">Time</div>
              <div>{f.t}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary mb-1 font-sans">Position</div>
              <div>{f.lat.toFixed(4)}°N</div>
              <div>{Math.abs(f.lon).toFixed(4)}°W</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary mb-1 font-sans">Drone</div>
              <div>AGL 42 m</div>
              <div>Heading 287°</div>
            </div>
          </div>
        </div>

        {/* 3. What we saw */}
        <Section title="What we saw">
          <p className="text-[13px] text-ink-primary leading-relaxed">
            {NARRATIVES[f.id]}
          </p>
        </Section>

        {/* 4. Severity reasoning */}
        <Section title="Severity reasoning">
          <div className="border border-border rounded-md p-3 bg-surface-panel">
            <p className="text-[13px] text-ink-primary leading-relaxed">
              <span className="font-semibold" style={{ color: SEV_COLOR[f.sev] }}>{reasoning.word}</span>
              <span className="text-ink-secondary"> — </span>
              {reasoning.body}
            </p>
            {f.nerc &&
            <div className="mt-2.5">
                <span className="font-mono text-[10px] text-ink-secondary bg-surface-subtle border border-border rounded px-1.5 py-0.5 inline-flex items-center gap-1">
                  <FileText size={10} /> {f.nerc}
                </span>
              </div>
            }
          </div>
        </Section>

        {/* 5. Component details */}
        <Section title="Component details">
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-3 text-[12px]">
            {componentRows.map(([k, v]) =>
            <React.Fragment key={k}>
                <dt className="text-ink-tertiary uppercase tracking-[0.06em] text-[10px] pt-0.5">{k}</dt>
                <dd className="text-ink-primary">{v}</dd>
              </React.Fragment>
            )}
          </dl>
        </Section>

        {/* 6. Confidence breakdown */}
        <Section title="Confidence breakdown">
          <div className="space-y-2.5">
            <ConfRow label="Marengo similarity" value={f.marengo} display={f.marengo.toFixed(2)} color={SEV_COLOR[f.sev]} />
            <ConfRow label="Pegasus confidence" value={confLevelPct(f.pegasus)} display={f.pegasus} color={SEV_COLOR[f.sev]} />
            <ConfRow label="Combined" value={confLevelPct(combinedConf)} display={combinedConf} color={SEV_COLOR[f.sev]} />
          </div>
        </Section>

        <div className="h-2" />
      </div>

      {/* Sticky actions footer */}
      <div className="border-t border-border bg-surface-panel p-3 flex flex-col gap-2">
        <button className="h-9 inline-flex items-center justify-center gap-2 rounded-md bg-ink-primary text-white text-[12px] font-medium hover:bg-black transition-colors">
          <ExternalLink size={13} />
          Generate work order
        </button>
        <div className="flex gap-2">
          <button className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface-panel text-[12px] font-medium text-ink-primary hover:bg-surface-subtle">
            <Check size={13} /> Mark reviewed
          </button>
          <button className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface-panel text-[12px] font-medium text-ink-primary hover:bg-surface-subtle">
            <Flag size={13} /> Flag for re-inspection
          </button>
        </div>
      </div>
    </aside>);

}

function Section({ title, children }) {
  return (
    <div className="px-4 mt-6">
      <h3 className="text-[10px] font-semibold tracking-[0.1em] uppercase text-ink-secondary mb-2">{title}</h3>
      {children}
    </div>);

}

function confLevelPct(level) {
  return level === 'high' ? 0.88 : level === 'medium' ? 0.62 : 0.34;
}

function ConfRow({ label, value, display, color }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-ink-secondary">{label}</span>
        <span className="font-mono text-ink-primary">{display}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-subtle overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value * 100}%`, background: color }} />
      </div>
    </div>);

}

/* --------------------------- Timeline strip ---------------------------- */

function Timeline({ selected, onSelectSecond }) {
  // Build per-second severity (most severe finding active within a 10s window)
  const cells = useMemo(() => {
    const out = new Array(TOTAL_SECONDS).fill(null);
    FINDINGS.forEach((f) => {
      const start = Math.max(0, f.tSec - 4);
      const end = Math.min(TOTAL_SECONDS - 1, f.tSec + 4);
      for (let s = start; s <= end; s++) {
        const cur = out[s];
        if (!cur || SEV_ORDER[f.sev] < SEV_ORDER[cur.sev]) {
          out[s] = { sev: f.sev, id: f.id };
        }
      }
    });
    return out;
  }, []);

  const minMarks = useMemo(() => {
    const m = [];
    for (let i = 0; i <= 7; i++) m.push(i * 60);
    return m;
  }, []);

  const scrubPct = selected ? selected.tSec / TOTAL_SECONDS * 100 : 0;

  return (
    <footer
      className="h-14 bg-surface-panel border border-border rounded-lg flex flex-col overflow-hidden"
      data-screen-label="Timeline strip">
      
      <div className="px-3 pt-1.5 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink-secondary font-semibold">Timeline</span>
          <span className="font-mono text-[10px] text-ink-tertiary">7 min · 1 col / sec · {FINDINGS.length} findings</span>
        </div>
        {selected &&
        <span className="font-mono text-[10px] text-ink-secondary">
            <span className="text-ink-tertiary">selected</span> {selected.id} · {selected.t}
          </span>
        }
      </div>

      <div className="relative flex-1 px-3 pb-1.5">
        {/* Scrubber */}
        {selected &&
        <div
          className="absolute top-0 bottom-1.5 w-px bg-ink-primary z-10"
          style={{ left: `calc(0.75rem + ${scrubPct}% * (100% - 1.5rem) / 100%)` }}>
          
            <div
            className="absolute -top-0.5 -translate-x-1/2 h-2 px-1 rounded-sm font-mono text-[9px] text-white inline-flex items-center"
            style={{ background: SEV_COLOR[selected.sev] }}>
            
              {selected.t}
            </div>
          </div>
        }

        {/* Cell strip */}
        <div className="absolute inset-x-3 bottom-1.5 top-1 flex">
          {cells.map((c, i) =>
          <button
            key={i}
            onClick={() => {
              if (c) onSelectSecond(c.id);
            }}
            className="tt h-full"
            style={{
              width: `${100 / TOTAL_SECONDS}%`,
              background: c ? SEV_COLOR[c.sev] : '#F1F5F9',
              opacity: c ? selected && selected.id === c.id ? 1 : 0.92 : 1
            }}>
            
              {c &&
            <span className="tt-pop">
                  {`${formatT(i)} · ${SEV_LABEL[c.sev]} · ${c.id}`}
                </span>
            }
            </button>
          )}
        </div>

        {/* Minute marks */}
        <div className="absolute inset-x-3 bottom-0 h-2 pointer-events-none">
          {minMarks.map((s) =>
          <span
            key={s}
            className="absolute top-0 text-[9px] font-mono text-ink-tertiary leading-none"
            style={{ left: `${s / TOTAL_SECONDS * 100}%`, transform: 'translateX(-50%)' }}>
            
              {String(Math.floor(s / 60)).padStart(2, '0')}:00
            </span>
          )}
        </div>
      </div>
    </footer>);

}

function formatT(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/* ----------------------------- Intake screen --------------------------- */

const VIDEO_LIBRARY = [
  { id: 'v01', name: 'Ameren MO 345 kV — Section A.mp4', dur: '07:00', cat: 'suspension', findings: 12, critical: 3, palette: ['#1f2a44','#3d5a7a','#86a3c7'], scene: 'tower-day' },
  { id: 'v02', name: 'Westar KS 230 kV — Tap Line.mp4',  dur: '12:14', cat: 'tension',    findings: 8,  critical: 1, palette: ['#0f3d2e','#2c6a4a','#9bc4a8'], scene: 'corridor-fields' },
  { id: 'v03', name: 'Entergy AR 500 kV — Loop East.mp4', dur: '18:42', cat: 'suspension', findings: 21, critical: 5, palette: ['#3a2a1c','#7a5a3a','#d4ac6e'], scene: 'tower-dusk' },
  { id: 'v04', name: 'Vegetation Sweep — ROW 14.mp4',     dur: '09:08', cat: 'vegetation', findings: 6,  critical: 0, palette: ['#163d1c','#3d7a3d','#a8c87a'], scene: 'forest' },
  { id: 'v05', name: 'AEP TX 138 kV — Spur 7.mp4',        dur: '05:31', cat: 'tension',    findings: 4,  critical: 1, palette: ['#3d2a1f','#7a4a2a','#c87a3d'], scene: 'tower-sunset' },
  { id: 'v06', name: 'Substation Approach — Bay 3.mp4',   dur: '04:22', cat: 'substation', findings: 9,  critical: 2, palette: ['#1f1f2a','#3d3d5a','#86869c'], scene: 'substation' },
  { id: 'v07', name: 'Vegetation Sweep — ROW 22.mp4',     dur: '11:47', cat: 'vegetation', findings: 7,  critical: 0, palette: ['#1f3d2a','#3d7a4a','#9cc88a'], scene: 'forest-edge' },
];

const CATEGORIES = [
  { k: 'all',         label: 'All' },
  { k: 'suspension',  label: 'Suspension' },
  { k: 'tension',     label: 'Tension' },
  { k: 'vegetation',  label: 'Vegetation Sweep' },
  { k: 'substation',  label: 'Substation Approach' },
];

function VideoThumb({ palette, scene, dur }) {
  // Procedural illustrative thumbnail: drone-style scene rendered with SVG
  const [c1, c2, c3] = palette;
  const horizonY = 60;
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <svg viewBox="0 0 200 120" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        {/* sky */}
        <defs>
          <linearGradient id={`sky-${scene}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"  stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
          <linearGradient id={`gnd-${scene}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"  stopColor={c2} />
            <stop offset="100%" stopColor={c1} />
          </linearGradient>
        </defs>
        <rect width="200" height={horizonY} fill={`url(#sky-${scene})`} />
        <rect y={horizonY} width="200" height={120 - horizonY} fill={`url(#gnd-${scene})`} />

        {/* Scene-specific overlays */}
        {scene === 'tower-day' && <>
          {/* lattice tower silhouette */}
          <path d="M 100 110 L 90 30 L 110 30 Z" fill={c1} opacity="0.85" />
          <path d="M 92 70 L 108 70 L 100 30 Z" fill="none" stroke={c3} strokeWidth="0.5" opacity="0.6" />
          <line x1="60" y1="40" x2="140" y2="40" stroke={c3} strokeWidth="0.6" opacity="0.7" />
          <line x1="55" y1="46" x2="145" y2="46" stroke={c3} strokeWidth="0.6" opacity="0.7" />
          <line x1="50" y1="52" x2="150" y2="52" stroke={c3} strokeWidth="0.6" opacity="0.7" />
          <circle cx="20" cy="14" r="6" fill="#fff" opacity="0.55" />
        </>}
        {scene === 'corridor-fields' && <>
          <path d="M 0 60 C 60 56, 140 64, 200 58 L 200 120 L 0 120 Z" fill={c2} opacity="0.7" />
          <line x1="0" y1="40" x2="200" y2="42" stroke={c3} strokeWidth="0.6" opacity="0.6" />
          <line x1="0" y1="44" x2="200" y2="46" stroke={c3} strokeWidth="0.6" opacity="0.6" />
          {[40, 90, 140, 190].map(x => (
            <path key={x} d={`M ${x} 110 L ${x-3} 50 L ${x+3} 50 Z`} fill={c1} opacity="0.8" />
          ))}
        </>}
        {scene === 'tower-dusk' && <>
          <circle cx="160" cy="38" r="14" fill="#f5b860" opacity="0.6" />
          <path d="M 100 110 L 88 28 L 112 28 Z" fill={c1} opacity="0.95" />
          <line x1="40" y1="40" x2="160" y2="40" stroke="#000" strokeWidth="0.8" opacity="0.5" />
          <path d="M 0 90 L 200 90" stroke={c3} strokeWidth="0.4" opacity="0.4" />
        </>}
        {scene === 'forest' && <>
          {Array.from({length: 18}).map((_, i) => {
            const x = (i * 13) % 200; const y = 50 + ((i * 7) % 30);
            return <path key={i} d={`M ${x} ${y+18} L ${x-5} ${y+4} L ${x+5} ${y+4} Z M ${x} ${y+12} L ${x-7} ${y-2} L ${x+7} ${y-2} Z`} fill={c1} opacity="0.85" />;
          })}
        </>}
        {scene === 'tower-sunset' && <>
          <rect width="200" height="60" fill={c3} opacity="0.6" />
          <circle cx="100" cy="55" r="20" fill="#f08040" opacity="0.7" />
          <path d="M 60 110 L 50 32 L 70 32 Z" fill={c1} opacity="0.9" />
          <path d="M 140 110 L 132 38 L 148 38 Z" fill={c1} opacity="0.85" />
          <line x1="20" y1="42" x2="180" y2="46" stroke="#000" strokeWidth="0.8" opacity="0.5" />
        </>}
        {scene === 'substation' && <>
          {/* substation: rectangles + busbars */}
          <rect x="20"  y="60" width="14" height="40" fill={c1} opacity="0.9" />
          <rect x="50"  y="50" width="14" height="50" fill={c1} opacity="0.9" />
          <rect x="80"  y="55" width="14" height="45" fill={c1} opacity="0.9" />
          <rect x="110" y="50" width="14" height="50" fill={c1} opacity="0.9" />
          <rect x="140" y="62" width="14" height="38" fill={c1} opacity="0.9" />
          <rect x="170" y="55" width="14" height="45" fill={c1} opacity="0.9" />
          <line x1="0" y1="48" x2="200" y2="48" stroke={c3} strokeWidth="0.5" opacity="0.7" />
          <line x1="0" y1="52" x2="200" y2="52" stroke={c3} strokeWidth="0.5" opacity="0.7" />
        </>}
        {scene === 'forest-edge' && <>
          <path d="M 0 70 L 200 60 L 200 120 L 0 120 Z" fill={c1} opacity="0.6" />
          {Array.from({length: 12}).map((_, i) => {
            const x = i * 17 + 6; const y = 56 + ((i * 5) % 12);
            return <path key={i} d={`M ${x} ${y+14} L ${x-5} ${y} L ${x+5} ${y} Z`} fill={c1} opacity="0.9" />;
          })}
          <line x1="0" y1="44" x2="200" y2="46" stroke={c3} strokeWidth="0.6" opacity="0.6" />
        </>}

        {/* Drone HUD overlay */}
        <text x="6" y="10" fill="#ffd84d" fontSize="5" fontFamily="monospace" opacity="0.9">REC ●</text>
        <text x="160" y="10" fill="#fff" fontSize="4" fontFamily="monospace" opacity="0.7">AGL 42m</text>
        <text x="6" y="116" fill="#fff" fontSize="4" fontFamily="monospace" opacity="0.7">N 38.67° W 90.71°</text>
        <text x="160" y="116" fill="#fff" fontSize="4" fontFamily="monospace" opacity="0.7">HDG 287°</text>
        {/* Crosshair */}
        <g stroke="#fff" strokeWidth="0.4" opacity="0.5">
          <line x1="100" y1="56" x2="100" y2="64" />
          <line x1="96" y1="60" x2="104" y2="60" />
        </g>
      </svg>

      {/* Duration pill */}
      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/75 rounded font-mono text-[10px] text-white">
        {dur}
      </span>
    </div>
  );
}

function CatChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "h-8 px-3 rounded-full text-[12px] font-medium transition-colors border " +
        (active
          ? "bg-ink-primary text-white border-ink-primary"
          : "bg-surface-panel text-ink-primary border-border hover:bg-surface-subtle")
      }
    >
      {children}
    </button>
  );
}

function IntakeScreen({ onOpen }) {
  const [cat, setCat] = useState('all');
  const [drag, setDrag] = useState(false);

  const filtered = cat === 'all' ? VIDEO_LIBRARY : VIDEO_LIBRARY.filter(v => v.cat === cat);

  // Compute total duration
  const totalSec = VIDEO_LIBRARY.reduce((acc, v) => {
    const [m, s] = v.dur.split(':').map(Number);
    return acc + m * 60 + s;
  }, 0);
  const totalH = Math.floor(totalSec / 3600);
  const totalM = Math.floor((totalSec % 3600) / 60);

  return (
    <div className="min-h-screen bg-surface-canvas text-ink-primary" data-screen-label="Library">
      {/* Header */}
      <header className="h-16 bg-surface-panel border-b border-border flex items-center px-6">
        <div className="flex-1">
          <span className="text-[24px] font-semibold tracking-tight text-ink-primary leading-none">GridSight</span>
        </div>
        <div className="flex-1 flex items-center justify-center font-mono text-[11px] text-ink-tertiary uppercase tracking-[0.1em]">
          Inspection Library
        </div>
        <div className="flex-1 flex items-center justify-end gap-3">
          <button className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-surface-panel text-ink-secondary hover:bg-surface-subtle">
            <Settings size={15} />
          </button>
          <span className="ml-1 font-mono text-[10px] tracking-[0.12em] text-ink-tertiary uppercase">Hackathon Demo</span>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-8 pt-8 pb-12">
        {/* Category chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORIES.map(c => (
            <CatChip key={c.k} active={cat === c.k} onClick={() => setCat(c.k)}>
              {c.label}
            </CatChip>
          ))}
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-surface-panel border border-border rounded-md overflow-hidden">
              <button className="h-8 inline-flex items-center gap-1.5 px-2.5 bg-ink-primary text-white text-[12px] font-medium">
                <LayoutGrid size={13} /> Videos
              </button>
              <button className="h-8 inline-flex items-center gap-1.5 px-2.5 text-ink-secondary text-[12px] font-medium hover:bg-surface-subtle">
                <Rows3 size={13} /> Tabular
              </button>
            </div>
            <span className="ml-2 inline-flex items-center gap-1.5 text-[12px] text-ink-secondary">
              <PlayCircle size={13} /> {filtered.length} videos
            </span>
            <span className="ml-1 inline-flex items-center gap-1.5 text-[12px] text-ink-secondary">
              <TimerIcon size={13} /> {totalH} h {totalM} min
            </span>
          </div>
          <button className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md text-[12px] font-medium text-ink-secondary hover:bg-surface-subtle">
            Sort by <span className="text-ink-primary">Recent upload</span>
            <ChevronDown size={13} />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-4 gap-5">
          {/* Upload card */}
          <label
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); onOpen(); }}
            className={
              "rounded-lg border-2 border-dashed cursor-pointer transition-colors flex flex-col p-5 " +
              (drag
                ? "border-brand bg-brand/5"
                : "border-border bg-surface-panel hover:border-ink-tertiary")
            }
            style={{ aspectRatio: '16 / 11' }}
          >
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <span className="h-9 w-9 rounded-full bg-surface-subtle inline-flex items-center justify-center mb-2.5">
                <UploadCloud size={17} color="#475569" strokeWidth={1.75} />
              </span>
              <div className="text-[13px] font-semibold text-ink-primary">Drop videos or documents</div>
              <div className="mt-2 flex flex-wrap gap-1 justify-center">
                <span className="font-mono text-[10px] text-ink-secondary bg-surface-subtle border border-border rounded-full px-2 py-0.5">Videos: MP4, MOV, AVI</span>
                <span className="font-mono text-[10px] text-ink-secondary bg-surface-subtle border border-border rounded-full px-2 py-0.5">Telemetry: SRT, CSV</span>
              </div>
            </div>
            <ul className="text-[10.5px] text-ink-tertiary space-y-0.5 leading-snug mt-1">
              <li className="flex items-start gap-1.5">
                <span style={{ color: SEV_COLOR.intact }}>●</span>
                <span><span className="text-ink-secondary">Videos:</span> Marengo indexing &amp; analysis</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span style={{ color: SEV_COLOR.high }}>●</span>
                <span><span className="text-ink-secondary">Documents:</span> NERC FAC-003 reference</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span style={{ color: SEV_COLOR.low }}>●</span>
                <span>Max file size <span className="text-ink-secondary">4 GB</span> per video</span>
              </li>
            </ul>
            <input type="file" accept="video/*" className="sr-only" onChange={() => onOpen()} />
          </label>

          {/* Video tiles */}
          {filtered.map(v => (
            <button
              key={v.id}
              onClick={() => onOpen(v.id)}
              className="text-left group"
            >
              <div className="rounded-lg overflow-hidden border border-border bg-black relative" style={{ aspectRatio: '16 / 11' }}>
                <VideoThumb palette={v.palette} scene={v.scene} dur={v.dur} />
                {/* hover play */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                  <span className="h-11 w-11 rounded-full bg-white/90 inline-flex items-center justify-center">
                    <Play size={18} color="#0F172A" fill="#0F172A" />
                  </span>
                </div>
                {/* finding badge */}
                {v.critical > 0 && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-mono text-[10px] font-semibold text-white"
                        style={{ background: SEV_COLOR.critical }}>
                    {v.critical} CRITICAL
                  </span>
                )}
              </div>
              <div className="mt-2 px-0.5">
                <div className="text-[12.5px] font-medium text-ink-primary leading-snug truncate">{v.name}</div>
                <div className="font-mono text-[10.5px] text-ink-tertiary mt-0.5">
                  {v.findings} findings · analyzed
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer pagination */}
        <div className="mt-8 flex items-center justify-between text-[11px] text-ink-tertiary">
          <span>Showing {filtered.length} of {VIDEO_LIBRARY.length}</span>
          <div className="flex items-center gap-1">
            <button className="h-7 px-2 rounded-md border border-border bg-surface-panel text-ink-secondary opacity-50">Previous</button>
            <span className="font-mono text-ink-secondary px-2">Page 1 of 1</span>
            <button className="h-7 px-2 rounded-md border border-border bg-surface-panel text-ink-primary hover:bg-surface-subtle">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- App --------------------------------- */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "findingsWidth": 380,
  "detailWidth": 420,
  "columnGap": 32,
  "outerPaddingX": 32,
  "outerPaddingTop": 32,
  "showDetailPanel": true,
  "showTimeline": true,
  "panelRadius": 8
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState('intake');
  const [selectedId, setSelectedId] = useState('f01');
  const [filters, setFilters] = useState(new Set(['all']));
  const [sort, setSort] = useState('severity');
  const [showIntact, setShowIntact] = useState(false);

  const selected = FINDINGS.find((f) => f.id === selectedId) || null;

  if (view === 'intake') {
    return <IntakeScreen onOpen={() => { setSelectedId('f01'); setView('dashboard'); }} />;
  }

  const reservedHeight = 64 /* header */ + (t.showTimeline ? 56 + 24 : 0) + t.outerPaddingTop + 32 /* bottom padding */;

  return (
    <div className="min-h-screen bg-surface-canvas text-ink-primary"
         style={{ '--panel-radius': `${t.panelRadius}px` }}>
      <style>{`
        [data-screen-label="Findings list"],
        [data-screen-label="Map view"],
        [data-screen-label="Detail panel"],
        [data-screen-label="Timeline strip"] { border-radius: var(--panel-radius) !important; }
      `}</style>

      <Header findings={FINDINGS} onBack={() => setView('intake')} />

      <div style={{ paddingLeft: t.outerPaddingX, paddingRight: t.outerPaddingX, paddingTop: t.outerPaddingTop, paddingBottom: 32 }}>
        <div className="flex" style={{ gap: `${t.columnGap}px`, height: `calc(100vh - ${reservedHeight}px)` }}>
          <FindingsList
            findings={FINDINGS}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            filters={filters}
            setFilters={setFilters}
            sort={sort}
            setSort={setSort}
            showIntact={showIntact}
            setShowIntact={setShowIntact}
            width={t.findingsWidth} />

          <MapView
            findings={FINDINGS}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            showIntact={showIntact} />

          {selected && t.showDetailPanel &&
          <DetailPanel f={selected} onClose={() => setSelectedId(null)} width={t.detailWidth} />
          }
        </div>
      </div>

      {t.showTimeline && (
        <div style={{ paddingLeft: t.outerPaddingX, paddingRight: t.outerPaddingX, paddingBottom: 24 }}>
          <Timeline selected={selected} onSelectSecond={setSelectedId} />
        </div>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Column widths" />
        <TweakSlider label="Findings list" value={t.findingsWidth} min={280} max={520} step={10} unit="px"
                     onChange={(v) => setTweak('findingsWidth', v)} />
        <TweakSlider label="Detail panel"  value={t.detailWidth}   min={320} max={560} step={10} unit="px"
                     onChange={(v) => setTweak('detailWidth', v)} />

        <TweakSection label="Spacing" />
        <TweakSlider label="Column gap"    value={t.columnGap}     min={8}   max={64}  step={2} unit="px"
                     onChange={(v) => setTweak('columnGap', v)} />
        <TweakSlider label="Outer padding" value={t.outerPaddingX} min={8}   max={64}  step={2} unit="px"
                     onChange={(v) => setTweak('outerPaddingX', v)} />
        <TweakSlider label="Top padding"   value={t.outerPaddingTop} min={0} max={64}  step={2} unit="px"
                     onChange={(v) => setTweak('outerPaddingTop', v)} />
        <TweakSlider label="Panel radius"  value={t.panelRadius}   min={0}   max={20}  step={1} unit="px"
                     onChange={(v) => setTweak('panelRadius', v)} />

        <TweakSection label="Visibility" />
        <TweakToggle label="Detail panel" value={t.showDetailPanel}
                     onChange={(v) => setTweak('showDetailPanel', v)} />
        <TweakToggle label="Timeline"     value={t.showTimeline}
                     onChange={(v) => setTweak('showTimeline', v)} />
      </TweaksPanel>
    </div>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);