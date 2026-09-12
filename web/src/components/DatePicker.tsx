import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import './DatePicker.css';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface CalendarProps {
  selected?: Date;
  onSelect: (date: Date) => void;
  defaultMonth?: Date;
  minDate?: Date;
  className?: string;
}

/**
 * Clean, lightweight, self-contained Calendar component in Portuguese.
 */
export const Calendar: React.FC<CalendarProps> = ({
  selected,
  onSelect,
  defaultMonth,
  minDate,
  className,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    return defaultMonth || selected || new Date();
  });

  useEffect(() => {
    if (selected) {
      setCurrentMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  }, [selected]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Build grid of days (prev month filler, current month, next month filler)
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isDisabled: boolean;
    }> = [];

    const now = new Date();
    const isTodayDate = (d: Date) =>
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const isSelectedDate = (d: Date) =>
      Boolean(
        selected &&
        d.getDate() === selected.getDate() &&
        d.getMonth() === selected.getMonth() &&
        d.getFullYear() === selected.getFullYear()
      );

    // Prev month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: isTodayDate(d),
        isSelected: isSelectedDate(d),
        isDisabled: Boolean(minDate && d < minDate),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        isCurrentMonth: true,
        isToday: isTodayDate(d),
        isSelected: isSelectedDate(d),
        isDisabled: Boolean(minDate && d < minDate),
      });
    }

    // Next month days to complete 35 or 42 grid cells
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: isTodayDate(d),
        isSelected: isSelectedDate(d),
        isDisabled: Boolean(minDate && d < minDate),
      });
    }

    return days;
  }, [year, month, selected, minDate]);

  return (
    <div className={cn('waddle-calendar-root', className)}>
      {/* Month / Year header with navigation */}
      <div className="waddle-calendar-header">
        <button
          type="button"
          className="waddle-calendar-nav-btn"
          onClick={handlePrevMonth}
          title="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="waddle-calendar-month-label">
          {MONTH_NAMES[month]} de {year}
        </span>
        <button
          type="button"
          className="waddle-calendar-nav-btn"
          onClick={handleNextMonth}
          title="Próximo mês"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekdays header */}
      <div className="waddle-calendar-weekdays">
        {WEEKDAY_NAMES.map((name) => (
          <span key={name} className="waddle-calendar-weekday">
            {name}
          </span>
        ))}
      </div>

      {/* Days grid */}
      <div className="waddle-calendar-grid">
        {calendarDays.map((item, idx) => (
          <button
            key={idx}
            type="button"
            disabled={item.isDisabled}
            className={cn(
              'waddle-calendar-day-btn',
              !item.isCurrentMonth && 'is-outside',
              item.isToday && 'is-today',
              item.isSelected && 'is-selected'
            )}
            onClick={() => onSelect(item.date)}
          >
            <span>{item.date.getDate()}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/* ── Date formatting helpers ────────────────────────────────────────── */

export function formatDateBR(date?: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateWithTimeBR(date: Date, timeStr?: string): string {
  const dateStr = formatDateBR(date);
  if (timeStr) {
    return `${dateStr} às ${timeStr}`;
  }
  return dateStr;
}

export function formatFriendlyDateBR(date: Date, timeStr?: string): string {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const timeSuffix = timeStr ? ` às ${timeStr}` : '';

  if (isToday) return `Hoje${timeSuffix}`;
  if (isTomorrow) return `Amanhã${timeSuffix}`;

  return `${formatDateBR(date)}${timeSuffix}`;
}

/* ── DatePicker Component ───────────────────────────────────────────── */

export interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date, formattedString: string) => void;
  onInsert?: (formattedString: string) => void;
  onClose?: () => void;
  inline?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  placement?: 'top' | 'bottom';
  align?: 'left' | 'right';
  className?: string;
  triggerLabel?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  onInsert,
  onClose,
  inline = false,
  open,
  onOpenChange,
  hideTrigger = false,
  placement = 'top',
  align = 'left',
  className,
  triggerLabel,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => value || new Date());
  const [internalOpen, setInternalOpen] = useState<boolean>(inline || hideTrigger);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isControlled = open !== undefined;
  const isCurrentlyOpen = isControlled ? open : (inline ? true : internalOpen);

  const setOpenState = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      onClose?.();
    }
  };

  useEffect(() => {
    if (value) setSelectedDate(value);
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    if (inline || !isCurrentlyOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenState(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inline, isCurrentlyOpen]);

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    const formatted = formatDateBR(date);
    onChange?.(date, formatted);
    onInsert?.(formatted);
    if (!inline) {
      setOpenState(false);
    }
  };

  const formattedLabel = selectedDate
    ? formatDateBR(selectedDate)
    : triggerLabel || 'Escolher data';

  return (
    <div className={cn('waddle-datepicker-wrapper', inline && 'is-inline', className)} ref={popoverRef}>
      {!inline && !hideTrigger && (
        <button
          type="button"
          className={cn('waddle-datepicker-trigger', isCurrentlyOpen && 'is-active')}
          onClick={() => setOpenState(!isCurrentlyOpen)}
        >
          <CalendarIcon size={14} />
          <span className="waddle-datepicker-trigger-text">{formattedLabel}</span>
        </button>
      )}

      {(isCurrentlyOpen || inline) && (
        <div
          className={cn(
            'waddle-datepicker-popover',
            inline && 'is-inline-panel',
            `placement-${placement}`,
            `align-${align}`
          )}
        >
          <Calendar
            selected={selectedDate}
            onSelect={handleSelectDate}
          />
        </div>
      )}
    </div>
  );
};

export default DatePicker;
