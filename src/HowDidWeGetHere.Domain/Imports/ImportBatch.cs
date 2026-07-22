using HowDidWeGetHere.Domain.Common;
using HowDidWeGetHere.Domain.Enums;

namespace HowDidWeGetHere.Domain.Imports;

public sealed class ImportBatch : Entity
{
    public string FileName { get; set; } = string.Empty;
    public string? ImportedByUserId { get; set; }
    public ImportStatus Status { get; set; } = ImportStatus.Pending;
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
    public string? SummaryJson { get; set; }

    public ICollection<ImportedRow> Rows { get; set; } = [];
}

