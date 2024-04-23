import React from 'react'

import {
  SimpleFeatureSerialized,
  defaultCodonTable,
  generateCodonTable,
  revcom,
} from '../../util'
import {
  SeqState,
  calculateUTRs,
  calculateUTRs2,
  dedupe,
  revlist,
} from '../util'
import CDNASequence from './seqtypes/CDNASequence'
import ProteinSequence from './seqtypes/ProteinSequence'
import GenomicSequence from './seqtypes/GenomicSequence'
import CDSSequence from './seqtypes/CDSSequence'
import { SequenceFeatureDetailsModel } from './model'

interface SeqPanelProps {
  sequence: SeqState
  feature: SimpleFeatureSerialized
  mode: string
  model: SequenceFeatureDetailsModel
}

const SeqPanel = React.forwardRef<HTMLDivElement, SeqPanelProps>(
  function SeqPanel2(props, ref) {
    const { model, feature, mode } = props
    let {
      sequence: { seq, upstream = '', downstream = '' },
    } = props
    const { subfeatures = [] } = feature

    const children = subfeatures
      .sort((a, b) => a.start - b.start)
      .map(sub => ({
        ...sub,
        start: sub.start - feature.start,
        end: sub.end - feature.start,
      }))

    // we filter duplicate entries in cds and exon lists duplicate entries may be
    // rare but was seen in Gencode v36 track NCList, likely a bug on GFF3 or
    // probably worth ignoring here (produces broken protein translations if
    // included)
    //
    // position 1:224,800,006..225,203,064 gene ENSG00000185842.15 first
    // transcript ENST00000445597.6
    //
    // http://localhost:3000/?config=test_data%2Fconfig.json&session=share-FUl7G1isvF&password=HXh5Y

    let cds = dedupe(children.filter(sub => sub.type === 'CDS'))
    let utr = dedupe(children.filter(sub => sub.type?.match(/utr/i)))
    let exons = dedupe(children.filter(sub => sub.type === 'exon'))

    if (!utr.length && cds.length && exons.length) {
      utr = calculateUTRs(cds, exons)
    }
    if (!utr.length && cds.length && !exons.length) {
      utr = calculateUTRs2(cds, {
        start: 0,
        end: feature.end - feature.start,
        type: 'gene',
      })
    }

    if (feature.strand === -1) {
      // doing this in a single assignment is needed because downstream and
      // upstream are swapped so this avoids a temp variable
      ;[seq, upstream, downstream] = [
        revcom(seq),
        revcom(downstream),
        revcom(upstream),
      ]
      cds = revlist(cds, seq.length)
      exons = revlist(exons, seq.length)
      utr = revlist(utr, seq.length)
    }
    const codonTable = generateCodonTable(defaultCodonTable)

    return (
      <div ref={ref} data-testid="sequence_panel">
        <div
          style={{
            /* raw styles instead of className so that html copy works */
            fontFamily: 'monospace',
            wordWrap: 'break-word',
            overflow: 'auto',
            color: 'black',
            fontSize: 12,
            maxWidth: 600,
            maxHeight: 300,
          }}
        >
          <span style={{ background: 'white' }}>
            {`>${
              feature.name ||
              feature.id ||
              `${feature.refName}:${feature.start + 1}-${feature.end}`
            }-${mode}\n`}
          </span>
          <br />
          {mode === 'genomic' ? (
            <GenomicSequence sequence={seq} />
          ) : mode === 'genomic_sequence_updownstream' ? (
            <GenomicSequence
              sequence={seq}
              upstream={upstream}
              downstream={downstream}
            />
          ) : mode === 'cds' ? (
            <CDSSequence cds={cds} sequence={seq} />
          ) : mode === 'cdna' ? (
            <CDNASequence
              model={model}
              exons={exons}
              cds={cds}
              utr={utr}
              sequence={seq}
            />
          ) : mode === 'protein' ? (
            <ProteinSequence cds={cds} codonTable={codonTable} sequence={seq} />
          ) : mode === 'gene' ? (
            <CDNASequence
              model={model}
              exons={exons}
              cds={cds}
              utr={utr}
              sequence={seq}
              includeIntrons
            />
          ) : mode === 'gene_collapsed_intron' ? (
            <CDNASequence
              model={model}
              exons={exons}
              cds={cds}
              sequence={seq}
              utr={utr}
              includeIntrons
              collapseIntron
            />
          ) : mode === 'gene_updownstream' ? (
            <CDNASequence
              model={model}
              exons={exons}
              cds={cds}
              sequence={seq}
              utr={utr}
              upstream={upstream}
              downstream={downstream}
              includeIntrons
            />
          ) : mode === 'gene_updownstream_collapsed_intron' ? (
            <CDNASequence
              model={model}
              exons={exons}
              cds={cds}
              sequence={seq}
              utr={utr}
              upstream={upstream}
              downstream={downstream}
              includeIntrons
              collapseIntron
            />
          ) : (
            <div>Unknown type</div>
          )}
        </div>
      </div>
    )
  },
)

export default SeqPanel
