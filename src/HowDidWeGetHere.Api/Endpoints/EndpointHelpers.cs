using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using HowDidWeGetHere.Infrastructure.Persistence;

namespace HowDidWeGetHere.Api.Endpoints;

internal static partial class EndpointHelpers
{
    public static string NormalizeLanguage(string? language) =>
        string.IsNullOrWhiteSpace(language) ? "en" : language.Trim().ToLowerInvariant();

    public static string MakeUniqueEntrySlug(string baseSlug, HistoryDbContext dbContext)
    {
        var slug = string.IsNullOrWhiteSpace(baseSlug) ? Guid.NewGuid().ToString("n") : baseSlug;
        var uniqueSlug = slug;
        var suffix = 2;

        while (dbContext.Entries.Any(entry => entry.Slug == uniqueSlug))
        {
            uniqueSlug = $"{slug}-{suffix}";
            suffix++;
        }

        return uniqueSlug;
    }

    public static string Slugify(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);

        foreach (var character in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(character);
            if (category == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(character))
            {
                builder.Append(char.ToLowerInvariant(character));
            }
            else
            {
                builder.Append('-');
            }
        }

        return CollapseDashesRegex().Replace(builder.ToString(), "-").Trim('-');
    }

    [GeneratedRegex("-+")]
    private static partial Regex CollapseDashesRegex();
}

