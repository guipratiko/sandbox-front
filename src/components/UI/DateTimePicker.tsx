import React, { useState, useRef, useEffect } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
  setHours,
  setMinutes,
  parseISO,
  isValid,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  minDatetime?: Date;
  placeholder?: string;
  label?: string;
  id?: string;
  className?: string;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  minDatetime,
  placeholder,
  label,
  id,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (value) {
      try {
        const d = new Date(value);
        return isValid(d) ? d : new Date();
      } catch {
        return new Date();
      }
    }
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const minDate = minDatetime ? startOfDay(minDatetime) : undefined;
  const parsed = value ? (() => {
    try {
      const d = parseISO(value);
      return isValid(d) ? d : null;
    } catch {
      return null;
    }
  })() : null;

  const displayText = parsed
    ? format(parsed, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : placeholder ?? 'Selecione data e hora';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = monthStart.getDay();
  const paddingDays = Array.from({ length: firstDayOfWeek }, (_, i) => null);

  const minTime =
    minDate && parsed && isSameDay(parsed, minDate)
      ? minDate
      : undefined;

  const handleSelectDay = (day: Date) => {
    if (minDate && isBefore(day, minDate)) return;
    const now = new Date();
    const base = parsed ? new Date(parsed) : setMinutes(setHours(day, now.getHours()), now.getMinutes());
    let combined = new Date(day.getFullYear(), day.getMonth(), day.getDate(), base.getHours(), base.getMinutes());
    if (minDate && isSameDay(combined, minDate) && isBefore(combined, minDate)) {
      combined = new Date(minDate);
    }
    onChange(format(combined, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (!v) return;
    const [h, m] = v.split(':').map(Number);
    const base = parsed || new Date();
    const combined = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
    if (minDate && isBefore(combined, minDate)) return;
    onChange(format(combined, "yyyy-MM-dd'T'HH:mm"));
  };

  const timeValue = parsed ? format(parsed, 'HH:mm') : '';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 text-left text-sm flex items-center justify-between"
      >
        <span className={parsed ? '' : 'text-gray-400'}>{displayText}</span>
        <span className="text-gray-400 ml-2">📅</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-3 min-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-clerky-backendText"
            >
              ←
            </button>
            <span className="text-sm font-medium text-clerky-backendText dark:text-gray-200 capitalize">
              {format(viewMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-clerky-backendText"
            >
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-2 text-center text-xs text-gray-500 dark:text-gray-400">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {paddingDays.map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((day) => {
              const disabled = minDate && isBefore(day, minDate);
              const selected = parsed && isSameDay(day, parsed);
              const today = isToday(day);
              const otherMonth = !isSameMonth(day, viewMonth);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelectDay(day)}
                  className={`
                    w-8 h-8 rounded text-sm
                    ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                    ${selected ? 'bg-clerky-backendButton text-white hover:bg-clerky-backendButton' : ''}
                    ${today && !selected ? 'ring-1 ring-clerky-backendButton' : ''}
                    ${otherMonth ? 'text-gray-300 dark:text-gray-500' : 'text-clerky-backendText dark:text-gray-200'}
                  `}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hora</label>
            <input
              type="time"
              value={timeValue}
              onChange={handleTimeChange}
              min={minTime ? format(minTime, 'HH:mm') : undefined}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DateTimePicker;
