import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, Moon, Sun, MoreVertical, Check, Bold, Italic, Underline, Highlighter, Trash2, X, Shuffle } from "lucide-react";

/* ------------------------------------------------------------------
   Flashcard Creator
   A calm, minimal, Apple-inspired flashcard app.
   Filters aren't a separate list you manage — they're derived
   directly from whatever's typed into a card's Filter field, so the
   pills below always reflect exactly what's actually on your cards.
------------------------------------------------------------------- */

const STORAGE_KEY = "flashcard-app-data";
const HIGHLIGHT_COLOR = "#FDE68A"; // highlighter yellow

/* Each filter gets a consistent, very light tint so the gallery is
   scannable by grouping at a glance without leaving the neutral,
   minimal palette behind. Same filter name always maps to the same
   color — no randomness, no manual assignment. */
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

/* ---------- Theme tokens ----------
   Only core Tailwind palette classes are used here (neutral-50..950,
   white, black, standard shadow sizes) — this environment serves a
   pre-built stylesheet, not a live compiler, so arbitrary bracket
   values like bg-[#111] never generate real CSS and silently fail. */

function useTokens(theme) {
  const dark = theme === "dark";
  return {
    dark,
    page: dark ? "bg-neutral-950" : "bg-pink-50",
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

function FlashcardForm({ theme, filters, onCreate }) {
  const [topic, setTopic] = useState("");
  const [filter, setFilter] = useState("");
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

  const handleSubmit = () => {
    const nextErrors = {};
    if (!topic.trim()) nextErrors.topic = true;
    if (!descriptionText.trim()) nextErrors.description = true;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onCreate({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      topic: topic.trim(),
      filter: filter.trim(),
      description: descriptionHtml,
      createdAt: Date.now(),
    });

    setTopic("");
    setFilter("");
    setDescriptionHtml("");
    setDescriptionText("");
    setErrors({});
    setResetKey((k) => k + 1); // remounts the editor to a clean, empty state
  };

  const errorRing = "ring-2 ring-red-400";

  return (
    <div className={`w-full rounded-3xl p-8 space-y-6 ${t.card} ${t.shadow}`}>
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
        <label className={`block text-xs font-medium mb-2 tracking-wide uppercase ${t.label}`}>Filter</label>
        <Input
          theme={theme}
          list="filter-suggestions"
          placeholder="Add a grouping, e.g. Concepts"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <datalist id="filter-suggestions">
          {filters.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
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
  const tint = getFilterTint(card.filter, t.dark);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBg = theme === "dark" ? "bg-neutral-800 border border-neutral-700" : "bg-white border border-neutral-200";
  const deleteHover = theme === "dark" ? "hover:bg-red-950" : "hover:bg-red-50";

  return (
    <div
      className={`rounded-2xl p-3 border transition-all duration-300 hover:-translate-y-1 flashcard-enter ${tint} ${t.shadow} ${t.cardHover}`}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-start justify-between mb-1.5">
        <h3 className={`text-sm font-semibold leading-snug ${t.body}`}>{card.topic}</h3>
        <div className="relative shrink-0 -mr-1 -mt-1">
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
      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 ${t.badge}`}>{card.filter}</span>
      <div
        className={`text-xs leading-relaxed line-clamp-3 ${t.muted}`}
        dangerouslySetInnerHTML={{ __html: card.description }}
      />
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
function QuizModal({ cards, theme, onClose }) {
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
  const tint = getFilterTint(current.filter, t.dark);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${overlayBg}`}>
      <div className={`w-full max-w-lg rounded-3xl p-8 ${t.page} border ${border}`}>
        <div className="flex items-center justify-between mb-6">
          <span className={`text-xs font-medium tracking-wide uppercase ${t.label}`}>
            {index + 1} / {total}
          </span>
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
              <span className={`text-xs font-medium mb-3 ${t.label}`}>{current.filter}</span>
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

/* ---------- Root app ---------- */

export default function App() {
  const [flashcards, setFlashcards] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("light");
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const toastTimeout = useRef(null);
  const t = useTokens(theme);

  // Filters are never stored on their own — they're computed fresh
  // from the flashcards that exist right now, so there's no way for
  // an old or orphaned grouping to linger in the UI.
  const filters = useMemo(() => {
    const unique = Array.from(new Set(flashcards.map((c) => c.filter).filter(Boolean)));
    return unique;
  }, [flashcards]);

  // Load persisted flashcards on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.flashcards)) setFlashcards(parsed.flashcards);
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
    const cleanFilter = card.filter.trim();
    const finalCard = { ...card, filter: cleanFilter || "Uncategorized" };
    setFlashcards((prev) => [finalCard, ...prev]);
    setToast("Flashcard created!");
    clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(""), 2500);
  };

  const handleDelete = (id) => {
    setFlashcards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleStartQuiz = () => {
    if (flashcards.length === 0) {
      setToast("Add a flashcard before starting a quiz");
      clearTimeout(toastTimeout.current);
      toastTimeout.current = setTimeout(() => setToast(""), 2500);
      return;
    }
    setShowQuiz(true);
  };

  const filteredCards = flashcards.filter((c) => {
    const matchesFilter = activeFilter === "All" || c.filter === activeFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || c.topic.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className={`min-h-screen w-full transition-colors duration-300 ${t.page}`}>
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
        .page-fade { animation: fadeInPage 0.5s ease-out; }
        .flashcard-enter { animation: cardEnter 0.45s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .toast-enter { animation: toastEnter 0.3s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .page-fade, .flashcard-enter, .toast-enter { animation: none; }
        }
      `}</style>

      <div className="page-fade max-w-5xl mx-auto px-6 py-16 md:py-20">
        {/* Top bar */}
        <div className="flex justify-end items-center gap-3 mb-8">
          <button
            onClick={handleStartQuiz}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-full transition-colors duration-200 ${t.pill}`}
          >
            <Shuffle size={14} />
            Quiz
          </button>
          <button
            onClick={() => setTheme(t.dark ? "light" : "dark")}
            aria-label="Toggle theme"
            className={`rounded-full p-2.5 transition-colors duration-200 ${t.card}`}
          >
            {t.dark ? <Sun size={16} className="text-neutral-400" /> : <Moon size={16} className="text-neutral-500" />}
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className={`text-4xl md:text-5xl font-semibold tracking-tight ${t.title}`}>Flashcard Creator</h1>
          <p className={`mt-3 text-sm ${t.subtitle}`}>Organize your knowledge.</p>
        </div>

        {/* Form */}
        <div className="max-w-xl mx-auto mb-20">
          <FlashcardForm theme={theme} filters={filters} onCreate={handleCreate} />
        </div>

        {/* Gallery */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className={`text-xl font-semibold ${t.body}`}>My Flashcards</h2>
            <div className="relative w-full sm:w-72">
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
      {showQuiz && <QuizModal cards={flashcards} theme={theme} onClose={() => setShowQuiz(false)} />}
    </div>
  );
}
