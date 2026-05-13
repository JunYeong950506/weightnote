/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

const STORAGE_KEY = "wt_records_v3";
const PICKER_MIN = 30;
const PICKER_MAX = 200;
const PICKER_DECIMALS = Array.from({ length: 10 }, (_, i) => i).reverse();
const PICKER_INTEGERS = Array.from({ length: PICKER_MAX - PICKER_MIN + 1 }, (_, i) => PICKER_MIN + i).reverse();
const PICKER_ITEM_HEIGHT = 50;
const PICKER_VISIBLE_ROWS = 5;
const PICKER_EDGE_ROWS = Math.floor(PICKER_VISIBLE_ROWS / 2);
const MOVING_AVERAGE_COLOR = "#ff8fb3";

const seed: any[] = [];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtShort(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtKo(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function fmtFull(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDecimal(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(1) : "—";
}

function fmtSignedDecimal(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function clampWeight(value: string | number | null) {
  if (value === "" || value === null || Number.isNaN(Number(value))) return "";
  const clamped = Math.min(PICKER_MAX + 0.9, Math.max(PICKER_MIN, Number(value)));
  return clamped.toFixed(1);
}

function weightToParts(value: string | number | null) {
  const normalized = clampWeight(value);
  if (!normalized) return { integer: 70, decimal: 0 };
  const [integer, decimal] = normalized.split(".");
  return { integer: Number(integer), decimal: Number(decimal) };
}

function latestWeightString(records: any[]) {
  const latestRecord = [...records].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return latestRecord ? clampWeight(latestRecord.weight) : "70.0";
}

const CustomDot = (props: any) => {
  const { cx, cy, payload, latest } = props;
  if (payload.date === latest) {
    return <circle cx={cx} cy={cy} r={5} fill="#0fbcc9" stroke="#ffffff" strokeWidth={2} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill="#e6f7f8" stroke="#0fbcc9" strokeWidth={1.4} />;
};

const ChartTooltip = ({ active, payload }: { active?: any; payload?: any[] }) => {
  if (!active || !payload?.length) return null;
  const weightPayload = payload.find((item) => item.dataKey === "weight");
  const movingAveragePayload = payload.find((item) => item.dataKey === "movingAverage");
  return (
    <div style={{ background: "#ffffff", border: "1px solid rgba(15,188,201,0.15)", borderRadius: 14, padding: "10px 16px", boxShadow: "0 12px 32px rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: 13, color: "#666666", marginBottom: 4, fontWeight: 500 }}>{fmtKo(payload[0].payload.date)}</div>
      {weightPayload && (
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Manrope','Pretendard',sans-serif", color: "#0fbcc9" }}>
          {weightPayload.value}<span style={{ fontSize: 14, color: "#666666", marginLeft: 4, fontWeight: 500 }}>kg</span>
        </div>
      )}
      {movingAveragePayload && (
        <div style={{ fontSize: 13, color: MOVING_AVERAGE_COLOR, marginTop: 4, fontWeight: 700 }}>
          7일 이동평균 {movingAveragePayload.value}kg
        </div>
      )}
    </div>
  );
};

interface WheelPickerProps {
  items: number[];
  value: number;
  onChange: (val: number) => void;
  format: (item: number) => string;
  width: number | string;
  ariaLabel: string;
}

function WheelPicker({ items, value, onChange, format, width, ariaLabel }: WheelPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const userScrollRef = useRef(false);
  const scrollTimerRef = useRef<any>(null);
  const programmaticTimerRef = useRef<any>(null);
  const isProgrammaticScrollRef = useRef(false);
  const didInitRef = useRef(false);
  const [previewValue, setPreviewValue] = useState(value);

  function resolveNearest(scrollTop: number) {
    const maxTop = (items.length - 1) * PICKER_ITEM_HEIGHT;
    const boundedTop = Math.max(0, Math.min(maxTop, scrollTop));
    const index = Math.max(
      0,
      Math.min(items.length - 1, Math.round(boundedTop / PICKER_ITEM_HEIGHT))
    );
    return { index, nextValue: items[index] };
  }

  function commitValue({ snap = true } = {}) {
    const el = pickerRef.current;
    if (!el) return;
    const { index, nextValue } = resolveNearest(el.scrollTop);
    const targetTop = index * PICKER_ITEM_HEIGHT;
    if (snap && Math.abs(el.scrollTop - targetTop) > 0.5) {
      el.scrollTo({ top: targetTop, behavior: "smooth" });
    }
    setPreviewValue(nextValue);
    if (nextValue !== value) onChange(nextValue);
  }

  useEffect(() => {
    const el = pickerRef.current;
    const index = items.indexOf(value);
    clearTimeout(scrollTimerRef.current);
    clearTimeout(programmaticTimerRef.current);
    userScrollRef.current = false;
    if (!el || index < 0) return;
    setPreviewValue(value);
    const targetTop = index * PICKER_ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - targetTop) < 1) {
      isProgrammaticScrollRef.current = false;
      return;
    }
    isProgrammaticScrollRef.current = true;
    el.scrollTo({
      top: targetTop,
      behavior: didInitRef.current ? "smooth" : "auto"
    });
    programmaticTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, didInitRef.current ? 300 : 40);
    didInitRef.current = true;
  }, [items, value]);

  useEffect(() => () => {
    clearTimeout(scrollTimerRef.current);
    clearTimeout(programmaticTimerRef.current);
  }, []);

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    if (isProgrammaticScrollRef.current) return;
    userScrollRef.current = true;
    const { nextValue } = resolveNearest(event.currentTarget.scrollTop);
    if (nextValue !== previewValue) setPreviewValue(nextValue);
    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      userScrollRef.current = false;
      commitValue();
    }, 170);
  }

  return (
    <div
      style={{
        position: "relative",
        width,
        height: PICKER_ITEM_HEIGHT * PICKER_VISIBLE_ROWS,
        borderRadius: 24,
        background: "linear-gradient(160deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.34) 45%, rgba(230,249,251,0.28) 100%)",
        border: "1px solid rgba(255,255,255,0.72)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        overflow: "hidden",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(15,188,201,0.08), 0 10px 22px rgba(15,188,201,0.12)",
      }}
    >
      <div
        className="wheel-pane"
        ref={pickerRef}
        onScroll={handleScroll}
        aria-label={ariaLabel}
        style={{
          height: "100%",
          overflowY: "auto",
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {Array.from({ length: PICKER_EDGE_ROWS }).map((_, idx) => (
          <div key={`top-${idx}`} style={{ height: PICKER_ITEM_HEIGHT, pointerEvents: "none" }} />
        ))}
        {items.map((item) => {
          const isSelected = item === previewValue;
          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                setPreviewValue(item);
                if (item !== value) onChange(item);
              }}
              style={{
                height: PICKER_ITEM_HEIGHT,
                width: "100%",
                scrollSnapAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                padding: 0,
                lineHeight: 1,
                color: isSelected ? "#0fbcc9" : "#999999",
                fontSize: isSelected ? 42 : 32,
                fontWeight: isSelected ? 700 : 500,
                fontFamily: "'Manrope','Pretendard','Noto Sans KR',sans-serif",
                cursor: "pointer",
                transition: "all 0.16s ease",
              }}
            >
              {format(item)}
            </button>
          );
        })}
        {Array.from({ length: PICKER_EDGE_ROWS }).map((_, idx) => (
          <div key={`bottom-${idx}`} style={{ height: PICKER_ITEM_HEIGHT, pointerEvents: "none" }} />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.48) 18%, rgba(255,255,255,0.03) 34%, rgba(255,255,255,0.03) 66%, rgba(255,255,255,0.48) 82%, rgba(255,255,255,0.94) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: "36%",
          pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 4,
          right: 4,
          top: "50%",
          height: PICKER_ITEM_HEIGHT,
          transform: "translateY(-50%)",
          borderTop: "2px solid rgba(15,188,201,0.66)",
          borderBottom: "2px solid rgba(15,188,201,0.66)",
          background: "linear-gradient(180deg, rgba(15,188,201,0.2) 0%, rgba(15,188,201,0.08) 100%)",
          borderRadius: 10,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.42), inset 0 -1px 0 rgba(255,255,255,0.26), 0 0 14px rgba(15,188,201,0.2)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default function App() {
  const [records, setRecords] = useState<any[]>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : seed;
    } catch {
      return seed;
    }
  });

  const initialWeightRef = useRef<string | null>(null);
  if (initialWeightRef.current === null) {
    initialWeightRef.current = latestWeightString(records);
  }

  const initialParts = weightToParts(initialWeightRef.current);

  const [tab, setTab] = useState("main");
  const [period, setPeriod] = useState("1M");
  const [inputWeight, setInputWeight] = useState(initialWeightRef.current);
  const [pickerInt, setPickerInt] = useState(initialParts.integer);
  const [pickerDec, setPickerDec] = useState(initialParts.decimal);
  const [inputDate, setInputDate] = useState(todayStr());
  const [inputMemo, setInputMemo] = useState("");
  const [showMemo, setShowMemo] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [editId, setEditId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showWeightLine, setShowWeightLine] = useState(true);
  const [showMovingAverageLine, setShowMovingAverageLine] = useState(true);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];

  useEffect(() => {
    const selectedRecord = records.find((r) => r.date === inputDate);
    if (!selectedRecord) return;
    const normalized = clampWeight(selectedRecord.weight);
    if (!normalized) return;
    const { integer, decimal } = weightToParts(normalized);
    setPickerInt(integer);
    setPickerDec(decimal);
    setInputWeight(normalized);
  }, [inputDate, records]);

  const movingAverageData = sorted.map((record, index) => {
    const windowRecords = sorted.slice(Math.max(0, index - 6), index + 1);
    const movingAverage = windowRecords.reduce((sum, r) => sum + r.weight, 0) / windowRecords.length;
    return { ...record, movingAverage: +movingAverage.toFixed(1) };
  });

  const last7 = sorted.slice(-7);
  const avg7 = last7.length ? +(last7.reduce((s, r) => s + r.weight, 0) / last7.length).toFixed(1) : null;

  const graphData = (() => {
    const now = new Date();
    let cutoff: Date | null = null;
    if (period === "1M") {
      cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - 1);
    } else if (period === "3M") {
      cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - 3);
    }
    if (!cutoff) return movingAverageData;
    const filtered = movingAverageData.filter((r) => new Date(r.date) >= cutoff!);
    return filtered.length ? filtered : movingAverageData;
  })();

  const periodWeights = graphData.map((r) => r.weight);
  const minW = periodWeights.length ? Math.min(...periodWeights) : null;
  const maxW = periodWeights.length ? Math.max(...periodWeights) : null;
  const weightSpeed = (() => {
    if (graphData.length < 2) return null;
    const first = graphData[0];
    const last = graphData[graphData.length - 1];
    const days = Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000);
    return +(((last.weight - first.weight) / days) * 7).toFixed(1);
  })();

  const yTicks = (() => {
    if (!graphData.length) return [60, 65, 70, 75, 80];
    const visibleWeights = graphData.flatMap((r) => [
      showWeightLine ? r.weight : null,
      showMovingAverageLine ? r.movingAverage : null,
    ]).filter((v): v is number => typeof v === "number");
    const chartWeights = visibleWeights.length ? visibleWeights : graphData.map((r) => r.weight);
    const minWeight = Math.min(...chartWeights);
    const maxWeight = Math.max(...chartWeights);
    let start = Math.floor((minWeight - 0.5) / 5) * 5;
    let end = Math.ceil((maxWeight + 0.5) / 5) * 5;
    if (start === end) {
      start -= 5;
      end += 5;
    }
    const ticks = [];
    for (let v = start; v <= end; v += 5) ticks.push(v);
    return ticks;
  })();
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];

  function setPickerWeight(integer: number, decimal: number) {
    const nextWeight = `${integer}.${decimal}`;
    setPickerInt(integer);
    setPickerDec(decimal);
    setInputWeight(nextWeight);
  }

  function handleSave() {
    if (!inputWeight || Number.isNaN(parseFloat(inputWeight))) return;
    if (records.some((r) => r.date === inputDate)) {
      setSaveState("duplicate");
      setTimeout(() => setSaveState("idle"), 1500);
      return;
    }
    const normalized = clampWeight(inputWeight);
    if (!normalized) return;
    const { integer, decimal } = weightToParts(normalized);
    setSaveState("saving");
    const rec = {
      id: Date.now().toString(),
      date: inputDate,
      weight: +parseFloat(normalized).toFixed(1),
      memo: inputMemo,
    };
    setTimeout(() => {
      setRecords((prevRecords) => [...prevRecords, rec]);
      setPickerWeight(integer, decimal);
      setInputMemo("");
      setShowMemo(false);
      setSaveState("done");
      setTimeout(() => setSaveState("idle"), 1500);
    }, 300);
  }

  function handleEditSave(id: string) {
    if (!editWeight || Number.isNaN(parseFloat(editWeight))) return;
    setRecords((prevRecords) => prevRecords.map((r) => (
      r.id === id ? { ...r, weight: +parseFloat(editWeight).toFixed(1) } : r
    )));
    setEditId(null);
    setEditWeight("");
  }

  function handleDelete(id: string) {
    setRecords((prevRecords) => prevRecords.filter((r) => r.id !== id));
    setDeleteConfirm(null);
  }

  const weightSpeedStatus = (() => {
    if (weightSpeed === null) return { color: "#999999", note: "기록 2개 이상 필요" };
    if (weightSpeed >= 0) return { color: "#ff5c8a", note: "유지 또는 증가, 원인 확인" };
    if (weightSpeed <= -1.0) return { color: "#ff9f43", note: "빠른 편, 근손실/피로 주의" };
    if (weightSpeed <= -0.5) return { color: "#20c997", note: "적정 감량 속도" };
    return { color: "#f6c84c", note: "감량 부족, 식단 조정 필요" };
  })();

  const statCards = [
    { label: "7일 평균", value: fmtDecimal(avg7), unit: avg7 !== null ? "kg" : "", color: "#0fbcc9" },
    {
      label: "감량 속도",
      value: weightSpeed !== null ? fmtSignedDecimal(weightSpeed) : "—",
      unit: weightSpeed !== null ? "kg/주" : "",
      color: weightSpeedStatus.color,
      note: weightSpeedStatus.note
    },
    { label: "최고", value: fmtDecimal(maxW), unit: maxW !== null ? "kg" : "", color: "#ff5252" },
    { label: "최저", value: fmtDecimal(minW), unit: minW !== null ? "kg" : "", color: "#1fa971" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8f9", color: "#000000", fontFamily: "'Pretendard', sans-serif", maxWidth: 430, margin: "0 auto" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        html{background:#f7f8f9;-webkit-text-size-adjust:108%;text-size-adjust:108%;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:grayscale(1) contrast(0.5);cursor:pointer;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.1);border-radius:4px;}
        .period-btn{background:#ffffff;border:1px solid #eeeeee;border-radius:20px;padding:6px 16px;font-size:14px;color:#666666;cursor:pointer;transition:all 0.15s;font-family:inherit;font-weight:500;}
        .period-btn.on{background:#0fbcc9;border-color:#0fbcc9;color:#ffffff;box-shadow:0 4px 12px rgba(15,188,201,0.2);}
        .tab-pill{flex:1;background:transparent;border:none;padding:14px 0;font-size:16px;cursor:pointer;font-family:inherit;transition:all 0.2s;border-radius:12px;}
        .tab-pill.on{background:#ffffff;color:#0fbcc9;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.06);}
        .tab-pill.off{color:#888888;font-weight:500;}
        .wt-input{background:transparent;border:none;font-size:54px;font-family:'Manrope',sans-serif;font-weight:700;color:#0fbcc9;text-align:center;width:160px;outline:none;caret-color:#0fbcc9;padding:0;}
        .wt-input::placeholder{color:#dddddd;}
        .save-btn{width:100%;border:none;border-radius:24px;padding:17px;font-size:20px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.25s;}
        .save-btn.ready{background:#0fbcc9;color:#ffffff;box-shadow:0 8px 16px rgba(15,188,201,0.2);}
        .save-btn.done{background:#22b573;color:#ffffff;box-shadow:0 8px 16px rgba(34,181,115,0.26);}
        .save-btn.duplicate{background:#ff5252;color:#ffffff;box-shadow:0 8px 16px rgba(255,82,82,0.2);}
        .save-btn.empty{background:#eeeeee;color:#aaaaaa;cursor:default;}
        .rec-row{display:flex;align-items:center;padding:16px 0;border-bottom:1px solid #f2f2f2;gap:12px;transition:background 0.15s;}
        .rec-row:last-child{border-bottom:none;}
        .ico-btn{background:transparent;border:none;cursor:pointer;color:#999999;padding:6px;font-size:16px;transition:all 0.15s;line-height:1;border-radius:50%;}
        .ico-btn:hover{background:rgba(0,0,0,0.05);color:#333333;}
        .edit-inp{background:#ffffff;border:1px solid #0fbcc9;border-radius:10px;color:#0fbcc9;font-size:19px;font-family:'Manrope',sans-serif;width:92px;padding:6px 9px;text-align:right;outline:none;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        .fade-up{animation:fadeUp 0.35s ease both;}
        .card{background:#ffffff;border-radius:24px;padding:20px;box-shadow:0 8px 24px rgba(0,0,0,0.04);border:1px solid #f0f0f0;}
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(247,248,249,0.9)", backdropFilter: "blur(20px)", padding: "16px 20px 10px", borderBottom: "1px solid #eeeeee" }}>
        <div style={{ display: "flex", background: "#f0f2f3", borderRadius: 16, padding: 4, gap: 4 }}>
          <button className={`tab-pill ${tab === "main" ? "on" : "off"}`} onClick={() => setTab("main")}>체중 기록</button>
          <button className={`tab-pill ${tab === "manage" ? "on" : "off"}`} onClick={() => setTab("manage")}>기록 관리</button>
        </div>
      </div>

      {tab === "main" && (
        <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <input
                type="date"
                value={inputDate}
                max={todayStr()}
                onChange={(e) => setInputDate(e.target.value)}
                style={{ background: "#f5f6f7", border: "1px solid #eeeeee", borderRadius: 16, color: "#333333", fontSize: 16, fontWeight: 600, padding: "12px 14px", fontFamily: "inherit", outline: "none", flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setInputDate(todayStr())}
                style={{ background: "#ffffff", border: "1px solid #eeeeee", borderRadius: 16, color: "#0fbcc9", fontSize: 15, fontWeight: 700, padding: "12px 16px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
              >
                오늘
              </button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
                <WheelPicker
                  items={PICKER_INTEGERS}
                  value={pickerInt}
                  onChange={(nextInt) => setPickerWeight(nextInt, pickerDec)}
                  format={(item) => String(item)}
                  width={140}
                  ariaLabel="체중 정수부 선택"
                />
                <div style={{ fontSize: 46, color: "#0fbcc9", fontFamily: "'Manrope',sans-serif", marginTop: -3, fontWeight: 700 }}>.</div>
                <WheelPicker
                  items={PICKER_DECIMALS}
                  value={pickerDec}
                  onChange={(nextDec) => setPickerWeight(pickerInt, nextDec)}
                  format={(item) => String(item)}
                  width={100}
                  ariaLabel="체중 소수부 선택"
                />
              </div>
              <div style={{ marginTop: 20, display: "flex", justifyContent: "center", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 52, fontWeight: 800, fontFamily: "'Manrope',sans-serif", color: "#000000" }}>{inputWeight}</span>
                <span style={{ fontSize: 24, color: "#666666", fontWeight: 600 }}>kg</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMemo((v) => !v)}
              style={{ background: "transparent", border: "none", color: "#666666", fontSize: 16, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, marginBottom: showMemo ? 12 : 20, fontWeight: 600 }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d={showMemo ? "M2 8l4-4 4 4" : "M2 4l4 4 4-4"} stroke="#666666" strokeWidth="2" strokeLinecap="round" />
              </svg>
              메모 {showMemo ? "닫기" : "추가"}
            </button>

            {showMemo && (
              <input
                type="text"
                placeholder="어떤 일이 있었나요?"
                value={inputMemo}
                onChange={(e) => setInputMemo(e.target.value)}
                style={{ background: "#f5f6f7", border: "1px solid #eeeeee", borderRadius: 16, color: "#333333", fontSize: 16, padding: "14px 18px", width: "100%", fontFamily: "inherit", outline: "none", marginBottom: 20 }}
              />
            )}

            <button
              className={`save-btn ${
                saveState === "done" ? "done" : saveState === "duplicate" ? "duplicate" : inputWeight ? "ready" : "empty"
              }`}
              onClick={handleSave}
              disabled={!inputWeight}
            >
              {saveState === "done" ? "기록되었습니다" : saveState === "saving" ? "처리 중..." : saveState === "duplicate" ? "이미 기록된 날짜" : "저장"}
            </button>
          </div>

          <div style={{ padding: "12px 4px 4px" }}>
            <div style={{ fontSize: 15, color: "#000000", fontWeight: 800, marginBottom: 16 }}>분석 리포트</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {statCards.map((s) => (
                <div key={s.label} className="card" style={{ padding: "16px 18px" }}>
                  <div style={{ fontSize: 14, color: "#888888", marginBottom: 10, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Manrope',sans-serif", color: s.color }}>{s.value}</span>
                    {s.unit && <span style={{ fontSize: 16, color: "#888888", fontWeight: 600 }}>{s.unit}</span>}
                  </div>
                  {"note" in s && s.note && (
                    <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.35, color: s.color, fontWeight: 700 }}>
                      {s.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, color: "#000000", fontWeight: 800 }}>체중 통계</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["1M", "3M", "ALL"].map((p) => (
                  <button key={p} className={`period-btn ${period === p ? "on" : ""}`} onClick={() => setPeriod(p)}>
                    {p === "1M" ? "1개월" : p === "3M" ? "3개월" : "전체"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 220, marginBottom: 4 }}>
              {graphData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graphData} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
                    <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fontSize: 12, fill: "#999999", fontWeight: 500 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[yMin, yMax]} ticks={yTicks} allowDecimals={false} tick={{ fontSize: 12, fill: "#999999", fontWeight: 500 }} axisLine={false} tickLine={false} />
                    <Tooltip content={(props) => <ChartTooltip {...props} />} />
                    {showWeightLine && (
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#0fbcc9"
                        strokeWidth={3}
                        dot={<CustomDot latest={latest?.date} />}
                        activeDot={{ fill: "#0fbcc9", r: 6, stroke: "#ffffff", strokeWidth: 2 }}
                      />
                    )}
                    {showMovingAverageLine && (
                      <Line
                        type="monotone"
                        dataKey="movingAverage"
                        stroke={MOVING_AVERAGE_COLOR}
                        strokeWidth={1.6}
                        dot={false}
                        activeDot={{ fill: MOVING_AVERAGE_COLOR, r: 5, stroke: "#ffffff", strokeWidth: 2 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaaaaa", fontSize: 15 }}>데이터가 없습니다</div>
              )}
            </div>
            {graphData.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 14, color: "#777777", fontSize: 12, fontWeight: 700 }}>
                <button
                  type="button"
                  aria-pressed={showWeightLine}
                  onClick={() => setShowWeightLine((v) => !v)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", padding: 0, color: showWeightLine ? "#777777" : "#c8c8c8", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: showWeightLine ? 1 : 0.55 }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: "#0fbcc9" }} />
                  체중
                </button>
                <button
                  type="button"
                  aria-pressed={showMovingAverageLine}
                  onClick={() => setShowMovingAverageLine((v) => !v)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", padding: 0, color: showMovingAverageLine ? "#777777" : "#c8c8c8", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: showMovingAverageLine ? 1 : 0.55 }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: MOVING_AVERAGE_COLOR }} />
                  7일 이동평균
                </button>
              </div>
            )}
          </div>

          <div style={{ padding: "12px 4px 4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, color: "#000000", fontWeight: 800 }}>최근 기록</div>
              <button
                type="button"
                onClick={() => setTab("manage")}
                style={{ background: "transparent", border: "none", color: "#0fbcc9", fontSize: 15, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
              >
                더보기
              </button>
            </div>
            <div className="card" style={{ padding: "4px 20px" }}>
              {[...sorted].reverse().slice(0, 5).map((r: any, i) => {
                const p = sorted[sorted.indexOf(r) - 1];
                const d = p ? +(r.weight - p.weight).toFixed(1) : null;
                const diffText = d === null ? "\u00A0" : fmtSignedDecimal(d);
                const diffColor = d === null ? "transparent" : d < 0 ? "#1fa971" : d > 0 ? "#ff5252" : "#888888";
                return (
                  <div key={r.id} className="rec-row">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, color: "#000000", fontWeight: 600 }}>{fmtFull(r.date)}</div>
                      {r.memo && <div style={{ fontSize: 14, color: "#777777", marginTop: 2, fontWeight: 500 }}>{r.memo}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginLeft: 8 }}>
                      <span style={{ fontFamily: "'Manrope',sans-serif", fontSize: 26, fontWeight: 700, color: "#000000" }}>{fmtDecimal(r.weight)}</span>
                      <span style={{ fontSize: 15, color: "#888888", fontWeight: 600 }}>kg</span>
                    </div>
                    <span
                      style={{
                        minWidth: 48,
                        textAlign: "right",
                        fontSize: 19,
                        color: diffColor,
                        fontFamily: "'Manrope',sans-serif",
                        fontWeight: 700,
                      }}
                    >
                      {diffText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "manage" && (
        <div style={{ padding: "16px 20px 40px" }}>
          <div style={{ fontSize: 15, color: "#000000", fontWeight: 800, marginBottom: 16 }}>
            전체 기록 ({sorted.length})
          </div>
          <div className="card" style={{ padding: "4px 20px" }}>
            {[...sorted].reverse().map((r: any, i) => (
              <div key={r.id} className="rec-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, color: "#000000", fontWeight: 600 }}>{fmtFull(r.date)}</div>
                  {r.memo && <div style={{ fontSize: 14, color: "#666666", marginTop: 2, fontWeight: 500 }}>{r.memo}</div>}
                </div>
                {editId === r.id ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="number"
                      step="0.1"
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleEditSave(r.id)}
                      className="edit-inp"
                      autoFocus
                    />
                    <button type="button" className="ico-btn" style={{ color: "#0fbcc9" }} onClick={() => handleEditSave(r.id)}>✓</button>
                    <button type="button" className="ico-btn" onClick={() => setEditId(null)}>✕</button>
                  </div>
                ) : deleteConfirm === r.id ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => handleDelete(r.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 10, color: "#ef4444", fontSize: 14, padding: "8px 12px", fontWeight: 700 }}>삭제</button>
                    <button type="button" onClick={() => setDeleteConfirm(null)} style={{ background: "#f3f4f6", border: "none", borderRadius: 10, color: "#666666", fontSize: 14, padding: "8px 12px", fontWeight: 700 }}>취소</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ textAlign: "right", marginRight: 4 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                        <span style={{ fontFamily: "'Manrope',sans-serif", fontSize: 24, color: "#000000", fontWeight: 700 }}>{fmtDecimal(r.weight)}</span>
                        <span style={{ fontSize: 14, color: "#888888", fontWeight: 600 }}>kg</span>
                      </div>
                    </div>
                    <button type="button" className="ico-btn" onClick={() => { setEditId(r.id); setEditWeight(fmtDecimal(r.weight)); }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" />
                      </svg>
                    </button>
                    <button type="button" className="ico-btn" onClick={() => setDeleteConfirm(r.id)}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M2 4h10M5 4V3h4v1M6 6.5v4M8 6.5v4M3 4l1 7h6l1-7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
