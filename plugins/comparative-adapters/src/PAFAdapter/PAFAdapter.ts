import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { Feature } from '@jbrowse/core/util'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { unzip } from '@gmod/bgzf-filehandle'
import { MismatchParser } from '@jbrowse/plugin-alignments'

// locals
import SyntenyFeature from './SyntenyFeature'
import { isGzip } from '../util'
import {
  getWeightedMeans,
  flipCigar,
  parsePAF,
  swapIndelCigar,
  PAFRecord,
} from './util'

const { parseCigar } = MismatchParser

interface PAFOptions extends BaseOptions {
  config?: AnyConfigurationModel
}

export default class PAFAdapter extends BaseFeatureDataAdapter {
  private setupP?: Promise<PAFRecord[]>

  public static capabilities = ['getFeatures', 'getRefNames']

  async setup(opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch(e => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  async setupPre(opts?: BaseOptions) {
    const pm = this.pluginManager
    const pafLocation = openLocation(this.getConf('pafLocation'), pm)
    const buffer = (await pafLocation.readFile(opts)) as Buffer
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    // 512MB  max chrome string length is 512MB
    if (buf.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }
    const text = new TextDecoder('utf8', { fatal: true }).decode(buf)
    return parsePAF(text)
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures
    // so is not really that important, and has to be true or else
    // getFeatures is never called (BaseAdapter filters it out)
    return true
  }

  getAssemblyNames() {
    const assemblyNames = this.getConf('assemblyNames') as string[]
    if (assemblyNames.length === 0) {
      const query = this.getConf('queryAssembly') as string
      const target = this.getConf('targetAssembly') as string
      return [query, target]
    }
    return assemblyNames
  }

  async getRefNames(opts: BaseOptions = {}) {
    // @ts-ignore
    const r1 = opts.regions?.[0].assemblyName
    const feats = await this.setup(opts)

    const idx = this.getAssemblyNames().indexOf(r1)
    if (idx !== -1) {
      const set = new Set<string>()
      for (let i = 0; i < feats.length; i++) {
        set.add(idx === 0 ? feats[i].qname : feats[i].tname)
      }
      return Array.from(set)
    }
    console.warn('Unable to do ref renaming on adapter')
    return []
  }

  getFeatures(query: Region, opts: PAFOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      let pafRecords = await this.setup(opts)
      const { config } = opts

      // note: this is not the adapter config, it is responding to a display
      // setting passed in via the opts parameter
      if (config && readConfObject(config, 'colorBy') === 'meanQueryIdentity') {
        pafRecords = getWeightedMeans(pafRecords)
      }
      const assemblyNames = this.getAssemblyNames()

      // The index of the assembly name in the query list corresponds to the
      // adapter in the subadapters list
      const index = assemblyNames.indexOf(query.assemblyName)
      const { start: qstart, end: qend, refName: qref, assemblyName } = query
      if (index === -1) {
        console.warn(`${assemblyName} not found in this adapter`)
        observer.complete()
      }

      for (let i = 0; i < pafRecords.length; i++) {
        const r = pafRecords[i]
        let start = 0
        let end = 0
        let refName = ''
        let mateName = ''
        let mateStart = 0
        let mateEnd = 0
        const flip = index === 0
        const assemblyName = assemblyNames[+!flip]
        if (index === 0) {
          start = r.qstart
          end = r.qend
          refName = r.qname
          mateName = r.tname
          mateStart = r.tstart
          mateEnd = r.tend
        } else {
          start = r.tstart
          end = r.tend
          refName = r.tname
          mateName = r.qname
          mateStart = r.qstart
          mateEnd = r.qend
        }
        const { extra, strand } = r
        if (refName === qref && doesIntersect2(qstart, qend, start, end)) {
          const { numMatches = 0, blockLen = 1, cg, ...rest } = extra

          let CIGAR = extra.cg
          if (extra.cg) {
            if (flip && strand === -1) {
              CIGAR = flipCigar(parseCigar(extra.cg)).join('')
            } else if (flip) {
              CIGAR = swapIndelCigar(extra.cg)
            }
          }

          observer.next(
            new SyntenyFeature({
              uniqueId: i + assemblyName,
              assemblyName,
              start,
              end,
              type: 'match',
              refName,
              strand,
              ...rest,
              CIGAR,
              syntenyId: i,
              identity: numMatches / blockLen,
              numMatches,
              blockLen,
              mate: {
                start: mateStart,
                end: mateEnd,
                refName: mateName,
                assemblyName: assemblyNames[+flip],
              },
            }),
          )
        }
      }

      observer.complete()
    })
  }

  freeResources(/* { query } */): void {}
}
