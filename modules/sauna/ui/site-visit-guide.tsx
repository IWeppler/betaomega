import type { PageContent } from "../domain/page";
import { describeRules, type PolicyRule } from "../domain/policy";
import { Question } from "./site-question";
import { textLinkClass } from "./site-parts";

/** Lines with a hairline between them, in two columns from tablets up: easier to scan than bullets in one long column. */
function Rows({ items, tone = "ink" }: { items: string[]; tone?: "ink" | "muted" }) {
  return <ul className={`m-0 list-none p-0 md:columns-2 md:gap-x-10 ${tone === "ink" ? "text-ink" : "text-muted"}`}>
    {items.map(item => <li key={item} className="break-inside-avoid border-b border-line py-3 text-lg leading-7">{item}</li>)}
  </ul>;
}

const INDEX = [
  { id: "recomendaciones", label: "Para disfrutar tu sesión" },
  { id: "contraindicaciones", label: "Contraindicaciones" },
  { id: "reservas-consultas", label: "Reservas y cancelaciones" },
];

// Health and preparation information stays visible, without requiring an accordion interaction (docs/SAUNA.md §12).
export function SiteVisitGuide({ page, rules }: { page: PageContent; rules: PolicyRule[] }) {
  const heading = "m-0 mb-5 font-display text-2xl/snug font-normal text-ink md:text-3xl";
  const care = [
    "Traé una botella de agua y tenela a mano al salir. Tomá agua antes y después de la sesión para reponer el líquido que perdés al transpirar.",
    "No toques el vaporizador ni la salida de vapor: pueden causar quemaduras.",
    "Si sentís mareos, náuseas, dolor de cabeza o cualquier malestar, salí del sauna y avisanos enseguida.",
  ];
  return <section id="preguntas" className="scroll-mt-8 px-[7%] py-20 md:py-28 lg:px-[8%]">
    <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-20">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <h2 className="m-0 font-display text-3xl/snug font-normal text-ink md:text-4xl">Antes de tu visita</h2>
        <p className="mt-4 mb-8 text-lg leading-8 text-muted">Unos minutos de lectura para que tu sesión salga bien.</p>
        <nav aria-label="Información para tu visita" className="flex flex-wrap gap-x-6 gap-y-1 lg:flex-col lg:gap-y-2">
          {INDEX.map(link => <a key={link.id} href={`#${link.id}`} className={`${textLinkClass} text-ink`}>{link.label}</a>)}
        </nav>
      </div>

      <div className="min-w-0 text-lg leading-8 text-ink">
        <section id="recomendaciones" aria-labelledby="recomendaciones-title" className="scroll-mt-8">
          <h3 id="recomendaciones-title" className={heading}>Para disfrutar tu sesión</h3>
          <Rows items={[...new Set([...page.recommendations, ...page.indications])]} />
          <div className="mt-8 rounded-card bg-sand p-6 md:p-8">
            <h4 className="m-0 mb-3 font-text text-xl font-semibold text-ink">Cuidados importantes</h4>
            <ul className="m-0 grid list-none gap-3 p-0">
              {care.map(item => <li key={item} className="border-l-2 border-brand-highlight pl-4 text-lg leading-7 text-ink">{item}</li>)}
            </ul>
          </div>
        </section>

        <section id="contraindicaciones" aria-labelledby="contraindicaciones-title" className="mt-16 scroll-mt-8 overflow-hidden rounded-card border border-line-strong bg-surface">
          <div className="border-b border-line-strong p-6 md:p-8">
            <h3 id="contraindicaciones-title" className={heading}>Contraindicaciones</h3>
            <p className="m-0 max-w-prose">El sauna no es un dispositivo médico. Si tenés alguna enfermedad, una condición de salud o dudas sobre si podés usarlo, consultá con tu médico antes de reservar. En las siguientes situaciones, no lo uses sin su aprobación.</p>
          </div>
          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <h4 className="m-0 mb-2 font-text text-xl font-semibold text-ink">No lo uses sin aprobación médica</h4>
              <ul className="m-0 list-none p-0">{page.contraindications.map(item => <li key={item} className="border-b border-line py-3 text-lg leading-7">{item}</li>)}</ul>
            </div>
            <div>
              <h4 className="m-0 mb-2 font-text text-xl font-semibold text-ink">Otros motivos de consulta previa</h4>
              <p className="m-0 mb-1 text-base leading-6 text-muted">El manual del equipo también indica consultar en estos casos:</p>
              <ul className="m-0 list-none p-0">{[
                "Diabetes, otras enfermedades metabólicas, enfermedades de los órganos internos o anemia severa.",
                "Implantes metálicos u otros implantes corporales, cirugía reciente, fracturas u osteoporosis.",
                "Cáncer u otras enfermedades malignas.",
                "Quemaduras o enrojecimiento de la piel, o tendencia a hemorragias.",
                "Lactancia. El manual también menciona la menstruación.",
                "Falta de sudoración (anhidrosis) o trastornos de sensibilidad al calor.",
                "Condiciones de salud mental que puedan afectar el uso seguro del equipo.",
              ].map(item => <li key={item} className="border-b border-line py-3 text-lg leading-7">{item}</li>)}</ul>
            </div>
          </div>
          <p className="m-0 bg-night p-6 text-base leading-7 font-medium text-night-ink md:px-8">Solo para mayores de 18 años. No ingreses después de consumir alcohol ni bajo los efectos de otras sustancias. No uses el equipo si no podés percibir el calor, salir por tus propios medios o comprender las instrucciones y manejar los controles.</p>
        </section>

        <section id="reservas-consultas" aria-labelledby="reservas-title" className="mt-16 scroll-mt-8">
          <h3 id="reservas-title" className={heading}>Reservas y cancelaciones</h3>
          <div className="border-t border-line">
            <Question title="¿Cómo reservo un turno?">Elegí el día y el horario, y dejá tu nombre y tu WhatsApp. Antes de confirmar vas a ver el precio y la seña. Tu lugar queda guardado por un rato y la reserva se confirma por WhatsApp.</Question>
            {rules.length > 0 && <Question title="Si necesitás cancelar"><ul className="m-0 grid list-disc gap-3 pl-5 marker:text-accent-text">{describeRules(rules).map(line => <li key={line} className="pl-1">{line}</li>)}</ul></Question>}
          </div>
        </section>
      </div>
    </div>
  </section>;
}
