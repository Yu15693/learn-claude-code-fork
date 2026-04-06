"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSteppedVisualization } from "@/hooks/useSteppedVisualization";
import { StepControls } from "@/components/visualizations/shared/step-controls";

type NodeId = "user" | "agent" | "tool";

interface DiagramNode {
  id: NodeId;
  label: string;
  x: number;
  y: number;
  color: string;
}

interface DiagramEdge {
  from: NodeId;
  to: NodeId;
  kind: "forward" | "return";
}

interface StepBadge {
  key: string;
  text: string;
  fromX: number;
  toX: number;
  y: number;
  color: string;
}

interface StepState {
  title: string;
  description: string;
  activeNodes: NodeId[];
  activeEdges: string[];
  badge: StepBadge | null;
}

const NODE_RADIUS = 28;
const RETURN_EDGE_Y_OFFSET = 34;
const BADGE_WIDTH = 56;
const BADGE_HEIGHT = 20;

// 1) 先定义“静态底图”。
// 这些坐标不跟动画耦合，动画只是让这些静态元素在不同 step 下变化。
const NODES: DiagramNode[] = [
  { id: "user", label: "User", x: 90, y: 120, color: "#3b82f6" },
  { id: "agent", label: "Agent", x: 250, y: 120, color: "#8b5cf6" },
  { id: "tool", label: "Tool", x: 410, y: 120, color: "#10b981" },
];

const EDGES: DiagramEdge[] = [
  { from: "user", to: "agent", kind: "forward" },
  { from: "agent", to: "tool", kind: "forward" },
  { from: "tool", to: "agent", kind: "return" },
];

// 2) 再定义“分镜脚本”。
// 每个 step 只描述当前该亮哪些节点/边，以及要不要显示一个移动中的消息块。
const STEPS: StepState[] = [
  {
    title: "Static Layout",
    description: "先把图的静态结构画出来。动画前，节点和连线的位置要先稳定。",
    activeNodes: [],
    activeEdges: [],
    badge: null,
  },
  {
    title: "User To Agent",
    description: "第一步只强调一条路径：用户消息进入 agent。",
    activeNodes: ["user", "agent"],
    activeEdges: ["user->agent"],
    badge: {
      key: "prompt",
      text: "prompt",
      fromX: 90,
      toX: 250,
      y: 78,
      color: "#3b82f6",
    },
  },
  {
    title: "Agent To Tool",
    description: "第二步切到 tool call。底图不变，只切换高亮状态和移动标签。",
    activeNodes: ["agent", "tool"],
    activeEdges: ["agent->tool"],
    badge: {
      key: "tool_call",
      text: "tool_call",
      fromX: 250,
      toX: 410,
      y: 78,
      color: "#8b5cf6",
    },
  },
  {
    title: "Tool Result Back",
    description: "第三步展示返回流。很多 Hero 动画的本质就是这种分镜切换。",
    activeNodes: ["agent", "tool"],
    activeEdges: ["tool->agent"],
    badge: {
      key: "tool_result",
      text: "tool_result",
      fromX: 410,
      toX: 250,
      y: 162,
      color: "#10b981",
    },
  },
];

function isEdgeActive(
  from: NodeId,
  to: NodeId,
  activeEdges: string[]
): boolean {
  return activeEdges.includes(`${from}->${to}`);
}

function getNode(id: NodeId): DiagramNode {
  return NODES.find((node) => node.id === id)!;
}

function getEdgeLine(edge: DiagramEdge): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  const from = getNode(edge.from);
  const to = getNode(edge.to);

  // 前向边按节点中心连线方向，向两端各缩进一个半径，
  // 这样线段会接到节点边缘，而不是被圆节点盖住。
  if (edge.kind === "forward") {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / distance;
    const uy = dy / distance;

    return {
      x1: from.x + ux * NODE_RADIUS,
      y1: from.y + uy * NODE_RADIUS,
      x2: to.x - ux * NODE_RADIUS,
      y2: to.y - uy * NODE_RADIUS,
    };
  }

  // 返回边单独下移，避免和上面的主流程边重叠。
  return {
    x1: from.x - NODE_RADIUS + 2,
    y1: from.y + RETURN_EDGE_Y_OFFSET,
    x2: to.x + NODE_RADIUS - 2,
    y2: to.y + RETURN_EDGE_Y_OFFSET,
  };
}

