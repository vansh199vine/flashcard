import React, { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { Search, Moon, Sun, MoreVertical, Check, Bold, Italic, Underline, Highlighter, Trash2, X, Shuffle, Plus, ChevronDown, PauseCircle, PlayCircle, PenLine } from "lucide-react";

/* ------------------------------------------------------------------
   Flashcard Creator
   A calm, minimal, Apple-inspired flashcard app.
   Filters aren't a separate list you manage — they're derived
   directly from whatever's typed into a card's Filter field, so the
   pills below always reflect exactly what's actually on your cards.
------------------------------------------------------------------- */

const STORAGE_KEY = "flashcard-app-data";
const HIGHLIGHT_COLOR = "#FDE68A"; // highlighter yellow

/* Each filter gets a consistent color so cards stay scannable by
   grouping at a glance. The quiz's big flip card washes its whole
   face in a very light tint; the gallery instead keeps a neutral
   card and highlights only the filter tag, so the color signals
   the grouping without taking over the card. Same filter name always
   maps to the same color — no randomness, no manual assignment. */
const FILTER_PALETTE = [
  { light: "bg-rose-50 border-rose-100", dark: "bg-rose-950 border-rose-900" },
  { light: "bg-amber-50 border-amber-100", dark: "bg-amber-950 border-amber-900" },
  { light: "bg-lime-50 border-lime-100", dark: "bg-lime-950 border-lime-900" },
  { light: "bg-emerald-50 border-emerald-100", dark: "bg-emerald-950 border-emerald-900" },
  { light: "bg-sky-50 border-sky-100", dark: "bg-sky-950 border-sky-900" },
  { light: "bg-indigo-50 border-indigo-100", dark: "bg-indigo-950 border-indigo-900" },
  { light: "bg-violet-50 border-violet-100", dark: "bg-violet-950 border-violet-900" },
  { light: "bg-pink-50 border-pink-100", dark: "bg-pink-950 border-pink-900" },
];

const FILTER_TAG_PALETTE = [
  { light: "bg-rose-100 text-rose-700", dark: "bg-rose-400/10 text-rose-300" },
  { light: "bg-amber-100 text-amber-700", dark: "bg-amber-400/10 text-amber-300" },
  { light: "bg-lime-100 text-lime-700", dark: "bg-lime-400/10 text-lime-300" },
  { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/10 text-emerald-300" },
  { light: "bg-sky-100 text-sky-700", dark: "bg-sky-400/10 text-sky-300" },
  { light: "bg-indigo-100 text-indigo-700", dark: "bg-indigo-400/10 text-indigo-300" },
  { light: "bg-violet-100 text-violet-700", dark: "bg-violet-400/10 text-violet-300" },
  { light: "bg-pink-100 text-pink-700", dark: "bg-pink-400/10 text-pink-300" },
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getFilterTint(filterName, dark) {
  const entry = FILTER_PALETTE[hashString(filterName || "") % FILTER_PALETTE.length];
  return dark ? entry.dark : entry.light;
}

function getFilterTag(filterName, dark) {
  const entry = FILTER_TAG_PALETTE[hashString(filterName || "") % FILTER_TAG_PALETTE.length];
  return dark ? entry.dark : entry.light;
}

/* ---------- Theme tokens ----------
   Only core Tailwind palette classes are used here (neutral-50..950,
   white, black, standard shadow sizes) — this environment serves a
   pre-built stylesheet, not a live compiler, so arbitrary bracket
   values like bg-[#111] never generate real CSS and silently fail. */

function useTokens(theme) {
  const dark = theme === "dark";
  return {
    dark,
    page: dark ? "bg-neutral-950" : "bg-neutral-50",
    card: dark ? "bg-neutral-900 border border-neutral-800" : "bg-white border border-neutral-200",
    cardHover: dark
      ? "hover:border-neutral-700 hover:shadow-lg hover:shadow-black/40"
      : "hover:border-neutral-300 hover:shadow-md",
    shadow: dark ? "shadow-md shadow-black/30" : "shadow-sm",
    inputBg: dark
      ? "bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-neutral-500"
      : "bg-white border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:border-neutral-400",
    title: dark ? "text-neutral-50" : "text-neutral-900",
    subtitle: dark ? "text-neutral-500" : "text-neutral-400",
    label: "text-neutral-500",
    body: dark ? "text-neutral-100" : "text-neutral-900",
    muted: dark ? "text-neutral-400" : "text-neutral-500",
    badge: dark ? "bg-neutral-800 border border-neutral-700 text-neutral-300" : "bg-neutral-100 border border-neutral-200 text-neutral-600",
    pill: dark ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-700" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200",
    pillActive: dark ? "bg-white text-black" : "bg-black text-white",
    panelBg: dark ? "bg-neutral-900 border border-neutral-800" : "bg-white border border-neutral-200",
    iconMuted: dark ? "text-neutral-500 hover:bg-neutral-800" : "text-neutral-400 hover:bg-neutral-100",
  };
}

/* ---------- Reusable primitives ---------- */

function Button({ children, onClick, theme, className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2";
  const variant =
    theme === "dark"
      ? "bg-white text-black hover:bg-neutral-200 focus-visible:ring-neutral-500"
      : "bg-black text-white hover:bg-neutral-800 focus-visible:ring-neutral-400";
  return (
    <button onClick={onClick} className={`${base} ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

function Input({ theme, className = "", ...props }) {
  const t = useTokens(theme);
  return (
    <input
      className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-colors duration-200 ${t.inputBg} ${className}`}
      {...props}
    />
  );
}

/* ---------- Rich text description ----------
   Bold / italic / underline / highlight, scoped only to the
   description field. Uses a contentEditable div so formatting can be
   stored inline and rendered back on each flashcard. */

function RichTextToolbar({ theme, editorRef, onAfterCommand }) {
  const t = useTokens(theme);

  const run = (command, value = null) => (e) => {
    e.preventDefault(); // keep the current text selection alive
    editorRef.current?.focus();
    try {
      document.execCommand(command, false, value);
    } catch (err) {
      // Formatting command unsupported in this browser — no-op
    }
    onAfterCommand?.();
  };

  const btn = `flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 ${t.pill}`;

  return (
    <div className="flex items-center gap-1.5 mb-2">
      <button type="button" onMouseDown={run("bold")} className={btn} aria-label="Bold">
        <Bold size={14} />
      </button>
      <button type="button" onMouseDown={run("italic")} className={btn} aria-label="Italic">
        <Italic size={14} />
      </button>
      <button type="button" onMouseDown={run("underline")} className={btn} aria-label="Underline">
        <Underline size={14} />
      </button>
      <button
        type="button"
        onMouseDown={run("hiliteColor", HIGHLIGHT_COLOR)}
        className={btn}
        aria-label="Highlight"
      >
        <Highlighter size={14} />
      </button>
    </div>
  );
}

function DescriptionField({ theme, editorRef, onChange, hasError }) {
  const t = useTokens(theme);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleInput = () => {
    const html = editorRef.current?.innerHTML || "";
    const text = editorRef.current?.innerText || "";
    setIsEmpty(text.trim().length === 0);
    onChange(html, text);
  };

  return (
    <div>
      <RichTextToolbar theme={theme} editorRef={editorRef} onAfterCommand={handleInput} />
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          className={`w-full min-h-[120px] border rounded-xl px-4 py-3 text-sm leading-relaxed outline-none transition-colors duration-200 ${t.inputBg} ${
            hasError ? "ring-2 ring-red-400" : ""
          }`}
        />
        {isEmpty && (
          <p className={`absolute left-4 top-3 text-sm pointer-events-none ${t.subtitle}`}>
            Write the information you'd like to remember...
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- Feature components ---------- */

function FlashcardForm({ theme, filters, onCreate, onCancel }) {
  const [topic, setTopic] = useState("");
  const [filterInput, setFilterInput] = useState("");
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [descriptionText, setDescriptionText] = useState("");
  const [errors, setErrors] = useState({});
  const [resetKey, setResetKey] = useState(0);
  const editorRef = useRef(null);
  const t = useTokens(theme);

  const handleDescriptionChange = (html, text) => {
    setDescriptionHtml(html);
    setDescriptionText(text);
  };

  const addFilter = () => {
    const value = filterInput.trim();
    if (!value) return;
    setSelectedFilters((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setFilterInput("");
  };

  const removeFilter = (value) => {
    setSelectedFilters((prev) => prev.filter((f) => f !== value));
  };

  const handleFilterKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addFilter();
    }
  };

  const handleSubmit = () => {
    const nextErrors = {};
    if (!topic.trim()) nextErrors.topic = true;
    if (!descriptionText.trim()) nextErrors.description = true;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onCreate({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      topic: topic.trim(),
      filters: selectedFilters,
      description: descriptionHtml,
      createdAt: Date.now(),
    });

    setTopic("");
    setSelectedFilters([]);
    setFilterInput("");
    setDescriptionHtml("");
    setDescriptionText("");
    setErrors({});
    setResetKey((k) => k + 1); // remounts the editor to a clean, empty state
  };

  const errorRing = "ring-2 ring-red-400";

  return (
    <div className={`w-full rounded-3xl p-8 space-y-6 ${t.card} ${t.shadow}`}>
      {onCancel && (
        <div className="flex justify-end -mb-4 -mt-2">
          <button
            onClick={onCancel}
            aria-label="Close form"
            className={`rounded-full p-1.5 transition-colors duration-200 ${t.iconMuted}`}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div>
        <label className={`block text-xs font-medium mb-2 tracking-wide uppercase ${t.label}`}>Topic</label>
        <Input
          theme={theme}
          placeholder="Topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className={errors.topic ? errorRing : ""}
        />
      </div>

      <div>
        <label className={`block text-xs font-medium mb-2 tracking-wide uppercase ${t.label}`}>Filters</label>
        <div className="flex gap-2">
          <Input
            theme={theme}
            list="filter-suggestions"
            placeholder="Add a grouping, press Enter"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            onKeyDown={handleFilterKeyDown}
          />
          <button
            type="button"
            onClick={addFilter}
            className={`shrink-0 rounded-xl px-4 text-sm font-medium transition-colors duration-200 ${t.pill}`}
          >
            Add
          </button>
        </div>
        <datalist id="filter-suggestions">
          {filters.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        {selectedFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {selectedFilters.map((f) => (
              <span
                key={f}
                className={`inline-flex items-center gap-1 text-xs font-medium pl-2 pr-1.5 py-0.5 rounded-full ${getFilterTag(f, t.dark)}`}
              >
                {f}
                <button
                  type="button"
                  onClick={() => removeFilter(f)}
                  aria-label={`Remove ${f}`}
                  className="hover:opacity-60"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={`block text-xs font-medium tracking-wide uppercase ${t.label}`}>Description</label>
          <span className={`text-xs ${t.label}`}>{descriptionText.length} characters</span>
        </div>
        <DescriptionField
          key={resetKey}
          theme={theme}
          editorRef={editorRef}
          onChange={handleDescriptionChange}
          hasError={errors.description}
        />
      </div>

      <Button theme={theme} onClick={handleSubmit} className="w-full rounded-2xl py-3.5 text-sm hover:scale-[1.01]">
        Create Flashcard
      </Button>
    </div>
  );
}

function Flashcard({ card, theme, index, onDelete }) {
  const t = useTokens(theme);
  const cardFilters = card.filters || [];
  const [menuOpen, setMenuOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const menuBg = theme === "dark" ? "bg-neutral-800 border border-neutral-700" : "bg-white border border-neutral-200";
  const deleteHover = theme === "dark" ? "hover:bg-red-950" : "hover:bg-red-50";

  return (
    <div
      className="flashcard-enter"
      data-agent-card="true"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div
        style={{ perspective: "1200px" }}
        className="cursor-pointer select-none"
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className={`relative h-44 rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${t.card} ${t.shadow} ${t.cardHover}`}
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front: filter tag + topic */}
          <div className="absolute inset-0 flex flex-col p-4" style={{ backfaceVisibility: "hidden" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {cardFilters.map((f) => (
                  <span
                    key={f}
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${getFilterTag(f, t.dark)}`}
                  >
                    {f}
                  </span>
                ))}
              </div>
              <div className="relative shrink-0 -mr-1 -mt-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className={`rounded-full p-1 transition-colors duration-200 ${t.iconMuted}`}
                  aria-label="More options"
                >
                  <MoreVertical size={14} />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className={`absolute right-0 top-full mt-1 z-20 rounded-xl shadow-lg overflow-hidden ${menuBg}`}>
                      <button
                        onClick={() => {
                          onDelete(card.id);
                          setMenuOpen(false);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-500 w-full text-left whitespace-nowrap transition-colors duration-150 ${deleteHover}`}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center text-center px-1">
              <h3 className={`text-sm font-semibold leading-snug ${t.body}`}>{card.topic}</h3>
            </div>
            <p className={`text-center text-[10px] ${t.subtitle}`}>Tap to flip</p>
          </div>

          {/* Back: description */}
          <div
            className="absolute inset-0 flex items-center justify-center p-4 text-center overflow-auto"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div
              className={`text-xs leading-relaxed line-clamp-5 ${t.muted}`}
              dangerouslySetInnerHTML={{ __html: card.description }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FlashcardGrid({ cards, theme, onDelete }) {
  const t = useTokens(theme);

  if (cards.length === 0) {
    return (
      <div className="w-full py-20 flex items-center justify-center">
        <p className={`text-sm ${t.subtitle}`}>No flashcards yet. Create your first one!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, i) => (
        <Flashcard key={card.id} card={card} theme={theme} index={i} onDelete={onDelete} />
      ))}
    </div>
  );
}

/* Filter pill bar: "All" plus only the groupings the user has
   actually typed into the form. No presets, no manage panel — the
   list here is purely a reflection of what's been created. */
function FilterBar({ theme, filters, activeFilter, onSelectFilter }) {
  const t = useTokens(theme);

  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <button
        onClick={() => onSelectFilter("All")}
        className={`text-sm font-medium px-3.5 py-1.5 rounded-full transition-colors duration-200 ${
          activeFilter === "All" ? t.pillActive : t.pill
        }`}
      >
        All
      </button>
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onSelectFilter(f)}
          className={`text-sm font-medium px-3.5 py-1.5 rounded-full transition-colors duration-200 ${
            activeFilter === f ? t.pillActive : t.pill
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function Toast({ message, theme }) {
  if (!message) return null;
  const bg = theme === "dark" ? "bg-white text-black" : "bg-black text-white";
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 toast-enter">
      <div className={`flex items-center gap-2 rounded-full px-5 py-3 shadow-lg text-sm font-medium ${bg}`}>
        <Check size={15} />
        {message}
      </div>
    </div>
  );
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* Quizlet-style study mode: shuffled order, topic shown first, click
   or Space to flip and reveal the description, arrow keys to move
   between cards. */
function QuizModal({ cards, scopeLabel, theme, onClose }) {
  const t = useTokens(theme);
  const [order] = useState(() => shuffleArray(cards));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const total = order.length;
  const current = order[index];

  const goNext = () => {
    setFlipped(false);
    setIndex((i) => (i + 1) % total);
  };
  const goPrev = () => {
    setFlipped(false);
    setIndex((i) => (i - 1 + total) % total);
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  if (total === 0 || !current) return null;

  const overlayBg = theme === "dark" ? "bg-black/80" : "bg-black/40";
  const border = theme === "dark" ? "border-neutral-800" : "border-neutral-200";
  const tintName = scopeLabel && scopeLabel !== "All" ? scopeLabel : (current.filters || [])[0] || "";
  const tint = getFilterTint(tintName, t.dark);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${overlayBg}`}>
      <div className={`w-full max-w-lg rounded-3xl p-8 ${t.page} border ${border}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className={`block text-xs font-medium tracking-wide uppercase ${t.label}`}>
              {index + 1} / {total}
            </span>
            <span className={`text-[11px] ${t.subtitle}`}>
              {scopeLabel && scopeLabel !== "All" ? `Testing: ${scopeLabel}` : "Testing: all flashcards"}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close quiz"
            className={`rounded-full p-2 transition-colors duration-200 ${t.iconMuted}`}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ perspective: "1200px" }} className="mb-8 cursor-pointer select-none" onClick={() => setFlipped((f) => !f)}>
          <div
            className={`relative h-64 sm:h-72 rounded-3xl border ${tint} ${t.shadow}`}
            style={{
              transformStyle: "preserve-3d",
              transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* Front: topic only */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
              style={{ backfaceVisibility: "hidden" }}
            >
              <span className={`text-xs font-medium mb-3 ${t.label}`}>{(current.filters || []).join(" · ")}</span>
              <h3 className={`text-2xl font-semibold ${t.body}`}>{current.topic}</h3>
              <p className={`mt-5 text-xs ${t.subtitle}`}>Click to flip</p>
            </div>
            {/* Back: description */}
            <div
              className="absolute inset-0 flex items-center justify-center p-8 text-center overflow-auto"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <div className={`text-sm leading-relaxed ${t.muted}`} dangerouslySetInnerHTML={{ __html: current.description }} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={goPrev}
            className={`text-sm font-medium px-4 py-2.5 rounded-xl transition-colors duration-200 ${t.pill}`}
          >
            Previous
          </button>
          <button
            onClick={() => setFlipped((f) => !f)}
            className={`text-sm font-medium px-4 py-2.5 rounded-xl transition-colors duration-200 ${t.pill}`}
          >
            Flip
          </button>
          <Button theme={theme} onClick={goNext} className="rounded-xl px-5 py-2.5 text-sm">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

/* A tiny 8-bit dinosaur that lives only on the "New flashcard" box,
   pacing back and forth within its width at a slow, constant wander,
   periodically charging up and firing a blue beam at whichever
   helicopter it picks as a target. */
const TREX_W = 94;
const TREX_H = 58;
const TREX_WANDER_SPEED = 0.02; // px per ms — slow, constant, no chasing

function TRexSprite({ legPhase, dark, breathing }) {
  const body = dark ? "#8bc065" : "#4f7a34";
  const belly = dark ? "#638f43" : "#375a22";
  const spine = dark ? "#a8d888" : "#6a9c50";
  const claw = dark ? "#f5f5f5" : "#1c1c1c";
  const eyeWhite = "#f5f5f5";
  const pupil = "#111111";
  const teeth = "#f5f5f5";
  return (
    <svg viewBox="0 0 34 16" width={TREX_W} height={TREX_H} shapeRendering="crispEdges" style={{ overflow: "visible" }}>
      {/* tail, tapering to a point */}
      <rect x="0" y="9" width="3" height="2" fill={body} />
      <rect x="2" y="8" width="3" height="3" fill={body} />
      <rect x="4" y="7" width="4" height="3" fill={body} />
      <rect x="1" y="9" width="6" height="1" fill={spine} />
      {/* body + back hump */}
      <rect x="7" y="4" width="8" height="6" fill={body} />
      <rect x="8" y="2" width="5" height="3" fill={body} />
      <rect x="8" y="2" width="5" height="1" fill={spine} />
      <rect x="8" y="8" width="7" height="2" fill={belly} />
      {/* tiny arm */}
      <rect x="13" y="7" width="2" height="1" fill={body} />
      {/* neck + long head */}
      <rect x="14" y="1" width="4" height="4" fill={body} />
      <rect x="17" y="0" width="7" height="4" fill={body} />
      <rect x="22" y="3" width="3" height="1" fill={body} />
      {/* jaw line + teeth */}
      <rect x="18" y="4" width="6" height="1" fill={belly} />
      <rect x="19" y="4" width="1" height="1" fill={teeth} />
      <rect x="21" y="4" width="1" height="1" fill={teeth} />
      {/* eye */}
      <rect x="21" y="1" width="2" height="1" fill={eyeWhite} />
      <rect x="22" y="1" width="1" height="1" fill={pupil} />
      {breathing && (
        <g className="trex-flicker">
          <rect x="24" y="1" width="5" height="6" fill="#ff9500" />
          <rect x="28" y="-1" width="6" height="5" fill="#ff5a00" />
          <rect x="28" y="5" width="6" height="5" fill="#ff5a00" />
          <rect x="34" y="1" width="6" height="6" fill="#ffd000" />
          <rect x="39" y="2" width="4" height="4" fill="#fffbe0" />
        </g>
      )}
      {legPhase ? (
        <>
          <rect x="8" y="11" width="3" height="4" fill={body} />
          <rect x="12" y="10" width="4" height="3" fill={body} />
          <rect x="8" y="14" width="1" height="1" fill={claw} />
          <rect x="15" y="12" width="1" height="1" fill={claw} />
        </>
      ) : (
        <>
          <rect x="8" y="10" width="3" height="3" fill={body} />
          <rect x="12" y="11" width="4" height="4" fill={body} />
          <rect x="8" y="12" width="1" height="1" fill={claw} />
          <rect x="15" y="14" width="1" height="1" fill={claw} />
        </>
      )}
    </svg>
  );
}

/* Roams the "New flashcard" box on its own, slow and constant, and
   every so often charges up and fires a blue atomic beam at one of
   the two helicopters (whichever one is currently airborne). */
function TRexPet({ formBoxRef, positionRef, theme, heliARef, heliBRef, headerRef }) {
  const dark = theme === "dark";
  const [x, setX] = useState(20);
  const [y, setY] = useState(0);
  const [facingLeft, setFacingLeft] = useState(false);
  const [legPhase, setLegPhase] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const [beam, setBeam] = useState(null);
  const xRef = useRef(20);
  const yRef = useRef(0);
  const dirRef = useRef(1);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let raf;
    let last = performance.now();
    const legTimer = setInterval(() => setLegPhase((p) => !p), 300);

    const tick = (now) => {
      const dt = Math.min(48, now - last);
      last = now;
      const el = formBoxRef.current;
      if (!el) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const rect = el.getBoundingClientRect();
      const minX = rect.left + 12;
      const maxX = rect.right - 12 - TREX_W;

      if (xRef.current <= minX) dirRef.current = 1;
      else if (xRef.current >= maxX) dirRef.current = -1;

      xRef.current = Math.min(maxX, Math.max(minX, xRef.current + dirRef.current * TREX_WANDER_SPEED * dt));
      const trexY = rect.top - TREX_H + 8;
      yRef.current = trexY;

      setX(xRef.current);
      setY(trexY);
      setFacingLeft(dirRef.current < 0);
      if (positionRef) positionRef.current = { x: xRef.current, y: trexY };
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(legTimer);
    };
  }, [formBoxRef]);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (!heliARef && !heliBRef) return undefined;
    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // A helicopter counts as a valid target once it's actually flying —
    // both start parked at a y of -80 before their first pass.
    const pickTarget = () => {
      const candidates = [heliARef?.current, heliBRef?.current].filter((p) => p && p.y > -40);
      if (candidates.length === 0) return null;
      return candidates[Math.floor(Math.random() * candidates.length)];
    };

    // The title must never be blocked by anything — including a beam
    // passing behind it — so a shot that would cross the header rect
    // is simply skipped rather than fired.
    const crossesHeader = (x1, y1, x2, y2) => {
      const rect = headerRef?.current?.getBoundingClientRect();
      if (!rect) return false;
      const pad = 8;
      const left = rect.left - pad;
      const right = rect.right + pad;
      const top = rect.top - pad;
      const bottom = rect.bottom + pad;
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        if (x >= left && x <= right && y >= top && y <= bottom) return true;
      }
      return false;
    };

    const loop = async () => {
      await sleep(4000 + Math.random() * 4000);
      while (!cancelled) {
        // Each time it attacks, randomly do one or the other — never
        // both together, and never the same fixed fire-then-beam order.
        const target = Math.random() < 0.5 ? pickTarget() : null;
        if (target) {
          // Aim assist: turn to face the target's side before firing,
          // then fire from the center of whichever side is now facing
          // outward, straight at the target's exact center.
          dirRef.current = target.x >= xRef.current ? 1 : -1;
          const facingLeftNow = dirRef.current < 0;
          const originX = facingLeftNow ? xRef.current + TREX_W * 0.12 : xRef.current + TREX_W * 0.88;
          const originY = yRef.current + TREX_H * 0.16;
          const targetX = target.x + HELI_W / 2;
          const targetY = target.y + HELI_H / 2;
          if (!crossesHeader(originX, originY, targetX, targetY)) {
            setBeam({ x1: originX, y1: originY, x2: targetX, y2: targetY });
            await sleep(400 + Math.random() * 200);
            if (cancelled) return;
            setBeam(null);
          }
        } else {
          setBreathing(true);
          await sleep(600 + Math.random() * 400);
          if (cancelled) return;
          setBreathing(false);
        }
        await sleep(6000 + Math.random() * 5000);
      }
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, [heliARef, heliBRef]);

  return (
    <>
      {beam && (
        <svg
          aria-hidden="true"
          style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 45 }}
        >
          <line x1={beam.x1} y1={beam.y1} x2={beam.x2} y2={beam.y2} stroke="#3aa0ff" strokeWidth="9" opacity="0.35" strokeLinecap="round" />
          <line x1={beam.x1} y1={beam.y1} x2={beam.x2} y2={beam.y2} stroke="#8fe0ff" strokeWidth="4" opacity="0.95" strokeLinecap="round" />
        </svg>
      )}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: x,
          top: y,
          width: TREX_W,
          height: TREX_H,
          zIndex: 44,
          pointerEvents: "none",
          transform: facingLeft ? "scaleX(-1)" : "scaleX(1)",
        }}
      >
        <TRexSprite legPhase={legPhase} dark={dark} breathing={breathing} />
      </div>
    </>
  );
}

/* A helicopter that shows up out of nowhere every so often, cuts an
   irregular path across the top-left of the screen, and leaves a
   dashed flight trail that fades out behind it. */
const HELI_W = 40;
const HELI_H = 20;

function HelicopterSprite({ dark }) {
  const color = dark ? "#f5f5f5" : "#111111";
  return (
    <svg viewBox="0 0 40 24" width={HELI_W} height={HELI_H} style={{ overflow: "visible" }}>
      <g style={{ transformOrigin: "18px 6px" }} className="rotor-spin">
        <rect x="2" y="5" width="32" height="1.6" fill={color} />
      </g>
      <rect x="16" y="6" width="2" height="4" fill={color} />
      <ellipse cx="17" cy="14" rx="11" ry="6.5" fill={color} />
      <rect x="26" y="12" width="13" height="2.2" fill={color} />
      <rect x="37" y="6" width="1.6" height="9" fill={color} />
      <rect x="9" y="19" width="17" height="1.6" fill={color} />
      <rect x="11" y="16" width="1.6" height="4.5" fill={color} />
      <rect x="22" y="16" width="1.6" height="4.5" fill={color} />
    </svg>
  );
}

const HELI_MIN_GAP = 100; // the two helicopters never close tighter than this

function Helicopter({
  theme,
  formBoxRef,
  quizButtonRef,
  themeButtonRef,
  headerRef,
  trexPosRef,
  selfPosRef,
  otherPosRef,
  startDelay = 0,
}) {
  const dark = theme === "dark";
  const [pos, setPos] = useState({ x: -80, y: -80 });
  const [bank, setBank] = useState(0);
  const [facingRight, setFacingRight] = useState(false);
  const [visible, setVisible] = useState(false);
  const [trail, setTrail] = useState([]);
  const [laser, setLaser] = useState(null);
  const posRef = useRef(pos);
  const dirXRef = useRef(-1);
  posRef.current = pos;
  if (selfPosRef) selfPosRef.current = pos;

  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let cancelled = false;
    let raf;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    // Eased in/out rather than snapped on, so the bank angle never
    // introduces a sudden jump.
    const bankState = { current: 0 };

    // Catmull-Rom: a smooth curve that actually passes through every
    // waypoint, so the flight has no straight-line kinks at the joins.
    const catmullRom = (p0, p1, p2, p3, t) => {
      const t2 = t * t;
      const t3 = t2 * t;
      return {
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      };
    };

    // Real UI it needs to steer clear of — the title, the form box below,
    // and the quiz / theme buttons up top.
    const getGuards = () => {
      const pad = 42;
      const guards = [quizButtonRef?.current, themeButtonRef?.current, headerRef?.current]
        .filter(Boolean)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left - pad, right: r.right + pad, top: r.top - pad, bottom: r.bottom + pad };
        });
      const formRect = formBoxRef?.current?.getBoundingClientRect();
      const ceilingY = formRect ? Math.max(70, formRect.top - 36) : 220;
      return { guards, ceilingY };
    };
    const clearOf = (guards, x, y) => guards.every((r) => x < r.left || x > r.right || y < r.top || y > r.bottom);

    // A fresh irregular set of waypoints, continuing on from wherever it
    // already is (no teleporting back to the edge), resampling a
    // candidate point a few times if it lands inside a guarded rect or
    // too near the other helicopter's current spot. Avoidance is baked
    // into the waypoints themselves — the flight afterward just follows
    // the resulting spline with nothing pushing on it mid-flight, so the
    // curve itself never gets bent into a straight line or a loop.
    const buildPath = (from, guards, ceilingY) => {
      // The full page width, not just a corner — it flies edge to edge.
      const minX = -80;
      const maxX = window.innerWidth + 80;
      const other = otherPosRef?.current;
      const points = [from];
      const legs = 3 + Math.floor(Math.random() * 2);
      let curX = from.x;
      let curY = from.y;
      for (let i = 0; i < legs; i++) {
        let x = curX;
        let y = curY;
        for (let tries = 0; tries < 10; tries++) {
          const atLeftEdge = curX < minX + 80;
          const atRightEdge = curX > maxX - 80;
          const dir = atLeftEdge ? 1 : atRightEdge ? -1 : Math.random() < 0.08 ? -1 : 1;
          x = Math.max(minX, Math.min(maxX, curX + dir * (160 + Math.random() * 220)));
          // A gentle drift from the current height rather than a fresh
          // random pick each leg, so the curve doesn't zigzag vertically.
          y = Math.max(20, Math.min(ceilingY, curY + (Math.random() - 0.5) * 70));
          const nearOther = other && Math.hypot(x - other.x, y - other.y) < HELI_MIN_GAP;
          if (clearOf(guards, x, y) && !nearOther) break;
        }
        curY = y;
        points.push({ x, y });
        curX = x;
      }
      return points;
    };

    // Glides through the whole spline in one continuous motion — no
    // per-leg resets — with position driven every frame from real
    // elapsed time (not CSS transitions), so whatever samples it for the
    // trail is always the true on-screen spot, dashes laid one at a time.
    const CRUISE_SPEED = 0.07; // px per ms — constant, so long legs just take longer

    const flyCurve = (from) =>
      new Promise((resolve) => {
        const { guards, ceilingY } = getGuards();
        const pts = buildPath(from, guards, ceilingY);
        const segs = pts.length - 1;
        const at = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];

        // Segment duration is proportional to its own length, at one
        // constant cruising speed — no more implicit speed-up/slow-down
        // between a short leg and a long one.
        const segMs = [];
        for (let i = 0; i < segs; i++) {
          const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
          segMs.push(Math.max(900, d / CRUISE_SPEED));
        }
        const segStart = [0];
        segMs.forEach((m) => segStart.push(segStart[segStart.length - 1] + m));
        const totalMs = segStart[segStart.length - 1];
        const start = performance.now();

        // Shared by both the current position and the lookahead sample
        // below, so the lookahead can cross into the next segment
        // instead of flattening out against the end of the current one.
        const sampleAt = (ms) => {
          const clamped = Math.max(0, Math.min(totalMs, ms));
          let seg = 0;
          while (seg < segs - 1 && clamped >= segStart[seg + 1]) seg++;
          const t = (clamped - segStart[seg]) / segMs[seg];
          return catmullRom(at(seg - 1), at(seg), at(seg + 1), at(seg + 2), t);
        };

        const tick = (now) => {
          if (cancelled) {
            resolve(pts[pts.length - 1]);
            return;
          }
          const elapsed = now - start;
          if (elapsed >= totalMs) {
            resolve(pts[pts.length - 1]);
            return;
          }
          const next = sampleAt(elapsed);
          const ahead = sampleAt(elapsed + 90);
          setPos(next);
          posRef.current = next;
          if (selfPosRef) selfPosRef.current = next;
          const dx = ahead.x - next.x;
          // Small deadzone so near-vertical moments don't flicker the
          // sprite's facing back and forth.
          if (Math.abs(dx) > 0.5) {
            const goingRight = dx > 0;
            dirXRef.current = goingRight ? 1 : -1;
            setFacingRight(goingRight);
          }
          const targetBank = Math.max(-16, Math.min(16, dx * 26));
          bankState.current += (targetBank - bankState.current) * 0.1;
          setBank(bankState.current);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });

    // It keeps going — one curved path flows straight into the next,
    // with no long stop, only a brief pause before its very first pass.
    const loop = async () => {
      await sleep(startDelay + 2500 + Math.random() * 2500);
      setVisible(true);
      let at = { x: -50, y: 60 + Math.random() * 80 };
      setPos(at);
      posRef.current = at;
      if (selfPosRef) selfPosRef.current = at;
      while (!cancelled) {
        at = await flyCurve(at);
      }
    };
    loop();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [formBoxRef, quizButtonRef, themeButtonRef, headerRef, otherPosRef, selfPosRef, startDelay]);

  // Fires an occasional red laser at wherever the T-Rex currently is.
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (!trexPosRef) return undefined;

    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const fireLoop = async () => {
      await sleep(startDelay + 6000 + Math.random() * 5000);
      while (!cancelled) {
        const trex = trexPosRef.current;
        const from = posRef.current;
        if (trex && from) {
          // Fires from whichever side is currently the nose, and aims
          // dead-center at the T-Rex — no near-misses.
          const noseRight = dirXRef.current > 0;
          setLaser({
            x1: from.x + (noseRight ? HELI_W * 0.675 : HELI_W * 0.325),
            y1: from.y + HELI_H * 0.6,
            x2: trex.x + TREX_W / 2,
            y2: trex.y + TREX_H / 2,
          });
          await sleep(180);
          if (cancelled) return;
          setLaser(null);
        }
        await sleep(5000 + Math.random() * 6000);
      }
    };
    fireLoop();

    return () => {
      cancelled = true;
    };
  }, [trexPosRef, startDelay]);

  useEffect(() => {
    if (!visible) return undefined;
    const id = setInterval(() => {
      setTrail((prev) => [...prev, { x: posRef.current.x, y: posRef.current.y, born: performance.now() }].slice(-90));
    }, 110);
    return () => clearInterval(id);
  }, [visible]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      setTrail((prev) => prev.filter((p) => now - p.born < 2400));
    }, 200);
    return () => clearInterval(id);
  }, []);

  const strokeColor = dark ? "#f5f5f5" : "#111111";
  const now = performance.now();

  return (
    <>
      <svg
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 42 }}
      >
        {trail.slice(1).map((p, i) => {
          const prev = trail[i];
          const age = now - p.born;
          const opacity = Math.max(0, 1 - age / 2400) * 0.6;
          return (
            <line
              key={i}
              x1={prev.x + HELI_W / 2}
              y1={prev.y + HELI_H / 2}
              x2={p.x + HELI_W / 2}
              y2={p.y + HELI_H / 2}
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeDasharray="5 5"
              opacity={opacity}
            />
          );
        })}
        {laser && <line x1={laser.x1} y1={laser.y1} x2={laser.x2} y2={laser.y2} stroke="#ff2d2d" strokeWidth="2.5" />}
      </svg>
      {visible && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            width: HELI_W,
            height: HELI_H,
            zIndex: 43,
            pointerEvents: "none",
            transform: `scaleX(${facingRight ? -1 : 1}) rotate(${facingRight ? -bank : bank}deg)`,
          }}
        >
          <HelicopterSprite dark={dark} />
        </div>
      )}
    </>
  );
}

/* ---------- Draw ----------
   A full-page freehand canvas. Transparent and click-through while
   inactive so it never blocks the app; when active it captures pointer
   input and lets the user scribble anywhere on the page. Strokes are
   kept in a ref (not React state) and replayed on resize, since
   resizing a canvas element clears its pixel buffer. */
const DrawingCanvas = forwardRef(function DrawingCanvas({ active, dark }, ref) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const currentRef = useRef(null);
  const drawingRef = useRef(false);

  const strokeStyle = () => (dark ? "#f5f5f5" : "#111111");

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = strokeStyle();
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    strokesRef.current.forEach((stroke) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    });
  };

  useImperativeHandle(ref, () => ({
    clear: () => {
      strokesRef.current = [];
      redraw();
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    redraw();
  }, [dark]); // eslint-disable-line react-hooks/exhaustive-deps

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    if (!active) return;
    canvasRef.current.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentRef.current = [point(e)];
  };
  const move = (e) => {
    if (!active || !drawingRef.current) return;
    const pts = currentRef.current;
    pts.push(point(e));
    const n = pts.length;
    if (n < 2) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = strokeStyle();
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[n - 2].x, pts[n - 2].y);
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentRef.current && currentRef.current.length > 1) {
      strokesRef.current.push(currentRef.current);
    }
    currentRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 45,
        touchAction: "none",
        pointerEvents: active ? "auto" : "none",
        cursor: active ? "crosshair" : "default",
      }}
    />
  );
});

/* ---------- Doodle ----------
   Generates an actual 8-bit sprite from a text prompt via the Stability
   AI API (text-to-image styled as pixel art, then a background-removal
   pass so it drops onto the page as a transparent sprite instead of a
   white square), and drops it onto the page as a free-floating,
   draggable image — users can call this repeatedly to build up a
   scene. The API key is entered by the user and kept in this browser's
   localStorage only. */
const STABILITY_KEY_STORAGE = "stability_api_key";

async function generateSprite(prompt, apiKey) {
  const genForm = new FormData();
  genForm.append(
    "prompt",
    `${prompt}, pixel art, 8-bit video game sprite, centered, isolated on a plain white background, no shadow`
  );
  genForm.append("style_preset", "pixel-art");
  genForm.append("output_format", "png");
  genForm.append("aspect_ratio", "1:1");

  const genRes = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "image/*" },
    body: genForm,
  });
  if (!genRes.ok) {
    const msg = await genRes.text().catch(() => "");
    throw new Error(`Image generation failed (${genRes.status}): ${msg.slice(0, 200)}`);
  }
  const genBlob = await genRes.blob();

  // Background removal is a nice-to-have — if it fails, fall back to
  // the raw generated image rather than losing the sprite entirely.
  try {
    const bgForm = new FormData();
    bgForm.append("image", genBlob, "sprite.png");
    bgForm.append("output_format", "png");
    const bgRes = await fetch("https://api.stability.ai/v2beta/stable-image/edit/remove-background", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "image/*" },
      body: bgForm,
    });
    if (!bgRes.ok) return URL.createObjectURL(genBlob);
    return URL.createObjectURL(await bgRes.blob());
  } catch {
    return URL.createObjectURL(genBlob);
  }
}

function DoodleModal({ theme, onSubmit, onClose }) {
  const t = useTokens(theme);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STABILITY_KEY_STORAGE) || "");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const overlayBg = theme === "dark" ? "bg-black/80" : "bg-black/40";
  const border = theme === "dark" ? "border-neutral-800" : "border-neutral-200";

  const submit = async () => {
    if (!text.trim() || !apiKey.trim() || loading) return;
    setError("");
    setLoading(true);
    localStorage.setItem(STABILITY_KEY_STORAGE, apiKey.trim());
    try {
      const imageUrl = await generateSprite(text.trim(), apiKey.trim());
      onSubmit({ imageUrl, text: text.trim() });
    } catch (err) {
      setError(err.message || "Something went wrong generating that sprite.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${overlayBg}`} onClick={onClose}>
      <div className={`w-full max-w-sm rounded-3xl p-6 ${t.page} border ${border}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-semibold ${t.body}`}>Generate an 8-bit sprite</h3>
          <button onClick={onClose} aria-label="Close" className={`rounded-full p-2 transition-colors duration-200 ${t.iconMuted}`}>
            <X size={15} />
          </button>
        </div>
        <label className={`block text-xs font-medium mb-1.5 ${t.label}`}>Stability AI API key</label>
        <Input
          theme={theme}
          type="password"
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="mb-3"
        />
        <label className={`block text-xs font-medium mb-1.5 ${t.label}`}>What should it be?</label>
        <Input
          theme={theme}
          autoFocus
          placeholder="e.g. a red dragon, a blue robot..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="flex justify-end mt-4">
          <Button
            theme={theme}
            onClick={submit}
            disabled={loading}
            className="rounded-xl px-5 py-2.5 text-sm disabled:opacity-60"
          >
            {loading ? "Generating…" : "Generate"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DoodleDisplay({ doodle, onClose }) {
  // Spawn near the bottom-left, well clear of the title regardless of
  // viewport size, rather than a fixed top-of-page spot every sprite
  // would otherwise pile up on.
  const [pos, setPos] = useState(() => ({
    x: 24 + Math.random() * 140,
    y: Math.max(140, window.innerHeight - 200 + Math.random() * 60),
  }));
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const startDrag = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
    offsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  const onDrag = (e) => {
    if (!draggingRef.current) return;
    setPos({ x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y });
  };
  const endDrag = () => {
    draggingRef.current = false;
    setDragging(false);
  };

  return (
    <div
      className="fixed z-40 group"
      style={{ left: pos.x, top: pos.y, touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
      onPointerDown={startDrag}
      onPointerMove={onDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img
        src={doodle.imageUrl}
        alt={doodle.text}
        draggable={false}
        style={{ width: 96, height: 96, objectFit: "contain", imageRendering: "pixelated", userSelect: "none" }}
      />
      <button
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Remove sprite"
        className="absolute -top-1.5 -right-1.5 rounded-full bg-black/70 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      >
        <X size={10} />
      </button>
    </div>
  );
}

/* ---------- Root app ---------- */

export default function App() {
  const [flashcards, setFlashcards] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("light");
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizScope, setQuizScope] = useState("All");
  const [quizMenuOpen, setQuizMenuOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [motionOn, setMotionOn] = useState(true);
  const [doodleModalOpen, setDoodleModalOpen] = useState(false);
  const [doodleMenuOpen, setDoodleMenuOpen] = useState(false);
  const [doodles, setDoodles] = useState([]);
  const [drawMode, setDrawMode] = useState(false);
  const drawCanvasRef = useRef(null);
  const toastTimeout = useRef(null);
  const headerRef = useRef(null);
  const formBoxRef = useRef(null);
  const searchBoxRef = useRef(null);
  const quizButtonRef = useRef(null);
  const themeButtonRef = useRef(null);
  const trexPosRef = useRef({ x: -9999, y: -9999 });
  const heliARef = useRef({ x: -9999, y: -9999 });
  const heliBRef = useRef({ x: -9999, y: -9999 });
  const t = useTokens(theme);

  // Filters are never stored on their own — they're computed fresh
  // from the flashcards that exist right now, so there's no way for
  // an old or orphaned grouping to linger in the UI.
  const filters = useMemo(() => {
    const unique = new Set();
    flashcards.forEach((c) => (c.filters || []).forEach((f) => unique.add(f)));
    return Array.from(unique);
  }, [flashcards]);

  // Load persisted flashcards on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.flashcards)) {
          // Older saved cards may still carry a single `filter` string —
          // lift it into the `filters` array so nothing gets lost.
          const migrated = parsed.flashcards.map((c) =>
            c.filters ? c : { ...c, filters: c.filter ? [c.filter] : [] }
          );
          setFlashcards(migrated);
        }
      }
    } catch (err) {
      // No saved data yet, or read failed — start fresh
    } finally {
      setLoaded(true);
    }
  }, []);

  // Persist whenever flashcards change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ flashcards }));
    } catch (err) {
      console.error("Failed to save app data", err);
    }
  }, [flashcards, loaded]);

  const handleCreate = (card) => {
    const finalCard = { ...card, filters: card.filters.length ? card.filters : ["Uncategorized"] };
    setFlashcards((prev) => [finalCard, ...prev]);
    setToast("Flashcard created!");
    clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(""), 2500);
    setFormOpen(false);
  };

  const handleDelete = (id) => {
    setFlashcards((prev) => prev.filter((c) => c.id !== id));
  };

  // Quiz scope is chosen independently from the dropdown on the Quiz
  // button — it doesn't borrow the gallery's browse filter, so studying
  // one grouping doesn't depend on what you happened to be browsing.
  const cardsForScope = (scope) =>
    scope === "All" ? flashcards : flashcards.filter((c) => (c.filters || []).includes(scope));

  const handleStartQuiz = (scope) => {
    const cards = cardsForScope(scope);
    setQuizMenuOpen(false);
    if (cards.length === 0) {
      setToast(scope === "All" ? "Add a flashcard before starting a quiz" : `No flashcards tagged "${scope}"`);
      clearTimeout(toastTimeout.current);
      toastTimeout.current = setTimeout(() => setToast(""), 2500);
      return;
    }
    setQuizScope(scope);
    setShowQuiz(true);
  };

  const filteredCards = flashcards.filter((c) => {
    const cardFilters = c.filters || [];
    const matchesFilter = activeFilter === "All" || cardFilters.includes(activeFilter);
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.topic.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      cardFilters.some((f) => f.toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className={`min-h-screen w-full isolate transition-colors duration-300 ${t.page}`}>
      <style>{`
        @keyframes fadeInPage {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastEnter {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes runCycleA {
          0%, 24.9% { opacity: 1; }
          25%, 100% { opacity: 0; }
        }
        @keyframes runCycleMid {
          0%, 24.9% { opacity: 0; }
          25%, 49.9% { opacity: 1; }
          50%, 74.9% { opacity: 0; }
          75%, 99.9% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes runCycleB {
          0%, 49.9% { opacity: 0; }
          50%, 74.9% { opacity: 1; }
          75%, 100% { opacity: 0; }
        }
        @keyframes agentBreathe {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.025); }
        }
        @keyframes treeSway {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes rotorSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .page-fade { animation: fadeInPage 0.5s ease-out; }
        .tree-sway { animation: treeSway 5s ease-in-out infinite; transform-origin: 50% 100%; }
        .rotor-spin { animation: rotorSpin 0.15s linear infinite; }
        .flashcard-enter { animation: cardEnter 0.45s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .toast-enter { animation: toastEnter 0.3s ease-out; }
        .agent-body {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .agent-pose {
          position: absolute;
          inset: 0;
        }
        .run-cycle-a { animation: runCycleA 0.68s steps(1) infinite; }
        .run-cycle-mid { animation: runCycleMid 0.68s steps(1) infinite; }
        .run-cycle-b { animation: runCycleB 0.68s steps(1) infinite; }
        .agent-breathe {
          animation: agentBreathe 2.6s ease-in-out infinite;
          transform-origin: 50% 100%;
        }
        @keyframes trexFlicker {
          0%, 100% { opacity: 1; transform: scaleX(1); }
          50% { opacity: 0.7; transform: scaleX(0.85); }
        }
        .trex-flicker { animation: trexFlicker 0.12s steps(1) infinite; transform-origin: 24px 4px; }
        @media (prefers-reduced-motion: reduce) {
          .page-fade, .flashcard-enter, .toast-enter, .tree-sway, .trex-flicker { animation: none; }
        }
      `}</style>

      <div className="page-fade max-w-5xl mx-auto px-6 py-16 md:py-20">
        {/* Top bar — kept above the drawing canvas (z-45) so it's always clickable */}
        <div className="relative z-50 flex justify-between items-center gap-3 mb-8">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setDoodleMenuOpen((o) => !o)}
                className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-full transition-colors duration-200 ${
                  drawMode ? t.pillActive : t.pill
                }`}
              >
                <PenLine size={14} />
                Doodle
                <ChevronDown size={13} className={`transition-transform duration-200 ${doodleMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {doodleMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDoodleMenuOpen(false)} />
                  <div
                    className={`absolute left-0 top-full mt-2 z-20 min-w-[10rem] rounded-xl shadow-lg overflow-hidden ${
                      t.dark ? "bg-neutral-800 border border-neutral-700" : "bg-white border border-neutral-200"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setDoodleModalOpen(true);
                        setDoodleMenuOpen(false);
                      }}
                      className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition-colors duration-150 ${
                        t.dark ? "text-neutral-100 hover:bg-neutral-700" : "text-neutral-900 hover:bg-neutral-100"
                      }`}
                    >
                      Prompt
                    </button>
                    <button
                      onClick={() => {
                        setDrawMode((d) => !d);
                        setDoodleMenuOpen(false);
                      }}
                      className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition-colors duration-150 ${
                        t.dark ? "text-neutral-100 hover:bg-neutral-700" : "text-neutral-900 hover:bg-neutral-100"
                      }`}
                    >
                      {drawMode ? "Stop drawing" : "Draw"}
                    </button>
                    {drawMode && (
                      <button
                        onClick={() => {
                          drawCanvasRef.current?.clear();
                          setDoodleMenuOpen(false);
                        }}
                        className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition-colors duration-150 ${
                          t.dark ? "text-neutral-100 hover:bg-neutral-700" : "text-neutral-900 hover:bg-neutral-100"
                        }`}
                      >
                        Clear drawing
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                ref={quizButtonRef}
                onClick={() => setQuizMenuOpen((o) => !o)}
                className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-full transition-colors duration-200 ${t.pill}`}
              >
                <Shuffle size={14} />
                Quiz
                <ChevronDown size={13} className={`transition-transform duration-200 ${quizMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {quizMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setQuizMenuOpen(false)} />
                  <div
                    className={`absolute right-0 top-full mt-2 z-20 min-w-[10rem] rounded-xl shadow-lg overflow-hidden ${
                      t.dark ? "bg-neutral-800 border border-neutral-700" : "bg-white border border-neutral-200"
                    }`}
                  >
                    <button
                      onClick={() => handleStartQuiz("All")}
                      className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition-colors duration-150 ${
                        t.dark ? "text-neutral-100 hover:bg-neutral-700" : "text-neutral-900 hover:bg-neutral-100"
                      }`}
                    >
                      All flashcards
                    </button>
                    {filters.map((f) => (
                      <button
                        key={f}
                        onClick={() => handleStartQuiz(f)}
                        className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition-colors duration-150 ${
                          t.dark ? "text-neutral-100 hover:bg-neutral-700" : "text-neutral-900 hover:bg-neutral-100"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setMotionOn((m) => !m)}
              aria-label={motionOn ? "Pause animations" : "Resume animations"}
              title={motionOn ? "Pause animations" : "Resume animations"}
              className={`rounded-full p-2.5 transition-colors duration-200 ${t.card}`}
            >
              {motionOn ? (
                <PauseCircle size={16} className={t.dark ? "text-neutral-400" : "text-neutral-500"} />
              ) : (
                <PlayCircle size={16} className={t.dark ? "text-neutral-400" : "text-neutral-500"} />
              )}
            </button>
            <button
              ref={themeButtonRef}
              onClick={() => setTheme(t.dark ? "light" : "dark")}
              aria-label="Toggle theme"
              className={`rounded-full p-2.5 transition-colors duration-200 ${t.card}`}
            >
              {t.dark ? <Sun size={16} className="text-neutral-400" /> : <Moon size={16} className="text-neutral-500" />}
            </button>
          </div>
        </div>

        {/* Header */}
        <div ref={headerRef} className="text-center mb-12">
          <h1 className={`text-4xl md:text-5xl font-semibold tracking-tight ${t.title}`}>MARGINALIA</h1>
          <p className={`mt-3 text-sm ${t.subtitle}`}>Organize your knowledge.</p>
        </div>

        {/* Form */}
        <div ref={formBoxRef} className="max-w-xl mx-auto mb-14">
          {formOpen ? (
            <div className="flashcard-enter">
              <FlashcardForm theme={theme} filters={filters} onCreate={handleCreate} onCancel={() => setFormOpen(false)} />
            </div>
          ) : (
            <button
              onClick={() => setFormOpen(true)}
              className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-medium border border-dashed transition-colors duration-200 ${
                t.dark
                  ? "border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
                  : "border-neutral-300 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"
              }`}
            >
              <Plus size={16} />
              New flashcard
            </button>
          )}
        </div>

        {/* Gallery */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className={`text-xl font-semibold ${t.body}`}>My Flashcards</h2>
            <div ref={searchBoxRef} className="relative w-full sm:w-72">
              <Search size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${t.muted}`} />
              <Input
                theme={theme}
                placeholder="Search flashcards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 py-2.5 rounded-full"
              />
            </div>
          </div>

          <FilterBar theme={theme} filters={filters} activeFilter={activeFilter} onSelectFilter={setActiveFilter} />

          <FlashcardGrid cards={filteredCards} theme={theme} onDelete={handleDelete} />
        </div>
      </div>

      <Toast message={toast} theme={theme} />
      {showQuiz && (
        <QuizModal cards={cardsForScope(quizScope)} scopeLabel={quizScope} theme={theme} onClose={() => setShowQuiz(false)} />
      )}
      {doodleModalOpen && (
        <DoodleModal
          theme={theme}
          onClose={() => setDoodleModalOpen(false)}
          onSubmit={(result) => {
            setDoodles((prev) => [...prev, { id: Date.now() + Math.random(), ...result }]);
            setDoodleModalOpen(false);
          }}
        />
      )}
      {doodles.map((d) => (
        <DoodleDisplay
          key={d.id}
          doodle={d}
          onClose={() => setDoodles((prev) => prev.filter((x) => x.id !== d.id))}
        />
      ))}
      <DrawingCanvas ref={drawCanvasRef} active={drawMode} dark={t.dark} />
      {motionOn && (
        <>
          <TRexPet
            formBoxRef={formBoxRef}
            positionRef={trexPosRef}
            theme={theme}
            heliARef={heliARef}
            heliBRef={heliBRef}
            headerRef={headerRef}
          />
          <Helicopter
            theme={theme}
            formBoxRef={formBoxRef}
            quizButtonRef={quizButtonRef}
            themeButtonRef={themeButtonRef}
            headerRef={headerRef}
            trexPosRef={trexPosRef}
            selfPosRef={heliARef}
            otherPosRef={heliBRef}
            startDelay={0}
          />
          <Helicopter
            theme={theme}
            formBoxRef={formBoxRef}
            quizButtonRef={quizButtonRef}
            themeButtonRef={themeButtonRef}
            headerRef={headerRef}
            trexPosRef={trexPosRef}
            selfPosRef={heliBRef}
            otherPosRef={heliARef}
            startDelay={9000}
          />
        </>
      )}
    </div>
  );
}
