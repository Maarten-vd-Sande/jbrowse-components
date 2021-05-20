/* eslint-disable @typescript-eslint/no-explicit-any */
/*  text-searching controller */
import BaseResult from './BaseResults'
import { AnyConfigurationModel } from '../configuration/configurationSchema'

import PluginManager from '../PluginManager'
import QuickLRU from '../util/QuickLRU'
import { searchType, BaseTextSearchAdapter } from '../data_adapters/BaseAdapter'
import { readConfObject } from '../configuration'

interface BaseArgs {
  searchType: searchType
  queryString: string
  signal?: AbortSignal
  limit?: number
  pageNumber?: number
}

interface Scope {
  aggregate: boolean
  assemblyNames: Array<string>
  openedTracks?: Array<string>
}

export default (pluginManager: PluginManager) => {
  return class TextSearchManager {
    adapterCache: QuickLRU

    textSearchAdapters: BaseTextSearchAdapter[]

    constructor() {
      this.textSearchAdapters = []
      this.adapterCache = new QuickLRU({
        maxSize: 15,
      })
    }

    /**
     * Instantiate/initialize list of relevant adapters
     */
    loadTextSearchAdapters(args: BaseArgs) {
      const adaptersToUse: BaseTextSearchAdapter[] = []
      // initialize relevant adapters
      this.relevantAdapters(args).forEach(
        (adapterConfig: AnyConfigurationModel) => {
          const adapterId = readConfObject(adapterConfig, 'textSearchAdapterId')
          if (this.adapterCache.has(adapterId)) {
            const adapterFromCache = this.adapterCache.get(adapterId)
            adaptersToUse.push(adapterFromCache)
          } else {
            const textSearchAdapterType = pluginManager.getTextSearchAdapterType(
              adapterConfig.type,
            )
            const textSearchAdapter = new textSearchAdapterType.AdapterClass(
              adapterConfig,
            ) as BaseTextSearchAdapter
            this.adapterCache.set(adapterId, textSearchAdapter)
            adaptersToUse.push(textSearchAdapter)
          }
        },
      )
      return adaptersToUse
    }

    /**
     * Returns list of relevant text search adapters to use
     * @param args - search options/arguments include: search query
     */
    relevantAdapters(scope: Scope) {
      // Note: (in the future we can add a condition to check if not aggregate
      // only return track text search adapters that cover relevant tracks,
      // for now only returning text search adapters that cover configured assemblies)
      // root level adapters and track adapters
      const { textSearchAdapters, tracks } = pluginManager.rootModel
        ?.jbrowse as any
      let trackTextSearchAdapters: BaseTextSearchAdapter[] = []
      tracks.forEach((trackTextSearchAdapterConfig: AnyConfigurationModel) => {
        const trackTextSearchAdapter = readConfObject(
          trackTextSearchAdapterConfig,
          'textSearchAdapter',
        )
        if (trackTextSearchAdapter.textSearchAdapterId !== 'placeholderId') {
          trackTextSearchAdapters.push(trackTextSearchAdapter)
        }
      })
      // get adapters that cover assemblies
      const rootTextSearchAdapters = this.getAdaptersWithAssemblies(
        scope.assemblyNames,
        textSearchAdapters,
      )
      trackTextSearchAdapters = this.getAdaptersWithAssemblies(
        scope.assemblyNames,
        trackTextSearchAdapters,
      )
      return rootTextSearchAdapters.concat(trackTextSearchAdapters)
    }

    getAdaptersWithAssemblies(
      scopeAssemblyNames: Array<string>,
      adapterList: Array<BaseTextSearchAdapter>,
    ) {
      const adaptersWithAssemblies = adapterList.filter(
        (adapterConf: AnyConfigurationModel) => {
          const adapterAssemblies = readConfObject(adapterConf, 'assemblies')
          const intersection = adapterAssemblies.filter(assembly =>
            scopeAssemblyNames.includes(assembly),
          )
          return intersection.length > 0
        },
      )
      return adaptersWithAssemblies
    }

    /**
     * Returns list of relevant results given a search query and options
     * @param args - search options/arguments include: search query
     * limit of results to return, searchType...preffix | full | exact", etc.
     */
    async search(args: BaseArgs, scope: Scope, rankSearchResults: Function) {
      // determine list of relevant adapters based on scope
      this.textSearchAdapters = this.loadTextSearchAdapters(scope)
      const results: Array<BaseResult[]> = await Promise.all(
        this.textSearchAdapters.map(async adapter => {
          // search with given search args
          const currentResults: BaseResult[] = await adapter.searchIndex(args)
          return currentResults
        }),
      )

      // aggregate and return relevant results
      const relevantResults = this.sortResults(
        results.flat(),
        rankSearchResults,
      )

      if (args.limit && relevantResults.length > 0) {
        return relevantResults.slice(0, args.limit)
      }
      return relevantResults
    }

    /**
     * Returns array of revelevant and sorted results
     * @param results - array of results from all text search adapters
     * @param rankSearchResults - function that updates results scores
     * based on more relevance
     */
    sortResults(results: BaseResult[], rankSearchResults: Function) {
      // first sort results in alphabetical order
      const sortedResults = results.sort(
        (a, b) => -b.getLabel().localeCompare(a.getLabel()),
      )
      // sort results based on score
      const sortedScoredResults = rankSearchResults(sortedResults).sort(
        function (result1: BaseResult, result2: BaseResult) {
          if (result1.getScore() < result2.getScore()) {
            return 1
          }
          if (result1.getScore() > result2.getScore()) {
            return -1
          }
          return 0
        },
      )
      return sortedScoredResults
    }
  }
}
