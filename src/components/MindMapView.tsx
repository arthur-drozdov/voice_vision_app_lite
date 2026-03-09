/**
 * MindMapView — Interactive Visual Mind Map
 *
 * Renders a MindmapNode tree as a true visual mind map with:
 *   - Radial tree layout with calculated positions
 *   - SVG curved bezier connection lines
 *   - Collapsible nodes (tap chevron)
 *   - Drag-to-reposition (hold + drag)
 *   - Editable node text (double-tap)
 *   - Add child nodes ("+" button)
 *   - Pan & zoom (pinch/scroll)
 *   - Colour-coded branches
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Plus, GripHorizontal } from "lucide-react";
import type { MindmapNode } from "@/lib/canvasStore";

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface NodeLayout {
  id: string;
  node: MindmapNode;
  x: number;
  y: number;
  depth: number;
  parentId: string | null;
  colour: BranchColour;
}

interface BranchColour {
  bg: string;
  border: string;
  line: string;
  text: string;
}

/* ─── Colour palette ──────────────────────────────────────────────────────── */

const BRANCH_PALETTES: BranchColour[] = [
  { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", line: "rgba(99,102,241,0.4)", text: "#818cf8" },
  { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)", line: "rgba(167,139,250,0.4)", text: "#a78bfa" },
  { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.35)", line: "rgba(251,191,36,0.4)", text: "#fbbf24" },
  { bg: "rgba(251,113,133,0.12)", border: "rgba(251,113,133,0.35)", line: "rgba(251,113,133,0.4)", text: "#fb7185" },
  { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.35)", line: "rgba(52,211,153,0.4)", text: "#34d399" },
  { bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.35)", line: "rgba(56,189,248,0.4)", text: "#38bdf8" },
];

const ROOT_COLOUR: BranchColour = {
  bg: "rgba(99,102,241,0.15)",
  border: "rgba(99,102,241,0.5)",
  line: "rgba(99,102,241,0.5)",
  text: "#818cf8",
};

/* ─── Node ID generation ──────────────────────────────────────────────────── */

let _nodeCounter = 0;
function assignIds(node: MindmapNode, prefix = "n"): MindmapNode {
  const id = node.id || `${prefix}_${_nodeCounter++}`;
  return {
    ...node,
    id,
    children: node.children?.map((c, i) => assignIds(c, `${id}_${i}`)),
  };
}

/* ─── Layout engine — radial tree ─────────────────────────────────────────── */

const LEVEL_RADIUS = [0, 180, 320, 430]; // distance from centre per depth

function getLabel(n: MindmapNode): string {
  return (n as any).label || (n as any).title || "";
}

function countLeaves(node: MindmapNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

function layoutTree(root: MindmapNode, centreX: number, centreY: number): NodeLayout[] {
  const result: NodeLayout[] = [];

  // Root at centre
  result.push({
    id: root.id || "root",
    node: root,
    x: centreX,
    y: centreY,
    depth: 0,
    parentId: null,
    colour: ROOT_COLOUR,
  });

  if (!root.children || root.children.length === 0) return result;

  // Distribute L1 children around the root
  const totalLeaves = root.children.reduce((s, c) => s + countLeaves(c), 0);
  let angleOffset = -Math.PI / 2; // start from top

  root.children.forEach((child, i) => {
    const colour = BRANCH_PALETTES[i % BRANCH_PALETTES.length];
    const leafShare = countLeaves(child) / totalLeaves;
    const sweep = leafShare * Math.PI * 2;
    const midAngle = angleOffset + sweep / 2;

    const r1 = LEVEL_RADIUS[1];
    const cx = centreX + Math.cos(midAngle) * r1;
    const cy = centreY + Math.sin(midAngle) * r1;

    result.push({
      id: child.id || `l1_${i}`,
      node: child,
      x: cx,
      y: cy,
      depth: 1,
      parentId: root.id || "root",
      colour,
    });

    // L2 children
    if (child.children && child.children.length > 0) {
      const l2Count = child.children.length;
      const l2Spread = Math.min(sweep * 0.8, Math.PI * 0.6);
      const l2Start = midAngle - l2Spread / 2;
      const l2Step = l2Count > 1 ? l2Spread / (l2Count - 1) : 0;

      child.children.forEach((gc, j) => {
        const a2 = l2Count === 1 ? midAngle : l2Start + j * l2Step;
        const r2 = LEVEL_RADIUS[2];
        const gx = centreX + Math.cos(a2) * r2;
        const gy = centreY + Math.sin(a2) * r2;

        result.push({
          id: gc.id || `l2_${i}_${j}`,
          node: gc,
          x: gx,
          y: gy,
          depth: 2,
          parentId: child.id || `l1_${i}`,
          colour,
        });

        // L3 children
        if (gc.children && gc.children.length > 0) {
          const l3Count = gc.children.length;
          const l3Spread = Math.min(l2Step || 0.4, 0.5);
          const l3Start = a2 - l3Spread / 2;
          const l3StepSize = l3Count > 1 ? l3Spread / (l3Count - 1) : 0;

          gc.children.forEach((ggc, k) => {
            const a3 = l3Count === 1 ? a2 : l3Start + k * l3StepSize;
            const r3 = LEVEL_RADIUS[3];
            result.push({
              id: ggc.id || `l3_${i}_${j}_${k}`,
              node: ggc,
              x: centreX + Math.cos(a3) * r3,
              y: centreY + Math.sin(a3) * r3,
              depth: 3,
              parentId: gc.id || `l2_${i}_${j}`,
              colour,
            });
          });
        }
      });
    }

    angleOffset += sweep;
  });

  return result;
}

/* ─── SVG Connection Line ─────────────────────────────────────────────────── */

const ConnectionLine = ({
  x1, y1, x2, y2, colour,
}: {
  x1: number; y1: number; x2: number; y2: number; colour: string;
}) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Curved bezier that bends toward the centre
  const d = `M ${x1} ${y1} Q ${mx} ${y1}, ${mx} ${my} Q ${mx} ${y2}, ${x2} ${y2}`;

  return (
    <path
      d={d}
      fill="none"
      stroke={colour}
      strokeWidth={2}
      strokeLinecap="round"
      opacity={0.6}
    />
  );
};

/* ─── Node sizes by depth ─────────────────────────────────────────────────── */

const NODE_STYLES: Record<number, { minW: number; fontSize: number; pad: number; fontWeight: number }> = {
  0: { minW: 120, fontSize: 14, pad: 16, fontWeight: 700 },
  1: { minW: 100, fontSize: 12, pad: 12, fontWeight: 600 },
  2: { minW: 80, fontSize: 11, pad: 10, fontWeight: 500 },
  3: { minW: 60, fontSize: 10, pad: 8, fontWeight: 400 },
};

/* ─── Main Component ──────────────────────────────────────────────────────── */

interface MindMapViewProps {
  root: MindmapNode;
  boardId: string;
  onUpdate?: (newRoot: MindmapNode) => void;
}

const MindMapView = ({ root: initialRoot, boardId, onUpdate }: MindMapViewProps) => {
  // Assign stable IDs to all nodes
  const [root, setRoot] = useState<MindmapNode>(() => assignIds(initialRoot));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [dragOffsets, setDragOffsets] = useState<Record<string, { dx: number; dy: number }>>({});

  // Pan & zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [focusBranchIdx, setFocusBranchIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Layout
  const CX = 500;
  const CY = 500;
  const allNodes = useMemo(() => layoutTree(root, CX, CY), [root]);

  // Filter out collapsed subtrees
  const visibleNodes = useMemo(() => {
    const hiddenParents = new Set<string>();
    const visible: NodeLayout[] = [];

    for (const nl of allNodes) {
      if (nl.parentId && hiddenParents.has(nl.parentId)) {
        hiddenParents.add(nl.id);
        continue;
      }
      if (collapsed.has(nl.id)) {
        hiddenParents.add(nl.id);
      }
      visible.push(nl);
    }
    return visible;
  }, [allNodes, collapsed]);

  // Build connection pairs
  const connections = useMemo(() => {
    const nodeMap = new Map(visibleNodes.map(n => [n.id, n]));
    return visibleNodes
      .filter(n => n.parentId && nodeMap.has(n.parentId))
      .map(n => ({
        from: nodeMap.get(n.parentId!)!,
        to: n,
      }));
  }, [visibleNodes]);

  // Bounding box for SVG viewport
  const bounds = useMemo(() => {
    if (visibleNodes.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of visibleNodes) {
      const ox = dragOffsets[n.id]?.dx || 0;
      const oy = dragOffsets[n.id]?.dy || 0;
      const x = n.x + ox;
      const y = n.y + oy;
      minX = Math.min(minX, x - 80); maxX = Math.max(maxX, x + 80);
      minY = Math.min(minY, y - 40); maxY = Math.max(maxY, y + 40);
    }
    return { minX: minX - 40, minY: minY - 40, maxX: maxX + 40, maxY: maxY + 40 };
  }, [visibleNodes, dragOffsets]);

  // Toggle collapse
  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Start editing
  const startEdit = (id: string, label: string) => {
    setEditing(id);
    setEditText(label);
  };

  // Save edit
  const commitEdit = useCallback(() => {
    if (!editing) return;
    const newRoot = updateNodeLabel(root, editing, editText);
    setRoot(newRoot);
    setEditing(null);
    onUpdate?.(newRoot);
  }, [editing, editText, root, onUpdate]);

  // Add child
  const addChild = (parentId: string) => {
    const newRoot = addChildNode(root, parentId, "New idea");
    setRoot(assignIds(newRoot));
    onUpdate?.(newRoot);
  };

  // Pan handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  };

  const handlePointerUp = () => { isPanning.current = false; };

  // Zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.3, Math.min(2, prev - e.deltaY * 0.001)));
  };

  const svgW = bounds.maxX - bounds.minX;
  const svgH = bounds.maxY - bounds.minY;

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden touch-none select-none"
      style={{
        height: "65vh",
        minHeight: 400,
        /* Glass background that covers the entire viewport area */
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Zoom & navigation controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => setZoom(z => Math.min(2, z + 0.15))}
          className="w-8 h-8 rounded-lg glass flex items-center justify-center text-foreground/60 text-sm font-bold hover:text-foreground transition-colors"
          title="Zoom in"
        >+</button>
        <button
          onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}
          className="w-8 h-8 rounded-lg glass flex items-center justify-center text-foreground/60 text-sm font-bold hover:text-foreground transition-colors"
          title="Zoom out"
        >−</button>
        <button
          onClick={() => {
            // Focus branch: cycle through top-level branches
            const branches = layout.filter(n => n.depth === 1);
            if (branches.length === 0) return;
            const nextIdx = (focusBranchIdx + 1) % branches.length;
            setFocusBranchIdx(nextIdx);
            const branch = branches[nextIdx];
            // Get all nodes in this branch subtree
            const branchNodes = layout.filter(n => {
              let id = n.id;
              while (id) {
                if (id === branch.id) return true;
                const parent = layout.find(p => p.id === id)?.parentId;
                if (!parent) break;
                id = parent;
              }
              return false;
            });
            if (branchNodes.length === 0) return;
            // Calculate branch center
            const ox = dragOffsets[branch.id]?.dx || 0;
            const oy = dragOffsets[branch.id]?.dy || 0;
            const avgX = branchNodes.reduce((s, n) => s + n.x + (dragOffsets[n.id]?.dx || 0), 0) / branchNodes.length;
            const avgY = branchNodes.reduce((s, n) => s + n.y + (dragOffsets[n.id]?.dy || 0), 0) / branchNodes.length;
            const containerW = containerRef.current?.clientWidth || 400;
            const containerH = containerRef.current?.clientHeight || 400;
            setZoom(1.2);
            setPan({
              x: containerW / 2 - (avgX - bounds.minX) * 1.2 - svgW / 2 * 1.2 + svgW * 1.2 / 2,
              y: containerH / 2 - (avgY - bounds.minY) * 1.2 - 20 * 1.2,
            });
          }}
          className="w-8 h-8 rounded-lg glass flex items-center justify-center text-foreground/60 text-xs hover:text-foreground transition-colors"
          title="Focus next branch"
        >🔍</button>
        <button
          onClick={() => {
            // Fit all: calculate optimal zoom and center everything
            const containerW = containerRef.current?.clientWidth || 400;
            const containerH = containerRef.current?.clientHeight || 400;
            const padding = 40;
            const fitZoomX = (containerW - padding * 2) / Math.max(svgW, 1);
            const fitZoomY = (containerH - padding * 2) / Math.max(svgH, 1);
            const fitZoom = Math.min(fitZoomX, fitZoomY, 1.2);
            const clampedZoom = Math.max(0.3, Math.min(fitZoom, 1.5));
            setZoom(clampedZoom);
            setPan({
              x: (containerW - svgW * clampedZoom) / 2,
              y: (containerH - svgH * clampedZoom) / 2 - 10,
            });
            setFocusBranchIdx(-1); // reset branch cycling
          }}
          className="w-8 h-8 rounded-lg glass flex items-center justify-center text-foreground/60 text-xs hover:text-foreground transition-colors"
          title="Fit all & centre"
        >⊡</button>
      </div>

      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          width: svgW,
          height: svgH,
          position: "relative",
          margin: "auto",
          marginTop: 20,
        }}
      >
        {/* SVG layer for lines */}
        <svg
          width={svgW}
          height={svgH}
          viewBox={`${bounds.minX} ${bounds.minY} ${svgW} ${svgH}`}
          className="absolute inset-0 pointer-events-none"
          style={{ overflow: "visible" }}
        >
          {connections.map(({ from, to }) => (
            <ConnectionLine
              key={`${from.id}-${to.id}`}
              x1={(from.x + (dragOffsets[from.id]?.dx || 0))}
              y1={(from.y + (dragOffsets[from.id]?.dy || 0))}
              x2={(to.x + (dragOffsets[to.id]?.dx || 0))}
              y2={(to.y + (dragOffsets[to.id]?.dy || 0))}
              colour={to.colour.line}
            />
          ))}
        </svg>

        {/* Node layer */}
        {visibleNodes.map((nl) => {
          const style = NODE_STYLES[nl.depth] || NODE_STYLES[3];
          const label = getLabel(nl.node);
          const hasChildren = nl.node.children && nl.node.children.length > 0;
          const isCollapsed = collapsed.has(nl.id);
          const isEditing = editing === nl.id;
          const ox = dragOffsets[nl.id]?.dx || 0;
          const oy = dragOffsets[nl.id]?.dy || 0;

          return (
            <motion.div
              key={nl.id}
              data-node
              drag
              dragMomentum={false}
              onDragEnd={(_, info) => {
                setDragOffsets(prev => ({
                  ...prev,
                  [nl.id]: {
                    dx: (prev[nl.id]?.dx || 0) + info.offset.x / zoom,
                    dy: (prev[nl.id]?.dy || 0) + info.offset.y / zoom,
                  },
                }));
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: nl.depth * 0.06, type: "spring", stiffness: 300, damping: 25 }}
              className="absolute flex items-center gap-1 cursor-grab active:cursor-grabbing"
              style={{
                left: nl.x + ox - bounds.minX - style.minW / 2,
                top: nl.y + oy - bounds.minY - 18,
                zIndex: nl.depth === 0 ? 10 : 5 - nl.depth,
              }}
            >
              {/* Node bubble */}
              <div
                className="rounded-xl backdrop-blur-md border transition-all"
                style={{
                  minWidth: style.minW,
                  padding: `${style.pad * 0.5}px ${style.pad}px`,
                  backgroundColor: nl.colour.bg,
                  borderColor: nl.colour.border,
                  maxWidth: nl.depth === 0 ? 200 : 160,
                }}
                onDoubleClick={() => startEdit(nl.id, label)}
              >
                {isEditing ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => e.key === "Enter" && commitEdit()}
                    className="w-full bg-transparent outline-none text-foreground text-center"
                    style={{ fontSize: style.fontSize, fontWeight: style.fontWeight }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <p
                    className="text-foreground text-center leading-snug"
                    style={{ fontSize: style.fontSize, fontWeight: style.fontWeight }}
                  >
                    {label}
                  </p>
                )}
              </div>

              {/* Collapse toggle */}
              {hasChildren && nl.depth > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCollapse(nl.id); }}
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-transform"
                  style={{
                    backgroundColor: nl.colour.bg,
                    border: `1px solid ${nl.colour.border}`,
                    transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                  }}
                >
                  <ChevronRight size={10} style={{ color: nl.colour.text }} />
                </button>
              )}

              {/* Add child button */}
              {nl.depth < 3 && !isEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); addChild(nl.id); }}
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 opacity-0 hover:opacity-100 transition-opacity"
                  style={{
                    backgroundColor: nl.colour.bg,
                    border: `1px solid ${nl.colour.border}`,
                  }}
                >
                  <Plus size={9} style={{ color: nl.colour.text }} />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Tree mutation helpers ───────────────────────────────────────────────── */

function updateNodeLabel(node: MindmapNode, id: string, newLabel: string): MindmapNode {
  if (node.id === id) return { ...node, label: newLabel };
  if (!node.children) return node;
  return { ...node, children: node.children.map(c => updateNodeLabel(c, id, newLabel)) };
}

function addChildNode(node: MindmapNode, parentId: string, label: string): MindmapNode {
  if (node.id === parentId) {
    return {
      ...node,
      children: [...(node.children || []), { label, id: `new_${Date.now()}` }],
    };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map(c => addChildNode(c, parentId, label)) };
}

export default MindMapView;
