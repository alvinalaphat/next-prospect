'use client';

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

export type ScoreCategoryTab = {
  id: string;
  label: string;
  value: number;
  cap: number;
  total?: boolean;
  panel: ReactNode;
};

export function ScoreCategorySwitcher({ categories }: { categories: ScoreCategoryTab[] }) {
  const instanceId = useId();
  const [selectedId, setSelectedId] = useState(categories[0]?.id ?? '');
  const selected = categories.find((category) => category.id === selectedId) ?? categories[0];

  if (!selected) return null;

  const tabId = (id: string) => `${instanceId}-${id}-tab`;
  const panelId = (id: string) => `${instanceId}-${id}-panel`;

  function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % categories.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + categories.length) % categories.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = categories.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = categories[nextIndex];
    setSelectedId(next.id);
    document.getElementById(tabId(next.id))?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Score categories" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {categories.map((category, index) => {
          const isSelected = category.id === selected.id;
          return (
            <button
              key={category.id}
              id={tabId(category.id)}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={panelId(category.id)}
              tabIndex={isSelected ? 0 : -1}
              data-no-press
              onClick={() => setSelectedId(category.id)}
              onKeyDown={(event) => selectFromKeyboard(event, index)}
              className={`min-h-20 rounded-lg border p-3 text-left transition-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-24 ${category.total ? 'col-span-2 sm:col-span-1' : ''} ${isSelected ? 'border-foreground bg-foreground text-background shadow-sm' : 'bg-background hover:bg-accent'}`}
            >
              <span className={`block text-xs ${isSelected ? 'opacity-70' : 'text-muted-foreground'}`}>{category.label}</span>
              <span className="mt-2 block font-mono text-lg tabular-nums">
                {category.total ? '' : '+'}{category.value}<span className={`text-xs ${isSelected ? 'opacity-70' : 'text-muted-foreground'}`}>/{category.cap}</span>
              </span>
            </button>
          );
        })}
      </div>

      {categories.map((category) => (
        <div
          key={category.id}
          id={panelId(category.id)}
          role="tabpanel"
          aria-labelledby={tabId(category.id)}
          tabIndex={0}
          hidden={category.id !== selected.id}
          className="mt-3 rounded-lg border bg-background p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
        >
          {category.panel}
        </div>
      ))}
    </div>
  );
}
