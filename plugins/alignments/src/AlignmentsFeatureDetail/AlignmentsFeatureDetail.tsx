import React, { useState } from 'react'
import { Link, Paper } from '@mui/material'
import { observer } from 'mobx-react'
import copy from 'copy-to-clipboard'
import clone from 'clone'
import { FeatureDetails } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { IAnyStateTreeNode } from 'mobx-state-tree'

// locals
import { getTag, navToLoc } from './util'
import SupplementaryAlignments from './AlignmentsFeatureSuppAligns'
import AlignmentFlags from './AlignmentsFeatureFlags'

const omit = ['clipPos', 'flags']

const tags = {
  AM: 'The smallest template-independent mapping quality in the template',
  AS: 'Alignment score generated by aligner',
  BC: 'Barcode sequence identifying the sample',
  BQ: 'Offset to base alignment quality (BAQ)',
  BZ: 'Phred quality of the unique molecular barcode bases in the {OX} tag',
  CB: 'Cell identifier',
  CC: 'Reference name of the next hit',
  CM: 'Edit distance between the color sequence and the color reference (see also {NM})',
  CO: 'Free-text comments',
  CP: 'Leftmost coordinate of the next hit',
  CQ: 'Color read base qualities',
  CR: 'Cellular barcode sequence bases (uncorrected)',
  CS: 'Color read sequence',
  CT: 'Complete read annotation tag, used for consensus annotation dummy features',
  CY: 'Phred quality of the cellular barcode sequence in the {CR} tag',
  E2: 'The 2nd most likely base calls',
  FI: 'The index of segment in the template',
  FS: 'Segment suffix',
  FZ: 'Flow signal intensities',
  GC: 'Reserved for backwards compatibility reasons',
  GQ: 'Reserved for backwards compatibility reasons',
  GS: 'Reserved for backwards compatibility reasons',
  H0: 'Number of perfect hits',
  H1: 'Number of 1-difference hits (see also {NM})',
  H2: 'Number of 2-difference hits',
  HI: 'Query hit index',
  IH: 'Query hit total count',
  LB: 'Library',
  MC: 'CIGAR string for mate/next segment',
  MD: 'String encoding mismatched and deleted reference bases',
  MF: 'Reserved for backwards compatibility reasons',
  MI: 'Molecular identifier; a string that uniquely identifies the molecule from which the record was derived',
  ML: 'Base modification probabilities',
  MM: 'Base modifications / methylation ',
  MQ: 'Mapping quality of the mate/next segment',
  NH: 'Number of reported alignments that contain the query in the current record',
  NM: 'Edit distance to the reference',
  OA: 'Original alignment',
  OC: 'Original CIGAR (deprecated; use {OA} instead)',
  OP: 'Original mapping position (deprecated; use {OA} instead)',
  OQ: 'Original base quality',
  OX: 'Original unique molecular barcode bases',
  PG: 'Program',
  PQ: 'Phred likelihood of the template',
  PT: 'Read annotations for parts of the padded read sequence',
  PU: 'Platform unit',
  Q2: 'Phred quality of the mate/next segment sequence in the {R2} tag',
  QT: 'Phred quality of the sample barcode sequence in the {BC} tag',
  QX: 'Quality score of the unique molecular identifier in the {RX} tag',
  R2: 'Sequence of the mate/next segment in the template',
  RG: 'Read group',
  RT: 'Reserved for backwards compatibility reasons',
  RX: 'Sequence bases of the (possibly corrected) unique molecular identifier',
  S2: 'Reserved for backwards compatibility reasons',
  SA: 'Other canonical alignments in a chimeric alignment',
  SM: 'Template-independent mapping quality',
  SQ: 'Reserved for backwards compatibility reasons',
  TC: 'The number of segments in the template',
  TS: 'Transcript strand',
  U2: 'Phred probability of the 2nd call being wrong conditional on the best being wrong',
  UQ: 'Phred likelihood of the segment, conditional on the mapping being correct',
}

function Formatter({ value }: { value: unknown }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const display = String(value)
  return display.length > 100 ? (
    <>
      <button
        type="button"
        onClick={() => {
          copy(display)
          setCopied(true)
          setTimeout(() => setCopied(false), 700)
        }}
      >
        {copied ? 'Copied to clipboard' : 'Copy'}
      </button>
      <button type="button" onClick={() => setShow(val => !val)}>
        {show ? 'Show less' : 'Show more'}
      </button>
      <div>{show ? display : `${display.slice(0, 100)}...`}</div>
    </>
  ) : (
    <div>{display}</div>
  )
}

function PairLink({
  locString,
  model,
}: {
  locString: string
  model: IAnyStateTreeNode
}) {
  return (
    <Link
      onClick={event => {
        event.preventDefault()
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        navToLoc(locString, model)
      }}
      href="#"
    >
      {locString}
    </Link>
  )
}

const AlignmentsFeatureDetails = observer(function (props: {
  model: IAnyStateTreeNode
}) {
  const { model } = props
  const feat = clone(model.featureData)
  const SA = getTag('SA', feat) as string
  return (
    <Paper data-testid="alignment-side-drawer">
      <FeatureDetails
        {...props}
        omit={omit}
        // @ts-expect-error
        descriptions={{ ...tags, tags }}
        feature={feat}
        formatter={(value, key) =>
          key === 'next_segment_position' ? (
            <PairLink model={model} locString={value as string} />
          ) : (
            <Formatter value={value} />
          )
        }
      />
      {SA ? <SupplementaryAlignments model={model} tag={SA} /> : null}
      {feat.flags !== undefined ? (
        <AlignmentFlags feature={feat} {...props} />
      ) : null}
    </Paper>
  )
})

export default AlignmentsFeatureDetails
