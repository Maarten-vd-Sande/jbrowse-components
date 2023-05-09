import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { toArray } from 'rxjs/operators'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { AugmentedRegion } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { IAnyStateTreeNode, addDisposer, isAlive } from 'mobx-state-tree'
import { autorun } from 'mobx'
// get tag from BAM or CRAM feature, where CRAM uses feature.get('tags') and
// BAM does not
export function getTag(feature: Feature, tag: string) {
  const tags = feature.get('tags')
  return tags ? tags[tag] : feature.get(tag)
}

// use fallback alt tag, used in situations where upper case/lower case tags
// exist e.g. Mm/MM for base modifications
export function getTagAlt(feature: Feature, tag: string, alt: string) {
  return getTag(feature, tag) || getTag(feature, alt)
}

// orientation definitions from igv.js, see also
// https://software.broadinstitute.org/software/igv/interpreting_pair_orientations
export const orientationTypes = {
  fr: {
    F1R2: 'LR',
    F2R1: 'LR',

    F1F2: 'LL',
    F2F1: 'LL',

    R1R2: 'RR',
    R2R1: 'RR',

    R1F2: 'RL',
    R2F1: 'RL',
  } as { [key: string]: string },

  rf: {
    R1F2: 'LR',
    R2F1: 'LR',

    R1R2: 'LL',
    R2R1: 'LL',

    F1F2: 'RR',
    F2F1: 'RR',

    F1R2: 'RL',
    F2R1: 'RL',
  } as { [key: string]: string },

  ff: {
    F2F1: 'LR',
    R1R2: 'LR',

    F2R1: 'LL',
    R1F2: 'LL',

    R2F1: 'RR',
    F1R2: 'RR',

    R2R1: 'RL',
    F1F2: 'RL',
  } as { [key: string]: string },
}

export function getColorWGBS(strand: number, base: string) {
  if (strand === 1) {
    if (base === 'C') {
      return '#f00'
    }
    if (base === 'T') {
      return '#00f'
    }
  } else if (strand === -1) {
    if (base === 'G') {
      return '#f00'
    }
    if (base === 'A') {
      return '#00f'
    }
  }
  return '#888'
}

// fetches region sequence augmenting by +/- 1bp for CpG on either side of requested region
export async function fetchSequence(
  region: AugmentedRegion,
  adapter: BaseFeatureDataAdapter,
) {
  const { start, end, originalRefName, refName } = region

  const feats = await firstValueFrom(
    adapter
      .getFeatures({
        ...region,
        refName: originalRefName || refName,
        end: end + 1,
        start: Math.max(0, start - 1),
      })
      .pipe(toArray()),
  )
  return feats[0]?.get('seq')
}

// has to check underlying C-G (aka CpG) on the reference sequence
export function shouldFetchReferenceSequence(type?: string) {
  return type === 'methylation'
}

// adapted from IGV https://github.com/igvteam/igv/blob/e803e3af2d8c9ea049961dfd4628146bdde9a574/src/main/java/org/broad/igv/sam/mods/BaseModificationColors.java#L27
export const modificationColors = {
  m: 'rgb(255,0,0)',
  h: 'rgb(11, 132, 165)',
  o: 'rgb(111, 78, 129)',
  f: 'rgb(246, 200, 95)',
  c: 'rgb(157, 216, 102)',
  g: 'rgb(255, 160, 86)',
  e: 'rgb(141, 221, 208)',
  b: 'rgb(202, 71, 47)',
} as Record<string, string | undefined>

export function createAutorun(
  self: IAnyStateTreeNode & { setError: (arg: unknown) => void },
  arg: () => Promise<void>,
  options?: { delay: number },
) {
  addDisposer(
    self,
    autorun(async () => {
      try {
        await arg()
      } catch (e) {
        if (isAlive(self)) {
          self.setError(e)
        }
      }
    }, options),
  )
}
export function randomColor() {
  return `hsl(${Math.random() * 200}, 50%, 50%)`
}
