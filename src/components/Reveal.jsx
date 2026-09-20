import { useInView } from '../hooks/useInView'
import './Reveal.css'

export default function Reveal({ children, delay = 0, className = '', id }) {
  const [ref, inView] = useInView()

  return (
    <div
      ref={ref}
      id={id}
      className={`reveal ${inView ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export function StaggerGroup({ children, className = '', style }) {
  const [ref, inView] = useInView()

  return (
    <div ref={ref} className={className} style={style}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div
              key={i}
              className={`reveal ${inView ? 'is-visible' : ''}`}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              {child}
            </div>
          ))
        : children}
    </div>
  )
}
