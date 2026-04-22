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
const PICKER_ITEM_HEIGHT = 50;
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
    return <circle cx={cx} cy={cy} r={5} fill="#0fbfd1" stroke="#ffffff" strokeWidth={2} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill="#dff5f8" stroke="#0fbfd1" strokeWidth={1.4} />;
};

const ChartTooltip = ({ active, payload }: { active?: any; payload?: any[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#ffffff", border: "1px solid rgba(14,172,190,0.24)", borderRadius: 10, padding: "8px 14px", boxShadow: "0 10px 24px rgba(26,77,99,0.12)" }}>
      <div style={{ fontSize: 13, color: "#4f6677", marginBottom: 3 }}>{fmtKo(payload[0].payload.date)}</div>
      <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "'Manrope','Pretendard','Noto Sans KR',sans-serif", color: "#089eb3" }}>
        {payload[0].value}<span style={{ fontSize: 13, color: "#4f6677", marginLeft: 4 }}>kg</span>
      </div>
    </div>
  );
};

function WheelPicker({ items, value, onChange, format, width, ariaLabel }) {
  const pickerRef = useRef(null);
  const userScrollRef = useRef(false);
  const scrollTimerRef = useRef(null);
  const didInitRef = useRef(false);
  const [previewValue, setPreviewValue] = useState(value);

  function resolveNearest(scrollTop) {
    const index = Math.max(
      0,
      Math.min(items.length - 1, Math.round(scrollTop / PICKER_ITEM_HEIGHT))
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
    if (!el || index < 0) return;
    setPreviewValue(value);
    if (userScrollRef.current) return;
    const targetTop = index * PICKER_ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - targetTop) < 1) return;
    el.scrollTo({
      top: targetTop,
      behavior: didInitRef.current ? "smooth" : "auto"
    });
    didInitRef.current = true;
  }, [items, value]);

  useEffect(() => () => clearTimeout(scrollTimerRef.current), []);

  function handleScroll(event) {
    userScrollRef.current = true;
    const { nextValue } = resolveNearest(event.currentTarget.scrollTop);
    if (nextValue !== previewValue) setPreviewValue(nextValue);
    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      userScrollRef.current = false;
      commitValue();
    }, 120);
  }

  return (
    <div
      style={{
        position: "relative",
        width,
        height: PICKER_ITEM_HEIGHT * PICKER_VISIBLE_ROWS,
        borderRadius: 24,
        background: "transparent",
        border: "none",
        overflow: "hidden",
        boxShadow: "none",
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
                background: "transparent",
                border: "none",
                color: isSelected ? "#056f81" : "#6e8697",
                fontSize: isSelected ? 40 : 31,
                fontWeight: isSelected ? 600 : 500,
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
          background: "linear-gradient(180deg, rgba(230,243,247,0.9) 0%, rgba(230,243,247,0.4) 18%, rgba(230,243,247,0) 34%, rgba(230,243,247,0) 66%, rgba(230,243,247,0.4) 82%, rgba(230,243,247,0.9) 100%)",
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
          borderTop: "2px solid rgba(7,142,163,0.62)",
          borderBottom: "2px solid rgba(7,142,163,0.62)",
          background: "rgba(7,142,163,0.15)",
          boxShadow: "inset 0 0 0 1px rgba(7,142,163,0.24), 0 0 12px rgba(9,175,193,0.2)",
          borderRadius: 10,
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
    { label: "7일 평균", value: avg7 ? `${avg7}` : "—", unit: "kg", color: "#07abc0" },
    {
      label: "주간 변화",
      value: weeklyChange !== null ? (weeklyChange > 0 ? `+${weeklyChange}` : `${weeklyChange}`) : "—",
      unit: weeklyChange !== null ? "kg" : "",
      color: weeklyChange === null ? "#88a0ad" : weeklyChange < 0 ? "#1bc6a7" : weeklyChange > 0 ? "#ff6f96" : "#9ab2be"
    },
    { label: "최고", value: maxW ?? "—", unit: maxW ? "kg" : "", color: "#ff7597" },
    { label: "최저", value: minW ?? "—", unit: minW ? "kg" : "", color: "#1bc6a7" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#eef8fb 0%,#e6f3f7 100%)", color: "#183140", fontFamily: "'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif", maxWidth: 430, margin: "0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&family=Noto+Sans+KR:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{background:#e6f3f7;-webkit-text-size-adjust:108%;text-size-adjust:108%;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.45) saturate(0.85);cursor:pointer;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(28,146,170,0.28);border-radius:4px;}
        .period-btn{background:rgba(255,255,255,0.55);border:1px solid #cfe3e9;border-radius:20px;padding:6px 16px;font-size:14px;color:#587282;cursor:pointer;transition:all 0.15s;font-family:inherit;font-weight:500;}
        .period-btn.on{background:linear-gradient(135deg,#1ec9d8,#0ab4c5);border-color:#0ab4c5;color:#f7fdff;box-shadow:0 8px 18px rgba(17,170,190,0.22);}
        .tab-pill{flex:1;background:transparent;border:none;padding:12px 0;font-size:16px;cursor:pointer;font-family:inherit;transition:all 0.2s;border-radius:10px;}
        .tab-pill.on{background:#ffffff;color:#173140;font-weight:600;box-shadow:0 8px 20px rgba(28,103,128,0.14);}
        .tab-pill.off{color:#546f80;font-weight:500;}
        .wt-input{background:transparent;border:none;font-size:54px;font-family:'Manrope','Pretendard','Noto Sans KR',sans-serif;font-weight:600;color:#0ab3c4;text-align:center;width:160px;outline:none;caret-color:#0ab3c4;padding:0;}
        .wt-input::placeholder{color:#95b8bf;}
        .save-btn{width:100%;border:none;border-radius:16px;padding:17px;font-size:22px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.25s;letter-spacing:0.02em;}
        .save-btn.ready{background:linear-gradient(135deg,#1fcbd9,#09b0c1);color:#f7fdff;box-shadow:0 10px 20px rgba(17,170,190,0.24);}
        .save-btn.done{background:linear-gradient(135deg,#1fd7b3,#11b692);color:#063e3a;box-shadow:0 10px 20px rgba(21,176,145,0.22);}
        .save-btn.duplicate{background:linear-gradient(135deg,#721737,#9b1f53);color:#ffd2e7;border:1px solid rgba(255,184,216,0.45);box-shadow:0 0 0 1px rgba(255,184,216,0.2) inset,0 8px 18px rgba(130,23,66,0.24);}
        .save-btn.empty{background:#d7e8ed;color:#6f8898;cursor:default;}
        .rec-row{display:flex;align-items:center;padding:13px 0;border-bottom:1px solid #dbeaf0;gap:10px;transition:background 0.15s;}
        .rec-row:last-child{border-bottom:none;}
        .ico-btn{background:transparent;border:none;cursor:pointer;color:#5f7989;padding:5px 7px;font-size:16px;transition:color 0.15s;line-height:1;}
        .ico-btn:hover{color:#406579;}
        .edit-inp{background:#f4fcfe;border:1px solid rgba(12,176,196,0.45);border-radius:8px;color:#089eb3;font-size:19px;font-family:'Manrope','Pretendard','Noto Sans KR',sans-serif;width:92px;padding:6px 9px;text-align:right;outline:none;}
        .del-confirm{display:flex;gap:6px;align-items:center;}
        .del-yes{background:#ffeef4;border:1px solid rgba(255,108,158,0.34);border-radius:8px;color:#d14678;font-size:14px;padding:6px 10px;cursor:pointer;font-family:inherit;}
        .del-no{background:#f4fbfe;border:1px solid #d9eaf0;border-radius:8px;color:#5e7888;font-size:14px;padding:6px 10px;cursor:pointer;font-family:inherit;}
        .wheel-pane::-webkit-scrollbar{display:none;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        .fade-up{animation:fadeUp 0.3s ease both;}
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(236,247,250,0.88)", backdropFilter: "blur(20px)", padding: "12px 20px 8px", borderBottom: "1px solid #d9ebf0" }}>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.65)", borderRadius: 12, padding: 3, gap: 2, boxShadow: "inset 0 0 0 1px #d8eaf0" }}>
          <button className={`tab-pill ${tab === "main" ? "on" : "off"}`} onClick={() => setTab("main")}>체중 기록</button>
          <button className={`tab-pill ${tab === "manage" ? "on" : "off"}`} onClick={() => setTab("manage")}>기록 관리</button>
        </div>
      </div>

      {tab === "main" && (
        <div style={{ paddingBottom: 40 }}>
          <div style={{ padding: "28px 20px 24px", borderBottom: "1px solid #dcebf0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <input
                type="date"
                value={inputDate}
                max={todayStr()}
                onChange={(e) => setInputDate(e.target.value)}
                style={{ background: "#ffffff", border: "1px solid #d4e9ee", borderRadius: 12, color: "#3f5a6b", fontSize: 16, fontWeight: 500, padding: "10px 12px", fontFamily: "inherit", outline: "none", flex: 1, boxShadow: "0 6px 14px rgba(35,117,140,0.08)" }}
              />
              <button
                type="button"
                onClick={() => setInputDate(todayStr())}
                style={{ background: "rgba(17,197,217,0.1)", border: "1px solid rgba(17,197,217,0.35)", borderRadius: 12, color: "#087f95", fontSize: 15, fontWeight: 700, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
              >
                오늘
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, padding: "0 2px" }}>
                <WheelPicker
                  items={PICKER_INTEGERS}
                  value={pickerInt}
                  onChange={(nextInt) => setPickerWeight(nextInt, pickerDec)}
                  format={(item) => String(item)}
                  width={172}
                  ariaLabel="체중 정수부 선택"
                />
                <div style={{ fontSize: 46, color: "#078ea3", fontFamily: "'Manrope','Pretendard','Noto Sans KR',sans-serif", marginTop: -3 }}>.</div>
                <WheelPicker
                  items={PICKER_DECIMALS}
                  value={pickerDec}
                  onChange={(nextDec) => setPickerWeight(pickerInt, nextDec)}
                  format={(item) => String(item)}
                  width={126}
                  ariaLabel="체중 소수부 선택"
                />
              </div>
              <div
                style={{ marginTop: 14, width: "100%", background: "transparent", border: "none", display: "flex", justifyContent: "center", alignItems: "baseline", gap: 6, padding: 0 }}
              >
                <span style={{ fontSize: 48, fontWeight: 600, fontFamily: "'Manrope','Pretendard','Noto Sans KR',sans-serif", color: "#078ea3" }}>{inputWeight}</span>
                <span style={{ fontSize: 24, color: "#4f6777", fontWeight: 500 }}>kg</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMemo((v) => !v)}
              style={{ background: "transparent", border: "none", color: "#4f6777", fontSize: 17, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, marginBottom: showMemo ? 10 : 16, padding: 0, fontWeight: 500 }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d={showMemo ? "M2 8l4-4 4 4" : "M2 4l4 4 4-4"} stroke="#4f6777" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              메모 {showMemo ? "닫기" : "추가"}
            </button>

            {showMemo && (
              <input
                type="text"
                placeholder="오늘 컨디션, 메모..."
                value={inputMemo}
                onChange={(e) => setInputMemo(e.target.value)}
                style={{ background: "#ffffff", border: "1px solid #d4e9ee", borderRadius: 12, color: "#3d5565", fontSize: 16, padding: "11px 14px", width: "100%", fontFamily: "inherit", outline: "none", marginBottom: 16, boxShadow: "0 6px 14px rgba(35,117,140,0.06)" }}
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
            <div style={{ fontSize: 14, color: "#546f80", letterSpacing: "0.08em", marginBottom: 12, fontWeight: 600 }}>분석</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
              {statCards.map((s) => (
                <div key={s.label} style={{ background: "#ffffff", border: "1px solid #d9ebf0", borderRadius: 16, padding: "14px 16px", boxShadow: "0 10px 20px rgba(33,108,131,0.08)" }}>
                  <div style={{ fontSize: 13, color: "#5f7a8a", letterSpacing: "0.04em", marginBottom: 8, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 34, fontWeight: 600, fontFamily: "'Manrope','Pretendard','Noto Sans KR',sans-serif", color: s.color }}>{s.value}</span>
                    {s.unit && <span style={{ fontSize: 17, color: "#5f7a8a", fontWeight: 500 }}>{s.unit}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: "#546f80", letterSpacing: "0.08em", fontWeight: 600 }}>통계</div>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#dcebf0" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fontSize: 13, fill: "#577384" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[yMin, yMax]} ticks={yTicks} allowDecimals={false} tick={{ fontSize: 13, fill: "#577384" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#0ab4c5"
                      strokeWidth={2.2}
                      dot={<CustomDot latest={latest?.date} />}
                      activeDot={{ fill: "#0ab4c5", r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#5f7888", fontSize: 15, fontWeight: 500 }}>데이터 부족</div>
              )}
            </div>
          </div>

          <div style={{ padding: "20px 20px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: "#546f80", letterSpacing: "0.08em", fontWeight: 600 }}>최근 기록</div>
              <button
                type="button"
                onClick={() => setTab("manage")}
                style={{ background: "transparent", border: "none", color: "#557182", fontSize: 15, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
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
                    <div style={{ fontSize: 16, color: "#4d6878", fontWeight: 500 }}>{fmtFull(r.date)}</div>
                    {r.memo && <div style={{ fontSize: 14, color: "#587484", marginTop: 3 }}>{r.memo}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontFamily: "'Manrope','Pretendard','Noto Sans KR',sans-serif", fontSize: 31, fontWeight: 600, color: "#078ea3" }}>{r.weight}</span>
                    <span style={{ fontSize: 15, color: "#4d6878", fontWeight: 500 }}>kg</span>
                  </div>
                  {d !== null && (
                    <span style={{ fontSize: 15, color: d < 0 ? "#1bc6a7" : d > 0 ? "#ff7398" : "#607c8d", minWidth: 40, textAlign: "right", fontFamily: "'Manrope','Pretendard','Noto Sans KR',sans-serif", fontWeight: 500 }}>
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
          <div style={{ fontSize: 14, color: "#546f80", letterSpacing: "0.08em", marginBottom: 16, fontWeight: 600 }}>
            총 {sorted.length}개 기록
          </div>
          {[...sorted].reverse().map((r, i) => (
            <div key={r.id} className="rec-row fade-up" style={{ animationDelay: `${i * 0.03}s` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: "#3f5968", fontWeight: 500 }}>{fmtFull(r.date)}</div>
                {r.memo && <div style={{ fontSize: 14, color: "#557182", marginTop: 3 }}>{r.memo}</div>}
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
                  <button type="button" className="ico-btn" style={{ color: "#12acbe" }} onClick={() => handleEditSave(r.id)}>✓</button>
                  <button type="button" className="ico-btn" onClick={() => setEditId(null)}>✕</button>
                </div>
              ) : deleteConfirm === r.id ? (
                <div className="del-confirm">
                  <button type="button" className="del-yes" onClick={() => handleDelete(r.id)}>삭제</button>
                  <button type="button" className="del-no" onClick={() => setDeleteConfirm(null)}>취소</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'Manrope','Pretendard','Noto Sans KR',sans-serif", fontSize: 30, color: "#078ea3", fontWeight: 600 }}>{r.weight}</span>
                  <span style={{ fontSize: 15, color: "#4d6878", fontWeight: 500 }}>kg</span>
                  <button type="button" className="ico-btn" onClick={() => { setEditId(r.id); setEditWeight(r.weight.toString()); }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                      <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" />
                    </svg>
                  </button>
                  <button type="button" className="ico-btn" style={{ color: "#d25784" }} onClick={() => setDeleteConfirm(r.id)}>
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
