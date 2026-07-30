import { Languages } from 'lucide-react'

type LanguageSelectProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

export function LanguageSelect({ label, onChange, value }: LanguageSelectProps) {
  return (
    <label className="language-select" aria-label={label}>
      <Languages aria-hidden="true" />
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="en">EN</option>
        <option value="cs">CS</option>
      </select>
    </label>
  )
}
