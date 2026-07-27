import React, { useState, useEffect, useRef, useMemo } from "react";
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

/* A small original silhouette "agent" who only ever stands on real,
   visible elements — the form panel, individual flashcards as they're
   added, the search box, the quiz button, the theme toggle — never on
   blank page background. Each stop is measured live via
   getBoundingClientRect, and he always moves to whichever corner of
   the next element is nearest, so a jump never lands somewhere with
   nothing to grab. Moving across one element's own top edge is a run;
   moving to a different element has a real gap, so that's played as a
   crouch, a liftoff, an arc with a hang at the peak, and a
   grab-the-ledge landing — not a slide across empty space. */
const AGENT_W = 46;
const AGENT_H = 66;
const AGENT_SPEED = 0.2; // px per ms, run segments only — an easy jog
const AGENT_MIN_MS = 1200;
const AGENT_MAX_MS = 3000;

// Each pose is a set of joint angles: torso lean, two arms (shoulder
// only), and two legs (hip thigh + knee shin) for a bent-knee look.
const AGENT_POSES = {
  idle: {
    torso: 0,
    armA: 0,
    armB: 0,
    legA: { thigh: 0, shin: 0 },
    legB: { thigh: 0, shin: 0 },
  },
  runA: {
    torso: 8,
    armA: -30,
    armB: 26,
    legA: { thigh: -34, shin: 20 },
    legB: { thigh: 30, shin: -12 },
  },
  runMid: {
    torso: 6,
    armA: -6,
    armB: 6,
    legA: { thigh: -4, shin: 26 },
    legB: { thigh: 6, shin: -6 },
  },
  runB: {
    torso: 8,
    armA: 26,
    armB: -30,
    legA: { thigh: 30, shin: -12 },
    legB: { thigh: -34, shin: 20 },
  },
  crouch: {
    torso: -7,
    armA: 46,
    armB: 50,
    legA: { thigh: 56, shin: 32 },
    legB: { thigh: 52, shin: 28 },
  },
  liftoff: {
    torso: 5,
    armA: -78,
    armB: -86,
    legA: { thigh: -62, shin: 14 },
    legB: { thigh: 26, shin: 54 },
  },
  jump: {
    torso: 13,
    armA: -112,
    armB: -122,
    legA: { thigh: 92, shin: 42 },
    legB: { thigh: 105, shin: 36 },
  },
  grab: {
    torso: -4,
    armA: 170,
    armB: 164,
    legA: { thigh: -52, shin: -36 },
    legB: { thigh: -62, shin: -30 },
  },
  impact: {
    torso: 3,
    armA: 68,
    armB: 74,
    legA: { thigh: 62, shin: 40 },
    legB: { thigh: -60, shin: -38 },
  },
  stretch: {
    torso: -13,
    armA: -172,
    armB: -166,
    legA: { thigh: 6, shin: -4 },
    legB: { thigh: -6, shin: 4 },
  },
  sit: {
    torso: 4,
    armA: 18,
    armB: 22,
    legA: { thigh: 86, shin: -78 },
    legB: { thigh: 82, shin: -74 },
  },
  danceA: {
    torso: -11,
    armA: -150,
    armB: 62,
    legA: { thigh: 22, shin: -16 },
    legB: { thigh: -18, shin: 12 },
  },
  danceB: {
    torso: 11,
    armA: 62,
    armB: -150,
    legA: { thigh: -18, shin: 12 },
    legB: { thigh: 22, shin: -16 },
  },
};

