/**
 * Screen 3 — "What are you making?" Design artifact `3b`.
 *
 * The three blueprints, described **by what you would do with them**, with the
 * page shapes drawn at true relative proportion. The word "blueprint" never
 * appears on screen, and neither does any page dimension: there is no page
 * size, column or margin control anywhere in this app.
 */

import { Footer, Option, PageShape, Screen } from '../chrome'
import { BLUEPRINT_COPY, BLUEPRINTS, type BlueprintId } from '../../model/vocabularies'
import { Field } from '../chrome'

const SHAPE: Record<BlueprintId, { w: number; h: number }> = {
  field_guide: { w: 5.5, h: 8.5 },
  quick_reference: { w: 8.5, h: 11 },
  huddle_card: { w: 8.5, h: 11 },
}

export function Blueprint({
  blueprint,
  title,
  onBlueprint,
  onTitle,
  onBack,
  onNext,
}: {
  blueprint: BlueprintId
  title: string
  onBlueprint: (id: BlueprintId) => void
  onTitle: (title: string) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <>
      <Screen
        title="What are you making?"
        lede="Pick the shape that suits how people will use it. You can change your mind later — nothing you write gets lost when you do."
      >
        <div className="stack-lg">
          <div className="stack">
            {BLUEPRINTS.map((id) => (
              <Option
                key={id}
                selected={blueprint === id}
                onSelect={() => onBlueprint(id)}
                title={BLUEPRINT_COPY[id].name}
                detail={BLUEPRINT_COPY[id].use}
                aside={<PageShape widthIn={SHAPE[id].w} heightIn={SHAPE[id].h} label={BLUEPRINT_COPY[id].name} />}
              />
            ))}
          </div>

          <Field
            id="doc-title"
            label="What is it called?"
            hint="What someone would search for when they need it. A verb usually helps: “Ordering a referral” rather than “Referrals”."
            value={title}
            onChange={onTitle}
            placeholder="Ordering and tracking outpatient referrals"
          />
        </div>
      </Screen>

      <Footer
        onBack={onBack}
        action={
          <button
            type="button"
            className="btn btn-accent"
            onClick={onNext}
            disabled={!title.trim()}
          >
            Start writing
          </button>
        }
      />
    </>
  )
}
