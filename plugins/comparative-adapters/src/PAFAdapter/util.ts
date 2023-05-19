import { zip } from '../util'

export interface PAFRecord {
  qname: string
  qstart: number
  qend: number
  tname: string
  tstart: number
  tend: number
  strand: number
  extra: {
    cg?: string
    blockLen?: number
    mappingQual: number
    numMatches?: number
    meanScore?: number
  }
}
// based on "weighted mean" method from https://github.com/tpoorten/dotPlotly
// License reproduced here
//
// MIT License

// Copyright (c) 2017 Tom Poorten

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Notes: in the weighted mean longer alignments factor in more heavily of all
// the fragments of a query vs the reference that it mapped to
//
// this uses a combined key query+'-'+ref to iteratively map all the alignments
// that match a particular ref from a particular query (so 1d array of what
// could be a 2d map)
//
// the result is a single number that says e.g. chr5 from human mapped to chr5
// on mouse with 0.8 quality, and that0.8 is then attached to all the pieces of
// chr5 on human that mapped to chr5 on mouse. if chr5 on human also more
// weakly mapped to chr6 on mouse, then it would have another value e.g. 0.6.
// this can show strong and weak levels of synteny, especially in polyploidy
// situations

export function getWeightedMeans(ret: PAFRecord[]) {
  const scoreMap: { [key: string]: { quals: number[]; len: number[] } } = {}
  for (let i = 0; i < ret.length; i++) {
    const entry = ret[i]
    const query = entry.qname
    const target = entry.tname
    const key = query + '-' + target
    if (!scoreMap[key]) {
      scoreMap[key] = { quals: [], len: [] }
    }
    scoreMap[key].quals.push(entry.extra.mappingQual)
    scoreMap[key].len.push(entry.extra.blockLen || 1)
  }

  const meanScoreMap = Object.fromEntries(
    Object.entries(scoreMap).map(([key, val]) => {
      const vals = zip(val.quals, val.len)
      return [key, weightedMean(vals)]
    }),
  )
  for (let i = 0; i < ret.length; i++) {
    const entry = ret[i]
    const query = entry.qname
    const target = entry.tname
    const key = query + '-' + target
    entry.extra.meanScore = meanScoreMap[key]
  }

  let min = 10000
  let max = 0
  for (let i = 0; i < ret.length; i++) {
    const entry = ret[i]
    min = Math.min(entry.extra.meanScore || 0, min)
    max = Math.max(entry.extra.meanScore || 0, max)
  }
  for (let i = 0; i < ret.length; i++) {
    const entry = ret[i]
    const b = entry.extra.meanScore || 0
    entry.extra.meanScore = (b - min) / (max - min)
  }

  return ret
}

// https://gist.github.com/stekhn/a12ed417e91f90ecec14bcfa4c2ae16a
function weightedMean(tuples: [number, number][]) {
  // eslint-disable-next-line unicorn/no-array-reduce
  const [valueSum, weightSum] = tuples.reduce(
    ([valueSum, weightSum], [value, weight]) => [
      valueSum + value * weight,
      weightSum + weight,
    ],
    [0, 0],
  )
  return valueSum / weightSum
}

export function parsePAFLine(line: string) {
  const [
    qname,
    ,
    qstart,
    qend,
    strand,
    tname,
    ,
    tstart,
    tend,
    numMatches,
    blockLen,
    mappingQual,
    ...fields
  ] = line.split('\t')

  const rest = Object.fromEntries(
    fields.map(field => {
      const r = field.indexOf(':')
      const fieldName = field.slice(0, r)
      const fieldValue = field.slice(r + 3)
      return [fieldName, fieldValue]
    }),
  )

  return {
    tname,
    tstart: +tstart,
    tend: +tend,
    qname,
    qstart: +qstart,
    qend: +qend,
    strand: strand === '-' ? -1 : 1,
    extra: {
      numMatches: +numMatches,
      blockLen: +blockLen,
      mappingQual: +mappingQual,
      ...rest,
    },
  } as PAFRecord
}

export function flipCigar(cigar: string[]) {
  const arr = []
  for (let i = cigar.length - 2; i >= 0; i -= 2) {
    arr.push(cigar[i])
    const op = cigar[i + 1]
    if (op === 'D') {
      arr.push('I')
    } else if (op === 'I') {
      arr.push('D')
    } else {
      arr.push(op)
    }
  }
  return arr
}

export function swapIndelCigar(cigar: string) {
  return cigar.replaceAll('D', 'K').replaceAll('I', 'D').replaceAll('K', 'I')
}
