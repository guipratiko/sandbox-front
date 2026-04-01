import React, { useEffect, useRef, useState, memo } from 'react';

export type CRMInstanceOption = {
  id: string;
  name: string;
  status: string;
  channel: 'whatsapp' | 'instagram';
};

/** Instâncias cujo Kanban está visível (pode haver várias). */
export type CrmSelectedInstance = {
  id: string;
  channel: 'whatsapp' | 'instagram';
};

interface CrmInstancePickerProps {
  instances: CRMInstanceOption[];
  selected: CrmSelectedInstance[];
  isLoading: boolean;
  onToggle: (inst: CRMInstanceOption) => void;
  onSelectAll: () => void;
  onClear: () => void;
  t: (key: string) => string;
}

const CrmInstancePickerInner: React.FC<CrmInstancePickerProps> = ({
  instances,
  selected,
  isLoading,
  onToggle,
  onSelectAll,
  onClear,
  t,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let onDoc: ((e: MouseEvent) => void) | undefined;
    const tid = window.setTimeout(() => {
      onDoc = (e: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', onDoc);
    }, 0);
    return () => {
      window.clearTimeout(tid);
      if (onDoc) document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  const isSelected = (inst: CRMInstanceOption) =>
    selected.some((s) => s.id === inst.id && s.channel === inst.channel);

  const count = selected.length;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isLoading || instances.length === 0}
        className="group inline-flex min-h-[2.75rem] max-w-full items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-800 shadow-sm transition-all hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:border-slate-500"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/15 to-indigo-500/10 ring-1 ring-slate-200/80 dark:from-sky-400/20 dark:to-indigo-500/15 dark:ring-slate-600/60">
          <svg className="h-5 w-5 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25zM6 13.5a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25h2.25A2.25 2.25 0 0010.5 18v-2.25A2.25 2.25 0 008.25 13.5H6z"
            />
          </svg>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('crm.instancesLabel')}
          </span>
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {isLoading
              ? t('crm.instancesLoading')
              : instances.length === 0
                ? t('crm.instancesNone')
                : count === 0
                  ? t('crm.instancesPickHint')
                  : t('crm.instancesSelectedCount').replace('{{count}}', String(count))}
          </span>
        </span>
        {count > 0 && (
          <span className="flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 px-2 text-xs font-bold tabular-nums text-white shadow-sm">
            {count}
          </span>
        )}
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-slate-500 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && instances.length > 0 && (
        <div
          className="absolute left-0 top-[calc(100%+0.5rem)] z-[100] w-[min(100vw-1.5rem,24rem)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-900 dark:ring-white/10"
          role="listbox"
          aria-multiselectable
        >
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-white px-3 py-2.5 dark:border-slate-700 dark:from-slate-800/80 dark:to-slate-900">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('crm.instancesPanelHint')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSelectAll()}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-sky-600 shadow-sm ring-1 ring-sky-200/80 transition hover:bg-sky-50 dark:bg-slate-800 dark:text-sky-400 dark:ring-sky-500/30 dark:hover:bg-slate-700"
              >
                {t('crm.instancesSelectAll')}
              </button>
              <button
                type="button"
                onClick={() => onClear()}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 dark:hover:bg-slate-700"
              >
                {t('crm.instancesClear')}
              </button>
            </div>
          </div>
          <ul className="max-h-[min(20rem,50vh)] overflow-y-auto overscroll-contain py-1">
            {instances.map((inst) => {
              const checked = isSelected(inst);
              const wa = inst.channel === 'whatsapp';
              return (
                <li key={`${inst.channel}:${inst.id}`}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/80">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(inst)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-500 dark:bg-slate-800"
                    />
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                        wa
                          ? 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                          : 'bg-gradient-to-br from-pink-500/20 to-purple-600/25 text-pink-800 dark:from-pink-500/25 dark:to-purple-600/30 dark:text-pink-200'
                      }`}
                    >
                      {wa ? 'WA' : 'IG'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{inst.name}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {wa ? 'WhatsApp' : 'Instagram'}
                        {inst.status === 'connected' ? ` · ${t('crm.instanceConnected')}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export const CrmInstancePicker = memo(CrmInstancePickerInner);
