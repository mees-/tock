import { useEffect, useRef, useState } from "react"

const SETS = 3
const N = 10
const HOME = N // middle set: indices 10–19

function DigitWheel({ digit }: { digit: number }) {
  const posRef = useRef(HOME + digit)
  const [pos, setPos] = useState(HOME + digit)
  const [animate, setAnimate] = useState(false)
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    const cur = posRef.current
    const curD = ((cur % N) + N) % N
    const fwd = (digit - curD + N) % N
    const bwd = (curD - digit + N) % N
    if (fwd === 0) return

    const next = fwd <= bwd ? cur + fwd : cur - bwd
    posRef.current = next
    setAnimate(true)
    setPos(next)
  }, [digit])

  function onTransitionEnd() {
    const p = posRef.current
    if (p < HOME || p >= HOME + N) {
      const norm = HOME + (((p % N) + N) % N)
      posRef.current = norm
      setAnimate(false)
      setPos(norm)
    }
  }

  const items = Array.from({ length: SETS * N }, (_, i) => i % N)

  return (
    <span className="relative inline-block overflow-hidden" style={{ height: "1em", lineHeight: "1em" }}>
      <span
        className="flex flex-col"
        style={{
          transform: `translateY(-${pos}em)`,
          transition: animate ? "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
        onTransitionEnd={onTransitionEnd}
      >
        {items.map((d, i) => (
          <span key={i} className="block" style={{ height: "1em", lineHeight: "1em" }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  )
}

export default function AnimatedNumber({ value, className }: { value: string | number; className?: string }) {
  const str = String(value)

  return (
    <span
      className={["inline-flex items-center", className].filter(Boolean).join(" ")}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {str.split("").map((char, i) => {
        const d = parseInt(char, 10)
        if (!isNaN(d)) {
          // Key from right keeps digit identity stable when total digit count changes
          return <DigitWheel key={str.length - 1 - i} digit={d} />
        }
        return <span key={`s${i}`}>{char}</span>
      })}
    </span>
  )
}
