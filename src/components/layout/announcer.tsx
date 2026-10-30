// elementos usados pela função announce() em src/lib/announcer.ts
export function Announcer() {
  return (
    <>
      <div id="announcer-polite" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div id="announcer-assertive" role="alert" aria-live="assertive" aria-atomic="true" className="sr-only" />
    </>
  )
}
