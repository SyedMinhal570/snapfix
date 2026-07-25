"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Tool = "pen" | "rect";

type Point = { x: number; y: number };

type PenStroke = {
  type: "pen";
  color: string;
  points: Point[];
};

type RectStroke = {
  type: "rect";
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Stroke = PenStroke | RectStroke;

const COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Yellow", value: "#eab308" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Black", value: "#171717" },
] as const;

export type AnnotationCanvasHandle = {
  exportPng: () => Promise<Blob | null>;
};

type Props = {
  file: File;
};

const AnnotationCanvas = forwardRef<AnnotationCanvasHandle, Props>(
  function AnnotationCanvas({ file }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const drawingRef = useRef(false);
    const startRef = useRef<Point | null>(null);
    const currentRef = useRef<Stroke | null>(null);

    const [tool, setTool] = useState<Tool>("pen");
    const [color, setColor] = useState<string>(COLORS[0].value);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [ready, setReady] = useState(false);

    const toolRef = useRef(tool);
    const colorRef = useRef(color);
    const strokesRef = useRef(strokes);
    toolRef.current = tool;
    colorRef.current = color;
    strokesRef.current = strokes;

    const drawStroke = useCallback(
      (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (stroke.type === "pen") {
          if (stroke.points.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          ctx.stroke();
          return;
        }

        ctx.strokeRect(stroke.x, stroke.y, stroke.w, stroke.h);
      },
      [],
    );

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      if (!canvas || !img) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      for (const stroke of strokesRef.current) {
        drawStroke(ctx, stroke);
      }
      if (currentRef.current) {
        drawStroke(ctx, currentRef.current);
      }
    }, [drawStroke]);

    useEffect(() => {
      setReady(false);
      setStrokes([]);
      currentRef.current = null;

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        setReady(true);
        // redraw after state settles via effect below
        requestAnimationFrame(() => {
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        });
      };
      img.src = url;

      return () => {
        URL.revokeObjectURL(url);
        imageRef.current = null;
      };
    }, [file]);

    useEffect(() => {
      if (ready) redraw();
    }, [ready, strokes, redraw]);

    useImperativeHandle(ref, () => ({
      exportPng: () =>
        new Promise((resolve) => {
          const canvas = canvasRef.current;
          if (!canvas) {
            resolve(null);
            return;
          }
          canvas.toBlob((blob) => resolve(blob), "image/png");
        }),
    }));

    function getPoint(e: ReactPointerEvent<HTMLCanvasElement>): Point {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      };
    }

    function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
      if (!ready) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      const point = getPoint(e);
      startRef.current = point;

      if (toolRef.current === "pen") {
        currentRef.current = {
          type: "pen",
          color: colorRef.current,
          points: [point],
        };
      } else {
        currentRef.current = {
          type: "rect",
          color: colorRef.current,
          x: point.x,
          y: point.y,
          w: 0,
          h: 0,
        };
      }
      redraw();
    }

    function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
      if (!drawingRef.current || !currentRef.current) return;
      const point = getPoint(e);

      if (currentRef.current.type === "pen") {
        currentRef.current = {
          ...currentRef.current,
          points: [...currentRef.current.points, point],
        };
      } else if (startRef.current) {
        const start = startRef.current;
        currentRef.current = {
          type: "rect",
          color: currentRef.current.color,
          x: Math.min(start.x, point.x),
          y: Math.min(start.y, point.y),
          w: Math.abs(point.x - start.x),
          h: Math.abs(point.y - start.y),
        };
      }
      redraw();
    }

    function handlePointerUp() {
      if (!drawingRef.current) return;
      drawingRef.current = false;

      const finished = currentRef.current;
      currentRef.current = null;
      startRef.current = null;

      if (!finished) return;
      if (finished.type === "pen" && finished.points.length < 2) return;
      if (finished.type === "rect" && (finished.w < 2 || finished.h < 2)) return;

      setStrokes((prev) => [...prev, finished]);
    }

    function handleUndo() {
      setStrokes((prev) => prev.slice(0, -1));
    }

    function handleClear() {
      setStrokes([]);
      currentRef.current = null;
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTool("pen")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tool === "pen"
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Pen
          </button>
          <button
            type="button"
            onClick={() => setTool("rect")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tool === "rect"
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Rectangle
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
          >
            Clear
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.name}
                aria-label={c.name}
                onClick={() => setColor(c.value)}
                className={`h-7 w-7 rounded-full border-2 ${
                  color === c.value ? "border-zinc-900" : "border-transparent"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="block max-w-full touch-none"
            style={{ maxWidth: 600, width: "100%", height: "auto" }}
          />
        </div>
      </div>
    );
  },
);

export default AnnotationCanvas;
