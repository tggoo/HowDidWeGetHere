using HowDidWeGetHere.Domain.Common;
using HowDidWeGetHere.Domain.Entries;

namespace HowDidWeGetHere.Domain.Imports;

public sealed class ImportedRow : Entity
{
    public Guid ImportBatchId { get; set; }
    public ImportBatch ImportBatch { get; set; } = null!;

    public string SheetName { get; set; } = string.Empty;
    public int RowNumber { get; set; }
    public string RawJson { get; set; } = "{}";
    public string? Warning { get; set; }

    public Guid? EntryId { get; set; }
    public Entry? Entry { get; set; }
}

