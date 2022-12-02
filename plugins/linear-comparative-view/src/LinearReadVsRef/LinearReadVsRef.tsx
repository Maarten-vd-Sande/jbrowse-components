import React, { useEffect, useState } from 'react'
import {
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'
import { getConf } from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getSession, getContainingView, Feature } from '@jbrowse/core/util'

// locals
import {
  getClip,
  getLength,
  getLengthOnRef,
  getLengthSansClipping,
  getTag,
  mergeIntervals,
} from './util'

interface ReducedFeature {
  refName: string
  start: number
  clipPos: number
  end: number
  strand: number
  seqLength: number
  syntenyId?: number
  uniqueId: string
  mate: {
    refName: string
    start: number
    end: number
    syntenyId?: number
    uniqueId?: string
  }
}

const useStyles = makeStyles()(theme => ({
  root: {
    width: 300,
  },
}))

interface BasicFeature {
  end: number
  start: number
  refName: string
}

// hashmap of refName->array of features
type FeaturesPerRef = { [key: string]: BasicFeature[] }

function gatherOverlaps(regions: BasicFeature[]) {
  const groups = regions.reduce((memo, x) => {
    if (!memo[x.refName]) {
      memo[x.refName] = []
    }
    memo[x.refName].push(x)
    return memo
  }, {} as FeaturesPerRef)

  return Object.values(groups)
    .map(group => mergeIntervals(group.sort((a, b) => a.start - b.start)))
    .flat()
}