function AgentSprite({ pose, dark }) {
  const p = AGENT_POSES[pose] || AGENT_POSES.idle;
  const ink = dark ? "#f5f5f5" : "#111111";
  const mid = dark ? "#c2c2c2" : "#2c2c2c";
  const back = dark ? "#8a8a8a" : "#4b4b4b";
  const glint = dark ? "#111111" : "#e8e8e8";

  const Leg = ({ hipX, thigh, shin, fill }) => (
    <g transform={`rotate(${thigh} ${hipX} 29)`}>
      <rect x={hipX - 2} y="29" width="4" height="9" rx="2" fill={fill} />
      <g transform={`rotate(${shin} ${hipX} 38)`}>
        <rect x={hipX - 1.8} y="38" width="3.6" height="9" rx="1.8" fill={fill} />
        <rect x={hipX - 2.4} y="46" width="5.4" height="2.2" rx="1.1" fill={fill} />
      </g>
    </g>
  );

  const Arm = ({ shoulderX, angle, fill }) => (
    <g transform={`rotate(${angle} ${shoulderX} 15)`}>
      <rect x={shoulderX - 1.75} y="15" width="3.5" height="9" rx="1.75" fill={fill} />
      <circle cx={shoulderX} cy="25.5" r="2.1" fill={fill} />
    </g>
  );

  return (
    <svg viewBox="0 0 32 50" width={AGENT_W} height={AGENT_H}>
      <Leg hipX={19} thigh={p.legB.thigh} shin={p.legB.shin} fill={back} />
      <Leg hipX={13} thigh={p.legA.thigh} shin={p.legA.shin} fill={ink} />
      <g transform={`rotate(${p.torso} 16 20)`}>
        <rect x="11" y="13" width="10" height="15" rx="4" fill={ink} />
        <rect x="11" y="13" width="10" height="2.2" rx="1.1" fill={mid} />
        <rect x="11.5" y="25.5" width="9" height="2" rx="1" fill={mid} />
      </g>
      <Arm shoulderX={21} angle={p.armB} fill={back} />
      <Arm shoulderX={11} angle={p.armA} fill={ink} />
      <rect x="14" y="10.5" width="4" height="3.5" fill={ink} />
      <circle cx="16" cy="7" r="6" fill={ink} />
      <rect x="12" y="5.3" width="8" height="2.6" rx="1.3" fill={glint} />
    </svg>
  );
}

