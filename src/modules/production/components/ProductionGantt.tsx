'use client';

import type {
  ProductionJob,
  ProductionStatus,
} from '../types';

type ProductionGanttProps = {
  jobs: ProductionJob[];
};

type TimelineDay = {
  date: Date;
  key: string;
  dayNumber: number;
  weekday: string;
  monthLabel: string;
  isWeekend: boolean;
  isToday: boolean;
};

const DAY_WIDTH = 42;
const LABEL_WIDTH = 320;
const MINIMUM_TIMELINE_DAYS = 42;
const TIMELINE_PADDING_DAYS = 7;

const statusStyles: Record<
  ProductionStatus,
  string
> = {
  not_started: 'bg-slate-600',
  on_deck: 'bg-amber-600',
  in_production: 'bg-blue-700',
  on_hold: 'bg-orange-700',
  shipped: 'bg-violet-700',
  complete: 'bg-emerald-700',
  cancelled: 'bg-red-700',
};

function startOfLocalDay(
  date: Date,
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
}

function addDays(
  date: Date,
  days: number,
) {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() + days,
  );

  return result;
}

function differenceInDays(
  laterDate: Date,
  earlierDate: Date,
) {
  const millisecondsPerDay =
    24 * 60 * 60 * 1000;

  const laterUtc =
    Date.UTC(
      laterDate.getFullYear(),
      laterDate.getMonth(),
      laterDate.getDate(),
    );

  const earlierUtc =
    Date.UTC(
      earlierDate.getFullYear(),
      earlierDate.getMonth(),
      earlierDate.getDate(),
    );

  return Math.round(
    (
      laterUtc -
      earlierUtc
    ) /
      millisecondsPerDay,
  );
}

function parseLocalDate(
  value: string,
) {
  const [
    year,
    month,
    day,
  ] = value
    .split('-')
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
  );
}

function formatShortDate(
  value: string | null,
) {
  if (!value) {
    return 'Not set';
  }

  return parseLocalDate(
    value,
  ).toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
    },
  );
}

