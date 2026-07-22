import './Spinner.css'

export function Spinner() {
  return (
    <div className="spinner-container" role="status" aria-label="Loading">
      <div className="spinner" />
    </div>
  )
}