function RunningAgent({ formBoxRef, searchBoxRef, quizButtonRef, themeButtonRef, theme, positionRef }) {
  const dark = theme === "dark";
  const [pos, setPos] = useState({ x: -80, y: 40 });
  const [facingLeft, setFacingLeft] = useState(false);
  const [animState, setAnimState] = useState("idle");
  const [transitionMs, setTransitionMs] = useState(0);
  const [easing, setEasing] = useState("cubic-bezier(0.4, 0, 0.2, 1)");
  const [resting, setResting] = useState(false);
  const posRef = useRef(pos);
  const busyRef = useRef(false);
  const currentAnchorRef = useRef(null);
  posRef.current = pos;
  if (positionRef) positionRef.current = pos;

  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

    // Only ever the two corners of a real element's own top edge —
    // never a point out in blank page background — and always
    // whichever of those two is actually closer to where he is now.
    const nearestCorner = (rect, from) => {
      const inset = 10;
      const leftPt = { x: rect.left + inset, y: rect.top - AGENT_H + 14 };
      const rightPt = { x: rect.right - AGENT_W - inset, y: rect.top - AGENT_H + 14 };
      const dl = distance(from, leftPt);
      const dr = distance(from, rightPt);
      return dl <= dr ? { near: leftPt, far: rightPt } : { near: rightPt, far: leftPt };
    };

    // Rebuilt on every stop so flashcards that get added or removed
    // mid-session are picked up right away.
    const getBoxes = () => {
      const boxes = [];
      if (formBoxRef.current) boxes.push(formBoxRef.current);
      boxes.push(...document.querySelectorAll('[data-agent-card="true"]'));
      if (searchBoxRef.current) boxes.push(searchBoxRef.current);
      if (quizButtonRef.current) boxes.push(quizButtonRef.current);
      if (themeButtonRef.current) boxes.push(themeButtonRef.current);
      return boxes;
    };

    const face = (from, to) => {
      if (to.x < from.x - 2) setFacingLeft(true);
      else if (to.x > from.x + 2) setFacingLeft(false);
    };

    // Perched between moves he doesn't just freeze — he glances around,
    // stretches, ducks down, breaks into a little dance, or sits down on
    // the ledge for a rest, picked at random each stop so he never
    // repeats the same beat twice in a row.
    const lookAround = async (totalMs) => {
      setResting(true);
      const roll = Math.random();

      if (roll < 0.3) {
        // Glance side to side.
        const glance = Math.min(450, totalMs / 4);
        const hold = Math.max(0, (totalMs - glance * 2) / 2);
        await sleep(hold);
        if (cancelled) return;
        setFacingLeft(true);
        await sleep(glance);
        if (cancelled) return;
        setFacingLeft(false);
        await sleep(glance);
        if (cancelled) return;
        await sleep(hold);
      } else if (roll < 0.5) {
        // A full-body stretch, like he's shaking out the last landing.
        const pre = totalMs * 0.35;
        const hold = Math.min(650, totalMs * 0.3);
        await sleep(pre);
        if (cancelled) return;
        setAnimState("stretch");
        await sleep(hold);
        if (cancelled) return;
        setAnimState("idle");
        await sleep(Math.max(0, totalMs - pre - hold));
      } else if (roll < 0.65) {
        // A quick curious duck, like something below caught his eye.
        const pre = totalMs * 0.4;
        const dip = 260;
        await sleep(pre);
        if (cancelled) return;
        setAnimState("crouch");
        await sleep(dip);
        if (cancelled) return;
        setAnimState("idle");
        await sleep(Math.max(0, totalMs - pre - dip));
      } else if (roll < 0.85) {
        // A little celebratory dance, arms and hips swapping sides.
        const pre = totalMs * 0.3;
        await sleep(pre);
        if (cancelled) return;
        const beats = 5;
        for (let i = 0; i < beats; i++) {
          setAnimState(i % 2 === 0 ? "danceA" : "danceB");
          await sleep(200);
          if (cancelled) return;
        }
        setAnimState("idle");
        await sleep(Math.max(0, totalMs - pre - beats * 200));
      } else {
        // Sits down on the ledge for a proper rest before moving on.
        const pre = totalMs * 0.25;
        const sitFor = Math.max(500, totalMs * 0.5);
        await sleep(pre);
        if (cancelled) return;
        setAnimState("sit");
        await sleep(sitFor);
        if (cancelled) return;
        setAnimState("idle");
        await sleep(Math.max(0, totalMs - pre - sitFor));
      }
    };

    const glideTo = async (to, ms, ease, pose) => {
      const from = posRef.current;
      face(from, to);
      setEasing(ease);
      setTransitionMs(ms);
      setAnimState(pose);
      setPos(to);
      await sleep(ms);
    };

    const runSegment = async (targetGetter) => {
      busyRef.current = true;
      setResting(false);
      const to = targetGetter();
      const from = posRef.current;
      face(from, to);
      // A quick coiled beat before he takes off, not a standing start.
      setAnimState("crouch");
      await sleep(110);
      if (cancelled) {
        busyRef.current = false;
        return;
      }
      const ms = clamp(distance(from, to) / AGENT_SPEED, AGENT_MIN_MS, AGENT_MAX_MS);
      await glideTo(to, ms, "cubic-bezier(0.45, 0, 0.15, 1)", "run");
      if (!cancelled) setAnimState("idle");
      busyRef.current = false;
    };

    // A real gap between elements gets a crouch, an explosive liftoff,
    // a two-leg arc that rises, hangs for a beat at the peak, then
    // falls, a squashed impact beat, and a grab-the-ledge landing —
    // not a slide through space.
    const jumpSegment = async (targetGetter) => {
      busyRef.current = true;
      setResting(false);
      const to = targetGetter();
      const from = posRef.current;
      setAnimState("crouch");
      face(from, to);
      await sleep(300);
      if (cancelled) {
        busyRef.current = false;
        return;
      }
      setAnimState("liftoff");
      await sleep(150);
      if (cancelled) {
        busyRef.current = false;
        return;
      }
      const peak = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 44 };
      await glideTo(peak, 400, "cubic-bezier(0.3, 0.9, 0.6, 1)", "jump");
      if (cancelled) {
        busyRef.current = false;
        return;
      }
      await sleep(60); // brief hang at the top of the arc
      if (cancelled) {
        busyRef.current = false;
        return;
      }
      await glideTo(to, 400, "cubic-bezier(0.4, 0, 0.7, 0.3)", "jump");
      if (cancelled) {
        busyRef.current = false;
        return;
      }
      setAnimState("impact");
      await sleep(90);
      if (cancelled) {
        busyRef.current = false;
        return;
      }
      setAnimState("grab");
      await sleep(360);
      if (!cancelled) setAnimState("idle");
      busyRef.current = false;
    };

    const visitBox = async (el) => {
      const rect = el.getBoundingClientRect();
      const { near, far } = nearestCorner(rect, posRef.current);
      await jumpSegment(() => near);
      if (cancelled) return;
      if (distance(near, far) > 40) {
        await runSegment(() => far);
        if (cancelled) return;
      }
      await lookAround(2400 + Math.random() * 1200);
    };

    const loop = async () => {
      await sleep(700);
      let boxIndex = 0;
      while (!cancelled) {
        const boxes = getBoxes();
        if (boxes.length === 0) {
          await sleep(600);
          continue;
        }
        boxIndex = boxIndex % boxes.length;
        const el = boxes[boxIndex];
        currentAnchorRef.current = () => nearestCorner(el.getBoundingClientRect(), posRef.current).near;
        await visitBox(el);
        if (cancelled) return;
        boxIndex += 1;
      }
    };

    loop();

    let ticking = false;
    const resync = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (busyRef.current || !currentAnchorRef.current) return;
        setTransitionMs(0);
        setPos(currentAnchorRef.current());
      });
    };
    window.addEventListener("scroll", resync, { passive: true });
    window.addEventListener("resize", resync);

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", resync);
      window.removeEventListener("resize", resync);
    };
  }, [formBoxRef, searchBoxRef, quizButtonRef, themeButtonRef]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: AGENT_W,
        height: AGENT_H,
        zIndex: 45,
        pointerEvents: "none",
        transform: facingLeft ? "scaleX(-1)" : "scaleX(1)",
        transition: transitionMs === 0 ? "none" : `left ${transitionMs}ms ${easing}, top ${transitionMs}ms ${easing}`,
      }}
    >
      <div className={`agent-body ${resting ? "agent-breathe" : ""}`}>
        {animState === "run" ? (
          <>
            <div className="agent-pose run-cycle-a">
              <AgentSprite pose="runA" dark={dark} />
            </div>
            <div className="agent-pose run-cycle-mid">
              <AgentSprite pose="runMid" dark={dark} />
            </div>
            <div className="agent-pose run-cycle-b">
              <AgentSprite pose="runB" dark={dark} />
            </div>
          </>
        ) : (
          <div className="agent-pose">
            <AgentSprite pose={animState} dark={dark} />
          </div>
        )}
      </div>
    </div>
  );
}

