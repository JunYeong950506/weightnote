import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

const STORAGE_KEY = "wt_records_v3";
const PICKER_MIN = 30;
const PICKER_MAX = 200;
const PICKER_DECIMALS = Array.from({ length: 10 }, (_, i) => i).reverse();
const PICKER_INTEGERS = Array.from({ length: PICKER_MAX - PICKER_MIN + 1 }, (_, i) => PICKER_MIN + i).reverse();
const PICKER_ITEM_HEIGHT = 44;
const PICKER_VISIBLE_ROWS = 5;
const PICKER_EDGE_ROWS = Math.floor(PICKER_VISIBLE_ROWS / 2);

const seed = [];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtShort(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtKo(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function fmtFull(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}`;
}

function clampWeight(value) {
  if (value === "" || value === null || Number.isNaN(Number(value))) return "";
  const clamped = Math.min(PICKER_MAX + 0.9, Math.max(PICKER_MIN, Number(value)));
  return clamped.toFixed(1);
}

function weightToParts(value) {
  const normalized = clampWeight(value);
  if (!normalized) return { integer: 70, decimal: 0 };
  const [integer, decimal] = normalized.split(".");
  return { integer: Number(integer), decimal: Number(decimal) };
}

function latestWeightString(records) {
  const latestRecord = [...records].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return latestRecord ? clampWeight(latestRecord.weight) : "70.0";
}

const CustomDot = (props) => {
  const { cx, cy, payload, latest } = props;
  if (payload.date === latest) {
    return <circle cx={cx} cy={cy} r={5} fill="#e8ff6e" stroke="#0f1117" strokeWidth={2} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill="#3a3d2a" stroke="#e8ff6e" strokeWidth={1} />;
};

const ChartTooltip = ({ active, payload }: { active?: any; payload?: any[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a1d24", border: "1px solid rgba(232,255,110,0.2)", borderRadius: 8, padding: "8px 14px" }}>
      <div style={{ fontSize: 11, color: "#b7bfcc", marginBottom: 2 }}>{fmtKo(payload[0].payload.date)}</div>
      <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'DM Mono',monospace", color: "#e8ff6e" }}>
        {payload[0].value}<span style={{ fontSize: 11, color: "#b7bfcc", marginLeft: 4 }}>kg</span>
      </div>
    </div>
  );
};

function WheelPicker({ items, value, onChange, format, width, ariaLabel }) {
  const pickerRef = useRef(null);
  const userScrollRef = useRef(false);
  const scrollTimerRef = useRef(null);
  const didInitRef = useRef(false);

  useEffect(() => {
    const el = pickerRef.current;
    const index = items.indexOf(value);
    if (!el || index < 0 || userScrollRef.current) return;
    const targetTop = index * PICKER_ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - targetTop) < 1) return;
    el.scrollTo({ top: targetTop, behavior: didInitRef.current ? "smooth" : "auto" });
    didInitRef.current = true;
  }, [items, value]);

  useEffect(() => () => clearTimeout(scrollTimerRef.current), []);

  function handleScroll(event) {
    userScrollRef.current = true;
    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      userScrollRef.current = false;
    }, 120);
    const nextIndex = Math.max(
      0,
      Math.min(items.length - 1, Math.round(event.currentTarget.scrollTop / PICKER_ITEM_HEIGHT))
    );
    const nextValue = items[nextIndex];
    if (nextValue !== value) onChange(nextValue);
  }

  return (
    <div
      style={{
        position: "relative",
        width,
        height: PICKER_ITEM_HEIGHT * PICKER_VISIBLE_ROWS,
        borderRadius: 20,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
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
          const isSelected = item === value;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              style={{
                height: PICKER_ITEM_HEIGHT,
                width: "100%",
                scrollSnapAlign: "center",
                background: "transparent",
                border: "none",
                color: isSelected ? "#e8ff6e" : "rgba(240,240,240,0.42)",
                fontSize: isSelected ? 30 : 24,
                fontWeight: isSelected ? 500 : 400,
                fontFamily: "'DM Mono',monospace",
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
          background: "linear-gradient(180deg, rgba(12,14,20,0.96) 0%, rgba(12,14,20,0.48) 18%, rgba(12,14,20,0) 36%, rgba(12,14,20,0) 64%, rgba(12,14,20,0.48) 82%, rgba(12,14,20,0.96) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          top: "50%",
          height: PICKER_ITEM_HEIGHT,
          transform: "translateY(-50%)",
          borderTop: "1px solid rgba(232,255,110,0.32)",
          borderBottom: "1px solid rgba(232,255,110,0.32)",
          background: "rgba(232,255,110,0.04)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default function App() {
  const [records, setRecords] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : seed;
    } catch {
      return seed;
    }
  });

  const initialWeightRef = useRef(null);
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
  const [editId, setEditId] = useState(null);
  const [editWeight, setEditWeight] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    const upsertMeta = (name, content) => {
      let el = document.head.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const upsertLink = (selector, attrs) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement("link");
        document.head.appendChild(el);
      }
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    };

    upsertMeta("apple-mobile-web-app-capable", "yes");
    upsertMeta("apple-mobile-web-app-title", "WeightNote");
    upsertLink('link[rel="apple-touch-icon"][sizes="180x180"]', {
      rel: "apple-touch-icon",
      sizes: "180x180",
      href: "/icons/apple-touch-icon-180.png",
    });
    upsertLink('link[rel="icon"][sizes="32x32"]', {
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      href: "/icons/favicon-32.png",
    });
    upsertLink('link[rel="icon"][sizes="16x16"]', {
      rel: "icon",
      type: "image/png",
      sizes: "16x16",
      href: "/icons/favicon-16.png",
    });
    upsertLink('link[rel="manifest"]', {
      rel: "manifest",
      href: "/site.webmanifest",
    });
  }, []);

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

  const allWeights = sorted.map((r) => r.weight);
  const minW = allWeights.length ? Math.min(...allWeights) : null;
  const maxW = allWeights.length ? Math.max(...allWeights) : null;
  const last7 = sorted.slice(-7);
  const avg7 = last7.length ? +(last7.reduce((s, r) => s + r.weight, 0) / last7.length).toFixed(1) : null;

  const weeklyChange = (() => {
    if (sorted.length < 2) return null;
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const thisWeek = sorted.filter((r) => new Date(r.date) >= weekAgo);
    const prevWeek = sorted.filter((r) => {
      const d = new Date(r.date);
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(now.getDate() - 14);
      return d >= twoWeeksAgo && d < weekAgo;
    });
    if (!thisWeek.length || !prevWeek.length) return null;
    const thisAvg = thisWeek.reduce((s, r) => s + r.weight, 0) / thisWeek.length;
    const prevAvg = prevWeek.reduce((s, r) => s + r.weight, 0) / prevWeek.length;
    return +(thisAvg - prevAvg).toFixed(1);
  })();

  const graphData = (() => {
    const now = new Date();
    let cutoff = null;
    if (period === "1M") {
      cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - 1);
    } else if (period === "3M") {
      cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - 3);
    }
    if (!cutoff) return sorted;
    const filtered = sorted.filter((r) => new Date(r.date) >= cutoff);
    return filtered.length ? filtered : sorted;
  })();

  const yTicks = (() => {
    if (!graphData.length) return [60, 65, 70, 75, 80];
    const minWeight = Math.min(...graphData.map((r) => r.weight));
    const maxWeight = Math.max(...graphData.map((r) => r.weight));
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

  function setPickerWeight(integer, decimal) {
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

  function handleEditSave(id) {
    if (!editWeight || Number.isNaN(parseFloat(editWeight))) return;
    setRecords((prevRecords) => prevRecords.map((r) => (
      r.id === id ? { ...r, weight: +parseFloat(editWeight).toFixed(1) } : r
    )));
    setEditId(null);
    setEditWeight("");
  }

  function handleDelete(id) {
    setRecords((prevRecords) => prevRecords.filter((r) => r.id !== id));
    setDeleteConfirm(null);
  }

  const statCards = [
    { label: "7일 평균", value: avg7 ? `${avg7}` : "—", unit: "kg", color: "#e8ff6e" },
    {
      label: "주간 변화",
      value: weeklyChange !== null ? (weeklyChange > 0 ? `+${weeklyChange}` : `${weeklyChange}`) : "—",
      unit: weeklyChange !== null ? "kg" : "",
      color: weeklyChange === null ? "#b7bfcc" : weeklyChange < 0 ? "#6ee8c0" : weeklyChange > 0 ? "#e87a6e" : "#d2d8e1"
    },
    { label: "최고", value: maxW ?? "—", unit: maxW ? "kg" : "", color: "#e87a6e" },
    { label: "최저", value: minW ?? "—", unit: minW ? "kg" : "", color: "#6ee8c0" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0c0e14", color: "#f0f0f0", fontFamily: "'DM Sans','Pretendard',sans-serif", maxWidth: 430, margin: "0 auto", filter: "saturate(1.08)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{background:#0c0e14;-webkit-text-size-adjust:108%;text-size-adjust:108%;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.4);cursor:pointer;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px;}
        .period-btn{background:transparent;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:4px 14px;font-size:12px;color:#adb5c4;cursor:pointer;transition:all 0.15s;font-family:inherit;}
        .period-btn.on{background:rgba(232,255,110,0.12);border-color:rgba(232,255,110,0.3);color:#e8ff6e;}
        .tab-pill{flex:1;background:transparent;border:none;padding:10px 0;font-size:13px;cursor:pointer;font-family:inherit;transition:all 0.2s;border-radius:10px;}
        .tab-pill.on{background:rgba(255,255,255,0.07);color:#f0f0f0;font-weight:500;}
        .tab-pill.off{color:#a2a9b8;}
        .wt-input{background:transparent;border:none;font-size:52px;font-family:'DM Mono',monospace;font-weight:500;color:#e8ff6e;text-align:center;width:160px;outline:none;caret-color:#e8ff6e;padding:0;}
        .wt-input::placeholder{color:#2a2d1a;}
        .save-btn{width:100%;border:none;border-radius:14px;padding:15px;font-size:15px;font-weight:500;cursor:pointer;font-family:inherit;transition:all 0.25s;letter-spacing:0.02em;}
        .save-btn.ready{background:#e8ff6e;color:#0c0e14;}
        .save-btn.done{background:#6ee8a0;color:#0a2e18;}
        .save-btn.duplicate{background:linear-gradient(135deg,#2a0b17,#4a1026);color:#ff78a7;border:1px solid rgba(255,95,157,0.45);box-shadow:0 0 0 1px rgba(255,95,157,0.2) inset;}
        .save-btn.empty{background:rgba(255,255,255,0.04);color:#8c95a5;cursor:default;}
        .rec-row{display:flex;align-items:center;padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.05);gap:10px;transition:background 0.15s;}
        .rec-row:last-child{border-bottom:none;}
        .ico-btn{background:transparent;border:none;cursor:pointer;color:#a2a9b8;padding:5px 7px;font-size:14px;transition:color 0.15s;line-height:1;}
        .ico-btn:hover{color:#d2d8e3;}
        .edit-inp{background:rgba(255,255,255,0.07);border:1px solid rgba(232,255,110,0.35);border-radius:8px;color:#e8ff6e;font-size:16px;font-family:'DM Mono',monospace;width:78px;padding:5px 8px;text-align:right;outline:none;}
        .del-confirm{display:flex;gap:6px;align-items:center;}
        .del-yes{background:#3d1a1a;border:1px solid rgba(232,110,110,0.3);border-radius:8px;color:#e87a6e;font-size:12px;padding:5px 10px;cursor:pointer;font-family:inherit;}
        .del-no{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#b7bfcc;font-size:12px;padding:5px 10px;cursor:pointer;font-family:inherit;}
        .wheel-pane::-webkit-scrollbar{display:none;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        .fade-up{animation:fadeUp 0.3s ease both;}
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(12,14,20,0.95)", backdropFilter: "blur(20px)", padding: "12px 20px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 3, gap: 2 }}>
          <button className={`tab-pill ${tab === "main" ? "on" : "off"}`} onClick={() => setTab("main")}>체중 기록</button>
          <button className={`tab-pill ${tab === "manage" ? "on" : "off"}`} onClick={() => setTab("manage")}>기록 관리</button>
        </div>
      </div>

      {tab === "main" && (
        <div style={{ paddingBottom: 40 }}>
          <div style={{ padding: "28px 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <input
                type="date"
                value={inputDate}
                max={todayStr()}
                onChange={(e) => setInputDate(e.target.value)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#c4cad5", fontSize: 13, padding: "8px 12px", fontFamily: "inherit", outline: "none", flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setInputDate(todayStr())}
                style={{ background: "rgba(232,255,110,0.08)", border: "1px solid rgba(232,255,110,0.15)", borderRadius: 10, color: "#b6c36e", fontSize: 12, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
              >
                오늘
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
                <WheelPicker
                  items={PICKER_INTEGERS}
                  value={pickerInt}
                  onChange={(nextInt) => setPickerWeight(nextInt, pickerDec)}
                  format={(item) => String(item)}
                  width={132}
                  ariaLabel="체중 정수부 선택"
                />
                <div style={{ fontSize: 34, color: "#e8ff6e", fontFamily: "'DM Mono',monospace", marginTop: -2 }}>.</div>
                <WheelPicker
                  items={PICKER_DECIMALS}
                  value={pickerDec}
                  onChange={(nextDec) => setPickerWeight(pickerInt, nextDec)}
                  format={(item) => String(item)}
                  width={88}
                  ariaLabel="체중 소수부 선택"
                />
              </div>
              <div
                style={{ marginTop: 14, width: "100%", background: "transparent", border: "none", display: "flex", justifyContent: "center", alignItems: "baseline", gap: 6, padding: 0 }}
              >
                <span style={{ fontSize: 34, fontWeight: 500, fontFamily: "'DM Mono',monospace", color: "#e8ff6e" }}>{inputWeight}</span>
                <span style={{ fontSize: 13, color: "#b7bfcc" }}>kg</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMemo((v) => !v)}
              style={{ background: "transparent", border: "none", color: "#b7bfcc", fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, marginBottom: showMemo ? 10 : 16, padding: 0 }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d={showMemo ? "M2 8l4-4 4 4" : "M2 4l4 4 4-4"} stroke="#b7bfcc" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              메모 {showMemo ? "닫기" : "추가"}
            </button>

            {showMemo && (
              <input
                type="text"
                placeholder="오늘 컨디션, 메모..."
                value={inputMemo}
                onChange={(e) => setInputMemo(e.target.value)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, color: "#e1e6ed", fontSize: 13, padding: "10px 14px", width: "100%", fontFamily: "inherit", outline: "none", marginBottom: 16 }}
              />
            )}

            <button
              className={`save-btn ${
                saveState === "done"
                  ? "done"
                  : saveState === "duplicate"
                    ? "duplicate"
                    : inputWeight
                      ? "ready"
                      : "empty"
              }`}
              onClick={handleSave}
              disabled={!inputWeight}
            >
              {saveState === "done" ? "저장 완료" : saveState === "saving" ? "저장 중..." : saveState === "duplicate" ? "같은 날짜 기록 있음" : "저장"}
            </button>
          </div>

          <div style={{ padding: "20px 20px 0" }}>
            <div style={{ fontSize: 11, color: "#a2a9b8", letterSpacing: "0.08em", marginBottom: 12 }}>분석</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
              {statCards.map((s) => (
                <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: "#adb5c4", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 500, fontFamily: "'DM Mono',monospace", color: s.color }}>{s.value}</span>
                    {s.unit && <span style={{ fontSize: 11, color: "#adb5c4" }}>{s.unit}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#a2a9b8", letterSpacing: "0.08em" }}>통계</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["1M", "3M", "ALL"].map((p) => (
                  <button key={p} className={`period-btn ${period === p ? "on" : ""}`} onClick={() => setPeriod(p)}>
                    {p === "1M" ? "1개월" : p === "3M" ? "3개월" : "전체"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 200, marginBottom: 8 }}>
              {graphData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graphData} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "#a2a9b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[yMin, yMax]} ticks={yTicks} allowDecimals={false} tick={{ fontSize: 10, fill: "#a2a9b8" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#e8ff6e"
                      strokeWidth={1.5}
                      dot={<CustomDot latest={latest?.date} />}
                      activeDot={{ fill: "#e8ff6e", r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8c95a5", fontSize: 13 }}>데이터 부족</div>
              )}
            </div>
          </div>

          <div style={{ padding: "20px 20px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#a2a9b8", letterSpacing: "0.08em" }}>최근 기록</div>
              <button
                type="button"
                onClick={() => setTab("manage")}
                style={{ background: "transparent", border: "none", color: "#adb5c4", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
              >
                전체 보기 →
              </button>
            </div>
            {[...sorted].reverse().slice(0, 5).map((r, i) => {
              const p = sorted[sorted.indexOf(r) - 1];
              const d = p ? +(r.weight - p.weight).toFixed(1) : null;
              return (
                <div key={r.id} className="rec-row fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#adb5c4" }}>{fmtFull(r.date)}</div>
                    {r.memo && <div style={{ fontSize: 11, color: "#b7bfcc", marginTop: 2 }}>{r.memo}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 17, fontWeight: 500, color: "#e8ff6e" }}>{r.weight}</span>
                    <span style={{ fontSize: 11, color: "#adb5c4" }}>kg</span>
                  </div>
                  {d !== null && (
                    <span style={{ fontSize: 12, color: d < 0 ? "#6ee8c0" : d > 0 ? "#e87a6e" : "#adb5c4", minWidth: 36, textAlign: "right", fontFamily: "'DM Mono',monospace" }}>
                      {d > 0 ? "+" : ""}{d}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "manage" && (
        <div style={{ padding: "24px 20px 40px" }}>
          <div style={{ fontSize: 11, color: "#a2a9b8", letterSpacing: "0.08em", marginBottom: 16 }}>
            총 {sorted.length}개 기록
          </div>
          {[...sorted].reverse().map((r, i) => (
            <div key={r.id} className="rec-row fade-up" style={{ animationDelay: `${i * 0.03}s` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#c0c7d3" }}>{fmtFull(r.date)}</div>
                {r.memo && <div style={{ fontSize: 11, color: "#adb5c4", marginTop: 2 }}>{r.memo}</div>}
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
                  <button type="button" className="ico-btn" style={{ color: "#a8c050" }} onClick={() => handleEditSave(r.id)}>✓</button>
                  <button type="button" className="ico-btn" onClick={() => setEditId(null)}>✕</button>
                </div>
              ) : deleteConfirm === r.id ? (
                <div className="del-confirm">
                  <button type="button" className="del-yes" onClick={() => handleDelete(r.id)}>삭제</button>
                  <button type="button" className="del-no" onClick={() => setDeleteConfirm(null)}>취소</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 17, color: "#e8ff6e", fontWeight: 500 }}>{r.weight}</span>
                  <span style={{ fontSize: 11, color: "#adb5c4" }}>kg</span>
                  <button type="button" className="ico-btn" onClick={() => { setEditId(r.id); setEditWeight(r.weight.toString()); }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                      <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" />
                    </svg>
                  </button>
                  <button type="button" className="ico-btn" style={{ color: "#5a3030" }} onClick={() => setDeleteConfirm(r.id)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                      <path d="M2 4h10M5 4V3h4v1M6 6.5v4M8 6.5v4M3 4l1 7h6l1-7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
