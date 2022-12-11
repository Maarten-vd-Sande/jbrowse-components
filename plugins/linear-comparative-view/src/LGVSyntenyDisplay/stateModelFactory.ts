import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import {
  getSession,
  getContainingTrack,
  getContainingView,
  Feature,
} from '@jbrowse/core/util'
import {
  MismatchParser,
  linearPileupDisplayStateModelFactory,
} from '@jbrowse/plugin-alignments'
import { types } from 'mobx-state-tree'
import { when } from 'mobx'

// locals
import { LinearSyntenyViewModel } from '../LinearSyntenyView/model'

type LSV = LinearSyntenyViewModel

const { parseCigar, getOrientedCigar } = MismatchParser

function findPosInCigar(inCigar: string[], flip: boolean, x: number) {
  let featX = 0
  let mateX = 0
  const cigar = getOrientedCigar(flip, inCigar)
  for (let i = 0; i < cigar.length; i++) {
    const len = +cigar[i]
    const op = cigar[i + 1]
    const min = Math.min(len, x - featX)

    if (featX >= x) {
      break
    } else if (op === 'I') {
      mateX += len
    } else if (op === 'D') {
      featX += min
    } else if (op === 'M') {
      mateX += min
      featX += min
    }
  }
  return [featX, mateX]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function navToSynteny(feature: Feature, self: any) {
  const session = getSession(self)
  const track = getContainingTrack(self)
  const view = getContainingView(self)
  const reg = view.dynamicBlocks.contentBlocks[0]
  const cigar = parseCigar(feature.get('cg'))
  const strand = feature.get('strand')
  const regStart = reg.start
  const regEnd = reg.end
  const featStart = feature.get('start')
  const featEnd = feature.get('end')
  const mate = feature.get('mate')
  const flip = feature.get('flipInsDel')
  const mateStart = mate.start
  const mateEnd = mate.end
  const mateAsm = mate.assemblyName
  const mateRef = mate.refName
  const featAsm = reg.assemblyName
  const featRef = reg.refName

  let rMateStart = mateStart
  let rMateEnd = mateStart
  let rFeatStart = featStart
  let rFeatEnd = featStart

  if (cigar) {
    const [fStartX, mStartX] = findPosInCigar(cigar, flip, regStart - featStart)
    const [fEndX, mEndX] = findPosInCigar(cigar, flip, regEnd - featStart)

    // avoid multiply by 0 with strand undefined
    const flipper = strand === -1 ? -1 : 1
    rFeatStart = featStart + fStartX
    rFeatEnd = featStart + fEndX
    rMateStart = mateStart + mStartX * flipper
    rMateEnd = mateStart + mEndX * flipper
  } else {
    rFeatEnd = featEnd
    rMateEnd = mateEnd
  }
  const trackId = track.configuration.trackId

  const view2 = session.addView('LinearSyntenyView', {
    type: 'LinearSyntenyView',
    views: [
      {
        id: `${Math.random()}`,
        type: 'LinearGenomeView',
        hideHeader: true,
      },
      {
        id: `${Math.random()}`,
        type: 'LinearGenomeView',
        hideHeader: true,
      },
    ],
    tracks: [
      {
        configuration: trackId,
        type: 'SyntenyTrack',
        displays: [
          {
            type: 'LinearSyntenyDisplay',
            configuration: `${trackId}-LinearSyntenyDisplay`,
          },
        ],
      },
    ],
  }) as LSV
  const f = (n: number) => Math.floor(n)
  const l1 = `${featRef}:${f(rFeatStart)}-${f(rFeatEnd)}`
  const l2 = `${mateRef}:${f(rMateStart)}-${f(rMateEnd)}${
    strand === -1 ? '[rev]' : ''
  }`
  await when(() => view2.width !== undefined)
  await Promise.all([
    view2.views[0].navToLocString(l1, featAsm),
    view2.views[1].navToLocString(l2, mateAsm),
  ])
}

/**
 * #stateModel LGVSyntenyDisplay
 * extends `LinearPileupDisplay`, displays location of "synteny" feature in a
 * plain LGV, allowing linking out to external synteny views
 */
function stateModelFactory(schema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LGVSyntenyDisplay',
      linearPileupDisplayStateModelFactory(schema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LGVSyntenyDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(schema),
      }),
    )
    .views(self => {
      const superContextMenuItems = self.contextMenuItems
      return {
        contextMenuItems() {
          const feature = self.contextMenuFeature
          return [
            ...superContextMenuItems(),
            ...(feature
              ? [
                  {
                    label: 'Open synteny view for this position',
                    onClick: () => navToSynteny(feature, self),
                  },
                ]
              : []),
          ]
        },
      }
    })
}

export default stateModelFactory
