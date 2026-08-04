import { useState, useRef, useEffect } from 'react';

// Parse whatever the DB gives us (JSON string, array, or null) into a string[].
export function parseTags(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Editable tag field with autocomplete against a shared tag library.
// - `value`: string[] of tags currently on the item
// - `onChange`: receives the updated string[]
// - `suggestions`: array of { name, description } from the tag library
// Type to filter suggestions; ↑/↓ to move, Enter/Tab to accept the highlighted
// suggestion (or add the typed text), comma also adds, Backspace removes last.
export default function TagInput({ value = [], onChange, suggestions = [], placeholder = 'Type to add a tag (Tab to autocomplete)' }) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const q = draft.trim().toLowerCase();
  // Suggestions not already applied, matching the current draft.
  const matches = suggestions
    .filter(s => !value.some(v => v.toLowerCase() === s.name.toLowerCase()))
    .filter(s => !q || s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));

  const addTag = (raw) => {
    const t = (raw || '').trim().replace(/,+$/, '').trim();
    if (!t) return;
    if (value.some(x => x.toLowerCase() === t.toLowerCase())) { setDraft(''); return; }
    onChange([...value, t]);
    setDraft('');
    setHighlight(0);
  };

  const removeTag = (t) => onChange(value.filter(x => x !== t));

  const acceptHighlighted = () => {
    if (open && matches[highlight]) {
      addTag(matches[highlight].name);
    } else {
      addTag(draft);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      acceptHighlighted();
    } else if (e.key === 'Tab') {
      // Tab autocompletes to the highlighted suggestion when the menu is open.
      if (open && matches.length) {
        e.preventDefault();
        acceptHighlighted();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight(h => Math.min(h + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="w-full bg-slate-700 rounded-lg px-2 py-1.5 flex flex-wrap gap-1 items-center">
        {value.map(t => (
          <span key={t} className="text-xs bg-slate-600 text-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            {t}
            <button type="button" onClick={() => removeTag(t)} className="opacity-60 hover:opacity-100 leading-none">✕</button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-slate-500 py-0.5"
          placeholder={value.length ? '' : placeholder}
          value={draft}
          onChange={e => { setDraft(e.target.value); setOpen(true); setHighlight(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && matches.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-56 overflow-auto">
          {matches.map((s, i) => (
            <button
              type="button"
              key={s.name}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => addTag(s.name)}
              className={`w-full text-left px-3 py-1.5 ${i === highlight ? 'bg-slate-700' : ''}`}
            >
              <span className="text-sm text-slate-200">#{s.name}</span>
              {s.description && <span className="block text-xs text-slate-500 truncate">{s.description}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Read-only chips for displaying tags on a card. Pass `descriptions` (a
// name->description map) to surface each tag's meaning as a hover tooltip.
export function TagChips({ tags, className = '', descriptions }) {
  const list = parseTags(tags);
  if (!list.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {list.map(t => (
        <span
          key={t}
          title={descriptions?.[t.toLowerCase()] || undefined}
          className="text-xs bg-slate-700/70 text-slate-300 px-1.5 py-0.5 rounded"
        >#{t}</span>
      ))}
    </div>
  );
}
