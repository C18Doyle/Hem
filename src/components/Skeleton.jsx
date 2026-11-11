export function GridSkeleton({ n = 6, cols }) {
  return <div className={"grid" + (cols === 3 ? " cols3" : cols === 2 ? " cols2" : "")} aria-busy="true" aria-label="Loading">
    {Array.from({ length: n }, (_, k) => <div key={k}><div className="im sk" /><div className="sk sk-line" style={{ width: "70%" }} /><div className="sk sk-line" style={{ width: "40%", height: 10 }} /></div>)}
  </div>;
}
export function FigsSkeleton() {
  return <div className="figs" aria-busy="true">{[0, 1, 2].map(k => <div key={k}><div className="sk" style={{ height: 44, width: "60%" }} /><div className="sk sk-line" style={{ width: "80%", height: 10 }} /></div>)}</div>;
}
