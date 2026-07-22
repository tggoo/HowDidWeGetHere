using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Application.Time;

public sealed record HistoricalDateRange(
    long? StartYear,
    byte? StartMonth,
    byte? StartDay,
    long? EndYear,
    byte? EndMonth,
    byte? EndDay,
    TimePrecision Precision);

