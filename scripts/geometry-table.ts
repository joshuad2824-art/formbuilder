/**
 * Prints the geometry table from the engine.
 *
 * This is the antidote to the defect that recurred through six design passes:
 * a hand-typed figure sitting beside correct geometry. Nothing here is typed —
 * run it and the table is whatever the layout actually is.
 */
import { reportAll, formatReports } from '../src/geometry/verify'
import { CalibratedMeasurer } from '../src/geometry/measure'

const reports = reportAll(new CalibratedMeasurer())
console.log(formatReports(reports))

const failed = reports.flatMap((r) => r.checks.filter((c) => !c.ok).map((c) => `${r.label}: ${c.name}`))
if (failed.length > 0) {
  console.error('Geometry checks failed:\n  ' + failed.join('\n  '))
  process.exit(1)
}
console.log('All geometries pass their own checks.')