/* A tiny 8-bit dinosaur that lives only on the "New flashcard" box,
   pacing back and forth within its width at a slow, constant wander —
   it doesn't react to the running agent at all — breathing a small
   burst of fire out on its own timer every so often. */
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

/* Roams the "New flashcard" box on its own, slow and constant, never
   reacting to the running agent — no chasing, just a small breath of
   8-bit fire every so often, out on its own timer. */
function TRexPet({ formBoxRef, positionRef, theme }) {
  const dark = theme === "dark";
  const [x, setX] = useState(20);
  const [y, setY] = useState(0);
  const [facingLeft, setFacingLeft] = useState(false);
  const [legPhase, setLegPhase] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const xRef = useRef(20);
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
    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const loop = async () => {
      await sleep(3500 + Math.random() * 4000);
      while (!cancelled) {
        setBreathing(true);
        await sleep(800 + Math.random() * 500);
        if (cancelled) return;
        setBreathing(false);
        await sleep(4500 + Math.random() * 5000);
      }
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
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
  const [visible, setVisible] = useState(false);
  const [trail, setTrail] = useState([]);
  const [laser, setLaser] = useState(null);
  const posRef = useRef(pos);
  posRef.current = pos;
  if (selfPosRef) selfPosRef.current = pos;

  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let cancelled = false;
    let raf;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    // candidate point a few times if it lands inside a guarded rect.
    const buildPath = (from, guards, ceilingY) => {
      // The full page width, not just a corner — it flies edge to edge.
      const minX = -80;
      const maxX = window.innerWidth + 80;
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
          const dir = atLeftEdge ? 1 : atRightEdge ? -1 : Math.random() < 0.12 ? -1 : 1;
          x = Math.max(minX, Math.min(maxX, curX + dir * (160 + Math.random() * 220)));
          // A gentle drift from the current height rather than a fresh
          // random pick each leg, so the curve doesn't zigzag vertically.
          y = Math.max(20, Math.min(ceilingY, curY + (Math.random() - 0.5) * 70));
          if (clearOf(guards, x, y)) break;
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
    const flyCurve = (from) =>
      new Promise((resolve) => {
        const { guards, ceilingY } = getGuards();
        const pts = buildPath(from, guards, ceilingY);
        const segs = pts.length - 1;
        const msPerSeg = 3000 + Math.random() * 1600; // slow
        const totalMs = segs * msPerSeg;
        const start = performance.now();
        const at = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];

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
          const u = (elapsed / totalMs) * segs;
          const seg = Math.min(segs - 1, Math.floor(u));
          const t = u - seg;
          let next = catmullRom(at(seg - 1), at(seg), at(seg + 1), at(seg + 2), t);

          // Never let the two helicopters touch: push directly away from
          // the other one if it's currently closer than the minimum gap.
          const other = otherPosRef?.current;
          if (other) {
            const dx = next.x - other.x;
            const dy = next.y - other.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            if (dist < HELI_MIN_GAP) {
              const push = HELI_MIN_GAP - dist;
              next = { x: next.x + (dx / dist) * push, y: next.y + (dy / dist) * push };
            }
          }

          const ahead = catmullRom(at(seg - 1), at(seg), at(seg + 1), at(seg + 2), Math.min(1, t + 0.02));
          setPos(next);
          posRef.current = next;
          if (selfPosRef) selfPosRef.current = next;
          setBank(Math.max(-16, Math.min(16, (ahead.x - next.x) * 26)));
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
          setLaser({ x1: from.x + HELI_W / 2, y1: from.y + HELI_H - 2, x2: trex.x + 32, y2: trex.y + 20 });
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
            transform: `rotate(${bank}deg)`,
          }}
        >
          <HelicopterSprite dark={dark} />
        </div>
      )}
    </>
  );
}

