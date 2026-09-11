import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useSyncExternalStore,
  forwardRef,
} from 'react';
import { Check, X, Loader2, Minus, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import './StatusTimeline.css';

export type StageStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
export type DerivedStatus = StageStatus | 'not_run';

export interface TimelineStage {
  id: string;
  label: string;
  status: StageStatus;
  startedAt?: string | number | Date;
  endedAt?: string | number | Date;
  detail?: string;
  error?: string;
}

export interface StatusTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  stages: TimelineStage[];
  orientation?: 'vertical' | 'horizontal';
  label?: string;
  showSummary?: boolean;
  defaultExpandedErrorIds?: string[];
  tickInterval?: number;
  now?: number | Date;
  className?: string;
}

const STATUS_TEXT: Record<DerivedStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  skipped: 'Skipped',
  not_run: 'Not run',
};

function parseTime(val?: string | number | Date): number | null {
  if (val === undefined || val === null) return null;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const parsed = Date.parse(val);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return '0s';
  const sec = ms / 1000;
  if (sec < 10) {
    return `${sec.toFixed(1)}s`;
  }
  if (sec < 60) {
    return `${Math.round(sec)}s`;
  }
  const min = Math.floor(sec / 60);
  const remSec = Math.round(sec % 60);
  if (min < 60) {
    return `${min}m ${remSec < 10 ? '0' : ''}${remSec}s`;
  }
  const hours = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hours}h ${remMin < 10 ? '0' : ''}${remMin}m`;
}

function useTimelineClock(
  enabled: boolean,
  tick: number = 1000,
  pinnedNow?: number | Date
): number | null {
  const pinnedTime = pinnedNow ? parseTime(pinnedNow) : null;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!enabled || pinnedTime !== null || tick <= 0 || !Number.isFinite(tick)) {
        return () => {};
      }
      const interval = Math.max(100, tick);
      const id = setInterval(onStoreChange, interval);
      return () => clearInterval(id);
    },
    [enabled, pinnedTime, tick]
  );

  const getSnapshot = useCallback(() => {
    if (pinnedTime !== null) return pinnedTime;
    if (!enabled || tick <= 0 || !Number.isFinite(tick)) return Math.floor(Date.now() / 1000) * 1000;
    const interval = Math.max(100, tick);
    return Math.floor(Date.now() / interval) * interval;
  }, [enabled, pinnedTime, tick]);

  const getServerSnapshot = useCallback(() => null, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const StatusTimeline = forwardRef<HTMLDivElement, StatusTimelineProps>(
  (
    {
      stages = [],
      orientation = 'vertical',
      label = 'Run stages',
      showSummary = true,
      defaultExpandedErrorIds = [],
      tickInterval = 1000,
      now,
      className,
      ...rest
    },
    ref
  ) => {
    // 1. Deduplicate by stage.id (first occurrence wins)
    const uniqueStages = useMemo(() => {
      const seen = new Set<string>();
      const result: TimelineStage[] = [];
      for (const s of stages) {
        if (!s || !s.id) continue;
        if (!seen.has(s.id)) {
          seen.add(s.id);
          result.push(s);
        }
      }
      return result;
    }, [stages]);

    // 2. Derived "Not run" status
    const derivedStages = useMemo(() => {
      let hasFailed = false;
      return uniqueStages.map((stage) => {
        if (stage.status === 'failed') {
          hasFailed = true;
          return { ...stage, derivedStatus: 'failed' as DerivedStatus };
        }
        if (hasFailed && stage.status === 'pending') {
          return { ...stage, derivedStatus: 'not_run' as DerivedStatus };
        }
        return { ...stage, derivedStatus: stage.status as DerivedStatus };
      });
    }, [uniqueStages]);

    // Check if any stage is currently running with a startedAt
    const anyRunningWithStart = useMemo(() => {
      return derivedStages.some(
        (s) => s.derivedStatus === 'running' && parseTime(s.startedAt) !== null
      );
    }, [derivedStages]);

    // External store clock
    const clock = useTimelineClock(anyRunningWithStart, tickInterval, now);

    // Error panels expanded state
    const [expandedErrors, setExpandedErrors] = useState<Set<string>>(() => {
      return new Set(defaultExpandedErrorIds);
    });

    const toggleError = (stageId: string) => {
      setExpandedErrors((prev) => {
        const next = new Set(prev);
        if (next.has(stageId)) next.delete(stageId);
        else next.add(stageId);
        return next;
      });
    };

    // Live region announcements
    const [politeAnnouncement, setPoliteAnnouncement] = useState<string>('');
    const [alertAnnouncement, setAlertAnnouncement] = useState<string>('');
    const isFirstMount = useRef(true);
    const quietTimerRef = useRef<number | null>(null);

    const viewSignature = useMemo(() => {
      return derivedStages.map((s) => `${s.id}:${s.derivedStatus}`).join('|');
    }, [derivedStages]);

    useEffect(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }

      if (quietTimerRef.current) {
        window.clearTimeout(quietTimerRef.current);
      }

      quietTimerRef.current = window.setTimeout(() => {
        const hasFailed = derivedStages.some((s) => s.derivedStatus === 'failed');
        const runningStage = derivedStages.find((s) => s.derivedStatus === 'running');
        const succeededStages = derivedStages.filter((s) => s.derivedStatus === 'succeeded');

        if (hasFailed) {
          const failedStage = derivedStages.find((s) => s.derivedStatus === 'failed');
          setAlertAnnouncement(`Stage ${failedStage?.label || 'unknown'} failed.`);
        } else if (runningStage) {
          const lastSucceeded = succeededStages[succeededStages.length - 1];
          if (lastSucceeded) {
            setPoliteAnnouncement(
              `${lastSucceeded.label}: succeeded. Now running ${runningStage.label}.`
            );
          } else {
            setPoliteAnnouncement(`Now running ${runningStage.label}.`);
          }
        } else {
          // Settled run
          const allSucceeded = derivedStages.every(
            (s) => s.derivedStatus === 'succeeded' || s.derivedStatus === 'skipped'
          );
          if (allSucceeded && derivedStages.length > 0) {
            setPoliteAnnouncement('Run completed successfully.');
          }
        }
      }, 600);

      return () => {
        if (quietTimerRef.current) window.clearTimeout(quietTimerRef.current);
      };
    }, [viewSignature, derivedStages]);

    // Settled run check (nothing pending, nothing running)
    const isSettled = useMemo(() => {
      if (derivedStages.length === 0) return false;
      return derivedStages.every(
        (s) => s.derivedStatus !== 'pending' && s.derivedStatus !== 'running'
      );
    }, [derivedStages]);

    // Overall summary calculation
    const summaryData = useMemo(() => {
      if (!isSettled || !showSummary) return null;

      let minStart: number | null = null;
      let maxEnd: number | null = null;

      let succeededCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      let notRunCount = 0;

      for (const s of derivedStages) {
        if (s.derivedStatus === 'succeeded') succeededCount++;
        else if (s.derivedStatus === 'failed') failedCount++;
        else if (s.derivedStatus === 'skipped') skippedCount++;
        else if (s.derivedStatus === 'not_run') notRunCount++;

        const st = parseTime(s.startedAt);
        const et = parseTime(s.endedAt);
        if (st !== null) minStart = minStart === null ? st : Math.min(minStart, st);
        if (et !== null) maxEnd = maxEnd === null ? et : Math.max(maxEnd, et);
      }

      const totalDuration =
        minStart !== null && maxEnd !== null && maxEnd >= minStart ? maxEnd - minStart : null;

      const hasFailed = failedCount > 0;
      const statusTitle = hasFailed
        ? totalDuration !== null
          ? `Failed after ${formatDuration(totalDuration)}`
          : 'Failed'
        : totalDuration !== null
        ? `Completed in ${formatDuration(totalDuration)}`
        : 'Completed';

      return {
        hasFailed,
        statusTitle,
        succeededCount,
        failedCount,
        skippedCount,
        notRunCount,
      };
    }, [isSettled, showSummary, derivedStages]);

    const renderNodeIcon = (derivedStatus: DerivedStatus) => {
      switch (derivedStatus) {
        case 'succeeded':
          return <Check size={13} className="timeline-glyph glyph-succeeded" strokeWidth={2.6} />;
        case 'failed':
          return <X size={13} className="timeline-glyph glyph-failed" strokeWidth={2.6} />;
        case 'running':
          return (
            <Loader2
              size={13}
              className="timeline-glyph glyph-running animate-spin"
              strokeWidth={2.4}
              aria-hidden="true"
            />
          );
        case 'skipped':
          return <Minus size={12} className="timeline-glyph glyph-skipped" strokeWidth={2.5} />;
        case 'not_run':
          return <span className="timeline-glyph-hollow-dashed" />;
        case 'pending':
        default:
          return <span className="timeline-glyph-hollow-solid" />;
      }
    };

    return (
      <div
        ref={ref}
        className={cn('status-timeline-root', `orientation-${orientation}`, className)}
        {...rest}
      >
        {/* Live Regions for Screen Readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {politeAnnouncement}
        </div>
        <div aria-live="assertive" aria-atomic="true" className="sr-only">
          {alertAnnouncement}
        </div>

        {derivedStages.length === 0 ? (
          <div className="timeline-empty-message">No stages reported yet.</div>
        ) : (
          <ol role="list" className="timeline-list" aria-label={label}>
            {derivedStages.map((stage, index) => {
              const prevStage = index > 0 ? derivedStages[index - 1] : null;
              const isRunning = stage.derivedStatus === 'running';

              // Connector tint is determined by the stage BEHIND it
              const connectorClass = prevStage
                ? prevStage.derivedStatus === 'succeeded'
                  ? 'connector-succeeded'
                  : prevStage.derivedStatus === 'failed'
                  ? 'connector-failed'
                  : 'connector-muted'
                : '';

              // Duration
              let durationLabel: string | null = null;
              const st = parseTime(stage.startedAt);
              const et = parseTime(stage.endedAt);

              if (st !== null && et !== null && et >= st) {
                durationLabel = formatDuration(et - st);
              } else if (isRunning && st !== null && clock !== null && clock >= st) {
                durationLabel = formatDuration(clock - st);
              }

              const isErrorExpanded = expandedErrors.has(stage.id);
              const hasError = Boolean(stage.error);

              return (
                <li
                  key={stage.id}
                  className={cn(
                    'timeline-stage-item',
                    `status-${stage.derivedStatus}`,
                    index > 0 && connectorClass
                  )}
                  aria-current={isRunning ? 'step' : undefined}
                >
                  {/* Vertical Connector Segment */}
                  {index > 0 && <div className={cn('timeline-connector', connectorClass)} />}

                  {/* Stage Node & Row */}
                  <div className="timeline-stage-row">
                    <div
                      className={cn('timeline-node', `node-${stage.derivedStatus}`, {
                        'has-halo': isRunning,
                      })}
                    >
                      {renderNodeIcon(stage.derivedStatus)}
                    </div>

                    <div className="timeline-stage-content">
                      <div className="timeline-stage-header">
                        <span className="timeline-stage-label">{stage.label}</span>
                        <div className="timeline-stage-meta">
                          <span className={cn('timeline-status-word', `text-${stage.derivedStatus}`)}>
                            {STATUS_TEXT[stage.derivedStatus]}
                          </span>
                          {durationLabel && (
                            <span className="timeline-duration tabular-nums">{durationLabel}</span>
                          )}
                        </div>
                      </div>

                      {stage.detail && (
                        <div className="timeline-stage-detail">{stage.detail}</div>
                      )}

                      {/* Error Toggle Button */}
                      {hasError && stage.derivedStatus === 'failed' && (
                        <div className="timeline-error-toggle-row">
                          <button
                            type="button"
                            className="timeline-error-toggle-btn"
                            aria-expanded={isErrorExpanded}
                            aria-controls={`error-panel-${stage.id}`}
                            onClick={() => toggleError(stage.id)}
                          >
                            {isErrorExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            <span>{isErrorExpanded ? 'Hide error' : 'Show error'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Monospace Error Panel (rendered under row) */}
                  {hasError && (
                    <div
                      id={`error-panel-${stage.id}`}
                      className="timeline-error-panel"
                      hidden={!isErrorExpanded}
                    >
                      <pre className="timeline-error-code">
                        <code>{stage.error}</code>
                      </pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {/* Settled Run Summary Card */}
        {summaryData && (
          <div
            className={cn('timeline-summary-card', {
              'summary-failed': summaryData.hasFailed,
              'summary-succeeded': !summaryData.hasFailed,
            })}
          >
            <div className="timeline-summary-header">
              <span className="timeline-summary-icon">
                {summaryData.hasFailed ? <AlertCircle size={15} /> : <Check size={15} />}
              </span>
              <strong className="timeline-summary-title">{summaryData.statusTitle}</strong>
            </div>

            <div className="timeline-summary-counts">
              {summaryData.succeededCount > 0 && (
                <span className="count-tag tag-succeeded">
                  {summaryData.succeededCount} succeeded
                </span>
              )}
              {summaryData.failedCount > 0 && (
                <span className="count-tag tag-failed">
                  {summaryData.failedCount} failed
                </span>
              )}
              {summaryData.skippedCount > 0 && (
                <span className="count-tag tag-skipped">
                  {summaryData.skippedCount} skipped
                </span>
              )}
              {summaryData.notRunCount > 0 && (
                <span className="count-tag tag-not-run">
                  {summaryData.notRunCount} not run
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

StatusTimeline.displayName = 'StatusTimeline';
export default StatusTimeline;