export default function MinimalHeroExample({ title }: { title?: string }) {
  const {
    currentStep,
    totalSteps,
    next,
    prev,
    reset,
    isPlaying,
    toggleAutoPlay,
  } = useSteppedVisualization({
    totalSteps: STEPS.length,
    autoPlayInterval: 1800,
  });

  // 3) 当前真正驱动 UI 的只有一个状态：currentStep。
  // 其余视觉表现都从当前 step 派生出来。
  const step = STEPS[currentStep];

  return (
    <section className="min-h-[420px] space-y-4">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {title || "Minimal SVG + Motion Demo"}
      </h2>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-6 dark:border-zinc-800 dark:bg-zinc-950">
          <svg viewBox="0 0 500 220" className="w-full">
            <defs>
              {/*
                marker = 给线段末端复用的小图形，这里用来画箭头。

                可以把它理解成一张“小贴纸”：
                - viewBox 定义这张贴纸内部自己的坐标系
                - refX / refY 定义“贴纸里的哪个点”要对准线段终点

                这里 viewBox="0 0 10 10"，表示 marker 内部坐标范围是 0..10。
                下面 path 画的是一个向右的三角形：
                - 左上:  (0, 0)
                - 尖端:  (10, 5)
                - 左下:  (0, 10)

                refY="5" 表示用垂直中线去对齐线段，箭头不会偏上或偏下。
                refX="9" 表示用一个“靠近箭头尖端”的点去对齐线段终点，
                所以视觉上就像箭头尖端挂在线尾。
              */}
              <marker
                id="minimal-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
              <marker
                id="minimal-arrow-active"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f172a" />
              </marker>
            </defs>

            {/* 4) 边仍然是静态底图的一部分，但坐标现在从节点位置推导。 */}
            {EDGES.map((edge) => {
              const active = isEdgeActive(edge.from, edge.to, step.activeEdges);
              const line = getEdgeLine(edge);
              const inactiveStroke =
                edge.kind === "return" ? "#cbd5e1" : "#94a3b8";
              const stroke = active ? "#0f172a" : inactiveStroke;
              const strokeWidth = active ? 3 : 1.5;

              return (
                <motion.line
                  key={`${edge.from}->${edge.to}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={edge.kind === "return" ? "6 4" : undefined}
                  markerEnd={
                    active
                      ? "url(#minimal-arrow-active)"
                      : "url(#minimal-arrow)"
                  }
                  animate={{
                    stroke,
                    strokeWidth,
                  }}
                  transition={{ duration: 0.25 }}
                />
              );
            })}

            {NODES.map((node) => {
              const active = step.activeNodes.includes(node.id);

              return (
                <g key={node.id}>
                  {/* 节点高亮的本质也是状态切换，不是复杂时间轴。 */}
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={NODE_RADIUS}
                    animate={{
                      scale: active ? 1.08 : 1,
                      fill: active ? node.color : "#f8fafc",
                      stroke: active ? node.color : "#cbd5e1",
                    }}
                    initial={false}
                    transition={{ duration: 0.25 }}
                    strokeWidth={2}
                  />
                  <motion.text
                    x={node.x}
                    y={node.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight="700"
                    animate={{
                      fill: active ? "#ffffff" : "#334155",
                    }}
                    initial={false}
                    transition={{ duration: 0.25 }}
                  >
                    {node.label}
                  </motion.text>
                </g>
              );
            })}

            {/*
              AnimatePresence 的作用是“接管卸载时机”，让元素在真正从 DOM 消失前先跑 exit 动画。

              它并不限制里面只能有一个 motion 元素；
              这里只会看到一个 badge，原因是当前数据模型里 step.badge 本来就只有一个对象。

              mode="wait" 的效果是：
              - 先让旧 badge 跑完 exit
              - 再让新 badge 执行 initial -> animate

              所以切 step 时你会看到“前一个先消失，后一个再出现”，
              而不是两个 badge 同时重叠交接。
            */}
            <AnimatePresence mode="wait">
              {step.badge && (
                // 这个 badge 就是最小的“消息飞行”示例：
                // 用一个 motion.g 在两个坐标之间移动即可。
                //
                // 这里 key 很重要：
                // key 变化后，React 会把它当成“旧元素卸载，新元素挂载”。
                // AnimatePresence 正是利用这个时机去播放 exit / enter 动画。
                <motion.g
                  key={step.badge.key}
                  initial={{
                    opacity: 0,
                    x: step.badge.fromX - BADGE_WIDTH / 2,
                    y: step.badge.y,
                  }}
                  animate={{
                    opacity: 1,
                    x: step.badge.toX - BADGE_WIDTH / 2,
                    y: step.badge.y,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                >
                  <rect
                    width={BADGE_WIDTH}
                    height={BADGE_HEIGHT}
                    rx="5"
                    fill={step.badge.color}
                  />
                  <text
                    x={BADGE_WIDTH / 2}
                    y={13}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="700"
                    fill="#ffffff"
                  >
                    {step.badge.text}
                  </text>
                </motion.g>
              )}
            </AnimatePresence>
          </svg>
        </div>

        <div className="mt-4">
          <StepControls
            currentStep={currentStep}
            totalSteps={totalSteps}
            onPrev={prev}
            onNext={next}
            onReset={reset}
            isPlaying={isPlaying}
            onToggleAutoPlay={toggleAutoPlay}
            stepTitle={step.title}
            stepDescription={step.description}
          />
        </div>
      </div>
    </section>
  );
}