function formatDateKey(
  date: Date,
) {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function createTimeline(
  jobs: ProductionJob[],
) {
  const today =
    startOfLocalDay(
      new Date(),
    );

  const timelineDates =
    jobs.flatMap((job) => {
      const dates: Date[] =
        [];

      if (job.planned_start) {
        dates.push(
          parseLocalDate(
            job.planned_start,
          ),
        );
      }

      if (job.planned_end) {
        dates.push(
          parseLocalDate(
            job.planned_end,
          ),
        );
      }

      if (
        job.requested_delivery_date
      ) {
        dates.push(
          parseLocalDate(
            job.requested_delivery_date,
          ),
        );
      }

      return dates;
    });

  const earliestJobDate =
    timelineDates.length > 0
      ? new Date(
          Math.min(
            ...timelineDates.map(
              (date) =>
                date.getTime(),
            ),
          ),
        )
      : today;

  const latestJobDate =
    timelineDates.length > 0
      ? new Date(
          Math.max(
            ...timelineDates.map(
              (date) =>
                date.getTime(),
            ),
          ),
        )
      : addDays(
          today,
          28,
        );

  const earliest =
    addDays(
      earliestJobDate <
        today
        ? earliestJobDate
        : today,
      -TIMELINE_PADDING_DAYS,
    );

  const minimumEnd =
    addDays(
      earliest,
      MINIMUM_TIMELINE_DAYS -
        1,
    );

  const paddedLatest =
    addDays(
      latestJobDate >
        today
        ? latestJobDate
        : today,
      TIMELINE_PADDING_DAYS,
    );

  const latest =
    paddedLatest >
    minimumEnd
      ? paddedLatest
      : minimumEnd;

  const totalDays =
    differenceInDays(
      latest,
      earliest,
    ) + 1;

  const days: TimelineDay[] =
    [];

  for (
    let index = 0;
    index < totalDays;
    index += 1
  ) {
    const date =
      addDays(
        earliest,
        index,
      );

    days.push({
      date,

      key:
        formatDateKey(
          date,
        ),

      dayNumber:
        date.getDate(),

      weekday:
        date.toLocaleDateString(
          undefined,
          {
            weekday:
              'narrow',
          },
        ),

      monthLabel:
        date.toLocaleDateString(
          undefined,
          {
            month: 'short',
            year: 'numeric',
          },
        ),

      isWeekend:
        date.getDay() ===
          0 ||
        date.getDay() === 6,

      isToday:
        differenceInDays(
          date,
          today,
        ) === 0,
    });
  }

  return {
    start: earliest,
    days,
  };
}

export default function ProductionGantt({
  jobs,
}: ProductionGanttProps) {
  if (
    jobs.length === 0
  ) {
    return (
      <div className="flex min-h-64 items-center justify-center border border-slate-400 bg-white px-6 py-12 text-center shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
        <div>
          <div className="text-lg font-bold text-slate-900">
            No production records found
          </div>

          <div className="mt-2 text-sm text-slate-600">
            Create a production record or adjust the current filters.
          </div>
        </div>
      </div>
    );
  }

  const {
    start,
    days,
  } = createTimeline(jobs);

  const timelineWidth =
    days.length *
    DAY_WIDTH;

  const todayIndex =
    days.findIndex(
      (day) =>
        day.isToday,
    );

  return (
    <div className="overflow-hidden border border-slate-400 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
      <div className="overflow-x-auto">
        <div
          style={{
            minWidth:
              LABEL_WIDTH +
              timelineWidth,
          }}
        >
          <div className="sticky top-0 z-20 flex border-b border-slate-400 bg-slate-100">
            <div
              className="sticky left-0 z-30 flex shrink-0 items-end border-r border-slate-400 bg-slate-100 px-4 pb-3 pt-9"
              style={{
                width:
                  LABEL_WIDTH,
              }}
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                Project / Schedule
              </div>
            </div>

            <div
              className="relative shrink-0"
              style={{
                width:
                  timelineWidth,
              }}
            >
              <div className="flex h-8 border-b border-slate-300">
                {days.map(
                  (
                    day,
                    index,
                  ) => {
                    const previousDay =
                      index > 0
                        ? days[
                            index -
                              1
                          ]
                        : null;

                    const showMonth =
                      index === 0 ||
                      previousDay?.date.getMonth() !==
                        day.date.getMonth();

                    return (
                      <div
                        key={`month-${day.key}`}
                        className="shrink-0"
                        style={{
                          width:
                            DAY_WIDTH,
                        }}
                      >
                        {showMonth && (
                          <div className="whitespace-nowrap px-2 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                            {
                              day.monthLabel
                            }
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>

              <div className="flex h-10">
                {days.map(
                  (day) => (
                    <div
                      key={
                        day.key
                      }
                      className={`flex shrink-0 flex-col items-center justify-center border-r border-slate-200 text-[10px] ${
                        day.isToday
                          ? 'bg-blue-100 font-bold text-blue-900'
                          : day.isWeekend
                            ? 'bg-slate-200/70 text-slate-500'
                            : 'text-slate-600'
                      }`}
                      style={{
                        width:
                          DAY_WIDTH,
                      }}
                    >
                      <span>
                        {
                          day.weekday
                        }
                      </span>

                      <span className="text-xs font-bold">
                        {
                          day.dayNumber
                        }
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>

          {jobs.map(
            (job) => {
              const hasSchedule =
                Boolean(
                  job.planned_start &&
                    job.planned_end,
                );

              const hasDeliveryMilestone =
                Boolean(
                  !hasSchedule &&
                    job.requested_delivery_date,
                );

              const startOffset =
                hasSchedule
                  ? differenceInDays(
                      parseLocalDate(
                        job.planned_start!,
                      ),
                      start,
                    )
                  : 0;

              const duration =
                hasSchedule
                  ? Math.max(
                      1,

                      differenceInDays(
                        parseLocalDate(
                          job.planned_end!,
                        ),

                        parseLocalDate(
                          job.planned_start!,
                        ),
                      ) + 1,
                    )
                  : 0;

              const deliveryOffset =
                hasDeliveryMilestone
                  ? differenceInDays(
                      parseLocalDate(
                        job.requested_delivery_date!,
                      ),
                      start,
                    )
                  : 0;

              return (
                <div
                  key={job.id}
                  className="flex min-h-[74px] border-b border-slate-300 last:border-b-0"
                >
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-center border-r border-slate-400 bg-white px-4 py-3"
                    style={{
                      width:
                        LABEL_WIDTH,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-950">
                        {job.name}
                      </div>

                      <div className="mt-1 truncate text-xs text-slate-600">
                        {[
                          job.job_number,
                          job.customer,
                        ]
                          .filter(
                            Boolean,
                          )
                          .join(
                            ' • ',
                          ) ||
                          'Identifiers not assigned'}
                      </div>

                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        {hasSchedule
                          ? `${formatShortDate(
                              job.planned_start,
                            )} – ${formatShortDate(
                              job.planned_end,
                            )}`
                          : job.requested_delivery_date
                            ? `Delivery requested ${formatShortDate(
                                job.requested_delivery_date,
                              )}`
                            : 'Schedule not set'}
                      </div>
                    </div>
                  </div>

                  <div
                    className="relative shrink-0"
                    style={{
                      width:
                        timelineWidth,
                    }}
                  >
                    <div className="absolute inset-0 flex">
                      {days.map(
                        (day) => (
                          <div
                            key={`${job.id}-${day.key}`}
                            className={`h-full shrink-0 border-r border-slate-200 ${
                              day.isWeekend
                                ? 'bg-slate-100'
                                : ''
                            }`}
                            style={{
                              width:
                                DAY_WIDTH,
                            }}
                          />
                        ),
                      )}
                    </div>

                    {todayIndex >=
                      0 && (
                      <div
                        className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-blue-600"
                        style={{
                          left:
                            todayIndex *
                              DAY_WIDTH +
                            DAY_WIDTH /
                              2,
                        }}
                      />
                    )}

                    {hasSchedule && (
                      <div
                        className={`absolute top-1/2 z-[2] h-8 -translate-y-1/2 overflow-hidden border border-black/20 text-white shadow-sm ${
                          statusStyles[
                            job
                              .production_status
                          ]
                        }`}
                        style={{
                          left:
                            startOffset *
                              DAY_WIDTH +
                            3,

                          width:
                            Math.max(
                              DAY_WIDTH -
                                6,

                              duration *
                                DAY_WIDTH -
                                6,
                            ),
                        }}
                        title={`${job.name}: ${job.planned_start} through ${job.planned_end}`}
                      >
                        <div className="relative flex h-full items-center px-2 text-[10px] font-bold uppercase tracking-[0.05em]">
                          <span className="truncate">
                            {
                              job.name
                            }
                          </span>
                        </div>
                      </div>
                    )}

                    {hasDeliveryMilestone && (
                      <div
                        className="absolute top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left:
                            deliveryOffset *
                              DAY_WIDTH +
                            DAY_WIDTH /
                              2,
                        }}
                        title={`Requested delivery: ${job.requested_delivery_date}`}
                      >
                        <div className="h-5 w-5 rotate-45 border-2 border-violet-800 bg-violet-200 shadow-sm" />

                        <div className="absolute left-5 top-1/2 w-40 -translate-y-1/2 pl-2 text-[10px] font-bold uppercase tracking-[0.05em] text-violet-900">
                          Delivery
                        </div>
                      </div>
                    )}

                    {!hasSchedule &&
                      !hasDeliveryMilestone && (
                        <div className="absolute left-4 top-1/2 z-[2] -translate-y-1/2">
                          <span className="inline-flex border border-dashed border-slate-400 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
                            Schedule not set
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}