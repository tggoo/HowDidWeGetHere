import { VirtualizedTableBody } from '../../molecules/VirtualizedTableBody'

type Numberish = number | string

type AdminImportPreviewRow = {
  slug: string
  title: string
  sourceSheet?: string | null
  sourceRow?: Numberish | null
  willUpdateExistingEntry: boolean
  tags: Numberish
  places: Numberish
  sources: Numberish
  audioFiles: Numberish
  imageFiles: Numberish
  warnings: string[]
}

type AdminImportPreviewTableProps = {
  rows: AdminImportPreviewRow[]
}

export function AdminImportPreviewTable({ rows }: AdminImportPreviewTableProps) {
  return (
    <div className="admin-table-scroll">
      <table className="admin-table virtualized">
        <thead>
          <tr>
            <th>Entry</th>
            <th>Action</th>
            <th>Links</th>
            <th>Media</th>
            <th>Warnings</th>
          </tr>
        </thead>
        <VirtualizedTableBody
          columnCount={5}
          getKey={(row) => row.slug}
          height={260}
          items={rows}
          renderRow={(row) => (
            <>
              <td>
                {row.title}
                <small>{row.sourceSheet && row.sourceRow ? `${row.sourceSheet} #${row.sourceRow}` : row.slug}</small>
              </td>
              <td>{row.willUpdateExistingEntry ? 'Update' : 'Create'}</td>
              <td>
                {row.tags} tags / {row.places} places / {row.sources} sources
              </td>
              <td>
                {row.audioFiles} audio / {row.imageFiles} images
              </td>
              <td>{row.warnings.length > 0 ? row.warnings.join(', ') : 'OK'}</td>
            </>
          )}
          rowHeight={58}
        />
      </table>
    </div>
  )
}
