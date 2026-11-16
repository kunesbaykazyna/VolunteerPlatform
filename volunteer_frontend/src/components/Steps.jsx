import { Search, Send, Check } from './Icons'

const steps = [
  { icon: <Search width={20} height={20} />, title: 'Find a project', text: 'Browse by category, date and location.' },
  { icon: <Send width={20} height={20} />, title: 'Register', text: 'Send your registration with a short note.' },
  { icon: <Check width={20} height={20} />, title: 'Get approved', text: 'The organizer reviews it — you see the status.' },
]

export default function Steps() {
  return (
    <section className="container steps">
      {steps.map((s, i) => (
        <div className="step" key={s.title}>
          <div className="step-icon">{s.icon}</div>
          <div>
            <h3>{i + 1}. {s.title}</h3>
            <p>{s.text}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
