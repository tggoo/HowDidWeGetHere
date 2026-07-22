using System.Globalization;
using System.Text.RegularExpressions;
using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Application.Time;

public static partial class HistoricalDateParser
{
    public static HistoricalDateRange Parse(string? label)
    {
        if (string.IsNullOrWhiteSpace(label))
        {
            return Unknown();
        }

        var normalized = label.Trim()
            .Replace('–', '-')
            .Replace('—', '-')
            .Replace(",", string.Empty);

        if (DateOnly.TryParseExact(normalized, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            return new HistoricalDateRange(date.Year, (byte)date.Month, (byte)date.Day, date.Year, (byte)date.Month, (byte)date.Day, TimePrecision.ExactDate);
        }

        var century = CenturyRegex().Match(normalized);
        if (century.Success)
        {
            var ordinal = long.Parse(century.Groups["value"].Value, CultureInfo.InvariantCulture);
            var isBce = century.Groups["era"].Value.Equals("BCE", StringComparison.OrdinalIgnoreCase);
            var start = isBce ? -(ordinal * 100) : ((ordinal - 1) * 100) + 1;
            var end = isBce ? -(((ordinal - 1) * 100) + 1) : ordinal * 100;
            return new HistoricalDateRange(start, null, null, end, null, null, TimePrecision.Century);
        }

        var range = RangeRegex().Match(normalized);
        if (range.Success)
        {
            var isBce = range.Groups["era"].Value.Equals("BCE", StringComparison.OrdinalIgnoreCase);
            var start = ParseYearToken(range.Groups["start"].Value, range.Groups["startScale"].Value, isBce);
            var end = ParseYearToken(range.Groups["end"].Value, range.Groups["endScale"].Value, isBce);
            return new HistoricalDateRange(start, null, null, end, null, null, IsApproximate(normalized) ? TimePrecision.Approximate : TimePrecision.Range);
        }

        var single = SingleYearRegex().Match(normalized);
        if (single.Success)
        {
            var isBce = single.Groups["era"].Value.Equals("BCE", StringComparison.OrdinalIgnoreCase);
            var year = ParseYearToken(single.Groups["value"].Value, single.Groups["scale"].Value, isBce);
            return new HistoricalDateRange(year, null, null, year, null, null, IsApproximate(normalized) ? TimePrecision.Approximate : TimePrecision.Year);
        }

        return Unknown();
    }

    private static bool IsApproximate(string value) =>
        value.StartsWith("c.", StringComparison.OrdinalIgnoreCase) ||
        value.StartsWith("ca.", StringComparison.OrdinalIgnoreCase) ||
        value.Contains("approx", StringComparison.OrdinalIgnoreCase);

    private static long ParseYearToken(string value, string scale, bool isBce)
    {
        var parsed = decimal.Parse(value, CultureInfo.InvariantCulture);
        var multiplier = scale.Equals("million", StringComparison.OrdinalIgnoreCase) ? 1_000_000m : 1m;
        var year = (long)Math.Round(parsed * multiplier, MidpointRounding.AwayFromZero);
        return isBce ? -year : year;
    }

    private static HistoricalDateRange Unknown() =>
        new(null, null, null, null, null, null, TimePrecision.Unknown);

    [GeneratedRegex(@"(?<value>\d+)(st|nd|rd|th)\s+century\s+(?<era>BCE|CE)", RegexOptions.IgnoreCase)]
    private static partial Regex CenturyRegex();

    [GeneratedRegex(@"(?<start>\d+(\.\d+)?)\s*(?<startScale>million)?\s*-\s*(?<end>\d+(\.\d+)?)\s*(?<endScale>million)?\s*(?<era>BCE|CE)?", RegexOptions.IgnoreCase)]
    private static partial Regex RangeRegex();

    [GeneratedRegex(@"(?<value>\d+(\.\d+)?)\s*(?<scale>million)?\s*(?<era>BCE|CE)?", RegexOptions.IgnoreCase)]
    private static partial Regex SingleYearRegex();
}

