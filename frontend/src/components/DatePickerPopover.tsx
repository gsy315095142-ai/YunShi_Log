interface DatePickerPopoverProps {
  dateOptions: string[]
  onSelect: (date: string) => void
}

export default function DatePickerPopover({ dateOptions, onSelect }: DatePickerPopoverProps) {
  return (
    <div className="date-picker-popover">
      {dateOptions.map((d) => (
        <button key={d} type="button" className="date-picker-item" onClick={() => onSelect(d)}>
          📅 {d}
        </button>
      ))}
    </div>
  )
}