export default function ReadVsRefDialog({
  track,
  feature: preFeature,
  handleClose,
}: {
  feature: Feature
  handleClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  track: any
}) {
  const { classes } = useStyles()

  // window size stored as string, because it corresponds to a textfield which
  // is parsed as number on submit
  const [windowSizeText, setWindowSize] = useState('0')
  const [error, setError] = useState<unknown>()
  const [primaryFeature, setPrimaryFeature] = useState<Feature>()
  const windowSize = +windowSizeText

  // we need to fetch the primary alignment if the selected feature is 2048.
  // this should be the first in the list of the SA tag
  useEffect(() => {
    let done = false
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      setError(undefined)
      try {
        if (preFeature.get('flags') & 2048) {
          const SA: string = getTag(preFeature, 'SA') || ''
          const primaryAln = SA.split(';')[0]
          const [saRef, saStart] = primaryAln.split(',')
          const { rpcManager } = getSession(track)
          const adapterConfig = getConf(track, 'adapter')
          const sessionId = getRpcSessionId(track)

          const feats = (await rpcManager.call(sessionId, 'CoreGetFeatures', {
            adapterConfig,
            sessionId,
            regions: [
              {
                refName: saRef,
                start: +saStart - 1,
                end: +saStart,
              },
            ],
          })) as Feature[]

          const result = feats.find(
            f =>
              f.get('name') === preFeature.get('name') &&
              !(f.get('flags') & 2048),
          )
          if (result) {
            if (!done) {
              setPrimaryFeature(result)
            }
          } else {
            throw new Error('primary feature not found')
          }
        } else {
          setPrimaryFeature(preFeature)
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()

    return () => {
      done = true
    }
  }, [preFeature, track])

  function onSubmit() {
    try {
      if (!primaryFeature) {
        return
      }
      const feature = primaryFeature
      const session = getSession(track)
      const view = getContainingView(track)
      const cigar = feature.get('CIGAR') as string
      const flags = feature.get('flags') as number
      const origStrand = feature.get('strand') as number
      const SA = (getTag(feature, 'SA') as string) || ''
      const readName = feature.get('name') as string
      const clipPos = getClip(cigar, 1)

      const readAssembly = `${readName}_assembly_${Date.now()}`
      const [trackAssembly] = getConf(track, 'assemblyNames')
      const assemblyNames = [trackAssembly, readAssembly]
      const trackId = `track-${Date.now()}`
      const trackName = `${readName}_vs_${trackAssembly}`

      // get the canonical refname for the read because if the
      // read.get('refName') is chr1 and the actual fasta refName is 1 then no
      // tracks can be opened on the top panel of the linear read vs ref
      const { assemblyManager } = session
      const assembly = assemblyManager.get(trackAssembly)

      const supplementaryAlignments = SA.split(';')
        .filter(aln => !!aln)
        .map((aln, index) => {
          const [saRef, saStart, saStrand, saCigar] = aln.split(',')
          const saLengthOnRef = getLengthOnRef(saCigar)
          const saLength = getLength(saCigar)
          const saLengthSansClipping = getLengthSansClipping(saCigar)
          const saStrandNormalized = saStrand === '-' ? -1 : 1
          const saClipPos = getClip(saCigar, saStrandNormalized * origStrand)
          const saRealStart = +saStart - 1
          return {
            refName: saRef,
            start: saRealStart,
            end: saRealStart + saLengthOnRef,
            seqLength: saLength,
            clipPos: saClipPos,
            CIGAR: saCigar,
            assemblyName: trackAssembly,
            strand: origStrand * saStrandNormalized,
            uniqueId: `${feature.id()}_SA${index}`,
            mate: {
              start: saClipPos,
              end: saClipPos + saLengthSansClipping,
              refName: readName,
            },
          }
        })

      const feat = feature.toJSON()
      feat.clipPos = clipPos
      feat.strand = 1

      feat.mate = {
        refName: readName,
        start: clipPos,
        end: clipPos + getLengthSansClipping(cigar),
      }

      // if secondary alignment or supplementary, calculate length from SA[0]'s
      // CIGAR which is the primary alignments. otherwise it is the primary
      // alignment just use seq.length if primary alignment
      const totalLength =
        flags & 2048
          ? getLength(supplementaryAlignments[0].CIGAR)
          : getLength(cigar)

      const features = [feat, ...supplementaryAlignments] as ReducedFeature[]

      features.forEach((f, index) => {
        f.refName = assembly?.getCanonicalRefName(f.refName) || f.refName
        f.syntenyId = index
        f.mate.syntenyId = index
        f.mate.uniqueId = `${f.uniqueId}_mate`
      })
      features.sort((a, b) => a.clipPos - b.clipPos)

      const featSeq = feature.get('seq') as string

      // the config feature store includes synthetic mate features
      // mapped to the read assembly
      const configFeatureStore = features.concat(
        // @ts-ignore
        features.map(f => f.mate),
      )

      const expand = 2 * windowSize
      const refLen = features.reduce((a, f) => a + f.end - f.start + expand, 0)

      const seqTrackId = `${readName}_${Date.now()}`
      const sequenceTrackConf = getConf(assembly, 'sequence')
      const lgvRegions = gatherOverlaps(
        features.map(f => ({
          ...f,
          start: Math.max(0, f.start - windowSize),
          end: f.end + windowSize,
          assemblyName: trackAssembly,
        })),
      )

      session.addTemporaryAssembly({
        name: `${readAssembly}`,
        sequence: {
          type: 'ReferenceSequenceTrack',
          name: `Read sequence`,
          trackId: seqTrackId,
          assemblyNames: [readAssembly],
          adapter: {
            type: 'FromConfigSequenceAdapter',
            noAssemblyManager: true,
            features: [
              {
                start: 0,
                end: totalLength,
                seq: featSeq,
                refName: readName,
                uniqueId: `${Math.random()}`,
              },
            ],
          },
        },
      })

      session.addView('LinearSyntenyView', {
        type: 'LinearSyntenyView',
        views: [
          {
            type: 'LinearGenomeView',
            hideHeader: true,
            offsetPx: 0,
            bpPerPx: refLen / view.width,
            displayedRegions: lgvRegions,
            tracks: [
              {
                id: `${Math.random()}`,
                type: 'ReferenceSequenceTrack',
                assemblyNames: [trackAssembly],
                configuration: sequenceTrackConf.trackId,
                displays: [
                  {
                    id: `${Math.random()}`,
                    type: 'LinearReferenceSequenceDisplay',
                    showReverse: true,
                    showTranslation: false,
                    height: 35,
                    configuration: `${seqTrackId}-LinearReferenceSequenceDisplay`,
                  },
                ],
              },
            ],
          },
          {
            type: 'LinearGenomeView',
            hideHeader: true,
            offsetPx: 0,
            bpPerPx: totalLength / view.width,
            displayedRegions: [
              {
                assemblyName: readAssembly,
                start: 0,
                end: totalLength,
                refName: readName,
              },
            ],
            tracks: [
              {
                id: `${Math.random()}`,
                type: 'ReferenceSequenceTrack',
                configuration: seqTrackId,
                displays: [
                  {
                    id: `${Math.random()}`,
                    type: 'LinearReferenceSequenceDisplay',
                    showReverse: true,
                    showTranslation: false,
                    height: 35,
                    configuration: `${seqTrackId}-LinearReferenceSequenceDisplay`,
                  },
                ],
              },
            ],
          },
        ],
        viewTrackConfigs: [
          {
            type: 'SyntenyTrack',
            assemblyNames,
            adapter: {
              type: 'FromConfigAdapter',
              features: configFeatureStore,
            },
            trackId,
            name: trackName,
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
        displayName: `${readName} vs ${trackAssembly}`,
      })
      handleClose()
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }

  return (
    <Dialog open onClose={handleClose} title="Set window size">
      <DialogContent>
        {error ? (
          <Typography color="error">{`${error}`}</Typography>
        ) : !primaryFeature ? (
          <div>
            <Typography>
              To accurately perform comparison we are fetching the primary
              alignment. Loading primary feature...
            </Typography>
            <CircularProgress />
          </div>
        ) : (
          <div className={classes.root}>
            <Typography>
              Show an extra window size around each part of the split alignment.
              Using a larger value can allow you to see more genomic context.
            </Typography>

            <TextField
              value={windowSize}
              onChange={event => setWindowSize(event.target.value)}
              label="Set window size"
            />
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          disabled={!primaryFeature}
          variant="contained"
          color="primary"
          onClick={onSubmit}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}