/* ---------- Doodle ---------- */

// Keyword -> action, checked in order so more specific words win over
// vaguer ones. Anything unmatched still gets a small idle bob, so the
// doodle always does *something*.
const DOODLE_ACTIONS = [
  { action: "spin", keywords: ["spin", "twirl", "rotate", "circle"] },
  { action: "jump", keywords: ["jump", "hop", "bounce", "leap"] },
  { action: "dance", keywords: ["dance", "boogie", "groove", "party"] },
  { action: "wave", keywords: ["wave", "hello", "hi", "greet"] },
  { action: "walk", keywords: ["walk", "run", "pace", "stroll", "move"] },
  { action: "sleep", keywords: ["sleep", "nap", "rest", "tired", "snooze"] },
  { action: "shake", keywords: ["shake", "wiggle", "vibrate", "shiver"] },
];

function matchDoodleAction(text) {
  const q = text.toLowerCase();
  for (const { action, keywords } of DOODLE_ACTIONS) {
    if (keywords.some((k) => q.includes(k))) return action;
  }
  return "bob";
}

function DoodleModal({ theme, onSubmit, onClose }) {
  const t = useTokens(theme);
  const [text, setText] = useState("");
  const overlayBg = theme === "dark" ? "bg-black/80" : "bg-black/40";
  const border = theme === "dark" ? "border-neutral-800" : "border-neutral-200";

  const submit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${overlayBg}`} onClick={onClose}>
      <div className={`w-full max-w-sm rounded-3xl p-6 ${t.page} border ${border}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-semibold ${t.body}`}>What should the doodle do?</h3>
          <button onClick={onClose} aria-label="Close" className={`rounded-full p-2 transition-colors duration-200 ${t.iconMuted}`}>
            <X size={15} />
          </button>
        </div>
        <Input
          theme={theme}
          autoFocus
          placeholder="e.g. dance, jump, wave, spin..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <div className="flex justify-end mt-4">
          <Button theme={theme} onClick={submit} className="rounded-xl px-5 py-2.5 text-sm">
            Doodle it
          </Button>
        </div>
      </div>
    </div>
  );
}

function DoodleSprite({ action, dark }) {
  const ink = dark ? "#f5f5f5" : "#111111";
  const bodyClass =
    {
      jump: "doodle-jump",
      spin: "doodle-spin",
      dance: "doodle-dance",
      walk: "doodle-walk",
      shake: "doodle-shake",
      sleep: "doodle-sleep",
    }[action] || "doodle-bob";

  return (
    <svg viewBox="0 0 40 60" width="40" height="60" style={{ overflow: "visible" }} className={bodyClass}>
      <circle cx="20" cy="10" r="7" fill="none" stroke={ink} strokeWidth="2.2" />
      <line x1="20" y1="17" x2="20" y2="38" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="20" y1="38" x2="12" y2="55" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="20" y1="38" x2="28" y2="55" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="20" y1="22" x2="9" y2="30" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <g transform="translate(20 22)" style={{ transformOrigin: "0px 0px" }} className={action === "wave" ? "doodle-wave-arm" : ""}>
        <line x1="0" y1="0" x2="11" y2={action === "wave" ? -10 : 8} stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function DoodleDisplay({ doodle, theme, onClose }) {
  const t = useTokens(theme);
  return (
    <div className="fixed top-24 left-6 z-40 flex flex-col items-center gap-1.5" style={{ pointerEvents: "none" }}>
      <DoodleSprite action={doodle.action} dark={t.dark} />
      <div
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${t.card}`}
        style={{ pointerEvents: "auto" }}
      >
        <span className={t.muted}>{doodle.text}</span>
        <button onClick={onClose} aria-label="Dismiss doodle" className="opacity-60 hover:opacity-100">
          <X size={11} />
        </button>
      </div>
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
  const [doodle, setDoodle] = useState(null);
  const toastTimeout = useRef(null);
  const headerRef = useRef(null);
  const formBoxRef = useRef(null);
  const searchBoxRef = useRef(null);
  const quizButtonRef = useRef(null);
  const themeButtonRef = useRef(null);
  const agentPosRef = useRef({ x: -9999, y: -9999 });
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
        @keyframes doodleBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes doodleJump {
          0%, 100% { transform: translateY(0); }
          35% { transform: translateY(-20px); }
          55% { transform: translateY(-20px); }
        }
        @keyframes doodleSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes doodleDance {
          0%, 100% { transform: rotate(-9deg) translateX(-3px); }
          50% { transform: rotate(9deg) translateX(3px); }
        }
        @keyframes doodleWalk {
          0%, 100% { transform: translateX(-10px); }
          50% { transform: translateX(10px); }
        }
        @keyframes doodleShake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-4px) rotate(-4deg); }
          75% { transform: translateX(4px) rotate(4deg); }
        }
        @keyframes doodleSleep {
          0%, 100% { transform: rotate(-82deg) scaleY(1); }
          50% { transform: rotate(-82deg) scaleY(1.03); }
        }
        @keyframes doodleWave {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-55deg); }
        }
        .doodle-bob { animation: doodleBob 1.6s ease-in-out infinite; }
        .doodle-jump { animation: doodleJump 0.9s ease-in-out infinite; }
        .doodle-spin { animation: doodleSpin 1.1s linear infinite; }
        .doodle-dance { animation: doodleDance 0.7s ease-in-out infinite; }
        .doodle-walk { animation: doodleWalk 1.4s ease-in-out infinite; }
        .doodle-shake { animation: doodleShake 0.35s ease-in-out infinite; }
        .doodle-sleep { animation: doodleSleep 2.4s ease-in-out infinite; transform-origin: 50% 100%; }
        .doodle-wave-arm { animation: doodleWave 0.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .page-fade, .flashcard-enter, .toast-enter, .tree-sway, .trex-flicker,
          .doodle-bob, .doodle-jump, .doodle-spin, .doodle-dance, .doodle-walk, .doodle-shake, .doodle-sleep, .doodle-wave-arm { animation: none; }
        }
      `}</style>

      <div className="page-fade max-w-5xl mx-auto px-6 py-16 md:py-20">
        {/* Top bar */}
        <div className="flex justify-between items-center gap-3 mb-8">
          <button
            onClick={() => setDoodleModalOpen(true)}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-full transition-colors duration-200 ${t.pill}`}
          >
            <PenLine size={14} />
            Doodle
          </button>
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
          onSubmit={(text) => {
            setDoodle({ action: matchDoodleAction(text), text });
            setDoodleModalOpen(false);
          }}
        />
      )}
      {doodle && <DoodleDisplay doodle={doodle} theme={theme} onClose={() => setDoodle(null)} />}
      {motionOn && (
        <>
          <RunningAgent
            formBoxRef={formBoxRef}
            searchBoxRef={searchBoxRef}
            quizButtonRef={quizButtonRef}
            themeButtonRef={themeButtonRef}
            theme={theme}
            positionRef={agentPosRef}
          />
          <TRexPet formBoxRef={formBoxRef} positionRef={trexPosRef} theme={theme} />
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
