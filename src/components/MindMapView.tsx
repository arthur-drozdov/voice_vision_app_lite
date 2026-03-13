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
import { ChevronRight, Plus, X, Undo2 } from "lucide-react";
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
  { bg: "rgba(99,102,241,0.45)", border: "rgba(99,102,241,0.60)", line: "rgba(99,102,241,0.7)", text: "#818cf8" },
  { bg: "rgba(167,139,250,0.45)", border: "rgba(167,139,250,0.60)", line: "rgba(167,139,250,0.7)", text: "#a78bfa" },
  { bg: "rgba(251,191,36,0.45)", border: "rgba(251,191,36,0.60)", line: "rgba(251,191,36,0.7)", text: "#fbbf24" },
  { bg: "rgba(251,113,133,0.45)", border: "rgba(251,113,133,0.60)", line: "rgba(251,113,133,0.7)", text: "#fb7185" },
  { bg: "rgba(52,211,153,0.45)", border: "rgba(52,211,153,0.60)", line: "rgba(52,211,153,0.7)", text: "#34d399" },
  { bg: "rgba(56,189,248,0.45)", border: "rgba(56,189,248,0.60)", line: "rgba(56,189,248,0.7)", text: "#38bdf8" },
];

const ROOT_COLOUR: BranchColour = {
  bg: "rgba(99,102,241,0.45)",
  border: "rgba(99,102,241,0.65)",
  line: "rgba(99,102,241,0.7)",
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

/* ─── Layout engine — balanced left/right mind map (zero overlap) ─────────── */

const H_STEP = 240;          // horizontal gap between levels
const V_PER_LEAF = 80;       // vertical space per leaf node
const V_BRANCH_GAP = 55;     // extra gap between L1 branches on the same side

function getLabel(n: MindmapNode): string {
  return (n as any).label || (n as any).title || "";
}

function countLeaves(node: MindmapNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

function getDescendantIds(node: MindmapNode): string[] {
  const ids: string[] = [];
  for (const child of node.children || []) {
    if (child.id) ids.push(child.id);
    ids.push(...getDescendantIds(child));
  }
  return ids;
}

/**
 * Classic mind-map layout:
 *   Root centred. Even branches go RIGHT, odd branches go LEFT.
 *   Each side vertically allocates space proportional to leaf count
 *   so nothing ever overlaps.
 */
function layoutTree(root: MindmapNode, centreX: number, centreY: number): NodeLayout[] {
  const result: NodeLayout[] = [];

  // Root
  result.push({
    id: root.id || "root", node: root, x: centreX, y: centreY,
    depth: 0, parentId: null, colour: ROOT_COLOUR,
  });

  if (!root.children || root.children.length === 0) return result;

  // Split branches into left and right sides
  const rightBranches: { child: MindmapNode; idx: number }[] = [];
  const leftBranches:  { child: MindmapNode; idx: number }[] = [];
  root.children.forEach((child, i) => {
    if (i % 2 === 0) rightBranches.push({ child, idx: i });
    else leftBranches.push({ child, idx: i });
  });

  /**
   * Lay out a subtree vertically within allocated space.
   * direction: 1 = right, -1 = left
   */
  function layoutSubtree(
    node: MindmapNode,
    parentId: string,
    depth: number,
    x: number,
    yStart: number,
    allocatedHeight: number,
    colour: BranchColour,
    direction: number,
  ) {
    const nodeY = yStart + allocatedHeight / 2;

    result.push({
      id: node.id || `d${depth}_${parentId}`,
      node, x, y: nodeY, depth, parentId, colour,
    });

    if (!node.children || node.children.length === 0) return;

    const kids = node.children;
    const kidLeafCounts = kids.map(c => countLeaves(c));
    const totalKidLeaves = kidLeafCounts.reduce((a, b) => a + b, 0);
    const nextX = x + direction * H_STEP;
    let childY = yStart;

    kids.forEach((child, j) => {
      const childHeight = (kidLeafCounts[j] / totalKidLeaves) * allocatedHeight;
      layoutSubtree(
        child,
        node.id || `d${depth}_${parentId}`,
        depth + 1,
        nextX,
        childY,
        childHeight,
        colour,
        direction,
      );
      childY += childHeight;
    });
  }

  function layoutSide(
    branches: { child: MindmapNode; idx: number }[],
    direction: number, // 1 = right, -1 = left
  ) {
    if (branches.length === 0) return;

    const leafCounts = branches.map(b => countLeaves(b.child));
    const totalLeaves = leafCounts.reduce((a, b) => a + b, 0);
    const totalHeight = totalLeaves * V_PER_LEAF + (branches.length - 1) * V_BRANCH_GAP;
    let yPos = centreY - totalHeight / 2;

    branches.forEach((b, i) => {
      const colour = BRANCH_PALETTES[b.idx % BRANCH_PALETTES.length];
      const branchHeight = leafCounts[i] * V_PER_LEAF;

      layoutSubtree(
        b.child,
        root.id || "root",
        1,
        centreX + direction * H_STEP,
        yPos,
        branchHeight,
        colour,
        direction,
      );
      yPos += branchHeight + V_BRANCH_GAP;
    });
  }

  layoutSide(rightBranches, 1);
  layoutSide(leftBranches, -1);

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
      strokeWidth={3}
      strokeLinecap="round"
      opacity={0.85}
    />
  );
};

/* ─── Node sizes by depth — strong visual hierarchy ──────────────────────── */

const NODE_STYLES: Record<number, { minW: number; fontSize: number; pad: number; fontWeight: number }> = {
  0: { minW: 180, fontSize: 18, pad: 22, fontWeight: 700 },  // Root — biggest, bold
  1: { minW: 140, fontSize: 14, pad: 16, fontWeight: 600 },  // Branch — prominent (2x sub-leaf)
  2: { minW: 100, fontSize: 11, pad: 12, fontWeight: 500 },  // Leaf — medium
  3: { minW: 70,  fontSize: 10, pad: 8,  fontWeight: 400 },  // Sub-leaf — smallest
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
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Load saved drag offsets from localStorage
  const [dragOffsets, setDragOffsets] = useState<Record<string, { dx: number; dy: number }>>(() => {
    try {
      const saved = localStorage.getItem(`mindmap-offsets-${boardId}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [undoStack, setUndoStack] = useState<Record<string, { dx: number; dy: number }>[]>([]);

  // Auto-save dragOffsets to localStorage (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(`mindmap-offsets-${boardId}`, JSON.stringify(dragOffsets));
      } catch { /* storage full — ignore */ }
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [dragOffsets, boardId]);

  // Pan & zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [focusBranchIdx, setFocusBranchIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pendingFocusId = useRef<string | null>(null);
  const draggingNode = useRef<{ id: string; startX: number; startY: number; startOffsets: Record<string, {dx:number;dy:number}>; descIds: string[] } | null>(null);
  const rafId = useRef<number | null>(null);

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

  const svgW = bounds.maxX - bounds.minX;
  const svgH = bounds.maxY - bounds.minY;

  // Auto-centre on first render
  const hasCentred = useRef(false);
  useEffect(() => {
    if (hasCentred.current) return;
    const el = containerRef.current;
    if (!el || svgW <= 0) return;
    const cW = el.clientWidth;
    const cH = el.clientHeight;
    const pad = 60;
    const fitZoom = Math.min((cW - pad * 2) / svgW, (cH - pad * 2) / svgH, 1.0);
    const z = Math.max(0.25, Math.min(fitZoom, 1.2));
    setZoom(z);
    setPan({ x: (cW - svgW * z) / 2, y: (cH - svgH * z) / 2 });
    hasCentred.current = true;
  }, [svgW, svgH]);

  // Auto-focus newly added node: pan to it and start editing
  useEffect(() => {
    const targetId = pendingFocusId.current;
    if (!targetId) return;
    const nl = allNodes.find(n => n.id === targetId);
    if (!nl) return;
    pendingFocusId.current = null;

    const cW = containerRef.current?.clientWidth || 400;
    const cH = containerRef.current?.clientHeight || 400;
    const px = nl.x + (dragOffsets[nl.id]?.dx || 0) - bounds.minX;
    const py = nl.y + (dragOffsets[nl.id]?.dy || 0) - bounds.minY;
    const z = Math.max(zoom, 0.8);
    setZoom(z);
    setPan({ x: cW / 2 - px * z, y: cH / 2 - py * z });
    setSelectedNode(targetId);
    startEdit(targetId, "New idea");
  }, [allNodes]);

  // Toggle collapse
  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Start editing — clear placeholder text for empty/new nodes
  const startEdit = (id: string, label: string) => {
    setEditing(id);
    setEditText(!label || label === "New idea" ? "" : label);
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
    const newId = `new_${Date.now()}`;
    const newRoot = addChildNode(root, parentId, "New idea", newId);
    const assigned = assignIds(newRoot);
    setRoot(assigned);
    onUpdate?.(newRoot);
    // Schedule focus on the new node after layout recalculates
    pendingFocusId.current = newId;
  };

  // Delete node
  const deleteNode = (nodeId: string) => {
    const newRoot = removeNode(root, nodeId);
    if (newRoot) {
      setRoot(assignIds(newRoot));
      onUpdate?.(newRoot);
    }
  };

  // Pan & drag handlers — all at container level (Miro-style)
  const DRAG_THRESHOLD = 3; // px minimum before a drag starts

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;

    const nodeEl = target.closest("[data-node]") as HTMLElement | null;
    if (nodeEl) {
      const nodeId = nodeEl.getAttribute("data-node-id");
      if (!nodeId) return;
      const nl = visibleNodes.find(n => n.id === nodeId);
      if (!nl) return;
      // Store potential drag start — actual drag begins after threshold
      draggingNode.current = {
        id: nodeId,
        startX: e.clientX,
        startY: e.clientY,
        startOffsets: { ...dragOffsets },
        descIds: getDescendantIds(nl.node),
      };
      return;
    }

    // Canvas pan
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setSelectedNode(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Node drag
    const dn = draggingNode.current;
    if (dn) {
      const rawDx = e.clientX - dn.startX;
      const rawDy = e.clientY - dn.startY;
      // Ignore micro-movements (tap vs drag)
      if (Math.abs(rawDx) < DRAG_THRESHOLD && Math.abs(rawDy) < DRAG_THRESHOLD) return;
      const dx = rawDx / zoom;
      const dy = rawDy / zoom;
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        // Safety: check draggingNode still valid
        if (!draggingNode.current) { rafId.current = null; return; }
        const prev = draggingNode.current.startOffsets;
        const next = { ...prev };
        next[dn.id] = { dx: (prev[dn.id]?.dx || 0) + dx, dy: (prev[dn.id]?.dy || 0) + dy };
        for (const cid of dn.descIds) {
          next[cid] = { dx: (prev[cid]?.dx || 0) + dx, dy: (prev[cid]?.dy || 0) + dy };
        }
        setDragOffsets(next);
        rafId.current = null;
      });
      return;
    }

    // Canvas pan
    if (!isPanning.current) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  };

  const handlePointerUp = () => {
    if (draggingNode.current) {
      // Only push undo if we actually moved
      const dn = draggingNode.current;
      const cur = dragOffsets[dn.id];
      const orig = dn.startOffsets[dn.id];
      if (cur && orig && (cur.dx !== orig.dx || cur.dy !== orig.dy)) {
        setUndoStack(prev => [...prev.slice(-19), dn.startOffsets]);
      }
      draggingNode.current = null;
      if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = null; }
    }
    isPanning.current = false;
  };

  // Pinch-to-zoom tracking
  const lastPinchDist = useRef<number | null>(null);

  // Wheel zoom — centers on viewport
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newZoom = Math.max(0.3, Math.min(2, zoom - e.deltaY * 0.001));
    const cW = containerRef.current?.clientWidth || 400;
    const cH = containerRef.current?.clientHeight || 400;
    const cx = (cW / 2 - pan.x) / zoom;
    const cy = (cH / 2 - pan.y) / zoom;
    setZoom(newZoom);
    setPan({ x: cW / 2 - cx * newZoom, y: cH / 2 - cy * newZoom });
  };

  // Touch pinch-to-zoom
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) { lastPinchDist.current = null; return; }
    const t1 = e.touches[0], t2 = e.touches[1];
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    if (lastPinchDist.current !== null) {
      const scale = dist / lastPinchDist.current;
      const newZoom = Math.max(0.3, Math.min(2, zoom * scale));
      const cW = containerRef.current?.clientWidth || 400;
      const cH = containerRef.current?.clientHeight || 400;
      // Pinch midpoint in screen space
      const mx = (t1.clientX + t2.clientX) / 2;
      const my = (t1.clientY + t2.clientY) / 2;
      const rect = containerRef.current?.getBoundingClientRect();
      const sx = mx - (rect?.left || 0);
      const sy = my - (rect?.top || 0);
      // Content point under the pinch midpoint
      const cx = (sx - pan.x) / zoom;
      const cy = (sy - pan.y) / zoom;
      setZoom(newZoom);
      setPan({ x: sx - cx * newZoom, y: sy - cy * newZoom });
    }
    lastPinchDist.current = dist;
  }, [zoom, pan]);

  const handleTouchEnd = () => { lastPinchDist.current = null; };


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
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Zoom & navigation controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        {/* Undo button — only shown when there's history */}
        {undoStack.length > 0 && (
          <button
            onClick={() => {
              setUndoStack(prev => {
                const next = [...prev];
                const last = next.pop();
                if (last) setDragOffsets(last);
                return next;
              });
            }}
            className="w-8 h-8 rounded-lg glass flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors"
            title="Undo"
          ><Undo2 size={14} /></button>
        )}
        <button
          onClick={() => {
            const newZoom = Math.min(2, zoom + 0.15);
            const cW = containerRef.current?.clientWidth || 400;
            const cH = containerRef.current?.clientHeight || 400;

            if (selectedNode) {
              const nl = visibleNodes.find(n => n.id === selectedNode);
              if (nl) {
                const px = nl.x + (dragOffsets[nl.id]?.dx || 0) - bounds.minX;
                const py = nl.y + (dragOffsets[nl.id]?.dy || 0) - bounds.minY;
                setZoom(newZoom);
                setPan({ x: cW / 2 - px * newZoom, y: cH / 2 - py * newZoom });
                return;
              }
            }
            // No selection: zoom toward current viewport center
            const cx = (cW / 2 - pan.x) / zoom;
            const cy = (cH / 2 - pan.y) / zoom;
            setZoom(newZoom);
            setPan({ x: cW / 2 - cx * newZoom, y: cH / 2 - cy * newZoom });
          }}
          className="w-8 h-8 rounded-lg glass flex items-center justify-center text-foreground/60 text-sm font-bold hover:text-foreground transition-colors"
          title="Zoom in"
        >+</button>
        <button
          onClick={() => {
            const newZoom = Math.max(0.3, zoom - 0.15);
            const cW = containerRef.current?.clientWidth || 400;
            const cH = containerRef.current?.clientHeight || 400;
            // Zoom out from current viewport center
            const cx = (cW / 2 - pan.x) / zoom;
            const cy = (cH / 2 - pan.y) / zoom;
            setZoom(newZoom);
            setPan({ x: cW / 2 - cx * newZoom, y: cH / 2 - cy * newZoom });
          }}
          className="w-8 h-8 rounded-lg glass flex items-center justify-center text-foreground/60 text-sm font-bold hover:text-foreground transition-colors"
          title="Zoom out"
        >−</button>
        <button
          onClick={() => {
            // Focus next L1 branch — zoom in and centre it
            const branches = allNodes.filter(n => n.depth === 1);
            if (branches.length === 0) return;
            const nextIdx = (focusBranchIdx + 1) % branches.length;
            setFocusBranchIdx(nextIdx);

            // Get the L1 node position in content-space (relative to bounds)
            const b = branches[nextIdx];
            const px = b.x + (dragOffsets[b.id]?.dx || 0) - bounds.minX;
            const py = b.y + (dragOffsets[b.id]?.dy || 0) - bounds.minY;

            const cW = containerRef.current?.clientWidth || 400;
            const cH = containerRef.current?.clientHeight || 400;
            const z = 1.1;
            // With transformOrigin: 0 0 → pan = screenCentre − contentPoint × zoom
            setZoom(z);
            setPan({ x: cW / 2 - px * z, y: cH / 2 - py * z });
          }}
          className="w-8 h-8 rounded-lg glass flex items-center justify-center text-foreground/60 text-xs hover:text-foreground transition-colors"
          title="Focus next branch"
        >🔍</button>
        <button
          onClick={() => {
            // Fit all & centre
            const cW = containerRef.current?.clientWidth || 400;
            const cH = containerRef.current?.clientHeight || 400;
            const pad = 40;
            const z = Math.max(0.2, Math.min(
              (cW - pad * 2) / Math.max(svgW, 1),
              (cH - pad * 2) / Math.max(svgH, 1),
              1.0
            ));
            setZoom(z);
            setPan({ x: (cW - svgW * z) / 2, y: (cH - svgH * z) / 2 });
            setFocusBranchIdx(-1);
          }}
          className="w-8 h-8 rounded-lg glass flex items-center justify-center text-foreground/60 text-xs hover:text-foreground transition-colors"
          title="Fit all & centre"
        >⊡</button>
      </div>

      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          width: svgW,
          height: svgH,
          position: "absolute",
          left: 0,
          top: 0,
          willChange: "transform",
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
          {connections.map(({ from, to }) => {
            const fromStyle = NODE_STYLES[from.depth] || NODE_STYLES[3];
            const toStyle = NODE_STYLES[to.depth] || NODE_STYLES[3];
            const fx = from.x + (dragOffsets[from.id]?.dx || 0);
            const fy = from.y + (dragOffsets[from.id]?.dy || 0);
            const tx = to.x + (dragOffsets[to.id]?.dx || 0);
            const ty = to.y + (dragOffsets[to.id]?.dy || 0);
            // Offset to node edges: connect from right/left edge of parent to left/right edge of child
            const dir = tx > fx ? 1 : -1;
            const x1 = fx + dir * (fromStyle.minW / 2);
            const x2 = tx - dir * (toStyle.minW / 2);
            return (
              <ConnectionLine
                key={`${from.id}-${to.id}`}
                x1={x1}
                y1={fy}
                x2={x2}
                y2={ty}
                colour={to.colour.line}
              />
            );
          })}
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
              data-node-id={nl.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: nl.depth * 0.06, type: "spring", stiffness: 300, damping: 25 }}
              className="absolute flex items-center gap-1 cursor-grab active:cursor-grabbing"
              style={{
                left: nl.x + ox - bounds.minX - style.minW / 2,
                top: nl.y + oy - bounds.minY - 18,
                zIndex: nl.depth === 0 ? 10 : 5 - nl.depth,
                willChange: "transform",
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
                  maxWidth: nl.depth === 0 ? 220 : nl.depth === 1 ? 200 : nl.depth === 2 ? 140 : 110,
                }}
                onDoubleClick={() => startEdit(nl.id, label)}
                onClick={() => setSelectedNode(prev => prev === nl.id ? null : nl.id)}
              >
                {isEditing ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => e.key === "Enter" && commitEdit()}
                    placeholder="Type here..."
                    className="w-full bg-transparent outline-none text-foreground text-center placeholder:text-foreground/30"
                    style={{ fontSize: style.fontSize, fontWeight: style.fontWeight }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <p
                    className={`text-center leading-snug ${!label || label === 'New idea' ? 'text-foreground/30 italic' : 'text-foreground'}`}
                    style={{ fontSize: style.fontSize, fontWeight: style.fontWeight }}
                  >
                    {!label || label === 'New idea' ? 'Type here...' : label}
                  </p>
                )}
              </div>
              {/* Action buttons — compact vertical stack, only on selected node */}
              {selectedNode === nl.id && !isEditing && nl.depth > 0 && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  {/* Collapse — branch colour, ▾/▸ */}
                  {hasChildren && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCollapse(nl.id); }}
                      className="w-2.5 h-3 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                      style={{ backgroundColor: nl.colour.border }}
                      title={isCollapsed ? "Expand" : "Collapse"}
                    >
                      <span className="text-white text-[8px] font-bold leading-none">{isCollapsed ? "▸" : "▾"}</span>
                    </button>
                  )}
                  {/* Add child — green + */}
                  {nl.depth < 3 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); addChild(nl.id); }}
                      className="w-2.5 h-3 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                      style={{ backgroundColor: "rgba(34,197,94,0.7)" }}
                      title="Add child"
                    >
                      <Plus size={8} className="text-white" />
                    </button>
                  )}
                  {/* Delete — red × */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNode(nl.id); }}
                    className="w-2.5 h-3 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    style={{ backgroundColor: "rgba(239,68,68,0.7)" }}
                    title="Delete"
                  >
                    <X size={8} className="text-white" />
                  </button>
                </div>
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

function addChildNode(node: MindmapNode, parentId: string, label: string, newId?: string): MindmapNode {
  if (node.id === parentId) {
    return {
      ...node,
      children: [...(node.children || []), { label, id: newId || `new_${Date.now()}` }],
    };
  }
  if (!node.children) return node;
  return { ...node, children: node.children.map(c => addChildNode(c, parentId, label, newId)) };
}

function removeNode(node: MindmapNode, targetId: string): MindmapNode | null {
  if (node.id === targetId) return null;
  if (!node.children) return node;
  const filtered = node.children
    .map(c => removeNode(c, targetId))
    .filter((c): c is MindmapNode => c !== null);
  return { ...node, children: filtered };
}

export default MindMapView;
