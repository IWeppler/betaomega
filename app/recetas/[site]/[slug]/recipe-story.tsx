import { descriptionBlocks } from "@/lib/recipes";

/** The full description, with the titles, paragraphs and lists the author wrote in the panel. */
export function RecipeStory({ text }: { text: string }) {
  return <section id="sobre-la-receta" className="r-story" aria-labelledby="story-title">
    <h2 id="story-title">Sobre esta receta</h2>
    <div className="r-story-body">
      {descriptionBlocks(text).map((block, n) => {
        if (block.kind === "heading") return <h3 key={n}>{block.text}</h3>;
        if (block.kind === "paragraph") return <p key={n}>{block.text}</p>;
        return <ul key={n}>{block.items.map((item, i) => <li key={i}>
          {item.label ? <><strong>{item.label}:</strong> {item.text}</> : item.text}
        </li>)}</ul>;
      })}
    </div>
  </section>;
}
